import { buildDefensePrompt, defenseSchema, makeTag, parseDefenseRequest, type DefenseRequest } from '@ghost-examiner/core';

/**
 * The LLM proxy behind `/api/llm` (ghost-defense-live design §5, Req 11), as a pure handler: every
 * side effect comes in through `deps`, so tests run it with a fake request, a fake upstream and a
 * fake clock. `netlify/edge-functions/llm.ts` wires in the real ones.
 *
 * Checks, in order, each with its own status: POST (405), same-origin from this site or one of
 * its deploys (403), JSON content type (415), body size (413), shape and caps per task (400 or
 * 413). Then it builds the prompt from the core templates and calls Gemini with the server key.
 * Upstream bodies are never forwarded; logs hold only the task, the status and the latency.
 */
export interface LlmDeps {
  env: (name: string) => string | undefined;
  /** The Netlify site (`context.site`). */
  site: { name?: string; url?: string };
  fetch: typeof fetch;
  randomBytes: (n: number) => Uint8Array;
  now: () => number;
  log: (line: string) => void;
  /** Upstream timeout in ms. Below the client's 20 s, so the client gets our answer first. */
  timeoutMs?: number;
}

const BODY_MAX_BYTES = 24 * 1024;
const UPSTREAM_MAX_BYTES = 256 * 1024;
const TEXT_MAX_CHARS = 16_000;
const TIMEOUT_MS = 18_000;
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

type ErrorCode = 'method' | 'forbidden' | 'media-type' | 'too-large' | 'bad-request' | 'rate-limited' | 'unavailable' | 'bad-output';
const fail = (status: number, error: ErrorCode, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

/** Same origin as the request, and that host is this site, its subdomain or one of its deploys. */
function allowedOrigin(req: Request, site: LlmDeps['site']): boolean {
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin) return false;
  const { protocol, hostname } = new URL(origin);
  if (protocol !== 'https:') return false;
  if (site.url && hostname === new URL(site.url).hostname) return true;
  if (!site.name || !/^[a-z0-9-]+$/.test(site.name)) return false;
  return hostname === `${site.name}.netlify.app` || new RegExp(`^[a-z0-9-]+--${site.name}\\.netlify\\.app$`).test(hostname);
}

/** Reads a body up to `max` bytes; undefined when it is larger. */
async function readCapped(body: ReadableStream<Uint8Array> | null, max: number): Promise<string | undefined> {
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** The model's text: the non-thought text parts of the first candidate, when it stopped normally. */
function modelText(raw: string): string | undefined {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const candidate = (data as { candidates?: { finishReason?: string; content?: { parts?: { text?: unknown; thought?: boolean }[] } }[] }).candidates?.[0];
  if (candidate?.finishReason !== 'STOP') return undefined;
  const text = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('');
  return text === '' || text.length > TEXT_MAX_CHARS ? undefined : text;
}

async function callGemini(req: DefenseRequest, deps: LlmDeps, clientSignal: AbortSignal): Promise<Response> {
  const key = deps.env('GEMINI_API_KEY');
  const model = deps.env('GEMINI_MODEL');
  if (!key || !model || !MODEL_ID.test(model)) return fail(503, 'unavailable');
  const prompt = buildDefensePrompt(req, makeTag(deps.randomBytes(4)));
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  const signal = AbortSignal.any([timeout.signal, clientSignal]); // a client that goes away stops the call
  try {
    const upstream = await deps.fetch(`${GEMINI}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        generationConfig: {
          maxOutputTokens: req.maxOutputTokens,
          responseMimeType: 'application/json',
          responseJsonSchema: defenseSchema(req),
        },
      }),
      signal,
    });
    if (upstream.status === 429) return fail(429, 'rate-limited');
    if (!upstream.ok) return fail(502, 'unavailable');
    const raw = await readCapped(upstream.body, UPSTREAM_MAX_BYTES);
    const text = raw === undefined ? undefined : modelText(raw);
    if (text === undefined) return fail(502, 'bad-output');
    return new Response(text, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  } catch {
    return timeout.signal.aborted ? fail(504, 'unavailable') : fail(502, 'unavailable');
  } finally {
    clearTimeout(timer);
  }
}

async function route(req: Request, deps: LlmDeps, seen: { task: string | null }): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method', { allow: 'POST' });
  if (!allowedOrigin(req, deps.site)) return fail(403, 'forbidden');
  if (!/^application\/json(\s*;|$)/i.test(req.headers.get('content-type') ?? '')) return fail(415, 'media-type');
  if (Number(req.headers.get('content-length') ?? 0) > BODY_MAX_BYTES) return fail(413, 'too-large');
  const raw = await readCapped(req.body, BODY_MAX_BYTES);
  if (raw === undefined) return fail(413, 'too-large');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'bad-request');
  }
  const parsed = parseDefenseRequest(body);
  if (!parsed.ok) return parsed.reason === 'too-large' ? fail(413, 'too-large') : fail(400, 'bad-request');
  seen.task = parsed.value.task;
  return callGemini(parsed.value, deps, req.signal);
}

export async function handleLlm(req: Request, deps: LlmDeps): Promise<Response> {
  const started = deps.now();
  const seen: { task: string | null } = { task: null };
  const res = await route(req, deps, seen);
  // Only the task, the status and the latency: never a body, a key or a header (Req 11.5, 12.2).
  deps.log(JSON.stringify({ task: seen.task, status: res.status, ms: deps.now() - started }));
  return res;
}
