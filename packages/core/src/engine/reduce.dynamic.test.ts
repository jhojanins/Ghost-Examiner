import { describe, expect, it } from 'vitest';
import type { DefenseReply } from '../llm/defense/types';
import { initialState, reduce } from './reduce';
import type { Effect, Question, QuestionPack, SessionEvent, SessionState } from './types';

// A dynamic pack (ghost-defense-live design §3.5): questions arrive at runtime.
const pack: QuestionPack = {
  id: 'defense',
  greeting: { en: 'Hello.', es: 'Hola.' },
  closing: { en: 'Bye.', es: 'Adiós.' },
  questions: [],
  dynamic: { count: 2 },
};
const q = (n: number): Question => ({
  id: `q${n}`,
  kind: 'free-text',
  prompt: { en: `Question ${n}?`, es: `Question ${n}?` },
  keyPoints: [],
  source: { excerptId: `e${n}`, quote: `quoted passage ${n}` },
});
const reply = (kind: DefenseReply['kind'], extra: Partial<DefenseReply> = {}): DefenseReply => ({ kind, say: [`A ${kind}.`, 'Second line.'], ...extra });

/** Runs events in order; `confirm` and `line-done` use the current ids. */
function run(events: (SessionEvent | 'confirm' | 'line-done')[], from: SessionState = initialState(pack, 'en')) {
  let state = from;
  const effects: Effect[] = [];
  for (const e of events) {
    const event: SessionEvent =
      e === 'confirm' ? { type: 'confirm', candidateId: state.candidate?.candidateId ?? -1 } : e === 'line-done' ? { type: 'line-done', lineId: state.lineId } : e;
    const r = reduce(state, event);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state, effects };
}
const answer = (text: string): SessionEvent => ({ type: 'candidate', candidate: { text, method: 'keyboard' } });
const started: (SessionEvent | 'confirm' | 'line-done')[] = [{ type: 'start' }, { type: 'privacy-accepted' }];
const spoken = (effects: Effect[]) => effects.flatMap((e) => (e.type === 'speak' ? ['text' in e.line ? e.line.text : e.line.localized.en] : []));

describe('reduce: dynamic sessions', () => {
  it('accepting privacy prepares questions instead of asking a pack question', () => {
    const { state, effects } = run(started);
    expect(state.phase).toBe('preparing');
    expect(effects.at(-1)).toEqual({ type: 'prepare-questions', count: 2, locale: 'en' });
  });

  it('questions-ready asks the first question; an empty list ends with the closing line and no summary request', () => {
    const asked = run([...started, { type: 'questions-ready', questions: [q(1), q(2)] }]);
    expect(asked.state.phase).toBe('asking');
    expect(spoken(asked.effects).at(-1)).toBe('Question 1?');
    const none = run([...started, { type: 'questions-ready', questions: [] }]);
    expect(none.state.phase).toBe('summary');
    expect(spoken(none.effects).at(-1)).toBe('Bye.');
    expect(none.effects.some((e) => e.type === 'summarize')).toBe(false);
  });

  it('a reply is spoken sentence by sentence and recorded as a turn', () => {
    const { state, effects } = run([...started, { type: 'questions-ready', questions: [q(1), q(2)] }, 'line-done', answer('Because.'), 'confirm', { type: 'reply-ready', reply: reply('correction') }]);
    expect(state.phase).toBe('feedback');
    expect(spoken(effects).slice(-2)).toEqual(['A correction.', 'Second line.']);
    expect(state.turns).toEqual([{ question: 'Question 1?', answer: 'Because.', kind: 'correction' }]);
  });

  it('asks a follow-up once, on the same passage, then moves on', () => {
    const followed = run([
      ...started,
      { type: 'questions-ready', questions: [q(1), q(2)] },
      'line-done',
      answer('Hmm.'),
      'confirm',
      { type: 'reply-ready', reply: reply('follow-up', { followUp: 'Why exactly?' }) },
      { type: 'next' },
    ]);
    expect(followed.state.phase).toBe('asking');
    expect(followed.state.followUp).toMatchObject({ prompt: { en: 'Why exactly?' }, followUpOf: 'q1', source: q(1).source });
    const evaluate = run(['line-done', answer('Because.'), 'confirm'], followed.state).effects.find((e) => e.type === 'evaluate');
    expect(evaluate).toMatchObject({ question: { followUpOf: 'q1' } });
    // A follow-up's reply can't ask another follow-up: it counts as an acknowledgment, and next goes to question 2.
    const after = run(['line-done', answer('Because.'), 'confirm', { type: 'reply-ready', reply: reply('follow-up', { followUp: 'And then?' }) }, { type: 'next' }], followed.state);
    expect(after.state.turns?.at(-1)?.kind).toBe('acknowledgment');
    expect(after.state.followUp).toBeUndefined();
    expect(after.state.questionIndex).toBe(1);
    expect(spoken(after.effects).at(-1)).toBe('Question 2?');
  });

  it('skip goes to the next main question; at the last one it goes to the summary', () => {
    const skipped = run([...started, { type: 'questions-ready', questions: [q(1), q(2)] }, { type: 'skip' }]);
    expect(skipped.state.questionIndex).toBe(1);
    expect(spoken(skipped.effects).at(-1)).toBe('Question 2?');
    expect(run([{ type: 'skip' }], skipped.state).state.phase).toBe('summary');
  });

  it('end goes to the summary at once and asks for it with the turns so far', () => {
    const { state, effects } = run([
      ...started,
      { type: 'questions-ready', questions: [q(1), q(2)] },
      'line-done',
      answer('Because.'),
      'confirm',
      { type: 'reply-ready', reply: reply('acknowledgment') },
      { type: 'end' },
    ]);
    expect(state.phase).toBe('summary');
    expect(effects.at(-1)).toEqual({ type: 'summarize', turns: [{ question: 'Question 1?', answer: 'Because.', kind: 'acknowledgment' }], locale: 'en' });
  });

  it('summary-ready speaks the strength, the review points and the closing line', () => {
    const atSummary = run([...started, { type: 'questions-ready', questions: [q(1)] }, 'line-done', answer('Because.'), 'confirm', { type: 'reply-ready', reply: reply('acknowledgment') }, { type: 'next' }]);
    expect(atSummary.effects.at(-1)?.type).toBe('summarize');
    const { state, effects } = run(
      [{ type: 'summary-ready', summary: { strength: 'Clear reasons.', review: [{ excerptId: 'e1', quote: 'quoted passage 1', point: 'Check the timing.' }] } }],
      atSummary.state,
    );
    expect(state.summary?.strength).toBe('Clear reasons.');
    expect(spoken(effects)).toEqual(['Clear reasons.', 'Check the timing.', 'Bye.']);
  });

  it('a language switch never asks for a reply again (each answer is replied to once)', () => {
    const fed = run([...started, { type: 'questions-ready', questions: [q(1)] }, 'line-done', answer('Because.'), 'confirm', { type: 'reply-ready', reply: reply('acknowledgment') }]);
    const switched = reduce(fed.state, { type: 'locale-changed', locale: 'es' });
    expect(switched.effects).toEqual([]);
    expect(switched.state.locale).toBe('es');
  });

  it('pack sessions ignore the new events', () => {
    const packState = { ...initialState({ ...pack, dynamic: undefined, questions: [q(1)] }, 'en'), phase: 'answering' as const };
    for (const event of [{ type: 'skip' }, { type: 'end' }, { type: 'reply-ready', reply: reply('acknowledgment') }] as SessionEvent[]) {
      expect(reduce(packState, event).state).toBe(packState);
    }
  });
});
