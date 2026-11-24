import { describe, expect, it, vi } from 'vitest';
import { config } from '../edge-functions/llm.ts';
import { handleLlm, type ControlStore, type LlmDeps } from './handler.ts';

/**
 * A fake of the Netlify Blobs store `llm-control` (design §2.3): text values with ETags and the
 * two conditional writes. `conflicts` makes the next N conditional writes lose a race.
 */
function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map<string, { value: string; etag: string }>(Object.entries(initial).map(([k, v]) => [k, { value: v, etag: '"0"' }]));
  let version = 0;
  const writes: { key: string; value: string; options: object }[] = [];
  const store = {
    conflicts: 0,
    failing: false,
    data,
    writes,
    async get(key: string) {
      if (store.failing) throw new Error('blobs down');
      return data.get(key)?.value ?? null;
    },
    async getWithMetadata(key: string) {
      if (store.failing) throw new Error('blobs down');
      const e = data.get(key);
      return e ? { data: e.value, etag: e.etag } : null;
    },
    async set(key: string, value: string, options: { onlyIfNew: true } | { onlyIfMatch: string }) {
      writes.push({ key, value, options });
      if (store.conflicts > 0) {
        store.conflicts--;
        data.set(key, { value: String(Number(data.get(key)?.value ?? 0) + 1), etag: `"c${++version}"` }); // another request won
        return { modified: false };
      }
      const current = data.get(key);
      const ok = 'onlyIfNew' in options ? current === undefined : current?.etag === options.onlyIfMatch;
      if (ok) data.set(key, { value, etag: `"${++version}"` });
      return { modified: ok };
    },
  } satisfies ControlStore & Record<string, unknown>;
  return store;
}

// Fictional site, key and bodies (test data only). The key is not a real key format.
const SITE = { name: 'ghost-examiner', url: 'https://ghost-examiner.netlify.app' };
const BRANCH = 'https://main--ghost-examiner.netlify.app';
const KEY = 'test-key-not-real-0001';
const excerpts = [
  { id: 'e1', text: 'We chose a queue because the payment service was slow.' },
  { id: 'e2', text: 'Checkout now answers in under one second.' },
];
const BODIES = {
  'defense-questions': { task: 'defense-questions', locale: 'en', input: { excerpts, count: 4, fileLang: 'en' } },
  'defense-reply': {
    task: 'defense-reply',
    locale: 'en',
    input: { excerpts, question: 'Why a queue?', quote: 'We chose a queue', answer: 'SECRET-ANSWER because it was slow.', followUpAllowed: true },
  },
  'defense-summary': { task: 'defense-summary', locale: 'es', input: { excerpts, turns: [{ question: 'Why?', answer: 'It was slow.', kind: 'correction' }] } },
} as const;
const MODEL_TEXT = '{"questions":[]}';
const gemini = (text = MODEL_TEXT, finishReason = 'STOP') =>
  new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function setup(over: Partial<LlmDeps> = {}, upstream: (init?: RequestInit) => Promise<Response> = async () => gemini()) {
  const calls: { url: string; init: RequestInit }[] = [];
  const logs: string[] = [];
  let clock = 1000;
  const deps: LlmDeps = {
    env: (name) => ({ GEMINI_API_KEY: KEY, GEMINI_MODEL: 'gemini-3.5-flash-lite' })[name],
    site: SITE,
    fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return upstream(init);
    }) as unknown as typeof fetch,
    randomBytes: (n) => new Uint8Array(n).fill(0xab),
    now: () => (clock += 25),
    log: (line) => logs.push(line),
    timeoutMs: 1000,
    control: fakeStore(),
    ...over,
  };
  return { deps, calls, logs };
}
function post(body: unknown, { origin = BRANCH, host = BRANCH, type = 'application/json', headers = {} as Record<string, string>, signal = undefined as AbortSignal | undefined, path = '/api/llm' } = {}) {
  const h: Record<string, string> = { 'content-type': type, ...headers };
  if (origin) h.origin = origin;
  return new Request(`${host}${path}`, { method: 'POST', headers: h, body: typeof body === 'string' ? body : JSON.stringify(body), signal });
}
const errorOf = async (r: Response) => ((await r.json()) as { error: string }).error;

