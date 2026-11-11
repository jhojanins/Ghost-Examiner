import type { Locale } from '../i18n/i18n';
import type { ConfirmedAnswer, Effect, LineRef, QuestionPack, SessionEvent, SessionState } from './types';

type Result = { state: SessionState; effects: Effect[] };

export function initialState(pack: QuestionPack, locale: Locale): SessionState {
  return { pack, locale, phase: 'intro', questionIndex: 0, lineId: 0, candidateCount: 0 };
}

function speak(state: SessionState, line: LineRef): Result {
  const lineId = state.lineId + 1;
  return { state: { ...state, lineId }, effects: [{ type: 'speak', lineId, line }] };
}

/**
 * Pure session reducer: transition table in design §3.3. No clock and no timer effects,
 * so only user events leave `answering` and `confirming` (Req 5.4, 5.6).
 * Any event not valid in the current phase returns the same state object and no effects.
 */
export function reduce(state: SessionState, event: SessionEvent): Result {
  const unchanged: Result = { state, effects: [] };
  const question = state.pack.questions[state.questionIndex];

  switch (event.type) {
    case 'start':
      return state.phase === 'intro' ? speak({ ...state, phase: 'privacy' }, { localized: state.pack.greeting }) : unchanged;

    case 'privacy-accepted':
      return state.phase === 'privacy' ? speak({ ...state, phase: 'asking' }, { localized: question.prompt }) : unchanged;

    case 'line-done':
      return state.phase === 'asking' && event.lineId === state.lineId
        ? { state: { ...state, phase: 'answering' }, effects: [] }
        : unchanged;

    case 'candidate': {
      if (state.phase !== 'asking' && state.phase !== 'answering') return unchanged;
      const candidateId = state.candidateCount + 1;
      return {
        state: { ...state, phase: 'confirming', candidateCount: candidateId, candidate: { ...event.candidate, candidateId }, draft: undefined },
        effects: [],
      };
    }

    case 'retry':
      return state.phase === 'confirming'
        ? { state: { ...state, phase: 'answering', candidate: undefined }, effects: [] }
        : unchanged;

    case 'edit':
      return state.phase === 'confirming'
        ? { state: { ...state, phase: 'answering', candidate: undefined, draft: state.candidate?.text }, effects: [] }
        : unchanged;

    case 'confirm': {
      if (state.phase !== 'confirming' || state.candidate?.candidateId !== event.candidateId) return unchanged;
      // The only place a ConfirmedAnswer is created (Req 5.2, 5.3).
      const answer = { ...state.candidate } as ConfirmedAnswer;
      return {
        state: { ...state, phase: 'evaluating', confirmed: answer },
        effects: [{ type: 'evaluate', question, answer, locale: state.locale }],
      };
    }

    case 'feedback-ready':
      return state.phase === 'evaluating'
        ? speak(
            { ...state, phase: 'feedback', feedback: event.feedback },
            { text: event.feedback.summary, locale: event.feedback.locale },
          )
        : unchanged;

    case 'next': {
      if (state.phase !== 'feedback') return unchanged;
      const cleared = { ...state, candidate: undefined, confirmed: undefined, feedback: undefined };
      const nextIndex = state.questionIndex + 1;
      const nextQuestion = state.pack.questions[nextIndex];
      return nextQuestion
        ? speak({ ...cleared, phase: 'asking', questionIndex: nextIndex }, { localized: nextQuestion.prompt })
        : speak({ ...cleared, phase: 'summary' }, { localized: state.pack.closing });
    }

    case 'locale-changed':
      if (state.phase === 'feedback' && state.confirmed) {
        return {
          state: { ...state, phase: 'evaluating', locale: event.locale, feedback: undefined },
          effects: [{ type: 'evaluate', question, answer: state.confirmed, locale: event.locale }],
        };
      }
      return { state: { ...state, locale: event.locale }, effects: [] };
  }
}
