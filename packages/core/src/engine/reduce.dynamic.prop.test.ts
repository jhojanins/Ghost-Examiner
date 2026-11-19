import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DefenseReply } from '../llm/defense/types';
import { initialState, reduce } from './reduce';
import type { Question, QuestionPack, SessionEvent, SessionState } from './types';

const question = (n: number): Question => ({ id: `q${n}`, kind: 'free-text', prompt: { en: `Q${n}?`, es: `Q${n}?` }, keyPoints: [] });
const reply: fc.Arbitrary<DefenseReply> = fc.oneof(
  fc.constantFrom<DefenseReply['kind']>('correction', 'acknowledgment', 'not-in-file', 'unsupported').map((kind) => ({ kind, say: ['Line.'] })),
  fc.constant<DefenseReply>({ kind: 'follow-up', say: ['Partly.'], followUp: 'Why?' }),
);
type Step =
  | SessionEvent
  | { type: 'confirm-current' }
  | { type: 'line-done-current' };
const step = fc.oneof<fc.Arbitrary<Step>[]>(
  fc.constant({ type: 'start' } as const),
  fc.constant({ type: 'privacy-accepted' } as const),
  fc.integer({ min: 0, max: 5 }).map((n) => ({ type: 'questions-ready', questions: Array.from({ length: n }, (_, i) => question(i + 1)) }) as const),
  fc.constant({ type: 'line-done-current' } as const),
  fc.constant({ type: 'candidate', candidate: { text: 'An answer.', method: 'keyboard' } } as const),
  fc.constant({ type: 'confirm-current' } as const),
  fc.integer({ min: -1, max: 4 }).map((candidateId) => ({ type: 'confirm', candidateId }) as const),
  fc.constant({ type: 'retry' } as const),
  fc.constant({ type: 'edit' } as const),
  reply.map((r) => ({ type: 'reply-ready', reply: r }) as const),
  fc.constant({ type: 'next' } as const),
  fc.constant({ type: 'skip' } as const),
  fc.constant({ type: 'end' } as const),
  fc.constantFrom('en', 'es').map((locale) => ({ type: 'locale-changed', locale }) as const),
  fc.constant({ type: 'summary-ready', summary: { strength: 'Good.', review: [] } } as const),
);

describe('P29: dynamic sessions', () => {
  it('at most one follow-up per main question, at most N main and N follow-up replies, and nothing evaluated without confirm', async () => {
    await fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), fc.array(step, { maxLength: 60 }), (count, steps) => {
        const pack: QuestionPack = { id: 'p', greeting: { en: 'Hi', es: 'Hola' }, closing: { en: 'Bye', es: 'Adiós' }, questions: [], dynamic: { count } };
        let state: SessionState = initialState(pack, 'en');
        const main = new Map<string, number>();
        const followUps = new Map<string, number>();
        for (const s of steps) {
          const event: SessionEvent =
            s.type === 'confirm-current'
              ? { type: 'confirm', candidateId: state.candidate?.candidateId ?? -1 }
              : s.type === 'line-done-current'
                ? { type: 'line-done', lineId: state.lineId }
                : s;
          const before = state;
          const r = reduce(state, event);
          state = r.state;
          for (const effect of r.effects) {
            if (effect.type !== 'evaluate') continue;
            // P1 extended: only a confirm of the candidate on screen evaluates, and only that answer.
            expect(event.type).toBe('confirm');
            expect(before.phase).toBe('confirming');
            expect(effect.answer.candidateId).toBe(before.candidate?.candidateId);
            const of = effect.question.followUpOf;
            if (of === undefined) main.set(effect.question.id, (main.get(effect.question.id) ?? 0) + 1);
            else followUps.set(of, (followUps.get(of) ?? 0) + 1);
          }
        }
        const n = state.pack.questions.length;
        expect([...main.values()].every((c) => c === 1)).toBe(true); // each main question replied to once
        expect([...followUps.values()].every((c) => c === 1)).toBe(true); // at most one follow-up each
        expect(main.size).toBeLessThanOrEqual(n);
        expect(followUps.size).toBeLessThanOrEqual(n);
        for (const of of followUps.keys()) expect(main.has(of)).toBe(true); // a follow-up only after its main question
      }),
      { numRuns: 500 },
    );
  });
});
