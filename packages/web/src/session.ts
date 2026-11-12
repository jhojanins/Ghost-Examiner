import {
  buildTimeline,
  initialState,
  reduce,
  validatePack,
  type Evaluator,
  type InputAdapter,
  type LineRef,
  type Locale,
  type PackIssue,
  type QuestionPack,
  type SessionEvent,
  type SessionState,
  type Timeline,
} from '@ghost-examiner/core';
import type { SpeechOutput } from './silent-output';

export interface SessionDeps {
  pack: QuestionPack;
  adapters: readonly InputAdapter[];
  preview: boolean;
  evaluator: Evaluator;
  speech: SpeechOutput;
  locale: Locale;
}

/** The ghost line on screen: what captions show and what the mouth plays. */
export interface LineView {
  id: number;
  text: string;
  locale: Locale;
  timeline: Timeline;
  startedAt: number; // on the speech output's clock; identifies the playback
  origin: () => number; // the timeline's current time origin, read every frame (spec b design §3.1)
  playing: boolean;
}

/** A ghost line that has stopped (finished, replaced by a newer line, or cancelled). */
export interface TranscriptEntry {
  id: number;
  text: string;
  locale: Locale;
}

export interface SessionView {
  state: SessionState;
  line?: LineView;
  /** Every line the ghost said, in order (Req 4.4). */
  transcript: readonly TranscriptEntry[];
}

export type SessionHandle =
  | {
      getSnapshot(): SessionView;
      subscribe(listener: () => void): () => void;
      dispatch(event: SessionEvent): void;
    }
  | { blocked: PackIssue[] }; // strict build with validation errors, or an empty pack (Req 5.5)

function resolveLine(ref: LineRef, locale: Locale): { text: string; locale: Locale } {
  return 'localized' in ref ? { text: ref.localized[locale], locale } : { text: ref.text, locale: ref.locale };
}

/**
 * Runs one session (design §4.1): `dispatch` runs the pure `reduce`, stores the state,
 * executes its effects (speak, evaluate), and notifies listeners once per change.
 */
export function createSession(deps: SessionDeps): SessionHandle {
  const issues = validatePack(deps.pack, deps.adapters, { preview: deps.preview });
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) return { blocked: errors };
  for (const issue of issues) console.warn('Ghost Examiner: question pack issue (Preview build)', issue);

  let state = initialState(deps.pack, deps.locale);
  let line: LineView | undefined;
  let lineRef: LineRef | undefined;
  let playback = 0; // identifies the current playback, so a cancelled one never ends the line
  let inputKey: string | undefined; // question and locale the adapters were started for
  let transcript: readonly TranscriptEntry[] = [];
  let view: SessionView = { state, transcript };
  const listeners = new Set<() => void>();

  /**
   * The current line stops playing and goes into the transcript in the language it ended in.
   * Once only: a line that is not playing returns early, and a replay keeps the same playing line.
   */
  function stopLine() {
    if (!line?.playing) return;
    line = { ...line, playing: false };
    transcript = [...transcript, { id: line.id, text: line.text, locale: line.locale }];
  }

  /**
   * Silences the ghost now. Its playback still resolves and sends `line-done`, which the engine
   * ignores: it accepts `line-done` only in `asking`, and every new line there has a new id.
   */
  function cancelLine() {
    if (!line?.playing) return;
    deps.speech.cancel();
    stopLine();
  }

  function play(id: number, ref: LineRef) {
    if (line && line.id !== id) stopLine(); // a newer line replaces the older one (a replay keeps it)
    const { text, locale } = resolveLine(ref, state.locale);
    const timeline = buildTimeline(text, locale);
    deps.speech.cancel(); // a newer line cancels the older one
    const token = ++playback;
    const { startedAt, origin, done } = deps.speech.speak({ text, locale, timeline });
    line = { id, text, locale, timeline, startedAt, origin, playing: true };
    lineRef = ref;
    void done.then(() => {
      if (token !== playback || !line) return;
      stopLine();
      dispatch({ type: 'line-done', lineId: id }, true);
    });
  }

  /** After a language switch, show the current pack line in the new language (Req 9.2). */
  function relocalize() {
    if (!line || !lineRef || !('localized' in lineRef)) return; // feedback text is re-evaluated by the engine
    if (line.playing) return play(line.id, lineRef);
    const { text, locale } = resolveLine(lineRef, state.locale);
    line = { ...line, text, locale, timeline: buildTimeline(text, locale) };
  }

  /** Inputs listen only while the current question can be answered (asking or answering). */
  function syncInputs() {
    const answerable = state.phase === 'asking' || state.phase === 'answering';
    const key = answerable ? `${state.questionIndex}:${state.locale}` : undefined;
    if (key === inputKey) return;
    if (inputKey !== undefined) for (const adapter of deps.adapters) adapter.stop();
    inputKey = key;
    if (key === undefined) return;
    const { id, kind } = state.pack.questions[state.questionIndex];
    for (const adapter of deps.adapters) adapter.start({ question: { id, kind }, locale: state.locale }, (e) => dispatch(e));
  }

  function dispatch(event: SessionEvent, lineChanged = false) {
    const before = state;
    const { state: next, effects } = reduce(state, event);
    if (next === before && effects.length === 0 && !lineChanged) return;
    state = next;
    for (const effect of effects) {
      if (effect.type === 'speak') play(effect.lineId, effect.line);
      else {
        void deps.evaluator
          .evaluate(effect.question, effect.answer, effect.locale)
          .then((feedback) => dispatch({ type: 'feedback-ready', feedback }));
      }
    }
    // Owner decision (task 27): an answer submitted while the question plays stops the ghost.
    if (state.phase === 'confirming' && before.phase !== 'confirming') cancelLine();
    if (state.locale !== before.locale) relocalize();
    syncInputs();
    view = { state, line, transcript };
    for (const listener of listeners) listener();
  }

  return {
    getSnapshot: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch: (event) => dispatch(event),
  };
}
