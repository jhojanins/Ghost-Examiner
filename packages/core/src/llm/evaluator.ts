import type { ConfirmedAnswer, Feedback, Question } from '../engine/types';
import type { Locale } from '../i18n/i18n';
import { isFeedback } from './is-feedback';
import type { LLMProvider } from './types';

export interface Evaluator {
  /** Accepts only a ConfirmedAnswer, which only the engine's confirm transition creates (Req 5.3). */
  evaluate(question: Question, answer: ConfirmedAnswer, locale: Locale): Promise<Feedback>;
}

const MAX_OUTPUT_TOKENS = 300;

/**
 * Builds the `evaluate-answer` request and checks the reply. Rejects (throws) on a provider
 * error, non-JSON text, output that fails `isFeedback`, or feedback in another locale. What
 * the session does then is spec (e)'s evaluator failure path (design §8).
 */
export function createLlmEvaluator(provider: LLMProvider): Evaluator {
  return {
    async evaluate(question, answer, locale) {
      const result = await provider.complete({
        task: 'evaluate-answer',
        locale,
        input: {
          question: question.prompt[locale],
          keyPoints: question.keyPoints.map((k) => ({ label: k.label[locale], cues: k.cues[locale] })),
          answer: answer.text,
        },
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      if (!result.ok) throw new Error(`evaluation failed: ${result.error}`);

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.text);
      } catch {
        throw new Error('evaluation failed: bad-output');
      }
      if (!isFeedback(parsed) || parsed.locale !== locale) throw new Error('evaluation failed: bad-output');
      return parsed;
    },
  };
}