describe('Edge Function /api/llm: config (design §5, Req 11.1)', () => {
  it('serves /api/llm and /api/llm/stream with the per-IP and domain rate limit', () => {
    expect(config.path).toEqual(['/api/llm', '/api/llm/stream']);
    expect(config.rateLimit).toEqual({ windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] });
  });
});

describe('Edge Function /api/llm: request checks, in order (design §5)', () => {
  it('405 for anything but POST', async () => {
    const { deps, calls } = setup();
    const r = await handleLlm(new Request(`${BRANCH}/api/llm`, { headers: { origin: BRANCH } }), deps);
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toBe('POST');
    expect(calls).toHaveLength(0);
  });
  it('403 without an Origin, from another site, or from another Netlify project; allowed from the site, a branch deploy and a deploy preview', async () => {
    const { deps } = setup();
    expect((await handleLlm(post(BODIES['defense-questions'], { origin: '' }), deps)).status).toBe(403);
    // Same-origin requests, but to a host that is not this site or one of its deploys.
    for (const origin of ['https://evil.example', 'https://main--other.netlify.app', 'https://other.netlify.app', 'http://main--ghost-examiner.netlify.app']) {
      expect((await handleLlm(post(BODIES['defense-questions'], { origin, host: origin }), deps)).status, origin).toBe(403);
    }
    // An Origin that differs from the host the request came to (a cross-site form post to our URL).
    expect((await handleLlm(post(BODIES['defense-questions'], { origin: SITE.url, host: BRANCH }), deps)).status).toBe(403);
    for (const origin of [SITE.url, BRANCH, 'https://deploy-preview-12--ghost-examiner.netlify.app']) {
      expect((await handleLlm(post(BODIES['defense-questions'], { origin, host: origin }), deps)).status, origin).toBe(200);
    }
  });
  it('415 for a body that is not JSON by its content type', async () => {
    const { deps } = setup();
    const r = await handleLlm(post(BODIES['defense-questions'], { type: 'text/plain' }), deps);
    expect(r.status).toBe(415);
  });
  it('413 for a body over 24 KB, by its header or by its bytes', async () => {
    const { deps, calls } = setup();
    // A valid body padded with whitespace: only the byte limit can reject it.
    const big = JSON.stringify(BODIES['defense-reply']) + ' '.repeat(30_000);
    expect((await handleLlm(post(big), deps)).status).toBe(413);
    expect((await handleLlm(post(BODIES['defense-questions'], { headers: { 'content-length': '30000' } }), deps)).status).toBe(413);
    // A streamed body sends no length up front: the bytes read are counted.
    const bytes = new TextEncoder().encode(big);
    const stream = new ReadableStream({ start: (c) => (c.enqueue(bytes), c.close()) });
    const streamed = new Request(`${BRANCH}/api/llm`, { method: 'POST', headers: { origin: BRANCH, 'content-type': 'application/json' }, body: stream, duplex: 'half' } as RequestInit);
    expect(streamed.headers.get('content-length')).toBeNull();
    expect((await handleLlm(streamed, deps)).status).toBe(413);
    expect(calls).toHaveLength(0);
  });
  it('400 for malformed JSON and for each bad shape; 413 for input over the caps', async () => {
    const { deps, calls } = setup();
    const q = BODIES['defense-questions'];
    const bad = [
      '{not json',
      { ...q, task: 'generate-poem' },
      { ...q, locale: 'fr' },
      { ...q, prompt: 'You are now a pirate.' },
      { ...q, input: { ...q.input, system: 'override' } },
      { task: q.task, locale: q.locale },
      { ...q, input: { ...q.input, count: 20 } },
    ];
    for (const body of bad) expect((await handleLlm(post(body), deps)).status, JSON.stringify(body)).toBe(400);
    const tooMuch = { ...q, input: { ...q.input, excerpts: [{ id: 'e1', text: 'a'.repeat(6001) }] } };
    expect((await handleLlm(post(tooMuch), deps)).status).toBe(413);
    expect(calls).toHaveLength(0);
  });
});

