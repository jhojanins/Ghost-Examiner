import {
  buildTimeline,
  createDemoProvider,
  initialState,
  kitMessages,
  parseDefenseQuestions,
  parseDefenseReply,
  parseDefenseSummary,
  selectExcerpts,
  type DefenseQuestion,
  type DefenseReply,
  type DefenseSummary,
  type Excerpt,
  type LLMProvider,
  type LLMRequest,
  type Parsed,
  type Question,
  type Turn,
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
  /** Dynamic packs (ghost-defense-live): the provider chain and the user's file, already split. */
  defense?: { provider: LLMProvider; excerpts: readonly Excerpt[]; fileLang: Locale };
  /** Runs `fn` after `ms` and returns a cancel function; for the waiting line. Defaults to `setTimeout`. */
  schedule?: (fn: () => void, ms: number) => () => void;
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
  /** Dynamic sessions: whether replies now come from AI or from the demo rules (Req 10.3). */
  defense?: { mode: 'ai' | 'demo' };
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

// ---- ghost-defense-live (design §4.3) ------------------------------------------------------
const EXCERPT_BUDGET = 6000; // characters of file text per request (Req 9.4)
const ANSWER_MAX = 2000;
const SUMMARY_ANSWER_MAX = 400;
const WAITING_MS = 1500;
const MAX_OUTPUT_TOKENS: Record<Exclude<LLMRequest['task'], 'evaluate-answer'>, number> = {
  'defense-questions': 800,
  'defense-reply': 400,
  'defense-summary': 500,
};
const defaultSchedule = (fn: () => void, ms: number) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};
const asInput = (es: readonly Excerpt[]) => es.map(({ id, text }) => ({ id, text }));
function toQuestion(q: DefenseQuestion, i: number): Question {
  return { id: `q${i + 1}`, kind: 'free-text', prompt: { en: q.prompt, es: q.prompt }, keyPoints: [], source: { excerptId: q.excerptId, quote: q.quote } };
}
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
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
  // Lines from one dispatch play one after another (a reply, sentence by sentence); a later dispatch replaces them.
  let queued: { id: number; ref: LineRef }[] = [];
  let inputLocale: Locale | undefined; // the language they last heard about
  let transcript: readonly TranscriptEntry[] = [];
  const defense = deps.defense;
  if (deps.pack.dynamic && !defense) throw new Error('A dynamic pack needs `defense` (provider and excerpts).');
  const schedule = deps.schedule ?? defaultSchedule;
  const demo = createDemoProvider();
  let demoPinned = defense?.provider.isDemo ?? true; // after the first fallback, demo for the rest (Req 10.3)
  let localLineId = 0; // runtime lines (the waiting line) count down, so they never meet an engine line id
  const defenseView = () => (defense ? { mode: demoPinned ? ('demo' as const) : ('ai' as const) } : undefined);
  let view: SessionView = { state, transcript, preview, defense: defenseView() };
  const listeners = new Set<() => void>();

  /**
   * Asks the provider, checks the output with its guard, and falls back to the demo rules on any
   * failure (Req 10.1, 10.2, 10.5): the turn is never lost. Demo output always passes the guards.
   */
  async function ask<T>(req: LLMRequest, parse: (value: unknown) => Parsed<T>, fallback: T): Promise<T> {
    if (!demoPinned && defense) {
      const r = await defense.provider.complete(req).catch(() => ({ ok: false }) as const);
      const parsed = r.ok ? parse(parseJson(r.text)) : undefined;
      if (parsed?.ok) return parsed.value;
      demoPinned = true;
    }
    const r = await demo.complete(req);
    const parsed = r.ok ? parse(parseJson(r.text)) : undefined;
    return parsed?.ok ? parsed.value : fallback;
  }

  async function prepareQuestions(count: number, locale: Locale) {
    if (!defense) return;
    // While the greeting still plays, the waiting line waits behind it (and the questions may replace it).
    const cancelWaiting = schedule(() => {
      if (state.phase !== 'preparing') return;
      const waiting = { id: --localLineId, ref: { text: kitMessages[locale]['defense.waiting'], locale } };
      if (line?.playing) queued = [...queued, waiting];
      else play(waiting.id, waiting.ref);
    }, WAITING_MS);
    const ctx = { excerpts: defense.excerpts, locale, count };
    const req: LLMRequest = {
      task: 'defense-questions',
      locale,
      maxOutputTokens: MAX_OUTPUT_TOKENS['defense-questions'],
      input: { excerpts: asInput(selectExcerpts(defense.excerpts, { budget: EXCERPT_BUDGET })), count, fileLang: defense.fileLang },
    };
    const parse = (v: unknown) => parseDefenseQuestions(v, ctx);
    let questions = (await ask(req, parse, [])).slice(0, count); // the rest are spares (design §3.2)
    if (questions.length < count) {
      // Too few left after the guard: fill up with demo questions on passages not used yet (Req 6.4).
      const r = await demo.complete(req);
      const extra = r.ok ? parse(parseJson(r.text)) : undefined;
      const used = new Set(questions.map((q) => q.excerptId));
      for (const q of extra?.ok ? extra.value : []) if (questions.length < count && !used.has(q.excerptId)) questions = [...questions, q];
    }
    cancelWaiting();
    dispatch({ type: 'questions-ready', questions: questions.map(toQuestion) });
  }

  async function reply(question: Question, answer: string, locale: Locale) {
    if (!defense) return;
    const followUpAllowed = question.followUpOf === undefined;
    const around = question.source?.excerptId;
    const req: LLMRequest = {
      task: 'defense-reply',
      locale,
      maxOutputTokens: MAX_OUTPUT_TOKENS['defense-reply'],
      input: {
        excerpts: asInput(selectExcerpts(defense.excerpts, { budget: EXCERPT_BUDGET, ...(around !== undefined && { around }) })),
        question: question.prompt[locale],
        quote: question.source?.quote ?? '',
        answer: answer.slice(0, ANSWER_MAX),
        followUpAllowed,
      },
    };
    const m = kitMessages[locale];
    let r: DefenseReply = await ask(req, (v) => parseDefenseReply(v, { excerpts: defense.excerpts, locale, followUpAllowed }), {
      kind: 'acknowledgment',
      say: [m['defense.demo.partly']],
    });
    // A correction without a verified quote: the ghost says so in its own words (Req 6.3).
    if (r.kind === 'unsupported') r = { kind: 'unsupported', say: [m['defense.cantPoint']] };
    dispatch({ type: 'reply-ready', reply: r });
  }

  async function summarize(turns: Turn[], locale: Locale) {
    if (!defense) return;
    const req: LLMRequest = {
      task: 'defense-summary',
      locale,
      maxOutputTokens: MAX_OUTPUT_TOKENS['defense-summary'],
      input: {
        turns: turns.map((t) => ({ ...t, answer: t.answer.slice(0, SUMMARY_ANSWER_MAX) })),
        excerpts: asInput(selectExcerpts(defense.excerpts, { budget: EXCERPT_BUDGET })),
      },
    };
    const summary: DefenseSummary = await ask(req, (v) => parseDefenseSummary(v, { excerpts: defense.excerpts, locale }), {
      strength: kitMessages[locale]['defense.demo.strength.effort'],
      review: [],
    });
    dispatch({ type: 'summary-ready', summary });
  }

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
    queued = [];
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
      const next = queued.shift();
      if (next) play(next.id, next.ref);
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
    // A follow-up is a new question at the same index (ghost-defense-live): restart the inputs for it.
    const key = answerable ? `${state.questionIndex}${state.followUp ? ':follow-up' : ''}` : undefined;
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
    const { id, kind } = state.followUp ?? state.pack.questions[state.questionIndex];
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
    const lines = effects.flatMap((e) => (e.type === 'speak' ? [{ id: e.lineId, ref: e.line }] : []));
    if (lines.length > 0 && event.type === 'questions-ready' && line?.playing) {
      queued = lines; // the greeting (or the waiting line) finishes first, then the first question (Req 4.2)
    } else if (lines.length > 0) {
      queued = lines.slice(1);
      play(lines[0].id, lines[0].ref);
    }
    for (const effect of effects) {
      switch (effect.type) {
        case 'prepare-questions':
          void prepareQuestions(effect.count, effect.locale);
          break;
        case 'summarize':
          void summarize(effect.turns, effect.locale);
          break;
        case 'evaluate':
          if (state.pack.dynamic) void reply(effect.question, effect.answer.text, effect.locale);
          else void deps.evaluator.evaluate(effect.question, effect.answer, effect.locale).then((feedback) => dispatch({ type: 'feedback-ready', feedback }));
          break;
      }
    }
    // Owner decision (task 27): an answer submitted while the question plays stops the ghost.
    if (state.phase === 'confirming' && before.phase !== 'confirming') cancelLine();
    if (state.locale !== before.locale) relocalize();
    syncInputs();
    view = { state, line, transcript, preview, defense: defenseView() };
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
