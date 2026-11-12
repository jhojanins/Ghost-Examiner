import {
  createKeyboardAdapter,
  type Evaluator,
  type Feedback,
  type InputAdapter,
  type InputEvent,
  type QuestionPack,
  type Timeline,
} from '@ghost-examiner/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession, type SessionDeps, type SessionHandle } from './session';
import type { Playback, SpeechOutput } from './silent-output';

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

/**
 * Speech you finish by hand; `cancel()` ends the current line early, like SilentOutput.
 * With `audible`, each line is "spoken aloud" until `cancel()` silences it, so a runtime that
 * reads `audible()` only after cancelling would see false.
 */
function fakeSpeech(audible = false) {
  const lines: { timeline: Timeline; finish: () => void; playback: Playback; silence: () => void }[] = [];
  let now = 0;
  const speech: SpeechOutput = {
    speak: vi.fn(({ timeline }: { timeline: Timeline }) => {
      now += 1000;
      const startedAt = now;
      let on = audible;
      let finish!: () => void;
      const done = new Promise<void>((resolve) => (finish = resolve));
      const playback: Playback = { startedAt, origin: () => startedAt, audible: () => on, done };
      lines.push({ timeline, finish, playback, silence: () => (on = false) });
      return playback;
    }),
    cancel: vi.fn(() => {
      lines.at(-1)?.silence();
      lines.at(-1)?.finish();
    }),
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

function setup(overrides: Partial<SessionDeps> = {}, audible = false) {
  const { speech, lines, finishLast } = fakeSpeech(audible);
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

  it('speaks the resolved line with its text, locale and timeline, and the view reads the playback origin', () => {
    const { handle, speech, lines } = setup();
    handle.dispatch({ type: 'start' });
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Good evening.', locale: 'en', timeline: lines[0].timeline });
    const view = handle.getSnapshot().line!;
    expect(view.origin).toBe(lines[0].playback.origin);
    expect(view.startedAt).toBe(lines[0].playback.startedAt);
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

  it('a partial event from an adapter changes nothing; only candidates reach the engine (spec b task 22)', () => {
    let emit: ((e: InputEvent) => void) | undefined;
    const voice: InputAdapter = { ...morse, id: 'voice', start: (_ctx, onEvent) => void (emit = onEvent) };
    const { handle } = setup({ adapters: [createKeyboardAdapter(), voice] });
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' });
    const before = handle.getSnapshot();
    const listener = vi.fn();
    handle.subscribe(listener);

    emit!({ type: 'partial', text: 'I fixed the' });
    expect(handle.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();

    emit!({ type: 'candidate', candidate: { text: 'I fixed the build.', method: 'voice' } });
    expect(handle.getSnapshot().state.phase).toBe('confirming');
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

  it('a language switch while answering calls setLocale on adapters that have it, and stops or restarts none (task 29)', () => {
    const setLocale = vi.fn();
    const voice: InputAdapter = { ...morse, id: 'voice', start: vi.fn(), stop: vi.fn(), setLocale };
    const keyboard = createKeyboardAdapter(); // no setLocale: it is simply left alone
    const keyboardStart = vi.spyOn(keyboard, 'start');
    const keyboardStop = vi.spyOn(keyboard, 'stop');
    const { handle } = setup({ adapters: [keyboard, voice] });
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' });
    expect(voice.start).toHaveBeenCalledTimes(1);

    handle.dispatch({ type: 'locale-changed', locale: 'es' });
    expect(setLocale).toHaveBeenCalledExactlyOnceWith('es');
    expect(voice.start).toHaveBeenCalledTimes(1);
    expect(voice.stop).not.toHaveBeenCalled();
    expect(keyboardStart).toHaveBeenCalledTimes(1);
    expect(keyboardStop).not.toHaveBeenCalled();

    handle.dispatch({ type: 'locale-changed', locale: 'es' }); // the same language again: nothing to tell
    expect(setLocale).toHaveBeenCalledTimes(1);
  });

  it('a language switch when no question is answerable tells no adapter, and the next start uses the new language', () => {
    const setLocale = vi.fn();
    const voice: InputAdapter = { ...morse, id: 'voice', start: vi.fn(), stop: vi.fn(), setLocale };
    const { handle } = setup({ adapters: [createKeyboardAdapter(), voice] });
    handle.dispatch({ type: 'start' }); // privacy: nothing started yet
    handle.dispatch({ type: 'locale-changed', locale: 'es' });
    expect(setLocale).not.toHaveBeenCalled();
    handle.dispatch({ type: 'privacy-accepted' });
    expect(voice.start).toHaveBeenCalledWith({ question: { id: 'q1', kind: 'free-text' }, locale: 'es' }, expect.any(Function));
  });

  it('submitting during the question stops the ghost speaking (owner decision, task 27)', async () => {
    const { handle, keyboard, speech } = setup();
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' });
    expect(handle.getSnapshot().line).toMatchObject({ text: 'Tell me more.', playing: true });
    const cancelsBefore = vi.mocked(speech.cancel).mock.calls.length;

    keyboard.submit('My answer.');
    const view = handle.getSnapshot();
    expect(view.state.phase).toBe('confirming');
    expect(vi.mocked(speech.cancel).mock.calls.length).toBe(cancelsBefore + 1);
    expect(view.line).toMatchObject({ text: 'Tell me more.', playing: false }); // captions stay, mouth stops

    await flush(); // the cancelled playback resolving must not count as anything
    expect(handle.getSnapshot().state.phase).toBe('confirming');
    expect(speech.speak).toHaveBeenCalledTimes(2); // greeting and question only
  });

  it('a candidate after the question finished cancels nothing', async () => {
    const { handle, keyboard, speech, finishLast } = setup();
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' });
    await finishLast();
    const cancelsBefore = vi.mocked(speech.cancel).mock.calls.length;
    keyboard.submit('My answer.');
    expect(handle.getSnapshot().state.phase).toBe('confirming');
    expect(vi.mocked(speech.cancel).mock.calls.length).toBe(cancelsBefore);
  });

  it('keeps a transcript of every line that stopped: finished, replaced by a newer line, or cancelled', async () => {
    const { handle, keyboard, finishLast } = setup();
    expect(handle.getSnapshot().transcript).toEqual([]);

    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' }); // the question replaces the greeting mid-line
    expect(handle.getSnapshot().transcript).toEqual([{ id: 1, text: 'Good evening.', locale: 'en', heard: false }]);

    keyboard.submit('My answer.'); // cancels the question
    expect(handle.getSnapshot().transcript.map((l) => l.text)).toEqual(['Good evening.', 'Tell me more.']);

    handle.dispatch({ type: 'confirm', candidateId: handle.getSnapshot().state.candidate!.candidateId });
    await flush();
    await finishLast(); // the feedback summary finishes
    expect(handle.getSnapshot().transcript.map((l) => l.text)).toEqual([
      'Good evening.',
      'Tell me more.',
      'Thank you. That answer was clear and on topic.',
    ]);
  });

  it('a line replayed in a new language enters the transcript once, in the language it ended in', async () => {
    const { handle, finishLast } = setup();
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' });
    handle.dispatch({ type: 'locale-changed', locale: 'es' });
    await flush();
    await finishLast();
    expect(handle.getSnapshot().transcript).toEqual([
      { id: 1, text: 'Good evening.', locale: 'en', heard: false },
      { id: 2, text: 'Cuéntame más.', locale: 'es', heard: false },
    ]);
  });

  it('a muted line that ends is not heard', async () => {
    const { handle, finishLast } = setup();
    handle.dispatch({ type: 'start' });
    await finishLast();
    expect(handle.getSnapshot().transcript).toEqual([{ id: 1, text: 'Good evening.', locale: 'en', heard: false }]);
  });

  it('a line that ends while audible is heard', async () => {
    const { handle, finishLast } = setup({}, true);
    handle.dispatch({ type: 'start' });
    await finishLast();
    expect(handle.getSnapshot().transcript).toEqual([{ id: 1, text: 'Good evening.', locale: 'en', heard: true }]);
  });

  it('a line cancelled or replaced while audible is heard: audible() is read before cancel()', () => {
    const { handle, keyboard, speech } = setup({}, true);
    handle.dispatch({ type: 'start' });
    handle.dispatch({ type: 'privacy-accepted' }); // the question replaces the greeting
    keyboard.submit('My answer.'); // cancels the question
    expect(speech.cancel).toHaveBeenCalled();
    expect(handle.getSnapshot().transcript.map(({ id, heard }) => ({ id, heard }))).toEqual([
      { id: 1, heard: true },
      { id: 2, heard: true },
    ]);
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
