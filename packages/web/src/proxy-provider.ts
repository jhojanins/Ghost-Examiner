import type { LLMProvider, LLMResult } from '@ghost-examiner/core';

export interface ProxyProviderDeps {
  /** Defaults to the page's `fetch`. */
  fetch?: typeof fetch;
  /** Defaults to 20 s (design §4.2). */
  timeoutMs?: number;
}

const TIMEOUT_MS = 20_000;

/**
 * The site's own LLM proxy (ghost-defense-live design §4.2): `POST /api/llm`, same origin, with
 * `{ task, locale, input }` only. The proxy builds the prompt and sets the output cap; the reply
 * text is still checked by the core guards in the session. Errors map to the four `LLMResult`
 * errors; the proxy's error body is never shown.
 */
export function createProxyProvider(deps: ProxyProviderDeps = {}): LLMProvider {
  const send = deps.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    id: 'proxy',
    isDemo: false,
    async complete(req): Promise<LLMResult> {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), deps.timeoutMs ?? TIMEOUT_MS);
      try {
        const res = await send('/api/llm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ task: req.task, locale: req.locale, input: req.input }),
          signal: abort.signal,
        });
        if (res.status === 429) return { ok: false, error: 'rate-limited' };
        if (res.status === 413) return { ok: false, error: 'too-large' };
        if (!res.ok) return { ok: false, error: 'unavailable' }; // 503 (also the kill switch), 4xx, 5xx
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
  };
}