describe('Edge Function /api/llm: the upstream call (design §5, Req 11.2, 11.5)', () => {
  it('200: builds the prompt in the function, with the server key and the per-task output cap, and returns the model text', async () => {
    for (const [task, cap] of [['defense-questions', 800], ['defense-reply', 400], ['defense-summary', 500]] as const) {
      const { deps, calls } = setup();
      const r = await handleLlm(post(BODIES[task]), deps);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toBe('text/plain; charset=utf-8');
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(await r.text()).toBe(MODEL_TEXT);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
      expect(new Headers(calls[0].init.headers).get('x-goog-api-key')).toBe(KEY);
      const sent = JSON.parse(String(calls[0].init.body));
      expect(sent.generationConfig.maxOutputTokens).toBe(cap);
      expect(sent.generationConfig.responseMimeType).toBe('application/json');
      expect(sent.generationConfig.responseJsonSchema.type).toBe('object');
      expect(sent.systemInstruction.parts[0].text).toContain('You are the Ghost Examiner');
      expect(sent.contents[0].parts[0].text).toContain('<doc-abababab id="e1">');
      expect(Object.keys(sent).sort()).toEqual(['contents', 'generationConfig', 'systemInstruction']); // no tools
    }
  });
  it('maps an upstream 429 to 429 and other failures to 502, never forwarding the upstream body', async () => {
    const leak = 'quota exceeded for project 12345, key test-key-not-real-0001';
    for (const [status, expected, error] of [[429, 429, 'rate-limited'], [500, 502, 'unavailable'], [403, 502, 'unavailable'], [400, 502, 'unavailable']] as const) {
      const { deps } = setup({}, async () => new Response(leak, { status }));
      const r = await handleLlm(post(BODIES['defense-reply']), deps);
      expect(r.status).toBe(expected);
      const text = await r.text();
      expect(JSON.parse(text)).toEqual(error === 'unavailable' ? { error, why: 'upstream' } : { error });
      expect(text).not.toContain('12345');
    }
    const { deps } = setup({}, async () => Promise.reject(new TypeError('network down')));
    expect((await handleLlm(post(BODIES['defense-reply']), deps)).status).toBe(502);
  });
  it('times out a slow upstream with 504, aborting the call', async () => {
    let signal: AbortSignal | undefined;
    const { deps } = setup({ timeoutMs: 30 }, (init) => {
      signal = init?.signal ?? undefined;
      return new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    });
    const r = await handleLlm(post(BODIES['defense-reply']), deps);
    expect(r.status).toBe(504);
    expect(await r.json()).toEqual({ error: 'unavailable', why: 'upstream' });
    expect(signal?.aborted).toBe(true);
  });
  it('aborts the upstream call when the client goes away', async () => {
    const client = new AbortController();
    let signal: AbortSignal | undefined;
    const { deps } = setup({}, (init) => {
      signal = init?.signal ?? undefined;
      client.abort();
      return Promise.reject(new DOMException('aborted', 'AbortError')); // the abort reached the upstream call
    });
    const r = await handleLlm(post(BODIES['defense-reply'], { signal: client.signal }), deps);
    expect(signal?.aborted).toBe(true);
    expect(r.status).toBe(502); // nobody reads it; not a timeout
  });
  it('502 bad-output for a cut, blocked, empty or oversized model answer', async () => {
    const cases = [
      gemini(MODEL_TEXT, 'MAX_TOKENS'),
      gemini(MODEL_TEXT, 'SAFETY'),
      new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }),
      new Response('not json', { status: 200 }),
      gemini(''),
      gemini('x'.repeat(16_001)),
    ];
    for (const res of cases) {
      const { deps } = setup({}, async () => res);
      const r = await handleLlm(post(BODIES['defense-questions']), deps);
      expect(r.status).toBe(502);
      expect(await errorOf(r)).toBe('bad-output');
    }
  });
  it('leaves out thought parts and joins the text parts', async () => {
    const res = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking...', thought: true }, { text: '{"a":' }, { text: '1}' }] }, finishReason: 'STOP' }] }), { status: 200 });
    const { deps } = setup({}, async () => res);
    expect(await (await handleLlm(post(BODIES['defense-questions']), deps)).text()).toBe('{"a":1}');
  });
  it('uses gemini-3.5-flash-lite when GEMINI_MODEL is not set or empty', async () => {
    for (const env of [{ GEMINI_API_KEY: KEY }, { GEMINI_API_KEY: KEY, GEMINI_MODEL: '' }] as Record<string, string>[]) {
      const { deps, calls } = setup({ env: (n) => env[n] });
      expect((await handleLlm(post(BODIES['defense-questions']), deps)).status).toBe(200);
      expect(calls[0].url).toContain('/models/gemini-3.5-flash-lite:generateContent');
    }
  });
  it('503 when the key is missing or the model name is not a plain id; nothing is called', async () => {
    for (const env of [{}, { GEMINI_MODEL: 'gemini-3.5-flash-lite' }, { GEMINI_API_KEY: KEY, GEMINI_MODEL: '../evil?x=' }] as Record<string, string>[]) {
      const { deps, calls } = setup({ env: (n) => env[n] });
      const r = await handleLlm(post(BODIES['defense-questions']), deps);
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error: 'unavailable', why: 'config' }); // a fixed code, never a value
      expect(calls).toHaveLength(0);
    }
  });
});

