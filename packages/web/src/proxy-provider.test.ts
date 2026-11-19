import { createKeyboardAdapter, splitExcerpts, type LLMRequest, type QuestionPack } from '@ghost-examiner/core';
import { describe, expect, it, vi } from 'vitest';
import { createProxyProvider } from './proxy-provider';
import { createSession } from './session';
import type { Playback, SpeechOutput } from './silent-output';

// Fictional excerpts and requests (test data only).
const excerpts = [{ id: 'e1', text: 'We chose a queue because the payment service was slow at the evening peak.' }];
const reply: LLMRequest = {
  task: 'defense-reply',
  locale: 'en',
  maxOutputTokens: 400,
  input: { excerpts, question: 'Why a queue?', quote: 'We chose a queue', answer: 'Because it was slow.', followUpAllowed: true },
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function proxy(respond: (init: RequestInit) => Promise<Response>, timeoutMs = 1000) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond(init ?? {});
  }) as unknown as typeof globalThis.fetch;
  return { provider: createProxyProvider({ fetch, timeoutMs }), calls };
}

describe('ProxyProvider (design §4.2)', () => {
  it('posts { task, locale, input } as JSON to /api/llm, same origin, and returns the text', async () => {
    const { provider, calls } = proxy(async () => new Response('{"kind":"acknowledgment","say":["Good."]}', { status: 200 }));
    expect(provider).toMatchObject({ id: 'proxy', isDemo: false });
    expect(await provider.complete(reply)).toEqual({ ok: true, text: '{"kind":"acknowledgment","say":["Good."]}' });
    expect(calls[0].url).toBe('/api/llm');
    expect(calls[0].init.method).toBe('POST');
    expect(new Headers(calls[0].init.headers).get('content-type')).toBe('application/json');
    expect(calls[0].init.credentials).toBe('same-origin');
    // The output cap is the proxy's to set: the client sends only what the proxy accepts.
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ task: reply.task, locale: reply.locale, input: reply.input });
  });
  it('maps 429 to rate-limited, 503 (also the kill switch) to unavailable, 413 to too-large, anything else to unavailable', async () => {
    const cases: [Response, string][] = [
      [json(429, { error: 'rate-limited' }), 'rate-limited'],
      [json(503, { error: 'disabled' }), 'unavailable'],
      [json(503, { error: 'unavailable' }), 'unavailable'],
      [json(413, { error: 'too-large' }), 'too-large'],
      [json(400, { error: 'bad-request' }), 'unavailable'],
      [json(502, { error: 'bad-output' }), 'unavailable'],
      [new Response('<html>Not found</html>', { status: 404 }), 'unavailable'],
    ];
    for (const [res, error] of cases) {
      const { provider } = proxy(async () => res);
      expect(await provider.complete(reply), `${res.status}`).toEqual({ ok: false, error });
    }
  });
  it('a 200 whose body is not JSON is bad-output', async () => {
    for (const body of ['{"kind": "acknowledg', '', '<html>Page</html>']) {
      const { provider } = proxy(async () => new Response(body, { status: 200 }));
      expect(await provider.complete(reply)).toEqual({ ok: false, error: 'bad-output' });
    }
  });
  it('times out after its limit (20 s by default) and aborts the request; a network error is unavailable', async () => {
    let signal: AbortSignal | undefined;
    const { provider } = proxy((init) => {
      signal = init.signal ?? undefined;
      return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    }, 20);
    expect(await provider.complete(reply)).toEqual({ ok: false, error: 'unavailable' });
    expect(signal?.aborted).toBe(true);
    const down = proxy(async () => Promise.reject(new TypeError('Failed to fetch')));
    expect(await down.provider.complete(reply)).toEqual({ ok: false, error: 'unavailable' });
  });
});

