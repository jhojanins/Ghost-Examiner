import type { LLMProvider, LLMResult } from './types';

/**
 * Tries each provider in order; the first ok result wins, otherwise the last error is
 * returned (Req 8.1). A provider that throws counts as `unavailable`, and its error is never
 * passed on, so upstream details can't leak. One pass only: no retries, no loops.
 */
export function withFallback(...chain: [LLMProvider, ...LLMProvider[]]): LLMProvider {
  if (chain.length === 0) throw new Error('withFallback needs at least one provider');
  return {
    id: chain[0].id,
    isDemo: chain.every((p) => p.isDemo),
    async complete(req) {
      let result: LLMResult = { ok: false, error: 'unavailable' };
      for (const provider of chain) {
        result = await provider.complete(req).catch((): LLMResult => ({ ok: false, error: 'unavailable' }));
        if (result.ok) return result;
      }
      return result;
    },
  };
}
