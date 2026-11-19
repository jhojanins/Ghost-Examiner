import type { Locale } from '../i18n/i18n';
import type { ConfirmedAnswer, Effect, LineRef, Question, QuestionPack, SessionEvent, SessionState } from './types';

type Result = { state: SessionState; effects: Effect[] };

export function initialState(pack: QuestionPack, locale: Locale): SessionState {
  return { pack, locale, phase: 'intro', questionIndex: 0, lineId: 0, candidateCount: 0 };
}

function speak(state: SessionState, line: LineRef): Result {
  return speakAll(state, [line]);
}
/** One `speak` effect per line, with consecutive line ids (a reply is spoken sentence by sentence). */
function speakAll(state: SessionState, lines: LineRef[]): Result {
  const effects: Effect[] = lines.map((line, i) => ({ type: 'speak', lineId: state.lineId + i + 1, line }));
  return { state: { ...state, lineId: state.lineId + lines.length }, effects };
}

// ---- Dynamic sessions (ghost-defense-live design §3.5) -----------------------------------
/** The summary phase: ask for a summary when there are turns, otherwise just say goodbye. */
function enterSummary(state: SessionState): Result {
  const cleared = { ...state, phase: 'summary' as const, candidate: undefined, confirmed: undefined, reply: undefined, followUp: undefined, draft: undefined };
  const turns = state.turns ?? [];
  if (turns.length === 0) return speak(cleared, { localized: state.pack.closing });
  return { state: cleared, effects: [{ type: 'summarize', turns, locale: state.locale }] };
}
/** The next main question, or the summary after the last one. */
function nextMain(state: SessionState): Result {
  const nextIndex = state.questionIndex + 1;
  const next = state.pack.questions[nextIndex];
  if (!next) return enterSummary(state);
  const cleared = { ...state, candidate: undefined, confirmed: undefined, reply: undefined, followUp: undefined, draft: undefined };
  return speak({ ...cleared, phase: 'asking', questionIndex: nextIndex }, { localized: next.prompt });
}
/** The follow-up asked after a follow-up reply: same passage, one per main question (Req 4.6). */
function followUpOf(main: Question, text: string): Question {
  const q: Question = { id: `${main.id}:follow-up`, kind: 'free-text', prompt: { en: text, es: text }, keyPoints: [], followUpOf: main.id };
  if (main.source) q.source = main.source;
  return q;
}

/**
 * Pure session reducer: transition table in design §3.3. No clock and no timer effects,
 * so only user events leave `answering` and `confirming` (Req 5.4, 5.6).
 * Any event not valid in the current phase returns the same state object and no effects.
 */
export function reduce(state: SessionState, event: SessionEvent): Result {
  const unchanged: Result = { state, effects: [] };
  const dynamic = state.pack.dynamic !== undefined;
  const question = state.followUp ?? state.pack.questions[state.questionIndex];

  switch (event.type) {
    case 'start':
      return state.phase === 'intro' ? speak({ ...state, phase: 'privacy' }, { localized: state.pack.greeting }) : unchanged;

    case 'privacy-accepted':
      if (state.phase !== 'privacy') return unchanged;
      if (state.pack.dynamic) {
        return { state: { ...state, phase: 'preparing' }, effects: [{ type: 'prepare-questions', count: state.pack.dynamic.count, locale: state.locale }] };
      }
      return speak({ ...state, phase: 'asking' }, { localized: question.prompt });

    case 'questions-ready': {
      if (!dynamic || state.phase !== 'preparing') return unchanged;
      const ready = { ...state, pack: { ...state.pack, questions: event.questions }, questionIndex: 0, turns: [] };
      const first = event.questions[0];
      return first ? speak({ ...ready, phase: 'asking' }, { localized: first.prompt }) : enterSummary(ready);
    }

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
      return !dynamic && state.phase === 'evaluating'
        ? speak(
            { ...state, phase: 'feedback', feedback: event.feedback },
            { text: event.feedback.summary, locale: event.feedback.locale },
          )
        : unchanged;

    case 'reply-ready': {
      if (!dynamic || state.phase !== 'evaluating' || !state.confirmed) return unchanged;
      // A follow-up's reply can't ask another follow-up (Req 4.6): it stands as an acknowledgment.
      const reply =
        question.followUpOf !== undefined && event.reply.kind === 'follow-up'
          ? { kind: 'acknowledgment' as const, say: event.reply.say }
          : event.reply;
      const turn = { question: question.prompt[state.locale], answer: state.confirmed.text, kind: reply.kind };
      return speakAll(
        { ...state, phase: 'feedback', reply, turns: [...(state.turns ?? []), turn] },
        reply.say.map((text) => ({ text, locale: state.locale })),
      );
    }

    case 'next': {
      if (state.phase !== 'feedback') return unchanged;
      if (dynamic) {
        // Only a main question's reply can be a follow-up (see reply-ready), so this asks at most one.
        const followUpText = state.reply?.kind === 'follow-up' ? state.reply.followUp : undefined;
        if (followUpText === undefined) return nextMain(state);
        const q = followUpOf(question, followUpText);
        const cleared = { ...state, candidate: undefined, confirmed: undefined, reply: undefined, draft: undefined };
        return speak({ ...cleared, phase: 'asking', followUp: q }, { localized: q.prompt });
      }
      const cleared = { ...state, candidate: undefined, confirmed: undefined, feedback: undefined };
      const nextIndex = state.questionIndex + 1;
      const nextQuestion = state.pack.questions[nextIndex];
      return nextQuestion
        ? speak({ ...cleared, phase: 'asking', questionIndex: nextIndex }, { localized: nextQuestion.prompt })
        : speak({ ...cleared, phase: 'summary' }, { localized: state.pack.closing });
    }

    case 'skip':
      return dynamic && (state.phase === 'asking' || state.phase === 'answering') ? nextMain(state) : unchanged;

    case 'end':
      return dynamic && ['preparing', 'asking', 'answering', 'confirming', 'evaluating', 'feedback'].includes(state.phase)
        ? enterSummary(state)
        : unchanged;

    case 'summary-ready':
      if (!dynamic || state.phase !== 'summary' || state.summary) return unchanged;
      return speakAll({ ...state, summary: event.summary }, [
        ...[event.summary.strength, ...event.summary.review.map((p) => p.point)].map((text) => ({ text, locale: state.locale })),
        { localized: state.pack.closing },
      ]);

    case 'locale-changed':
      // A dynamic session never asks for the same reply twice; the next line uses the new language.
      if (!dynamic && state.phase === 'feedback' && state.confirmed) {
        return {
          state: { ...state, phase: 'evaluating', locale: event.locale, feedback: undefined },
          effects: [{ type: 'evaluate', question, answer: state.confirmed, locale: event.locale }],
        };
      }
      return { state: { ...state, locale: event.locale }, effects: [] };
  }
}
