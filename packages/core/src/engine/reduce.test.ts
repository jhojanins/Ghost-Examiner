import { describe, expect, it } from 'vitest';
import { initialState, reduce } from './reduce';
import type {
  ConfirmedAnswer,
  Effect,
  Feedback,
  Question,
  QuestionPack,
  SessionEvent,
  SessionState,
} from './types';

// Fictional pack, test data only.
const q1: Question = {
  id: 'q1',
  kind: 'free-text',
  prompt: { en: 'Tell me about a problem you solved.', es: 'Cuéntame de un problema que resolviste.' },
  keyPoints: [],
};
const q2: Question = { ...q1, id: 'q2', prompt: { en: 'Second question?', es: '¿Segunda pregunta?' } };
const pack: QuestionPack = {
  id: 'test',
  greeting: { en: 'Hello.', es: 'Hola.' },
  closing: { en: 'Goodbye.', es: 'Adiós.' },
  questions: [q1, q2],
};
const feedback: Feedback = {
  summary: 'Solid answer.',
  strength: 'You covered the action.',
  improvement: 'Add a result.',
  reaction: 'approving',
  locale: 'en',
};
const hi = { type: 'candidate', candidate: { text: 'Hi', method: 'keyboard' } } as const;

/** Applies events in order; returns the final state and the last event's effects. */
function run(state: SessionState, ...events: SessionEvent[]): { state: SessionState; effects: Effect[] } {
  let effects: Effect[] = [];
  for (const event of events) ({ state, effects } = reduce(state, event));
  return { state, effects };
}

const intro = initialState(pack, 'en');
const privacy = run(intro, { type: 'start' }).state;
const asking = run(privacy, { type: 'privacy-accepted' }).state;
const answering = run(asking, { type: 'line-done', lineId: asking.lineId }).state;
const confirming = run(answering, hi).state;
const candidateId = confirming.candidate!.candidateId;
const evaluating = run(confirming, { type: 'confirm', candidateId }).state;
const inFeedback = run(evaluating, { type: 'feedback-ready', feedback }).state;

describe('reduce: transition table (design §3.3)', () => {
  it('intro + start -> privacy, speaks the greeting', () => {
    expect(intro.phase).toBe('intro');
    const { state, effects } = reduce(intro, { type: 'start' });
    expect(state.phase).toBe('privacy');
    expect(effects).toEqual([{ type: 'speak', lineId: state.lineId, line: { localized: pack.greeting } }]);
  });

  it('privacy + privacy-accepted -> asking, speaks the question', () => {
    const { state, effects } = reduce(privacy, { type: 'privacy-accepted' });
    expect(state.phase).toBe('asking');
    expect(effects).toEqual([{ type: 'speak', lineId: state.lineId, line: { localized: q1.prompt } }]);
  });

  it('asking + line-done (current line) -> answering, no effects', () => {
    const { state, effects } = reduce(asking, { type: 'line-done', lineId: asking.lineId });
    expect(state.phase).toBe('answering');
    expect(effects).toEqual([]);
  });

  it.each([
    ['asking', asking],
    ['answering', answering],
  ])('%s + candidate -> confirming with a new candidateId, no effects', (_, from) => {
    const { state, effects } = reduce(from, hi);
    expect(state.phase).toBe('confirming');
    expect(state.candidate).toEqual({ text: 'Hi', method: 'keyboard', candidateId: from.candidateCount + 1 });
    expect(effects).toEqual([]);
  });

  it('confirming + retry -> answering, candidate cleared, no effects', () => {
    const { state, effects } = reduce(confirming, { type: 'retry' });
    expect(state.phase).toBe('answering');
    expect(state.candidate).toBeUndefined();
    expect(state.questionIndex).toBe(confirming.questionIndex);
    expect(effects).toEqual([]);
  });

  it('confirming + edit -> answering with draft = candidate text, no effects', () => {
    const { state, effects } = reduce(confirming, { type: 'edit' });
    expect(state.phase).toBe('answering');
    expect(state.draft).toBe('Hi');
    expect(effects).toEqual([]);
  });

  it('confirming + confirm (matching candidateId) -> evaluating, evaluates the branded answer', () => {
    const { state, effects } = reduce(confirming, { type: 'confirm', candidateId });
    expect(state.phase).toBe('evaluating');
    expect(effects).toEqual([
      { type: 'evaluate', question: q1, answer: { text: 'Hi', method: 'keyboard', candidateId }, locale: 'en' },
    ]);
  });

  it('evaluating + feedback-ready -> feedback, speaks the summary', () => {
    const { state, effects } = reduce(evaluating, { type: 'feedback-ready', feedback });
    expect(state.phase).toBe('feedback');
    expect(state.feedback).toBe(feedback);
    expect(effects).toEqual([
      { type: 'speak', lineId: state.lineId, line: { text: 'Solid answer.', locale: 'en' } },
    ]);
  });

  it('feedback + next -> asking (next question), or summary after the last one', () => {
    const second = reduce(inFeedback, { type: 'next' });
    expect(second.state.phase).toBe('asking');
    expect(second.state.questionIndex).toBe(1);
    expect(second.effects).toEqual([{ type: 'speak', lineId: second.state.lineId, line: { localized: q2.prompt } }]);

    const last = run(
      second.state,
      hi,
      { type: 'confirm', candidateId: second.state.candidateCount + 1 },
      { type: 'feedback-ready', feedback },
    ).state;
    const end = reduce(last, { type: 'next' });
    expect(end.state.phase).toBe('summary');
    expect(end.effects).toEqual([{ type: 'speak', lineId: end.state.lineId, line: { localized: pack.closing } }]);
  });

  it('feedback + locale-changed -> evaluating, re-evaluates the same answer in the new locale', () => {
    const { state, effects } = reduce(inFeedback, { type: 'locale-changed', locale: 'es' });
    expect(state.phase).toBe('evaluating');
    expect(state.locale).toBe('es');
    expect(effects).toEqual([{ type: 'evaluate', question: q1, answer: evaluating.confirmed, locale: 'es' }]);
  });

  it('any other phase + locale-changed -> same phase, new locale, no effects', () => {
    const { state, effects } = reduce(confirming, { type: 'locale-changed', locale: 'es' });
    expect(state).toEqual({ ...confirming, locale: 'es' });
    expect(effects).toEqual([]);
  });

  it.each<[string, SessionState, SessionEvent]>([
    ['stale line-done', asking, { type: 'line-done', lineId: asking.lineId - 1 }],
    ['stale confirm', confirming, { type: 'confirm', candidateId: candidateId + 1 }],
    ['start while asking', asking, { type: 'start' }],
    ['candidate while evaluating', evaluating, hi],
    ['next while confirming', confirming, { type: 'next' }],
  ])('other combinations leave the state unchanged with no effects: %s', (_, from, event) => {
    const { state, effects } = reduce(from, event);
    expect(state).toBe(from);
    expect(effects).toEqual([]);
  });
});

describe('ConfirmedAnswer', () => {
  it('cannot be created from a plain object (compile-time, checked by pnpm typecheck)', () => {
    // @ts-expect-error: the brand is a non-exported unique symbol, so only reduce() can create one
    const forged: ConfirmedAnswer = { text: 'Hi', method: 'keyboard', candidateId: 1 };
    expect(forged.text).toBe('Hi');
  });
});
