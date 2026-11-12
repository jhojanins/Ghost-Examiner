import {
  buildTimeline,
  initialState,
  reduce,
  validatePack,
  type Evaluator,
  type InputAdapter,
  type InputEvent,
  type InputMethodId,
  type LineRef,
  type Locale,
  type PackIssue,
  type QuestionPack,
  type SessionEvent,
  type SessionState,
  type Timeline,
} from '@ghost-examiner/core';
import type { Playback, SpeechOutput } from './silent-output';

export interface SessionDeps {
  pack: QuestionPack;
  adapters: readonly InputAdapter[];
  preview: boolean;
  evaluator: Evaluator;
  speech: SpeechOutput;
  locale: Locale;
  /**
   * Registered methods this browser can't use (`unavailableInputs`, spec b Req 10.3). They never
   * count toward the two-method rule and are never started. Defaults to none.
   */
  unavailable?: readonly InputMethodId[];
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
  /** The line was audio when it stopped, so the user already heard it (Req 3.6). */
  heard: boolean;
}

export interface SessionView {
  state: SessionState;
  line?: LineView;
  /** Every line the ghost said, in order (Req 4.4). */
  transcript: readonly TranscriptEntry[];
  /**
   * Set when this browser leaves a question with fewer than 2 available methods, so the session runs
   * as a Preview session (spec b Req 10.4): the shell shows the Preview label and says what's missing.
   */
  preview?: { missing: InputMethodId[] };
}

export type SessionHandle =
  | {
      getSnapshot(): SessionView;
      subscribe(listener: () => void): () => void;
      dispatch(event: SessionEvent): void;
    }
  | { blocked: PackIssue[] }; // strict build with validation errors, or an empty pack (Req 5.5)

/** The registered methods this browser can't use, once each, in registration order (spec b Req 10.3). */
export async function unavailableInputs(adapters: readonly InputAdapter[]): Promise<InputMethodId[]> {
  const checks = await Promise.all(adapters.map(async (a) => ({ id: a.id, ok: (await a.checkAvailability()).available })));
  return [...new Set(checks.filter((c) => !c.ok).map((c) => c.id))];
}

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

  // Preview session (spec b design §3.4): check again with only the methods this browser can use.
  // A question the pack already flagged keeps its build warning; only new shortfalls count.
  const unavailable = deps.unavailable ?? [];
  const adapters = deps.adapters.filter((a) => !unavailable.includes(a.id));
  const flagged = new Set(issues.map((i) => ('questionId' in i ? i.questionId : '')));
  const lost = validatePack(deps.pack, adapters, { preview: true }).filter(
    (i) => i.kind === 'too-few-inputs' && !flagged.has(i.questionId),
  );
  for (const issue of lost) console.warn('Ghost Examiner: question pack issue (Preview session)', issue);
  const missing = [...new Set(deps.adapters.map((a) => a.id).filter((id) => unavailable.includes(id)))];
  const preview = lost.length > 0 ? { missing } : undefined;

  let state = initialState(deps.pack, deps.locale);
  let line: LineView | undefined;
  let lineRef: LineRef | undefined;
  let playback = 0; // identifies the current playback, so a cancelled one never ends the line
  let current: Playback | undefined; // the current line's playback
  let inputKey: string | undefined; // the question the adapters were started for
  let inputLocale: Locale | undefined; // the language they last heard about
  let transcript: readonly TranscriptEntry[] = [];
  let view: SessionView = { state, transcript, preview };
  const listeners = new Set<() => void>();

  /**
   * The current line stops playing and goes into the transcript in the language it ended in.
   * Once only: a line that is not playing returns early, and a replay keeps the same playing line.
   * Call it before `speech.cancel()`: `heard` reads whether the line is still audio.
   */
  function stopLine() {
    if (!line?.playing) return;
    line = { ...line, playing: false };
    const heard = current?.audible() ?? false;
    transcript = [...transcript, { id: line.id, text: line.text, locale: line.locale, heard }];
  }

  /**
   * Silences the ghost now. Its playback still resolves and sends `line-done`, which the engine
   * ignores: it accepts `line-done` only in `asking`, and every new line there has a new id.
   */
  function cancelLine() {
    if (!line?.playing) return;
    stopLine();
    deps.speech.cancel();
  }

  function play(id: number, ref: LineRef) {
    if (line && line.id !== id) stopLine(); // a newer line replaces the older one (a replay keeps it)
    const { text, locale } = resolveLine(ref, state.locale);
    const timeline = buildTimeline(text, locale);
    deps.speech.cancel(); // a newer line cancels the older one
    const token = ++playback;
    current = deps.speech.speak({ text, locale, timeline });
    const { startedAt, origin, done } = current;
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

  /**
   * Inputs listen only while the current question can be answered (asking or answering). A language
   * switch doesn't restart them: adapters that care get `setLocale` and keep the answer going
   * (spec b design §3.5, Req 4.6).
   */
  function syncInputs() {
    const answerable = state.phase === 'asking' || state.phase === 'answering';
    const key = answerable ? String(state.questionIndex) : undefined;
    if (key !== undefined && key === inputKey) {
      if (state.locale !== inputLocale) for (const adapter of adapters) adapter.setLocale?.(state.locale);
      inputLocale = state.locale;
      return;
    }
    if (key === inputKey) return;
    if (inputKey !== undefined) for (const adapter of adapters) adapter.stop();
    inputKey = key;
    inputLocale = state.locale;
    if (key === undefined) return;
    const { id, kind } = state.pack.questions[state.questionIndex];
    // Candidates go to the engine. A `partial` is accepted and changes nothing yet; barge-in uses
    // it in task 38 (spec b design §3.5).
    const onInput = (e: InputEvent) => e.type === 'candidate' && dispatch(e);
    for (const adapter of adapters) adapter.start({ question: { id, kind }, locale: state.locale }, onInput);
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
    view = { state, line, transcript, preview };
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
