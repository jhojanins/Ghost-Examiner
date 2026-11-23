import {
  buildTimeline,
  createDemoProvider,
  initialState,
  kitMessages,
  parseDefenseQuestions,
  createReplyReader,
  inLanguage,
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
  /**
   * A streamed reply: how many of its sentences have started playing, so the app can show each one
   * when it is spoken (owner decision 2026-11-20). Undefined for a reply that came whole.
   */
  replyPlayed?: number;
  /** Dynamic sessions: whether replies now come from AI or from the demo rules (Req 10.3). */
  defense?: {
    /** Where the questions and replies so far came from: all AI, all demo rules, or some of each (Req 10.3). */
    mode: 'ai' | 'demo' | 'mixed';
    /** Who wrote the summary, once it is there (Req 8.2). */
    summaryFrom?: 'ai' | 'demo';
  };
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
const FIRST_SENTENCE_MS = 8000; // Req 5.3
/** Latency marks for the owner's check (design §4.3): read them with performance.getEntriesByType('mark'). */
const mark = (name: string) => globalThis.performance?.mark?.(`ghost-defense:${name}`);
/**
 * How a streamed reply ended (task 23): `done` with the reply to record (whole, or cut after
 * sentences were said), `unsupported` (a correction whose quote isn't in the file), `demo` (nothing
 * was said and the demo rules answer: a timeout, a rate limit, a bad head or first sentence), or
 * `whole` (the stream failed before anything was said: try the non-streaming request).
 */
type StreamOutcome = { kind: 'done'; reply: DefenseReply } | { kind: 'unsupported' } | { kind: 'demo' } | { kind: 'whole' };
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
  const streamedLine = new Map<number, number>(); // line id → index of the streamed sentence it says
  let replyPlayed: number | undefined;
  let awaitingFirstPlay = false; // for the latency mark of the first streamed sentence
  let fallbackPending = false; // the fallback line goes before the next lines the ghost says (Req 10.2)
  // What actually answered so far: the mode label must never call a demo answer AI, nor hide that
  // some answers were AI (Req 10.3).
  const used = { ai: false, demo: false };
  let summaryFrom: 'ai' | 'demo' | undefined;
  const defenseView = (): SessionView['defense'] => {
    if (!defense) return undefined;
    const mode = used.ai && used.demo ? 'mixed' : used.ai || (!used.demo && !demoPinned) ? 'ai' : 'demo';
    return summaryFrom ? { mode, summaryFrom } : { mode };
  };
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
      if (parsed?.ok) {
        used.ai = true;
        if (req.task === 'defense-summary') summaryFrom = 'ai';
        return parsed.value;
      }
      demoPinned = true;
      fallbackPending = true;
    }
    used.demo = true;
    if (req.task === 'defense-summary') summaryFrom = 'demo';
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
      const taken = new Set(questions.map((q) => q.excerptId));
      const before = questions.length;
      for (const q of extra?.ok ? extra.value : []) if (questions.length < count && !taken.has(q.excerptId)) questions = [...questions, q];
      if (questions.length > before) used.demo = true;
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
    const ctx = { excerpts: defense.excerpts, locale, followUpAllowed };
    mark('reply-requested');
    if (!demoPinned && defense.provider.stream) {
      const outcome = await streamReply(req, ctx);
      if (outcome.kind === 'done' || outcome.kind === 'unsupported') {
        used.ai = true;
        const r = outcome.kind === 'done' ? outcome.reply : { kind: 'unsupported' as const, say: [m['defense.cantPoint']] };
        return dispatch({ type: 'reply-ready', reply: r });
      }
      if (outcome.kind === 'demo') {
        demoPinned = true;
        fallbackPending = true;
      }
    }
    let r: DefenseReply = await ask(req, (v) => parseDefenseReply(v, ctx), {
      kind: 'acknowledgment',
      say: [m['defense.demo.partly']],
    });
    // A correction without a verified quote: the ghost says so in its own words (Req 6.3).
    if (r.kind === 'unsupported') r = { kind: 'unsupported', say: [m['defense.cantPoint']] };
    dispatch({ type: 'reply-ready', reply: r });
  }

  /**
   * A streamed reply (design §4.3, Req 5.1, 5.4): the head is checked with the full guard, with the
   * first sentence, before anything is shown, so a quote appears only once verified. Each sentence
   * then passes the per-sentence check and the language check before it is said. No first sentence
   * within 8 s means the demo rules answer (Req 5.3). A stream cut after sentences were said keeps
   * them and the turn, and the rest of the session is demo (Req 10.5).
   */
  function streamReply(req: LLMRequest, ctx: { excerpts: readonly Excerpt[]; locale: Locale; followUpAllowed: boolean }): Promise<StreamOutcome> {
    const provider = defense!.provider;
    return new Promise((resolve) => {
      const reader = createReplyReader();
      const abort = new AbortController();
      let settled = false;
      let firstByte = true;
      let head: { kind: string; excerptId?: string; quote?: string } | undefined;
      let shown: DefenseReply | undefined; // the head as checked, with the sentences said so far
      const cancelTimer = schedule(() => {
        if (!shown) settle({ kind: 'demo' });
      }, FIRST_SENTENCE_MS);
      function settle(outcome: StreamOutcome) {
        if (settled) return;
        settled = true;
        cancelTimer();
        abort.abort(); // nothing more is read: stop the request
        resolve(outcome);
      }
      /** The stream broke: keep what was said, or let the demo rules answer when nothing was. */
      function cut() {
        if (!shown) return settle({ kind: 'demo' });
        demoPinned = true;
        fallbackPending = true;
        settle({ kind: 'done', reply: shown }); // a cut follow-up asks nothing more: next goes on
      }
      function sentence(text: string) {
        if (!inLanguage(text, ctx.locale)) return cut();
        if (!shown) {
          // The head, checked as a whole reply with this first sentence (a follow-up gets a stand-in question).
          const probe = { ...head, say: [text], ...(head?.kind === 'follow-up' && { followUp: kitMessages[ctx.locale]['defense.demo.followUp'] }) };
          const checked = parseDefenseReply(probe, ctx);
          if (!checked.ok) return settle({ kind: 'demo' });
          if (checked.value.kind === 'unsupported') return settle({ kind: 'unsupported' });
          cancelTimer();
          shown = { ...checked.value };
          delete shown.followUp; // only the stand-in so far; the real one comes with the end
          mark('first-sentence');
          awaitingFirstPlay = true;
        } else {
          shown = { ...shown, say: [...shown.say, text] };
        }
        dispatch({ type: 'reply-partial', reply: shown });
      }
      function onEvents(events: ReturnType<typeof reader.push>) {
        for (const e of events) {
          if (settled) return;
          if (e.type === 'head') head = e.head;
          else if (e.type === 'sentence') sentence(e.text);
          else if (e.type === 'error') cut();
          else {
            // The whole reply, through the full guard; it must say exactly what was said.
            const final = parseDefenseReply(e.value, ctx);
            // The reader emitted exactly its say items, and the head was already checked, so the guard agrees.
            if (final.ok) settle({ kind: 'done', reply: final.value });
            else cut();
          }
        }
      }
      provider
        .stream!(
          req,
          (chunk) => {
            if (settled) return;
            if (firstByte) mark('first-byte');
            firstByte = false;
            onEvents(reader.push(chunk));
          },
          abort.signal,
        )
        .then(
          (r) => {
            if (settled) return;
            if (r.ok) onEvents(reader.end());
            if (settled) return;
            if (shown) return cut();
            const quick = !r.ok && (r.error === 'rate-limited' || r.error === 'too-large');
            settle({ kind: quick ? 'demo' : 'whole' });
          },
          () => (shown ? cut() : settle({ kind: 'whole' })),
        );
    });
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
    const sentence = streamedLine.get(id);
    if (sentence !== undefined) replyPlayed = Math.max(replyPlayed ?? 0, sentence + 1);
    if (awaitingFirstPlay && state.replyStreaming) {
      awaitingFirstPlay = false;
      mark('first-sentence-played');
    }
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
    // A cut stream ends with a reply-ready that may add no line: the fallback line is said anyway.
    if (fallbackPending && (lines.length > 0 || event.type === 'reply-ready')) {
      fallbackPending = false;
      lines.unshift({ id: --localLineId, ref: { text: kitMessages[state.locale]['defense.fallback'], locale: state.locale } });
    }
    const streamed = event.type === 'reply-partial' || (event.type === 'reply-ready' && before.replyStreaming);
    if (streamed) {
      const said = before.replyStreaming ? (before.reply?.say.length ?? 0) : 0;
      effects.forEach((e, i) => e.type === 'speak' && streamedLine.set(e.lineId, said + i));
      replyPlayed ??= 0;
    }
    if (!state.reply) {
      streamedLine.clear();
      replyPlayed = undefined;
    }
    if (lines.length > 0 && streamed && line?.playing) {
      queued = [...queued, ...lines]; // a streamed sentence waits for the one playing (Req 5.1)
    } else if (lines.length > 0 && event.type === 'questions-ready' && line?.playing) {
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
    view = { state, line, transcript, preview, defense: defenseView(), ...(replyPlayed !== undefined && { replyPlayed }) };
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
