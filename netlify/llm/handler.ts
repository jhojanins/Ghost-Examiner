import { buildDefensePrompt, defenseSchema, makeTag, parseDefenseRequest, type DefenseRequest } from '@ghost-examiner/core';

/**
 * The LLM proxy behind `/api/llm` (ghost-defense-live design §5, Req 11), as a pure handler: every
 * side effect comes in through `deps`, so tests run it with a fake request, a fake upstream and a
 * fake clock. `netlify/edge-functions/llm.ts` wires in the real ones.
 *
 * Checks, in order, each with its own status: POST (405), same-origin from this site or one of
 * its deploys (403), JSON content type (415), body size (413), shape and caps per task (400 or
 * 413), the kill switch (503 `disabled`) and the daily cap (429), both in Netlify Blobs. Then it
 * builds the prompt from the core templates and calls Gemini with the server key.
 * Upstream bodies are never forwarded; logs hold only the task, the status and the latency.
 */
/**
 * The Blobs store `llm-control` (design §2.3): `kill` ("on" stops the proxy), `cap` (requests per
 * UTC day, 300 when missing or invalid) and `count-YYYY-MM-DD` (a number). No user content, ever.
 */
export interface ControlStore {
  get(key: string): Promise<string | null>;
  getWithMetadata(key: string): Promise<{ data: string; etag?: string } | null>;
  set(key: string, value: string, options: { onlyIfNew: true } | { onlyIfMatch: string }): Promise<{ modified: boolean }>;
}

export interface LlmDeps {
  env: (name: string) => string | undefined;
  /** The Netlify site (`context.site`). */
  site: { name?: string; url?: string };
  fetch: typeof fetch;
  randomBytes: (n: number) => Uint8Array;
  now: () => number;
  log: (line: string) => void;
  control: ControlStore;
  /** Upstream timeout in ms. Below the client's 20 s, so the client gets our answer first. */
  timeoutMs?: number;
}

const BODY_MAX_BYTES = 24 * 1024;
const UPSTREAM_MAX_BYTES = 256 * 1024;
const TEXT_MAX_CHARS = 16_000;
const TIMEOUT_MS = 18_000;
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_CAP = 300; // owner decision 3
const WHOLE = /^\d+$/;

type ErrorCode = 'method' | 'forbidden' | 'media-type' | 'too-large' | 'bad-request' | 'disabled' | 'rate-limited' | 'unavailable' | 'bad-output';
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

/** The request body Gemini gets: the core prompt, the per-task output cap and the JSON schema. No tools. */
function geminiBody(req: DefenseRequest, deps: LlmDeps): string {
  const prompt = buildDefensePrompt(req, makeTag(deps.randomBytes(4)));
  return JSON.stringify({
    systemInstruction: { parts: [{ text: prompt.system }] },
    contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
    generationConfig: { maxOutputTokens: req.maxOutputTokens, responseMimeType: 'application/json', responseJsonSchema: defenseSchema(req) },
  });
}

const TEXT_HEADERS = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' };