describe('Edge Function /api/llm: logs (Req 11.5, 12.2)', () => {
  it("adds Gemini's numeric status to the log line, never its body; the response body stays the same", async () => {
    for (const [status, up] of [[429, 429], [500, 500], [403, 403]] as const) {
      const { deps, logs } = setup({}, async () => new Response('quota 12345 for key test-key-not-real-0001', { status }));
      const r = await handleLlm(post(BODIES['defense-reply']), deps);
      expect(JSON.parse(logs[0])).toMatchObject({ up });
      expect(logs[0]).not.toContain('12345');
      expect(Object.keys(await r.json())).not.toContain('up');
    }
    const { deps, logs } = setup({}, async () => Promise.reject(new TypeError('network down')));
    await handleLlm(post(BODIES['defense-reply']), deps);
    expect(JSON.parse(logs[0])).toMatchObject({ up: 0 });
  });
  it('logs one line per request with only the task, the status and the latency', async () => {
    const { deps, logs } = setup();
    await handleLlm(post(BODIES['defense-reply']), deps);
    await handleLlm(post('{not json'), deps);
    expect(logs.map((l) => JSON.parse(l))).toEqual([
      { task: 'defense-reply', status: 200, ms: 25, up: 200 }, // up: Gemini's status, a number only
      { task: null, status: 400, ms: 25 }, // no upstream call, no up
    ]);
    for (const line of logs) {
      expect(line).not.toContain('SECRET-ANSWER');
      expect(line).not.toContain(KEY);
    }
  });
});

