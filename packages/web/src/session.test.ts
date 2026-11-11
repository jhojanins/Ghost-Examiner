import {
  createKeyboardAdapter,
  type Evaluator,
  type Feedback,
  type InputAdapter,
  type QuestionPack,
  type Timeline,
} from '@ghost-examiner/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession, type SessionDeps, type SessionHandle } from './session';
import type { SpeechOutput } from './silent-output';

// Fictional pack, test data only.
const pack: QuestionPack = {
  id: 'test',
  greeting: { en: 'Good evening.', es: 'Buenas noches.' },
  closing: { en: 'That is all.', es: 'Eso es todo.' },
  questions: [{ id: 'q1', kind: 'free-text', prompt: { en: 'Tell me more.', es: 'Cuéntame más.' }, keyPoints: [] }],
};
const feedback: Feedback = {
  summary: 'Thank you. That answer was clear and on topic.',
  strength: 'You took the time to answer.',
  improvement: 'Add one result you can measure.',
  reaction: 'approving',
  locale: 'en',
};

/** Speech you finish by hand; `cancel()` ends the current line early, like SilentOutput. */
function fakeSpeech() {
  const lines: { timeline: Timeline; finish: () => void }[] = [];
  let now = 0;
  const speech: SpeechOutput = {
    speak: vi.fn((timeline: Timeline) => {
      now += 1000;
      let finish!: () => void;
      const done = new Promise<void>((resolve) => (finish = resolve));
      lines.push({ timeline, finish });
      return { startedAt: now, done };
    }),
    cancel: vi.fn(() => lines.at(-1)?.finish()),
  };
  const finishLast = async () => {
    lines.at(-1)?.finish();
    await flush();
  };
  return { speech, lines, finishLast };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const fakeEvaluator = (result: Feedback = feedback) => ({ evaluate: vi.fn(async () => result) }) satisfies Evaluator;
// A second input method so a strict build has 2 methods per question.
const morse: InputAdapter = {
  id: 'morse',
  requires: { camera: false, microphone: false },
  experimental: false,
  supports: ['free-text', 'choice', 'yes-no'],
  checkAvailability: async () => ({ available: true }),
  start() {},
  stop() {},
};

function setup(overrides: Partial<SessionDeps> = {}) {
  const { speech, lines, finishLast } = fakeSpeech();
  const keyboard = createKeyboardAdapter();
  const evaluator = fakeEvaluator();
  const deps: SessionDeps = { pack, adapters: [keyboard, morse], preview: false, evaluator, speech, locale: 'en', ...overrides };
  const handle = createSession(deps);
  if ('blocked' in handle) throw new Error('unexpected blocked session');
  return { handle, keyboard, evaluator, speech, lines, finishLast };
}

afterEach(() => vi.restoreAllMocks());

describe('createSession', () => {
  it('start → privacy-accepted → typed candidate before line-done → confirm → feedback', async () => {
    const { handle, keyboard, evaluator, speech, finishLast } = setup();

    handle.dispatch({ type: 'start' });
    expect(handle.getSnapshot().line).toMatchObject({ id: 1, text: 'Good evening.', locale: 'en', playing: true });
    handle.dispatch({ type: 'privacy-accepted' });
    expect(handle.getSnapshot().line).toMatchObject({ text: 'Tell me more.', playing: true });
    expect(speech.cancel).toHaveBeenCalled(); // the question replaced the greeting

    // The question is still playing; the typed answer arrives through the started keyboard adapter (Req 4.6).
    expect(keyboard.submit('  My answer.  ')).toEqual({ ok: true });
    const view = handle.getSnapshot();
    expect(view.state.phase).toBe('confirming');
    expect(view.state.candidate).toMatchObject({ text: 'My answer.', method: 'keyboard' });

    handle.dispatch({ type: 'confirm', candidateId: view.state.candidate!.candidateId });
    expect(handle.getSnapshot().state.phase).toBe('evaluating');
    await flush();

    expect(evaluator.evaluate).toHaveBeenCalledWith(pack.questions[0], expect.objectContaining({ text: 'My answer.' }), 'en');
    const done = handle.getSnapshot();
    expect(done.state.phase).toBe('feedback');
    expect(done.state.feedback).toEqual(feedback);
    expect(done.line).toMatchObject({ text: feedback.summary, locale: 'en', playing: true });

    await finishLast();
    expect(handle.getSnapshot().line?.playing).toBe(false);
  });

  it('dispatches line-done when the question finishes, moving asking → answering', async () => {
    const { handle, finishLast } = setup();
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' });
    await finishLast();
    expect(handle.getSnapshot().state.phase).toBe('answering');
  });

  it('a strict build with one adapter returns { blocked } and starts nothing', () => {
    const { speech } = fakeSpeech();
    const keyboard = createKeyboardAdapter();
    const start = vi.spyOn(keyboard, 'start');
    const handle = createSession({ pack, adapters: [keyboard], preview: false, evaluator: fakeEvaluator(), speech, locale: 'en' });
    expect(handle).toEqual({
      blocked: [{ kind: 'too-few-inputs', questionId: 'q1', severity: 'error', supportedBy: ['keyboard'] }],
    });
    expect(speech.speak).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('a Preview build with one adapter warns once per issue and starts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handle } = setup({ adapters: [createKeyboardAdapter()], preview: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toContainEqual(expect.objectContaining({ kind: 'too-few-inputs', severity: 'warning' }));
    handle.dispatch({ type: 'start' });
    expect(handle.getSnapshot().state.phase).toBe('privacy');
  });

  it('a Preview build with an empty pack is still blocked', () => {
    const handle: SessionHandle = createSession({
      pack: { ...pack, questions: [] },
      adapters: [createKeyboardAdapter()],
      preview: true,
      evaluator: fakeEvaluator(),
      speech: fakeSpeech().speech,
      locale: 'en',
    });
    expect(handle).toEqual({ blocked: [{ kind: 'no-questions', severity: 'error' }] });
  });

  it('locale-changed re-resolves the current line text and replays it, without ending the line early', async () => {
    const { handle, speech, lines } = setup();
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' });
    const before = handle.getSnapshot().line!;

    handle.dispatch({ type: 'locale-changed', locale: 'es' });
    await flush();
    const after = handle.getSnapshot();
    expect(after.state.locale).toBe('es');
    expect(after.line).toMatchObject({ id: before.id, text: 'Cuéntame más.', locale: 'es', playing: true });
    expect(after.line!.startedAt).toBeGreaterThan(before.startedAt);
    expect(lines.at(-1)!.timeline.words.map((w) => w.text)).toEqual(['Cuéntame', 'más.']);
    expect(speech.speak).toHaveBeenCalledTimes(3); // greeting, question, question again in es
    // The cancelled English playback must not count as the line finishing.
    expect(after.state.phase).toBe('asking');
  });

  it('locale-changed on a finished line updates its text without replaying it', async () => {
    const { handle, speech, finishLast } = setup();
    handle.dispatch({ type: 'start' });
    await finishLast();
    handle.dispatch({ type: 'locale-changed', locale: 'es' });
    expect(handle.getSnapshot().line).toMatchObject({ text: 'Buenas noches.', locale: 'es', playing: false });
    expect(speech.speak).toHaveBeenCalledTimes(1);
  });

  it('starts adapters only while a question can be answered, with the question and locale', () => {
    const keyboard = createKeyboardAdapter();
    const start = vi.spyOn(keyboard, 'start');
    const stop = vi.spyOn(keyboard, 'stop');
    const { handle } = setup({ adapters: [keyboard, morse] });

    handle.dispatch({ type: 'start' });
    expect(keyboard.submit('Too early.')).toEqual({ ok: true });
    expect(handle.getSnapshot().state.phase).toBe('privacy'); // not started yet: nothing emitted
    expect(start).not.toHaveBeenCalled();

    handle.dispatch({ type: 'privacy-accepted' });
    expect(start).toHaveBeenCalledWith({ question: { id: 'q1', kind: 'free-text' }, locale: 'en' }, expect.any(Function));
    keyboard.submit('Now.');
    expect(handle.getSnapshot().state.phase).toBe('confirming');
    expect(stop).toHaveBeenCalled();
  });

  it('getSnapshot is stable between changes and listeners hear each change', () => {
    const { handle } = setup();
    const listener = vi.fn();
    const unsubscribe = handle.subscribe(listener);
    const first = handle.getSnapshot();
    expect(handle.getSnapshot()).toBe(first);

    handle.dispatch({ type: 'start' });
    expect(listener).toHaveBeenCalledTimes(1);
    const second = handle.getSnapshot();
    expect(second).not.toBe(first);
    expect(handle.getSnapshot()).toBe(second);

    handle.dispatch({ type: 'next' }); // invalid in privacy: no change, no notification, same snapshot
    expect(listener).toHaveBeenCalledTimes(1);
    expect(handle.getSnapshot()).toBe(second);

    unsubscribe();
    handle.dispatch({ type: 'privacy-accepted' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
