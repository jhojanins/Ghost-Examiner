import {
  createDemoProvider,
  createKeyboardAdapter,
  kitMessages,
  splitExcerpts,
  type Evaluator,
  type LLMProvider,
  type LLMRequest,
  type QuestionPack,
  type Timeline,
} from '@ghost-examiner/core';
import { describe, expect, it, vi } from 'vitest';
import { createSession, type SessionDeps } from './session';
import type { Playback, SpeechOutput } from './silent-output';

// Fictional document and pack, test data only.
const DOC = `# Design

We chose a message queue because the payment service could not keep up with the evening peak.

# Results

We measured the checkout time for two weeks with forty volunteers from the club.

# Costs

The queue runs on the same small server, so the monthly cost did not change at all.

# Conclusion

Therefore a queue was enough for our size, and a second server was not needed.`;
const excerpts = splitExcerpts(DOC, { maxChars: 1500 });
const quoteOf = (i: number) => excerpts[i].text.split('\n\n')[1].trim().slice(0, 60);
const pack: QuestionPack = { id: 'defense', greeting: { en: 'Good evening.', es: 'Buenas noches.' }, closing: { en: 'That is all.', es: 'Eso es todo.' }, questions: [], dynamic: { count: 4 } };
const unusedEvaluator: Evaluator = { evaluate: vi.fn(async () => Promise.reject(new Error('not used in dynamic sessions'))) };
const morse = { id: 'morse', requires: { camera: false, microphone: false }, experimental: false, supports: ['free-text'], checkAvailability: async () => ({ available: true as const }), start() {}, stop() {} } as const;

/** A provider that answers each task from a script and records the requests. */
function scripted(script: Partial<Record<LLMRequest['task'], (req: LLMRequest, n: number) => unknown>>) {
  const calls: LLMRequest[] = [];
  const provider: LLMProvider = {
    id: 'proxy',
    isDemo: false,
    async complete(req) {
      calls.push(req);
      const answer = script[req.task]?.(req, calls.filter((c) => c.task === req.task).length);
      return answer === undefined ? { ok: false, error: 'unavailable' } : { ok: true, text: typeof answer === 'string' ? answer : JSON.stringify(answer) };
    },
  };
  return { provider, calls };
}
const fourQuestions = () => ({
  questions: [0, 1, 2, 3].map((i) => ({ excerptId: excerpts[i].id, quote: quoteOf(i), prompt: `Why is part ${i + 1} like this?` })),
});