describe('Edge Function /api/llm: kill switch and daily cap in Netlify Blobs (design §2.3, Req 11.3, 11.4)', () => {
  const NOW = Date.UTC(2026, 10, 19, 23, 59, 30); // 2026-11-19, 30 s before midnight UTC
  const day = (store: ReturnType<typeof fakeStore>) => store.data.get('count-2026-11-19')?.value;
  const run = (store: ReturnType<typeof fakeStore>, body: unknown = BODIES['defense-reply']) => {
    const { deps, calls } = setup({ control: store, now: () => NOW });
    return handleLlm(post(body), deps).then(async (r) => ({ status: r.status, error: r.status === 200 ? undefined : await errorOf(r), calls: calls.length }));
  };
  it('the kill switch returns 503 disabled before any count or upstream call', async () => {
    const store = fakeStore({ kill: 'on' });
    expect(await run(store)).toEqual({ status: 503, error: 'disabled', calls: 0 });
    expect(store.writes).toEqual([]);
    for (const off of ['off', '', 'no']) expect((await run(fakeStore({ kill: off }))).status, off).toBe(200);
    expect((await run(fakeStore({ kill: ' ON\n' }))).status).toBe(503);
  });
  it('counts each request that goes upstream in a key per UTC day, starting with a create-only write', async () => {
    const store = fakeStore();
    await run(store);
    await run(store);
    expect(day(store)).toBe('2');
    expect(store.writes.map((w) => w.options)).toEqual([{ onlyIfNew: true }, { onlyIfMatch: '"1"' }]);
    await run(store, { task: 'defense-reply' }); // rejected before the count
    expect(day(store)).toBe('2');
  });
  it('returns 429 at the cap from the cap key, without calling upstream', async () => {
    const store = fakeStore({ cap: '2' });
    expect((await run(store)).status).toBe(200);
    expect((await run(store)).status).toBe(200);
    expect(await run(store)).toEqual({ status: 429, error: 'rate-limited', calls: 0 });
    expect(day(store)).toBe('2');
  });
  it('uses 300 when the cap is missing or not a whole number', async () => {
    for (const cap of [undefined, 'abc', '-5', '1.5', '']) {
      const store = fakeStore({ ...(cap !== undefined && { cap }), 'count-2026-11-19': '299' });
      expect((await run(store)).status, String(cap)).toBe(200);
      expect((await run(store)).status, String(cap)).toBe(429);
    }
    expect((await run(fakeStore({ cap: '0' }))).status).toBe(429); // 0 is a valid cap: AI off for the day
  });
  it('retries once on an ETag conflict; on a second conflict it lets the request through', async () => {
    const once = fakeStore({ 'count-2026-11-19': '5' });
    once.conflicts = 1;
    expect((await run(once)).status).toBe(200);
    expect(day(once)).toBe('7'); // the other request's count, then ours
    expect(once.writes).toHaveLength(2);
    const twice = fakeStore({ 'count-2026-11-19': '5' });
    twice.conflicts = 2;
    expect((await run(twice)).status).toBe(200);
    expect(twice.writes).toHaveLength(2); // no third try: the count is approximate under bursts
  });
  it('stores no user content: only the day counter, holding digits', async () => {
    const store = fakeStore();
    await run(store);
    await run(store, BODIES['defense-questions']);
    expect([...store.data.keys()]).toEqual(['count-2026-11-19']);
    for (const w of store.writes) expect(w.value).toMatch(/^\d+$/);
  });
  it('fails closed with 503 when the store cannot be read', async () => {
    const store = fakeStore();
    store.failing = true;
    expect(await run(store)).toEqual({ status: 503, error: 'unavailable', calls: 0 });
    const { deps } = setup({ control: store });
    expect(await (await handleLlm(post(BODIES['defense-reply']), deps)).json()).toEqual({ error: 'unavailable', why: 'store' });
  });
});