describe('ProxyProvider.stream (design §4.2, task 22)', () => {
  // Each read gets the next piece; a cut fails the read after the last one, as a dropped connection does.
  const chunked = (pieces: string[], { cut = false } = {}) => {
    let i = 0;
    return new Response(
      new ReadableStream({
        pull(c) {
          if (i < pieces.length) c.enqueue(new TextEncoder().encode(pieces[i++]));
          else if (cut) c.error(new TypeError('network error'));
          else c.close();
        },
      }),
      { status: 200 },
    );
  };
  it('posts the same body to /api/llm/stream and delivers each chunk as it arrives, then the whole text', async () => {
    const { provider, calls } = proxy(async () => chunked(['{"kind":"ackno', 'wledgment","say":["Gu', 'ay é."]}']));
    const seen: string[] = [];
    const r = await provider.stream!(reply, (chunk) => seen.push(chunk));
    expect(r).toEqual({ ok: true, text: '{"kind":"acknowledgment","say":["Guay é."]}' });
    expect(seen.join('')).toBe('{"kind":"acknowledgment","say":["Guay é."]}');
    expect(seen.length).toBeGreaterThan(1);
    expect(calls[0].url).toBe('/api/llm/stream');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ task: reply.task, locale: reply.locale, input: reply.input });
  });
  it('maps the statuses as complete does, before any chunk', async () => {
    for (const [status, error] of [[429, 'rate-limited'], [503, 'unavailable'], [413, 'too-large'], [404, 'unavailable']] as const) {
      const { provider } = proxy(async () => json(status, { error: 'x' }));
      const seen: string[] = [];
      expect(await provider.stream!(reply, (c) => seen.push(c))).toEqual({ ok: false, error });
      expect(seen).toEqual([]);
    }
  });
  it('an empty stream is bad-output; a multi-byte character split across byte chunks stays whole', async () => {
    expect(await proxy(async () => chunked([])).provider.stream!(reply, () => {})).toEqual({ ok: false, error: 'bad-output' });
    const bytes = new TextEncoder().encode('{"say":["Está «bien»."]}');
    let i = 0;
    const byByte = proxy(async () => new Response(new ReadableStream({ pull(c) { if (i < bytes.length) c.enqueue(bytes.slice(i, ++i)); else c.close(); } }), { status: 200 }));
    expect(await byByte.provider.stream!(reply, () => {})).toEqual({ ok: true, text: '{"say":["Está «bien»."]}' });
  });
  it('a stream cut midway resolves unavailable, after the chunks already delivered', async () => {
    const { provider } = proxy(async () => chunked(['{"kind":"ack'], { cut: true }));
    const seen: string[] = [];
    expect(await provider.stream!(reply, (c) => seen.push(c))).toEqual({ ok: false, error: 'unavailable' });
    expect(seen).toEqual(['{"kind":"ack']);
  });
  it('times out after 8 s without a first byte, aborting the request; once bytes flow, the 20 s total applies', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const { provider } = proxy((init) => {
        signal = init.signal ?? undefined;
        return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
      }, 20_000);
      const pending = provider.stream!(reply, () => {});
      await vi.advanceTimersByTimeAsync(7_999);
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual({ ok: false, error: 'unavailable' });
      expect(signal?.aborted).toBe(true);
      // A slow but flowing stream: the first byte at 7 s, the end at 15 s, is fine.
      let push!: (s: string) => void;
      let close!: () => void;
      // Like a real fetch, the body errors when the request's signal aborts.
      const slow = proxy(async (init) =>
        new Response(
          new ReadableStream({
            start(c) {
              push = (s) => c.enqueue(new TextEncoder().encode(s));
              close = () => c.close();
              init.signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
            },
          }),
          { status: 200 },
        ),
      20_000);
      const flowing = slow.provider.stream!(reply, () => {});
      await vi.advanceTimersByTimeAsync(7_000);
      push('{"a":');
      await vi.advanceTimersByTimeAsync(8_000);
      push('1}');
      close();
      expect(await flowing).toEqual({ ok: true, text: '{"a":1}' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the provider chain in a session (Req 10.1, 10.3, 10.5)', () => {
  const DOC = `# Design\n\nWe chose a message queue because the payment service could not keep up with the evening peak.\n\n# Results\n\nWe measured the checkout time for two weeks with forty volunteers from the club.\n\n# Costs\n\nThe queue runs on the same small server, so the monthly cost did not change at all.\n\n# Conclusion\n\nTherefore a queue was enough for our size, and a second server was not needed.`;
  const docExcerpts = splitExcerpts(DOC, { maxChars: 1500 });
  const pack: QuestionPack = { id: 'defense', greeting: { en: 'Hello.', es: 'Hola.' }, closing: { en: 'Bye.', es: 'Adiós.' }, questions: [], dynamic: { count: 3 } };
  const speech: SpeechOutput = {
    speak: (): Playback => ({ startedAt: 0, origin: () => 0, audible: () => false, done: new Promise<void>(() => {}) }), // lines never end on their own
    cancel: () => {},
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  it('the proxy answers first; on its first failure the demo rules take the same turn, and stay for the rest of the session', async () => {
    const questions = { questions: docExcerpts.slice(0, 3).map((e) => ({ excerptId: e.id, quote: e.text.split('\n\n')[1].slice(0, 50), prompt: 'Why is this so?' })) };
    let replies = 0;
    const { provider, calls } = proxy(async (init) => {
      const { task } = JSON.parse(String(init.body)) as { task: string };
      if (task === 'defense-questions') return new Response(JSON.stringify(questions), { status: 200 });
      replies++;
      return json(429, { error: 'rate-limited' });
    });
    const keyboard = createKeyboardAdapter();
    const handle = createSession({
      pack,
      adapters: [keyboard],
      preview: true, // keyboard only is enough here
      evaluator: { evaluate: vi.fn() },
      speech,
      locale: 'en',
      defense: { provider, excerpts: docExcerpts, fileLang: 'en' },
      schedule: () => () => {},
    });
    if ('blocked' in handle) throw new Error('blocked');
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' });
    await flush();
    expect(handle.getSnapshot().defense).toEqual({ mode: 'ai' });
    expect(handle.getSnapshot().state.pack.questions[0].prompt.en).toBe('Why is this so?'); // from the proxy
    handle.dispatch({ type: 'line-done', lineId: handle.getSnapshot().state.lineId });
    keyboard.submit('Because the evening peak was too much for the payment service.');
    const answer = handle.getSnapshot().state.candidate!;
    handle.dispatch({ type: 'confirm', candidateId: answer.candidateId });
    await flush();
    await flush();
    const after = handle.getSnapshot();
    expect(after.defense).toEqual({ mode: 'mixed' }); // AI questions, a demo reply
    expect(after.state.phase).toBe('feedback'); // the turn was not lost
    expect(after.state.turns?.[0].answer).toBe('Because the evening peak was too much for the payment service.');
    handle.dispatch({ type: 'end' });
    await flush();
    expect(handle.getSnapshot().state.summary).toBeDefined(); // the demo summary
    expect(replies).toBe(1); // demo pinned: no second proxy call
    expect(calls.map((c) => JSON.parse(String(c.init.body)).task)).toEqual(['defense-questions', 'defense-reply']);
  });
});
