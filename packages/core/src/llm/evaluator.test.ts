import { describe, expect, it, vi } from 'vitest';
import type { ConfirmedAnswer, Question } from '../engine/types';
import { createLlmEvaluator } from './evaluator';
import type { LLMProvider, LLMResult } from './types';

const question: Question = {
  id: 'q1',
  kind: 'free-text',
  prompt: { en: 'Question?', es: '¿Pregunta?' },
  keyPoints: [{ label: { en: 'the result', es: 'el resultado' }, cues: { en: ['result'], es: ['resultado'] } }],
};
// The evaluator only reads `text`; the brand is type-level, so a cast is enough for this unit test.
const answer = { text: 'My answer.', method: 'keyboard', candidateId: 1 } as ConfirmedAnswer;
const valid = { summary: 'S.', strength: 'T.', improvement: 'I.', reaction: 'approving', locale: 'es' };

const provider = (result: LLMResult) => ({ id: 'proxy' as const, isDemo: false, complete: vi.fn(async () => result) });

describe('createLlmEvaluator', () => {
  it('sends an evaluate-answer request resolved to the locale', async () => {
    const p = provider({ ok: true, text: JSON.stringify(valid) });
    await createLlmEvaluator(p satisfies LLMProvider).evaluate(question, answer, 'es');
    expect(p.complete).toHaveBeenCalledWith({
      task: 'evaluate-answer',
      locale: 'es',
      input: { question: '¿Pregunta?', keyPoints: [{ label: 'el resultado', cues: ['resultado'] }], answer: 'My answer.' },
      maxOutputTokens: 300,
    });
  });

  it.each<[string, LLMResult]>([
    ['a provider error', { ok: false, error: 'unavailable' }],
    ['text that is not JSON', { ok: true, text: 'Sure! Here is your feedback:' }],
    ['JSON that is not Feedback', { ok: true, text: JSON.stringify({ ...valid, score: 10 }) }],
    ['feedback in another locale', { ok: true, text: JSON.stringify({ ...valid, locale: 'en' }) }],
  ])('rejects %s', async (_, result) => {
    await expect(createLlmEvaluator(provider(result)).evaluate(question, answer, 'es')).rejects.toThrow();
  });
});
