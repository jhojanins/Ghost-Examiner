import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n/i18n';
import { initialState, reduce } from './reduce';
import type { ConfirmedAnswer, Effect, Feedback, Question, QuestionPack, SessionEvent, SessionState } from './types';

// ---- Generators -------------------------------------------------------------------------
// Events are generated as templates and resolved against the current state, so most ids
// point at the current line or candidate and sequences go deep into the flow without
// filtering. Stale and arbitrary ids are mixed in to exercise the "ignored" paths.

const locale = fc.constantFrom<Locale>('en', 'es');
const localized = fc.record({ en: fc.string(), es: fc.string() });
const question: fc.Arbitrary<Question> = fc.record({
  id: fc.string(),
  kind: fc.constantFrom('free-text', 'choice', 'yes-no'),
  prompt: localized,
  keyPoints: fc.constant([]),
});
// Non-empty packs only: validatePack rejects an empty pack (task 9).
const pack: fc.Arbitrary<QuestionPack> = fc.record({
  id: fc.string(),
  greeting: localized,
  closing: localized,
  questions: fc.array(question, { minLength: 1, maxLength: 3 }),
});
const feedback: fc.Arbitrary<Feedback> = fc.record({
  summary: fc.string(),
  strength: fc.string(),
  improvement: fc.string(),
  reaction: fc.constantFrom('approving', 'skeptical'),
  locale,
});

type IdChoice = 'current' | 'stale' | number;
const idChoice: fc.Arbitrary<IdChoice> = fc.oneof(
  { arbitrary: fc.constant('current' as const), weight: 4 },
  { arbitrary: fc.constant('stale' as const), weight: 1 },
  { arbitrary: fc.integer({ min: -2, max: 20 }), weight: 1 },
);

type Template =
  | Exclude<SessionEvent, { type: 'line-done' } | { type: 'confirm' }>
  | { type: 'line-done'; id: IdChoice }
  | { type: 'confirm'; id: IdChoice };

const nonUser = [
  fc.record({ type: fc.constant('line-done' as const), id: idChoice }),
  fc.record({ type: fc.constant('feedback-ready' as const), feedback }),
  fc.record({ type: fc.constant('locale-changed' as const), locale }),
] as const;
const nonUserTemplate: fc.Arbitrary<Template> = fc.oneof(...nonUser);
// Each of the 10 event types is equally likely.
const template: fc.Arbitrary<Template> = fc.oneof(
  ...nonUser,
  fc.constant({ type: 'start' as const }),
  fc.constant({ type: 'privacy-accepted' as const }),
  fc.record({
    type: fc.constant('candidate' as const),
    candidate: fc.record({ text: fc.string(), method: fc.constantFrom('keyboard', 'voice', 'morse', 'sign') }),
  }),
  fc.constant({ type: 'retry' as const }),
  fc.constant({ type: 'edit' as const }),
  fc.record({ type: fc.constant('confirm' as const), id: idChoice }),
  fc.constant({ type: 'next' as const }),
);
// size 'max': fast-check's default size caps arrays near 10 events, too short to reach feedback.
const sequence = fc.array(template, { maxLength: 80, size: 'max' });

function resolve(t: Template, state: SessionState): SessionEvent {
  const pick = (id: IdChoice, current: number) => (id === 'current' ? current : id === 'stale' ? current - 1 : id);
  if (t.type === 'line-done') return { type: 'line-done', lineId: pick(t.id, state.lineId) };
  if (t.type === 'confirm') {
    return { type: 'confirm', candidateId: pick(t.id, state.candidate?.candidateId ?? state.candidateCount) };
  }
  return t;
}

type Step = { before: SessionState; event: SessionEvent; after: SessionState; effects: Effect[] };

function play(p: QuestionPack, start: Locale, templates: Template[], onStep: (step: Step) => void): void {
  let state = initialState(p, start);
  for (const t of templates) {
    const event = resolve(t, state);
    const { state: after, effects } = reduce(state, event);
    onStep({ before: state, event, after, effects });
    state = after;
  }
}

/** Independent restatement of which events the design §3.3 table accepts in each phase. */
function isValid(state: SessionState, event: SessionEvent): boolean {
  switch (event.type) {
    case 'start':
      return state.phase === 'intro';
    case 'privacy-accepted':
      return state.phase === 'privacy';
    case 'line-done':
      return state.phase === 'asking' && event.lineId === state.lineId;
    case 'candidate':
      return state.phase === 'asking' || state.phase === 'answering';
    case 'retry':
    case 'edit':
      return state.phase === 'confirming';
    case 'confirm':
      return state.phase === 'confirming' && event.candidateId === state.candidate?.candidateId;
    case 'feedback-ready':
      return state.phase === 'evaluating';
    case 'next':
      return state.phase === 'feedback';
    case 'locale-changed':
      return true;
  }
}

const runs = { numRuns: 100 };

// ---- Properties (design §9) ---------------------------------------------------------------

describe('engine properties', () => {
  it('P1: every evaluate effect comes from a matching confirm, or re-evaluates an earlier confirmed answer', () => {
    const seen = { confirm: 0, relocale: 0 };
    fc.assert(
      fc.property(pack, locale, sequence, (p, start, templates) => {
        const confirmed: ConfirmedAnswer[] = [];
        play(p, start, templates, ({ before, event, effects }) => {
          for (const effect of effects) {
            if (effect.type !== 'evaluate') continue;
            if (event.type === 'confirm') {
              expect(event.candidateId).toBe(before.candidate?.candidateId);
              expect(effect.answer.candidateId).toBe(event.candidateId);
              expect(effect.answer.text).toBe(before.candidate?.text);
              confirmed.push(effect.answer);
              seen.confirm++;
            } else if (event.type === 'locale-changed') {
              expect(confirmed).toContain(effect.answer);
              expect(effect.locale).toBe(event.locale);
              seen.relocale++;
            } else {
              expect.fail(`evaluate emitted by a '${event.type}' event`);
            }
          }
        });
      }),
      runs,
    );
    // Guard against a vacuous pass: both sources of evaluate must have been exercised.
    expect(seen.confirm).toBeGreaterThan(0);
    expect(seen.relocale).toBeGreaterThan(0);
  });

  it('P2: non-user events never move a state out of answering or confirming', () => {
    let checked = 0;
    fc.assert(
      fc.property(pack, locale, sequence, fc.array(nonUserTemplate, { maxLength: 20 }), (p, start, prefix, suffix) => {
        // The prefix reaches arbitrary states; each answering or confirming state the run passes
        // through is then hit with a run of non-user events (line-done, feedback-ready, locale-changed).
        play(p, start, prefix, ({ after }) => {
          if (after.phase !== 'answering' && after.phase !== 'confirming') return;
          const phase = after.phase;
          let state = after;
          for (const t of suffix) {
            state = reduce(state, resolve(t, state)).state;
            expect(state.phase).toBe(phase);
            checked++;
          }
        });
      }),
      runs,
    );
    expect(checked).toBeGreaterThan(0);
  });

  it('P3: reduce never throws, and an event invalid for the phase returns the same state and no effects', () => {
    let invalid = 0;
    fc.assert(
      fc.property(pack, locale, sequence, (p, start, templates) => {
        play(p, start, templates, ({ before, event, after, effects }) => {
          if (isValid(before, event)) return;
          expect(after).toBe(before);
          expect(effects).toEqual([]);
          invalid++;
        });
      }),
      runs,
    );
    expect(invalid).toBeGreaterThan(0);
  });
});
