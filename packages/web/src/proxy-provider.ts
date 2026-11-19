import type { LLMProvider, LLMRequest, LLMResult } from '@ghost-examiner/core';

export interface ProxyProviderDeps {
  /** Defaults to the page's `fetch`. */
  fetch?: typeof fetch;
  /** Defaults to 20 s (design §4.2). */
  timeoutMs?: number;
  /** Time to the first streamed byte. Defaults to 8 s (Req 5.3). */
  firstByteMs?: number;
}

const TIMEOUT_MS = 20_000;
const FIRST_BYTE_MS = 8_000;

/** The proxy's status, mapped to the four `LLMResult` errors; undefined when it is ok. */
function statusError(res: Response): Extract<LLMResult, { ok: false }> | undefined {
  if (res.status === 429) return { ok: false, error: 'rate-limited' };
  if (res.status === 413) return { ok: false, error: 'too-large' };
  if (!res.ok) return { ok: false, error: 'unavailable' }; // 503 (also the kill switch), 4xx, 5xx
  return undefined;
}

/**
 * The site's own LLM proxy (ghost-defense-live design §4.2): `POST /api/llm`, same origin, with
 * `{ task, locale, input }` only. The proxy builds the prompt and sets the output cap; the reply
 * text is still checked by the core guards in the session. Errors map to the four `LLMResult`
 * errors; the proxy's error body is never shown.
 *
 * `stream` posts the same body to `/api/llm/stream` and hands over each piece of text as it
 * arrives. It gives up after 8 s without a first byte (Req 5.3) and after 20 s in total; a stream
 * cut midway resolves `unavailable`, so the session falls back for the rest of the turn.
 */
export function createProxyProvider(deps: ProxyProviderDeps = {}): LLMProvider {
  const send = deps.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const post = (path: string, req: LLMRequest, signal: AbortSignal) =>
    send(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ task: req.task, locale: req.locale, input: req.input }),
      signal,
    });
  return {
    id: 'proxy',
    isDemo: false,
    async complete(req): Promise<LLMResult> {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), deps.timeoutMs ?? TIMEOUT_MS);
      try {
        const res = await post('/api/llm', req, abort.signal);
        const error = statusError(res);
        if (error) return error;
        const text = await res.text();
        try {
          JSON.parse(text);
        } catch {
          return { ok: false, error: 'bad-output' };
        }
        return { ok: true, text };
      } catch {
        return { ok: false, error: 'unavailable' }; // a timeout or a network error
      } finally {
        clearTimeout(timer);
      }
    },
    async stream(req, onChunk, signal): Promise<LLMResult> {
      const abort = new AbortController();
      signal?.addEventListener('abort', () => abort.abort()); // the session stopped listening
      const total = setTimeout(() => abort.abort(), deps.timeoutMs ?? TIMEOUT_MS);
      const firstByte = setTimeout(() => abort.abort(), deps.firstByteMs ?? FIRST_BYTE_MS);
      try {
        const res = await post('/api/llm/stream', req, abort.signal);
        const error = statusError(res);
        if (error || !res.body) return error ?? { ok: false, error: 'unavailable' };
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          clearTimeout(firstByte);
          const chunk = decoder.decode(value, { stream: true });
          if (chunk === '') continue;
          text += chunk;
          onChunk(chunk);
        }
        return text === '' ? { ok: false, error: 'bad-output' } : { ok: true, text };
      } catch {
        return { ok: false, error: 'unavailable' }; // a timeout, a network error or a cut stream
      } finally {
        clearTimeout(firstByte);
        clearTimeout(total);
      }
    },
  };
}
