import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ConfirmedAnswer, Question } from '../engine/types';
import type { Locale } from '../i18n/i18n';
import { createDemoProvider } from './demo-provider';
import { createLlmEvaluator } from './evaluator';
import { isFeedback } from './is-feedback';

const locale = fc.constantFrom<Locale>('en', 'es');
// Labels are pack content: short, authored phrases ("the situation", "la situación").
const label = fc.string({ minLength: 1, maxLength: 60 });
const cues = fc.array(fc.string({ maxLength: 12 }), { maxLength: 4 });
const question: fc.Arbitrary<Question> = fc.record({
  id: fc.string(),
  kind: fc.constantFrom('free-text', 'choice', 'yes-no'),
  prompt: fc.record({ en: fc.string(), es: fc.string() }),
  keyPoints: fc.array(
    fc.record({ label: fc.record({ en: label, es: label }), cues: fc.record({ en: cues, es: cues }) }),
    { maxLength: 5 },
  ),
});
// Answers are untrusted user text of any shape and length; mix in words that hit cues.
const answer = fc.oneof(fc.string(), fc.string({ unit: 'grapheme', maxLength: 300 }), fc.lorem({ maxCount: 40 }));
// The evaluator only reads `text`; the brand is type-level only.
const asConfirmed = (text: string) => ({ text, method: 'keyboard', candidateId: 1 }) as ConfirmedAnswer;

describe('demo evaluation properties', () => {
  it('switching the language never changes the judgement, only the language of the text', async () => {
    await fc.assert(
      fc.asyncProperty(question, answer, async (q, text) => {
        const evaluator = createLlmEvaluator(createDemoProvider());
        const [en, es] = await Promise.all([evaluator.evaluate(q, asConfirmed(text), 'en'), evaluator.evaluate(q, asConfirmed(text), 'es')]);
        expect(es.reaction).toBe(en.reaction);
      }),
      { numRuns: 100 },
    );
  });

  it('P9: same question, answer and locale give the same feedback, and it always passes isFeedback', async () => {
    await fc.assert(
      fc.asyncProperty(question, answer, locale, async (q, text, loc) => {
        const first = await createDemoProvider().complete({
          task: 'evaluate-answer',
          locale: loc,
          input: {
            question: q.prompt[loc],
            keyPoints: q.keyPoints.map((k) => ({ label: k.label[loc], cues: k.cues[loc] })),
            answer: text,
          },
          maxOutputTokens: 300,
        });
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        expect(isFeedback(JSON.parse(first.text))).toBe(true);

        // Through the evaluator, twice, with fresh providers: identical, valid results in the locale.
        const a = await createLlmEvaluator(createDemoProvider()).evaluate(q, asConfirmed(text), loc);
        const b = await createLlmEvaluator(createDemoProvider()).evaluate(q, asConfirmed(text), loc);
        expect(a).toEqual(b);
        expect(isFeedback(a)).toBe(true);
        expect(a.locale).toBe(loc);
      }),
      { numRuns: 100 },
    );
  });
});
