import type { InputContext, InputEvent } from '@ghost-examiner/core';
import { describe, expect, it, vi } from 'vitest';
import { createVoiceAdapter, type RecognitionCtor, type RecognitionLike, type RecognitionResultEventLike } from './voice-adapter';

/** A fake `SpeechRecognition` the test drives by hand; every instance is recorded. */
function fakeRecognition(options: { throwOnNew?: boolean; throwOnStart?: boolean } = {}) {
  const instances: FakeRecognition[] = [];
  class FakeRecognition implements RecognitionLike {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 0;
    onresult: RecognitionLike['onresult'] = null;
    onerror: RecognitionLike['onerror'] = null;
    onend: RecognitionLike['onend'] = null;
    start = vi.fn(() => {
      if (options.throwOnStart) throw new Error('InvalidStateError');
    });
    stop = vi.fn();
    abort = vi.fn();
    constructor() {
      if (options.throwOnNew) throw new Error('not supported');
      instances.push(this);
    }
    /** The browser reports results: `[text, isFinal]` per result, the changed ones from `from`. */
    result(results: [string, boolean][], from = 0) {
      const list = results.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal }));
      this.onresult?.({ resultIndex: from, results: list } satisfies RecognitionResultEventLike);
    }
    error(code: string) {
      this.onerror?.({ error: code });
    }
    end() {
      this.onend?.();
    }
  }
  return { Recognition: FakeRecognition satisfies RecognitionCtor, instances };
}

const en: InputContext = { question: { id: 'q1', kind: 'free-text' }, locale: 'en' };
const es: InputContext = { question: { id: 'q1', kind: 'free-text' }, locale: 'es' };

function setup(fake = fakeRecognition(), languages: readonly string[] = ['en-GB', 'es-AR']) {
  const adapter = createVoiceAdapter({ Recognition: fake.Recognition, languages });
  const events: InputEvent[] = [];
  const listener = vi.fn();
  adapter.subscribe(listener);
  return { adapter, events, listener, ...fake, emit: (e: InputEvent) => events.push(e) };
}

describe('createVoiceAdapter: availability, store, listen (task 24)', () => {
  it('describes itself as the voice method: microphone, not experimental, free text only', () => {
    const { adapter } = setup();
    expect(adapter.id).toBe('voice');
    expect(adapter.requires).toEqual({ camera: false, microphone: true });
    expect(adapter.experimental).toBe(false);
    expect(adapter.supports).toEqual(['free-text']);
  });

  it('without SpeechRecognition it is unavailable with a reason, and listen() does nothing', async () => {
    const adapter = createVoiceAdapter({ languages: [] });
    const unavailable = { available: false, reason: 'voice.unavailable' };
    await expect(adapter.checkAvailability()).resolves.toEqual(unavailable);
    expect(adapter.getSnapshot().availability).toEqual(unavailable);
    adapter.start(en, () => {});
    expect(() => adapter.listen()).not.toThrow();
    expect(adapter.getSnapshot().listening).toBe(false);
  });

  it('checking availability is feature detection only: it creates no recognizer (no microphone prompt)', async () => {
    const { adapter, instances } = setup();
    await expect(adapter.checkAvailability()).resolves.toEqual({ available: true });
    expect(instances).toHaveLength(0);
  });

  it('listen() before start() creates nothing: the adapter is not armed for a question', () => {
    const { adapter, instances } = setup();
    adapter.listen();
    expect(instances).toHaveLength(0);
  });

  it('listen() creates one continuous recognizer with interim results, one alternative and the speechLang language', () => {
    const { adapter, instances, listener, emit } = setup();
    adapter.start(en, emit);
    adapter.listen();
    expect(instances).toHaveLength(1);
    const [r] = instances;
    expect([r.continuous, r.interimResults, r.maxAlternatives, r.lang]).toEqual([true, true, 1, 'en-GB']);
    expect(r.start).toHaveBeenCalledTimes(1);
    expect(adapter.getSnapshot()).toMatchObject({ listening: true, final: '', interim: '' });
    expect(listener).toHaveBeenCalled();

    adapter.listen(); // already listening: still one recognizer
    expect(instances).toHaveLength(1);
  });

  it('listens in the question language: Spanish uses the preferred Spanish tag', () => {
    const { adapter, instances, emit } = setup(fakeRecognition(), ['es-AR']);
    adapter.start(es, emit);
    adapter.listen();
    expect(instances[0].lang).toBe('es-AR');
  });

  it('stop() aborts the recognizer and stops listening', () => {
    const { adapter, instances, emit } = setup();
    adapter.start(en, emit);
    adapter.listen();
    adapter.stop();
    expect(instances[0].abort).toHaveBeenCalled();
    expect(adapter.getSnapshot().listening).toBe(false);
    adapter.listen(); // disarmed
    expect(instances).toHaveLength(1);
  });

  it('a stable snapshot between changes; subscribers are told about each change', () => {
    const { adapter, listener, emit } = setup();
    const first = adapter.getSnapshot();
    expect(adapter.getSnapshot()).toBe(first);
    adapter.start(en, emit);
    expect(listener).not.toHaveBeenCalled(); // arming changes nothing visible
    adapter.listen();
    expect(adapter.getSnapshot()).not.toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('createVoiceAdapter: a recognizer that cannot run makes voice unavailable (owner rule, Brave)', () => {
  const UNAVAILABLE = { available: false, reason: 'voice.unavailable' };

  it.each([
    ['the constructor throws', { throwOnNew: true }],
    ['start() throws', { throwOnStart: true }],
  ])('%s: unavailable with its reason, not listening, nothing thrown', async (_, options) => {
    const { adapter, emit } = setup(fakeRecognition(options));
    adapter.start(en, emit);
    expect(() => adapter.listen()).not.toThrow();
    expect(adapter.getSnapshot()).toMatchObject({ availability: UNAVAILABLE, listening: false });
    expect(adapter.getSnapshot().error).toBeUndefined(); // the keyboard fallback, not an error message
    await expect(adapter.checkAvailability()).resolves.toEqual(UNAVAILABLE);
  });

  it.each(['service-not-allowed', 'network'])(
    'a "%s" error before any result was ever heard: unavailable, and the end event that follows changes nothing',
    async (code) => {
      const { adapter, instances, emit } = setup();
      adapter.start(en, emit);
      adapter.listen();
      instances[0].error(code); // what Brave does: the API exists, but its service is missing
      instances[0].end();
      expect(adapter.getSnapshot()).toMatchObject({ availability: UNAVAILABLE, listening: false });
      expect(adapter.getSnapshot().error).toBeUndefined();
      await expect(adapter.checkAvailability()).resolves.toEqual(UNAVAILABLE);
      adapter.listen(); // stays unavailable: no new recognizer
      expect(instances).toHaveLength(1);
    },
  );

  it('an end event of the recognizer stops listening', () => {
    const { adapter, instances, emit } = setup();
    adapter.start(en, emit);
    adapter.listen();
    instances[0].end();
    expect(adapter.getSnapshot().listening).toBe(false);
  });
});
