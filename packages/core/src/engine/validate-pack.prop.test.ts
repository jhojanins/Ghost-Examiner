import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AnswerKind, InputAdapter, InputMethodId } from '../input/types';
import type { Question, QuestionPack } from './types';
import { validatePack } from './validate-pack';

const fakeAdapter = (id: InputMethodId, supports: readonly AnswerKind[]): InputAdapter => ({
  id,
  supports,
  requires: { camera: false, microphone: false },
  experimental: false,
  checkAvailability: async () => ({ available: true }),
  start() {},
  stop() {},
});

const kinds: AnswerKind[] = ['free-text', 'choice', 'yes-no'];
const methods: InputMethodId[] = ['keyboard', 'voice', 'morse', 'sign'];

// Adapters with distinct method ids, each supporting a random subset of answer kinds.
const adapters = fc
  .subarray(methods)
  .chain((ids) => fc.tuple(...ids.map((id) => fc.subarray(kinds).map((supports) => fakeAdapter(id, supports)))));

const question: fc.Arbitrary<Question> = fc.record({
  id: fc.string(),
  kind: fc.constantFrom(...kinds),
  prompt: fc.constant({ en: 'Q?', es: '¿P?' }),
  keyPoints: fc.constant([]),
});
const pack: fc.Arbitrary<QuestionPack> = fc.record({
  id: fc.constant('p'),
  greeting: fc.constant({ en: 'Hi.', es: 'Hola.' }),
  closing: fc.constant({ en: 'Bye.', es: 'Adiós.' }),
  questions: fc.array(question, { minLength: 1, maxLength: 6 }),
});

describe('validatePack properties', () => {
  it('P4: a question is reported iff fewer than 2 adapters support its kind; severity matches preview', () => {
    let reported = 0;
    let clean = 0;
    fc.assert(
      fc.property(pack, adapters, fc.boolean(), (p, registered, preview) => {
        const issues = validatePack(p, registered, { preview });
        const expected = p.questions.flatMap((q) => {
          const supportedBy = registered.filter((a) => a.supports.includes(q.kind)).map((a) => a.id);
          return supportedBy.length < 2
            ? [{ kind: 'too-few-inputs', questionId: q.id, severity: preview ? 'warning' : 'error', supportedBy }]
            : [];
        });
        expect(issues).toEqual(expected);
        reported += expected.length;
        clean += p.questions.length - expected.length;
      }),
      { numRuns: 100 },
    );
    // Both sides of the "iff" must have been exercised.
    expect(reported).toBeGreaterThan(0);
    expect(clean).toBeGreaterThan(0);
  });
});
