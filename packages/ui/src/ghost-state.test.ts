import { buildTimeline, initialState, type Feedback, type Phase, type QuestionPack, type SessionState } from '@ghost-examiner/core';
import { describe, expect, it } from 'vitest';
import { ghostState, type GhostSessionView } from './ghost-state';

// Fictional pack, test data only.
const pack: QuestionPack = {
  id: 'p',
  greeting: { en: 'Hello.', es: 'Hola.' },
  closing: { en: 'Bye.', es: 'Adiós.' },
  questions: [{ id: 'q1', kind: 'free-text', prompt: { en: 'Q?', es: '¿P?' }, keyPoints: [] }],
};
const feedback = (reaction: Feedback['reaction']): Feedback => ({
  summary: 'S.',
  strength: 'T.',
  improvement: 'I.',
  reaction,
  locale: 'en',
});
const at = (phase: Phase, extra: Partial<SessionState> = {}): SessionState => ({ ...initialState(pack, 'en'), phase, ...extra });
const timeline = buildTimeline('Tell me more.', 'en');
const playing = { timeline, startedAt: 1234, playing: true };
const finished = { ...playing, playing: false };
const view = (state: SessionState, line?: GhostSessionView['line']): GhostSessionView => ({ state, line });
const SEED = 7;

describe('ghostState (design §5.2)', () => {
  it.each<Phase>(['privacy', 'asking', 'confirming', 'feedback'])(
    'a line is playing (%s) → speaking / neutral, with the line timeline',
    (phase) => {
      // No feedback stored yet, so even in the feedback phase the expression is neutral.
      expect(ghostState(view(at(phase), playing), SEED)).toEqual({
        activity: 'speaking',
        expression: 'neutral',
        speech: { timeline, startedAt: 1234 },
        seed: SEED,
      });
    },
  );

  it.each<Feedback['reaction']>(['approving', 'skeptical'])(
    'saying the feedback summary → speaking with the evaluator reaction (%s)',
    (reaction) => {
      const g = ghostState(view(at('feedback', { feedback: feedback(reaction) }), playing), SEED);
      expect(g).toMatchObject({ activity: 'speaking', expression: reaction, speech: { timeline, startedAt: 1234 } });
    },
  );

  it.each<Phase>(['answering', 'confirming'])('%s, no line playing → listening / attentive', (phase) => {
    expect(ghostState(view(at(phase), finished), SEED)).toEqual({ activity: 'listening', expression: 'attentive', seed: SEED });
  });

  it('evaluating → thinking / thinking', () => {
    expect(ghostState(view(at('evaluating'), finished), SEED)).toEqual({ activity: 'thinking', expression: 'thinking', seed: SEED });
  });

  it.each<Feedback['reaction']>(['approving', 'skeptical'])('feedback, after the line → reacting / %s', (reaction) => {
    expect(ghostState(view(at('feedback', { feedback: feedback(reaction) }), finished), SEED)).toEqual({
      activity: 'reacting',
      expression: reaction,
      seed: SEED,
    });
  });

  it.each<[Phase, GhostSessionView['line']]>([
    ['intro', undefined],
    ['summary', finished],
    ['privacy', finished],
  ])('%s with no line playing → idle / neutral', (phase, line) => {
    expect(ghostState(view(at(phase), line), SEED)).toEqual({ activity: 'idle', expression: 'neutral', seed: SEED });
  });

  it('only a playing line carries speech, so a finished line never moves the mouth', () => {
    for (const phase of ['intro', 'privacy', 'asking', 'answering', 'confirming', 'evaluating', 'feedback', 'summary'] as const) {
      const state = phase === 'feedback' ? at(phase, { feedback: feedback('approving') }) : at(phase);
      expect(ghostState(view(state, finished), SEED).speech).toBeUndefined();
      expect(ghostState(view(state, playing), SEED).speech).toEqual({ timeline, startedAt: 1234 });
    }
  });
});
