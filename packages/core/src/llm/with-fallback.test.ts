import { describe, expect, it, vi } from 'vitest';
import type { LLMProvider, LLMRequest, LLMResult } from './types';
import { withFallback } from './with-fallback';

const request: LLMRequest = {
  task: 'evaluate-answer',
  locale: 'en',
  input: { question: 'Q?', keyPoints: [], answer: 'A.' },
  maxOutputTokens: 300,
};

function fake(id: LLMProvider['id'], result: LLMResult | Error, isDemo = id === 'demo') {
  const complete = vi.fn(async (): Promise<LLMResult> => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { id, isDemo, complete } satisfies LLMProvider;
}

describe('withFallback', () => {
  it('returns the working result after a failing provider', async () => {
    const failing = fake('proxy', { ok: false, error: 'rate-limited' });
    const working = fake('demo', { ok: true, text: '{}' });
    expect(await withFallback(failing, working).complete(request)).toEqual({ ok: true, text: '{}' });
    expect(failing.complete).toHaveBeenCalledWith(request);
    expect(working.complete).toHaveBeenCalledWith(request);
  });

  it('returns the last error when every provider fails', async () => {
    const first = fake('proxy', { ok: false, error: 'rate-limited' });
    const last = fake('gemini', { ok: false, error: 'bad-output' });
    expect(await withFallback(first, last).complete(request)).toEqual({ ok: false, error: 'bad-output' });
  });

  it('stops at the first ok result', async () => {
    const working = fake('proxy', { ok: true, text: 'first' });
    const unused = fake('demo', { ok: true, text: 'second' });
    expect(await withFallback(working, unused).complete(request)).toEqual({ ok: true, text: 'first' });
    expect(unused.complete).not.toHaveBeenCalled();
  });

  it('treats a provider that throws as unavailable and moves on, without exposing the error', async () => {
    const throwing = fake('groq', new Error('upstream body with details'));
    expect(await withFallback(throwing).complete(request)).toEqual({ ok: false, error: 'unavailable' });
    const working = fake('demo', { ok: true, text: 'ok' });
    expect(await withFallback(throwing, working).complete(request)).toEqual({ ok: true, text: 'ok' });
  });

  it('takes its id from the first provider and is demo only if every provider is', () => {
    const proxy = fake('proxy', { ok: true, text: '' });
    const demo = fake('demo', { ok: true, text: '' });
    expect(withFallback(proxy, demo)).toMatchObject({ id: 'proxy', isDemo: false });
    expect(withFallback(demo)).toMatchObject({ id: 'demo', isDemo: true });
  });

  it('requires at least one provider (compile-time, checked by pnpm typecheck)', () => {
    // @ts-expect-error: an empty chain has nothing to fall back to
    expect(() => withFallback()).toThrow();
  });
});