function fakeSpeech() {
  const lines: { text: string; finish: () => void }[] = [];
  let now = 0;
  const speech: SpeechOutput = {
    speak: vi.fn(({ text }: { text: string; timeline: Timeline }) => {
      now += 1000;
      const startedAt = now;
      let finish!: () => void;
      const done = new Promise<void>((resolve) => (finish = resolve));
      lines.push({ text, finish });
      return { startedAt, origin: () => startedAt, audible: () => false, done } satisfies Playback;
    }),
    cancel: vi.fn(() => lines.at(-1)?.finish()),
  };
  return { speech, lines };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(provider: LLMProvider, extra: Partial<SessionDeps> = {}) {
  const { speech, lines } = fakeSpeech();
  const keyboard = createKeyboardAdapter();
  const timers: { fn: () => void; ms: number; cancelled: boolean }[] = [];
  const schedule = (fn: () => void, ms: number) => {
    const t = { fn, ms, cancelled: false };
    timers.push(t);
    return () => (t.cancelled = true);
  };
  const handle = createSession({
    pack,
    adapters: [keyboard, morse],
    preview: false,
    evaluator: unusedEvaluator,
    speech,
    locale: 'en',
    defense: { provider, excerpts, fileLang: 'en' },
    schedule,
    ...extra,
  });
  if ('blocked' in handle) throw new Error('blocked');
  const view = () => handle.getSnapshot();
  /** Finishes the line the ghost is saying, as the speech output would. */
  const finishLine = async () => {
    lines.at(-1)?.finish();
    await flush();
  };
  /** Answers the current question by keyboard and confirms it. */
  const answer = async (text: string) => {
    while (view().state.phase === 'asking') await finishLine();
    keyboard.submit(text);
    handle.dispatch({ type: 'confirm', candidateId: view().state.candidate!.candidateId });
    await flush();
  };
  const begin = async () => {
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' });
    await flush();
  };
  return { handle, view, lines, speech, timers, finishLine, answer, begin };
}

describe('session runtime: dynamic (ghost-defense-live) sessions', () => {
  it('runs 4 questions with one follow-up to the summary, each reply sentence as its own transcript line', async () => {
    const { provider, calls } = scripted({
      'defense-questions': fourQuestions,
      'defense-reply': (_req, n) =>
        n === 1
          ? { kind: 'follow-up', say: ['That is part of it.', 'Let me ask one more thing.'], followUp: 'What happens when the queue is full?' }
          : { kind: 'acknowledgment', say: ['That matches your file.', 'Well explained.'] },
      'defense-summary': () => ({ strength: 'You explained your design choices.', review: [] }),
    });
    const s = setup(provider);
    await s.begin();
    expect(s.view().state.phase).toBe('asking');
    for (const text of ['Because of the peak.', 'It keeps orders waiting.', 'Two weeks.', 'Same server.', 'It was enough.']) {
      await s.answer(text);
      // Both sentences play one after the other; the second waits for the first.
      expect(s.lines.at(-1)?.text).toMatch(/^(That is part of it\.|That matches your file\.)$/);
      await s.finishLine();
      expect(s.lines.at(-1)?.text).toMatch(/^(Let me ask one more thing\.|Well explained\.)$/);
      await s.finishLine();
      s.handle.dispatch({ type: 'next' });
      await flush();
    }
    expect(s.view().state.phase).toBe('summary');
    expect(s.view().state.summary?.strength).toBe('You explained your design choices.');
    await s.finishLine();
    await s.finishLine();
    const said = s.view().transcript.map((t) => t.text);
    expect(said).toEqual(expect.arrayContaining(['That is part of it.', 'Let me ask one more thing.', 'What happens when the queue is full?', 'Well explained.']));
    expect(said.filter((t) => t === 'Well explained.')).toHaveLength(4);
    expect(calls.map((c) => c.task)).toEqual(['defense-questions', ...Array(5).fill('defense-reply'), 'defense-summary']);
    // The follow-up's own reply could not ask for another follow-up.
    expect(calls.filter((c) => c.task === 'defense-reply').map((c) => c.task === 'defense-reply' && c.input.followUpAllowed)).toEqual([true, false, true, true, true]);
  });

  it('never speaks a quote: quotes are shown, not spoken (owner decision 5)', async () => {
    const { provider } = scripted({ 'defense-questions': fourQuestions, 'defense-reply': () => ({ kind: 'correction', excerptId: excerpts[0].id, quote: quoteOf(0), say: ['Your file says otherwise.'] }) });
    const s = setup(provider);
    await s.begin();
    await s.answer('A guess.');
    const spoken = (s.speech.speak as ReturnType<typeof vi.fn>).mock.calls.map(([l]) => (l as { text: string }).text);
    for (let i = 0; i < 4; i++) expect(spoken.some((t) => t.includes(quoteOf(i)))).toBe(false);
    expect(s.view().state.reply?.quote).toBe(quoteOf(0));
  });

  it('sends the question\'s own passage and its neighbors, within the budget', async () => {
    const { provider, calls } = scripted({ 'defense-questions': fourQuestions, 'defense-reply': () => ({ kind: 'acknowledgment', say: ['Good.'] }) });
    const s = setup(provider);
    await s.begin();
    await s.answer('Because of the peak.');
    const reply = calls.find((c) => c.task === 'defense-reply');
    expect(reply?.task === 'defense-reply' && reply.input).toMatchObject({ quote: quoteOf(0), answer: 'Because of the peak.', question: 'Why is part 1 like this?' });
    expect(reply?.task === 'defense-reply' && reply.input.excerpts[0].id).toBe(excerpts[0].id);
  });

  it('says the local "can\'t point to that" line when a correction\'s quote is not in the file', async () => {
    const { provider } = scripted({ 'defense-questions': fourQuestions, 'defense-reply': () => ({ kind: 'correction', excerptId: excerpts[0].id, quote: 'a sentence that is not in the file', say: ['Wrong.'] }) });
    const s = setup(provider);
    await s.begin();
    await s.answer('A guess.');
    expect(s.lines.at(-1)?.text).toBe(kitMessages.en['defense.cantPoint']);
  });

  it('falls back to the demo rules when the provider fails or its output is invalid', async () => {
    const { provider } = scripted({ 'defense-questions': () => 'not json', 'defense-reply': () => ({ kind: 'praise', say: ['Great!'] }) });
    const s = setup(provider);
    await s.begin();
    expect(s.view().state.phase).toBe('asking'); // demo questions
    expect(s.view().state.pack.questions[0].source).toBeDefined();
    await s.answer('It seemed like a good idea.');
    expect(s.view().state.reply?.kind).toBe('follow-up'); // the demo's reply to a vague answer
  });

  it('says the waiting line only when the questions take longer than 1.5 s', async () => {
    let release!: () => void;
    const slow: LLMProvider = {
      id: 'proxy',
      isDemo: false,
      complete: (req) => new Promise((resolve) => (release = () => void createDemoProvider().complete(req).then(resolve))),
    };
    const s = setup(slow);
    await s.begin();
    expect(s.timers).toHaveLength(1);
    expect(s.timers[0].ms).toBe(1500);
    await s.finishLine(); // the greeting
    s.timers[0].fn();
    expect(s.lines.at(-1)?.text).toBe(kitMessages.en['defense.waiting']);
    release();
    await flush();
    await flush();
    expect(s.view().state.phase).toBe('asking');
    expect(s.lines.at(-1)?.text).toBe(kitMessages.en['defense.waiting']); // the question waits for it
    await s.finishLine();
    expect(s.lines.at(-1)?.text).toBe(s.view().state.pack.questions[0].prompt.en);

    const fast = setup(createDemoProvider());
    await fast.begin();
    expect(fast.timers[0].cancelled).toBe(true);
    expect(fast.lines.some((l) => l.text === kitMessages.en['defense.waiting'])).toBe(false);
  });

  it('opens with the greeting and then the first question: the question waits instead of cutting it (Req 4.2)', async () => {
    const s = setup(scripted({ 'defense-questions': fourQuestions }).provider);
    await s.begin();
    expect(s.view().state.phase).toBe('asking');
    expect(s.lines.map((l) => l.text)).toEqual(['Good evening.']);
    expect(s.speech.cancel).toHaveBeenCalledTimes(1); // only before the greeting itself
    await s.finishLine();
    expect(s.lines.at(-1)?.text).toBe('Why is part 1 like this?');
    await s.finishLine();
    expect(s.view().state.phase).toBe('answering');
  });
  it('skips the waiting line when the questions arrive before the greeting ends', async () => {
    let release!: () => void;
    const slow: LLMProvider = {
      id: 'proxy',
      isDemo: false,
      complete: (req) => new Promise((resolve) => (release = () => void createDemoProvider().complete(req).then(resolve))),
    };
    const s = setup(slow);
    await s.begin();
    s.timers[0].fn(); // 1.5 s, the greeting still playing: the waiting line waits behind it
    expect(s.lines.map((l) => l.text)).toEqual(['Good evening.']);
    release();
    await flush();
    await flush();
    await s.finishLine();
    expect(s.lines.map((l) => l.text)).toEqual(['Good evening.', s.view().state.pack.questions[0].prompt.en]);
  });
  it('asks only `count` questions; extra ones are spares for questions dropped by the guard', async () => {
    const six = { questions: [...fourQuestions().questions, ...fourQuestions().questions.slice(0, 2)] }; // count + 2
    const { provider } = scripted({ 'defense-questions': () => six });
    const s = setup(provider); // count 4: six questions pass the guard (at most count + 2)
    await s.begin();
    expect(s.view().defense).toEqual({ mode: 'ai' }); // the provider's list was accepted
    expect(s.view().state.pack.questions.map((q) => q.prompt.en)).toEqual(fourQuestions().questions.map((q) => q.prompt));
    const oneBad = { questions: [{ ...fourQuestions().questions[0], quote: 'a sentence that is not in the file' }, ...fourQuestions().questions.slice(1)] };
    const t = setup(scripted({ 'defense-questions': () => oneBad }).provider, { pack: { ...pack, dynamic: { count: 3 } } });
    await t.begin();
    expect(t.view().state.pack.questions.map((q) => q.source?.excerptId)).toEqual([excerpts[1].id, excerpts[2].id, excerpts[3].id]);
  });

  it('fills up with demo questions when too few are left, never repeating a passage', async () => {
    const one = { questions: [fourQuestions().questions[2]] };
    const s = setup(scripted({ 'defense-questions': () => one }).provider);
    await s.begin();
    const ids = s.view().state.pack.questions.map((q) => q.source?.excerptId);
    expect(ids[0]).toBe(excerpts[2].id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it('says the fallback line once, before the demo takes the turn, when the provider first fails (Req 10.2)', async () => {
    const { provider } = scripted({ 'defense-questions': fourQuestions, 'defense-reply': () => undefined });
    const s = setup(provider);
    await s.begin();
    await s.answer('Because of the peak.');
    const fallback = kitMessages.en['defense.fallback'];
    expect(s.lines.at(-1)?.text).toBe(fallback); // first, then the demo's reply
    await s.finishLine();
    expect(s.lines.at(-1)?.text).toBe(s.view().state.reply?.say[0]);
    await s.finishLine();
    s.handle.dispatch({ type: 'next' });
    await flush();
    await s.answer('Because of the peak.');
    expect(s.lines.filter((l) => l.text === fallback)).toHaveLength(1); // once per session
    expect(s.view().transcript.some((t) => t.text === fallback)).toBe(true);
  });
  it('a failed question request says the fallback line after the greeting, then the first demo question', async () => {
    const s = setup(scripted({}).provider);
    await s.begin();
    await s.finishLine(); // the greeting
    expect(s.lines.at(-1)?.text).toBe(kitMessages.en['defense.fallback']);
    await s.finishLine();
    expect(s.lines.at(-1)?.text).toBe(s.view().state.pack.questions[0].prompt.en);
  });
  it('the demo provider from the start says no fallback line', async () => {
    const s = setup(createDemoProvider());
    await s.begin();
    await s.finishLine();
    await s.answer('It seemed like a good idea.');
    expect(s.lines.some((l) => l.text === kitMessages.en['defense.fallback'])).toBe(false);
  });
  it('reports the mode: AI until the first fallback, then demo for the rest of the session', async () => {
    const { provider, calls } = scripted({ 'defense-questions': fourQuestions, 'defense-reply': () => undefined });
    const s = setup(provider);
    await s.begin();
    expect(s.view().defense).toEqual({ mode: 'ai' });
    await s.answer('Because of the peak.'); // the provider fails: demo answers
    expect(s.view().defense).toEqual({ mode: 'demo' });
    await s.finishLine();
    s.handle.dispatch({ type: 'next' });
    await flush();
    await s.answer('Because of the peak.');
    expect(calls.filter((c) => c.task === 'defense-reply')).toHaveLength(1); // demo stays pinned
    expect(setup(createDemoProvider()).view().defense).toEqual({ mode: 'demo' });
  });
});