describe('Edge Function /api/llm/stream: streamed replies (design §5, task 22)', () => {
  const sse = (events: unknown[], { split = 0, raw = '' } = {}) => {
    const text = events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join('') + raw;
    const bytes = new TextEncoder().encode(text);
    const step = split || bytes.length;
    return new Response(
      new ReadableStream({
        start(c) {
          for (let i = 0; i < bytes.length; i += step) c.enqueue(bytes.slice(i, i + step));
          c.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  };
  const part = (text: string, extra: object = {}) => ({ candidates: [{ content: { parts: [{ text, ...extra }] }, ...extra }] });
  const done = (text: string) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });
  const stream = (deps: LlmDeps, body: unknown = BODIES['defense-reply'], signal?: AbortSignal) => handleLlm(post(body, { path: '/api/llm/stream', signal }), deps);

  it('pipes the text deltas of the SSE events as plain text, in order, for any byte split', async () => {
    for (const split of [0, 1, 7]) {
      const { deps, calls } = setup({}, async () => sse([part('{"kind":"ackno'), part('wledgment","say":'), done('["Muy «bien», está claro."]}')], { split }));
      const r = await stream(deps);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toBe('text/plain; charset=utf-8');
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(await r.text()).toBe('{"kind":"acknowledgment","say":["Muy «bien», está claro."]}'); // multi-byte characters split by bytes stay whole
      expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse');
      expect(JSON.parse(String(calls[0].init.body)).generationConfig.maxOutputTokens).toBe(400);
    }
  });
  it('leaves out thought parts', async () => {
    const { deps } = setup({}, async () => sse([part('thinking about it', { thought: true }), done('{"a":1}')]));
    expect(await (await stream(deps)).text()).toBe('{"a":1}');
  });
  it('streams replies only: questions and summaries are refused here (400), before any upstream call or count', async () => {
    const store = fakeStore();
    const { deps, calls } = setup({ control: store });
    expect((await stream(deps, BODIES['defense-questions'])).status).toBe(400);
    expect((await stream(deps, BODIES['defense-summary'])).status).toBe(400);
    expect(calls).toHaveLength(0);
    expect(store.writes).toEqual([]);
  });
  it('the same checks and gate as /api/llm: origin, size, kill switch, cap, upstream errors before the first byte', async () => {
    const { deps } = setup();
    expect((await handleLlm(post(BODIES['defense-reply'], { path: '/api/llm/stream', origin: 'https://evil.example', host: 'https://evil.example' }), deps)).status).toBe(403);
    expect((await stream(setup({ control: fakeStore({ kill: 'on' }) }).deps)).status).toBe(503);
    expect((await stream(setup({ control: fakeStore({ cap: '0' }) }).deps)).status).toBe(429);
    expect((await stream(setup({}, async () => new Response('quota 12345', { status: 429 })).deps)).status).toBe(429);
    const r = await stream(setup({}, async () => new Response('secret detail 12345', { status: 500 })).deps);
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain('12345');
  });
  it('ends the stream early (a cut, not an error body) when the model stops abnormally, sends no text, or passes the byte cap', async () => {
    const blocked = setup({}, async () => sse([part('{"kind":"ack'), { candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] }, part('nowledgment"}')]));
    expect(await (await stream(blocked.deps)).text()).toBe('{"kind":"ack');
    const nothing = setup({}, async () => sse([{ candidates: [{ finishReason: 'STOP' }] }]));
    expect((await stream(nothing.deps)).status).toBe(502); // nothing at all: an error before the first byte
    const big = setup({}, async () => sse([part('x'.repeat(10_000)), part('y'.repeat(10_000)), done('z')]));
    const text = await (await stream(big.deps)).text();
    expect(text.length).toBeLessThanOrEqual(16_000);
    expect(text).not.toContain('z');
    const junk = setup({}, async () => sse([part('{"a":')], { raw: `data: {not json\n\ndata: ${JSON.stringify(part('1}'))}\n\n` }));
    expect(await (await stream(junk.deps)).text()).toBe('{"a":');
  });
  it('aborts the upstream call when the client goes away mid-stream', async () => {
    let upstreamSignal: AbortSignal | undefined;
    const { deps } = setup({}, async (init) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(part('{"kind":'))}\n\n`)); // then nothing more
          },
        }),
        { status: 200 },
      );
    });
    const r = await stream(deps);
    const reader = r.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('{"kind":');
    await reader.cancel(); // the platform cancels the body when the client disconnects
    expect(upstreamSignal?.aborted).toBe(true);
    // And the request's own abort signal is passed on too.
    const second = setup({}, async (init) => {
      const signal = init?.signal ?? undefined;
      client2.abort();
      return Promise.reject(signal?.aborted ? new DOMException('aborted', 'AbortError') : new Error('not aborted'));
    });
    const client2 = new AbortController();
    expect((await stream(second.deps, BODIES['defense-reply'], client2.signal)).status).toBe(502);
  });
  it('times out with 504 when the first event is slow, and logs task, status and latency only', async () => {
    const { deps, logs } = setup({ timeoutMs: 30 }, (init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    expect((await stream(deps)).status).toBe(504);
    expect(logs.map((l) => JSON.parse(l))).toEqual([{ task: 'defense-reply', status: 504, ms: 25, up: 0 }]); // 0: no answer
  });
});