async function callGemini(req: DefenseRequest, deps: LlmDeps, clientSignal: AbortSignal): Promise<Response> {
  const key = deps.env('GEMINI_API_KEY');
  const model = deps.env('GEMINI_MODEL');
  if (!key || !model || !MODEL_ID.test(model)) return fail(503, 'unavailable');
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  const signal = AbortSignal.any([timeout.signal, clientSignal]); // a client that goes away stops the call
  try {
    const upstream = await deps.fetch(`${GEMINI}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: geminiBody(req, deps),
      signal,
    });
    if (upstream.status === 429) return fail(429, 'rate-limited');
    if (!upstream.ok) return fail(502, 'unavailable');
    const raw = await readCapped(upstream.body, UPSTREAM_MAX_BYTES);
    const text = raw === undefined ? undefined : modelText(raw);
    if (text === undefined) return fail(502, 'bad-output');
    return new Response(text, { status: 200, headers: TEXT_HEADERS });
  } catch {
    return timeout.signal.aborted ? fail(504, 'unavailable') : fail(502, 'unavailable');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Text deltas from Gemini's SSE stream: each `data:` line is a GenerateContentResponse; thought
 * parts are left out. Ends at the first event whose `finishReason` isn't STOP (blocked or cut),
 * at a line that isn't JSON, or at the end of the stream.
 */
async function* deltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true }); // a character split across chunks stays whole
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        let event: { candidates?: { finishReason?: string; content?: { parts?: { text?: unknown; thought?: boolean }[] } }[] };
        try {
          event = JSON.parse(line.slice(5));
        } catch {
          return;
        }
        const candidate = event.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text as string).join('');
        if (text) yield text;
        if (candidate?.finishReason) return; // STOP ends it normally; anything else ends it early
      }
    }
  } finally {
    reader.releaseLock();
    await body.cancel().catch(() => {});
  }
}

/**
 * `/api/llm/stream` (design §5, Req 5.1): the reply's text as a plain-text stream. It waits for the
 * first text delta before answering, so failures before it keep their status codes and the
 * timeout covers the time to the first byte. Afterwards a problem only ends the stream early,
 * which the client reads as a cut (Req 10.5). Total text is capped at 16,000 characters.
 */
async function streamGemini(req: DefenseRequest, deps: LlmDeps, clientSignal: AbortSignal): Promise<Response> {
  const key = deps.env('GEMINI_API_KEY');
  const model = deps.env('GEMINI_MODEL');
  if (!key || !model || !MODEL_ID.test(model)) return fail(503, 'unavailable');
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  const upstreamAbort = new AbortController();
  const signal = AbortSignal.any([timeout.signal, clientSignal, upstreamAbort.signal]);
  let source: AsyncGenerator<string>;
  let first: IteratorResult<string>;
  try {
    const upstream = await deps.fetch(`${GEMINI}/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: geminiBody(req, deps),
      signal,
    });
    if (upstream.status === 429) return fail(429, 'rate-limited');
    if (!upstream.ok || !upstream.body) return fail(502, 'unavailable');
    source = deltas(upstream.body);
    first = await source.next();
    if (first.done) return fail(502, 'bad-output');
  } catch {
    return timeout.signal.aborted ? fail(504, 'unavailable') : fail(502, 'unavailable');
  } finally {
    clearTimeout(timer);
  }
  const encoder = new TextEncoder();
  let sent = 0;
  const stop = () => {
    upstreamAbort.abort();
    void source.return(undefined);
  };
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const head = first.value.slice(0, TEXT_MAX_CHARS);
        sent = head.length;
        controller.enqueue(encoder.encode(head));
      },
      async pull(controller) {
        try {
          const next = await source.next();
          if (next.done || sent + next.value.length > TEXT_MAX_CHARS) {
            stop();
            controller.close();
            return;
          }
          sent += next.value.length;
          controller.enqueue(encoder.encode(next.value));
        } catch {
          stop();
          controller.close(); // a cut: the client falls back for the rest of the turn
        }
      },
      cancel: stop, // the client went away: stop the upstream call
    }),
    { status: 200, headers: TEXT_HEADERS },
  );
}

/**
 * The kill switch, then the daily cap. A request under the cap is counted with a conditional
 * write; on an ETag conflict it re-reads and tries once more, and on a second conflict it goes
 * through, so the count is approximate under bursts. Gemini's own daily quota is a second cap.
 */
async function admit(store: ControlStore, now: number): Promise<'ok' | 'disabled' | 'capped'> {
  const [kill, capText] = await Promise.all([store.get('kill'), store.get('cap')]);
  if (kill?.trim().toLowerCase() === 'on') return 'disabled';
  const cap = WHOLE.test(capText?.trim() ?? '') ? Number(capText?.trim()) : DEFAULT_CAP;
  const key = `count-${new Date(now).toISOString().slice(0, 10)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await store.getWithMetadata(key);
    const count = current && WHOLE.test(current.data) ? Number(current.data) : 0;
    if (count >= cap) return 'capped';
    const next = String(count + 1);
    const write = current?.etag ? await store.set(key, next, { onlyIfMatch: current.etag }) : await store.set(key, next, { onlyIfNew: true });
    if (write.modified) return 'ok';
  }
  return 'ok';
}

async function route(req: Request, deps: LlmDeps, seen: { task: string | null }, started: number): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method', { allow: 'POST' });
  const streaming = new URL(req.url).pathname.endsWith('/stream');
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
  if (streaming && parsed.value.task !== 'defense-reply') return fail(400, 'bad-request'); // only replies are spoken as they arrive
  let gate: Awaited<ReturnType<typeof admit>>;
  try {
    gate = await admit(deps.control, started);
  } catch {
    return fail(503, 'unavailable'); // fail closed: without the store, no kill switch and no cap
  }
  if (gate === 'disabled') return fail(503, 'disabled');
  if (gate === 'capped') return fail(429, 'rate-limited');
  return streaming ? streamGemini(parsed.value, deps, req.signal) : callGemini(parsed.value, deps, req.signal);
}

export async function handleLlm(req: Request, deps: LlmDeps): Promise<Response> {
  const started = deps.now();
  const seen: { task: string | null } = { task: null };
  const res = await route(req, deps, seen, started);
  // Only the task, the status and the latency: never a body, a key or a header (Req 11.5, 12.2).
  deps.log(JSON.stringify({ task: seen.task, status: res.status, ms: deps.now() - started }));
  return res;
}
