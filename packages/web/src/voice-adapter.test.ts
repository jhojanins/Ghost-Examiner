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

/** The adapter's clock, moved by hand (`tick`). */
let now = 0;
const clock = { now: () => now };
const tick = (ms: number) => (now += ms);

const en: InputContext = { question: { id: 'q1', kind: 'free-text' }, locale: 'en' };
const es: InputContext = { question: { id: 'q1', kind: 'free-text' }, locale: 'es' };

function setup(fake = fakeRecognition(), languages: readonly string[] = ['en-GB', 'es-AR']) {
  now = 0;
  const adapter = createVoiceAdapter({ Recognition: fake.Recognition, clock, languages });
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
    const adapter = createVoiceAdapter({ clock, languages: [] });
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

  it('a restart after an early end that cannot start makes voice unavailable too (task 26)', () => {
    const options = { throwOnStart: false };
    const { adapter, instances, emit } = setup(fakeRecognition(options));
    adapter.start(en, emit);
    adapter.listen();
    options.throwOnStart = true; // from now on start() throws
    tick(6000);
    instances[0].end(); // the restart creates instances[1], whose start throws
    expect(instances).toHaveLength(2);
    expect(adapter.getSnapshot()).toMatchObject({ availability: UNAVAILABLE, listening: false });
  });
});

describe('createVoiceAdapter: results and the candidate (task 25)', () => {
  function listening() {
    const s = setup();
    s.adapter.start(en, s.emit);
    s.adapter.listen();
    return { ...s, r: s.instances[0] };
  }

  it('splits the results into final and interim text, and emits a partial with all of it', () => {
    const { adapter, r, events } = listening();
    r.result([['I fixed', false]]);
    expect(adapter.getSnapshot()).toMatchObject({ final: '', interim: 'I fixed' });
    r.result([['I fixed the build', true], [' and then', false]]);
    expect(adapter.getSnapshot()).toMatchObject({ final: 'I fixed the build', interim: 'and then' });
    expect(events).toEqual([
      { type: 'partial', text: 'I fixed' },
      { type: 'partial', text: 'I fixed the build and then' },
    ]);
  });

  it('joins several final results with single spaces, whatever spacing the browser sends', () => {
    const { adapter, r, events } = listening();
    r.result([['First part.', true], [' second part', true], ['third', true]], 2);
    expect(adapter.getSnapshot().final).toBe('First part. second part third');
    expect(events.at(-1)).toEqual({ type: 'partial', text: 'First part. second part third' });
  });

  it('stopListening() stops the recognizer; on its end, one candidate with the trimmed text and method voice', () => {
    const { adapter, r, events } = listening();
    r.result([['  I fixed the build  ', true]]);
    adapter.stopListening();
    expect(r.stop).toHaveBeenCalledTimes(1);
    expect(events.filter((e) => e.type === 'candidate')).toEqual([]); // waits for the last results
    r.result([['I fixed the build', true], [' on Friday', false]]); // late results still count
    r.end();
    expect(events.filter((e) => e.type === 'candidate')).toEqual([
      { type: 'candidate', candidate: { text: 'I fixed the build on Friday', method: 'voice' } },
    ]);
    expect(adapter.getSnapshot()).toMatchObject({ listening: false, final: '', interim: '' });
  });

  it('blank text: no candidate, and the view says what to do', () => {
    const { adapter, r, events } = listening();
    r.result([['   ', true]]);
    adapter.stopListening();
    r.end();
    expect(events.filter((e) => e.type === 'candidate')).toEqual([]);
    expect(adapter.getSnapshot()).toMatchObject({ listening: false, error: 'voice.empty' });
    adapter.listen(); // trying again clears the message
    expect(adapter.getSnapshot().error).toBeUndefined();
  });

  it('stop() also clears an "empty answer" message, so it never carries over to the next question', () => {
    const { adapter, r } = listening();
    adapter.stopListening();
    r.end();
    expect(adapter.getSnapshot().error).toBe('voice.empty');
    adapter.stop();
    expect(adapter.getSnapshot().error).toBeUndefined();
  });

  it('an end the user did not ask for makes no candidate and shows no message (task 26: listening goes on)', () => {
    const { adapter, r, events } = listening();
    r.result([['I fixed the build', true]]);
    r.end(); // the browser stopped on its own, e.g. after a pause
    expect(events.filter((e) => e.type === 'candidate')).toEqual([]);
    expect(adapter.getSnapshot()).toMatchObject({ listening: true, final: 'I fixed the build' });
    expect(adapter.getSnapshot().error).toBeUndefined();
  });

  it('stopListening() while not listening does nothing', () => {
    const { adapter, events, emit } = setup();
    adapter.start(en, emit);
    expect(() => adapter.stopListening()).not.toThrow();
    expect(events).toEqual([]);
  });

  it('stop() aborts listening, clears the text, and a late end emits nothing', () => {
    const { adapter, r, events } = listening();
    r.result([['I fixed', false]]);
    adapter.stop();
    expect(r.abort).toHaveBeenCalled();
    expect(adapter.getSnapshot()).toMatchObject({ listening: false, final: '', interim: '' });
    r.result([['I fixed the build', true]]); // events of an aborted recognizer
    r.end();
    expect(events).toEqual([{ type: 'partial', text: 'I fixed' }]);
  });
});

describe('createVoiceAdapter: early end and the loop guard (task 26)', () => {
  function listening() {
    const s = setup();
    s.adapter.start(en, s.emit);
    s.adapter.listen();
    return s;
  }
  const candidates = (events: InputEvent[]) => events.filter((e) => e.type === 'candidate');

  it('an end the user did not ask for keeps the text and starts a new recognizer, so speaking has no time limit', () => {
    const { adapter, instances, events } = listening();
    instances[0].result([['I fixed the build', true], ['on', false]]);
    tick(6000);
    instances[0].end(); // the browser stopped after a pause
    expect(instances).toHaveLength(2);
    expect(instances[1].start).toHaveBeenCalledTimes(1);
    expect(instances[1].lang).toBe('en-GB');
    expect(adapter.getSnapshot()).toMatchObject({ listening: true, final: 'I fixed the build on', interim: '' });

    instances[1].result([['Friday', true]]); // the new recognizer's results come after the kept text
    expect(adapter.getSnapshot().final).toBe('I fixed the build on Friday');
    expect(events.at(-1)).toEqual({ type: 'partial', text: 'I fixed the build on Friday' });

    adapter.stopListening();
    instances[1].end();
    expect(candidates(events)).toEqual([{ type: 'candidate', candidate: { text: 'I fixed the build on Friday', method: 'voice' } }]);
  });

  it('a no-speech error is ignored: the end that follows restarts listening, with no message', () => {
    const { adapter, instances } = listening();
    tick(8000);
    instances[0].error('no-speech');
    instances[0].end();
    expect(instances).toHaveLength(2);
    expect(adapter.getSnapshot()).toMatchObject({ listening: true });
    expect(adapter.getSnapshot().error).toBeUndefined();
  });

  it('loop guard: three ends in a row, each under 500 ms with no result, stop listening with voice.error.service', () => {
    const { adapter, instances } = listening();
    tick(100);
    instances[0].end();
    tick(499);
    instances[1].end();
    expect(instances).toHaveLength(3);
    tick(200);
    instances[2].end();
    expect(instances).toHaveLength(3); // no fourth recognizer
    expect(adapter.getSnapshot()).toMatchObject({ listening: false, error: 'voice.error.service' });
    expect(adapter.getSnapshot().availability).toEqual({ available: true }); // the user may try again
  });

  it('a slow end, or a quick end that heard something, resets the loop guard', () => {
    const { adapter, instances } = listening();
    tick(100);
    instances[0].end(); // quick 1
    tick(100);
    instances[1].end(); // quick 2
    tick(500);
    instances[2].end(); // 500 ms is not "under 500 ms": the count starts again
    tick(100);
    instances[3].end(); // quick 1
    tick(50);
    instances[4].result([['hello', false]]);
    tick(50);
    instances[4].end(); // quick, but it heard something
    tick(100);
    instances[5].end(); // quick 1
    tick(100);
    instances[6].end(); // quick 2
    expect(instances).toHaveLength(8);
    expect(adapter.getSnapshot()).toMatchObject({ listening: true });
  });
});

describe('createVoiceAdapter: errors (task 27)', () => {
  const UNAVAILABLE = { available: false, reason: 'voice.unavailable' };
  function listening() {
    const s = setup();
    s.adapter.start(en, s.emit);
    s.adapter.listen();
    return s;
  }
  const candidates = (events: InputEvent[]) => events.filter((e) => e.type === 'candidate');

  it.each([
    ['not-allowed', 'voice.error.permission'],
    ['audio-capture', 'voice.error.noMic'],
    ['language-not-supported', 'voice.error.language'],
    ['bad-grammar', 'voice.error.service'],
    ['something-new', 'voice.error.service'],
  ])('"%s" stops listening with %s; voice stays available and listen() retries', (code, key) => {
    const { adapter, instances, events } = listening();
    instances[0].error(code);
    instances[0].end(); // the end that follows an error changes nothing
    expect(adapter.getSnapshot()).toMatchObject({ listening: false, error: key, availability: { available: true } });
    expect(instances[0].abort).toHaveBeenCalled(); // the microphone is released at once
    expect(candidates(events)).toEqual([]); // nothing was recognized

    adapter.listen();
    expect(instances).toHaveLength(2);
    expect(adapter.getSnapshot()).toMatchObject({ listening: true });
    expect(adapter.getSnapshot().error).toBeUndefined();
  });

  it.each(['aborted', 'no-speech'])('"%s" is ignored: still listening, no message', (code) => {
    const { adapter, instances } = listening();
    instances[0].error(code);
    expect(adapter.getSnapshot()).toMatchObject({ listening: true });
    expect(adapter.getSnapshot().error).toBeUndefined();
  });

  it('network after a successful recognition on this page is a transient error: message, retry, voice stays available', () => {
    const { adapter, instances, events, emit } = listening();
    instances[0].result([['I fixed the build', true]]);
    adapter.stopListening();
    instances[0].end(); // a first answer: something was recognized on this page
    expect(candidates(events)).toHaveLength(1);

    adapter.stop(); // the next question
    adapter.start(en, emit);
    adapter.listen();
    instances[1].error('network');
    expect(adapter.getSnapshot()).toMatchObject({ listening: false, error: 'voice.error.network', availability: { available: true } });
    adapter.listen();
    expect(instances).toHaveLength(3);
  });

  it('network before anything was recognized on this page makes voice unavailable, with no message (Brave)', async () => {
    const { adapter, instances } = listening();
    instances[0].error('network');
    expect(adapter.getSnapshot()).toMatchObject({ listening: false, availability: UNAVAILABLE });
    expect(adapter.getSnapshot().error).toBeUndefined();
    await expect(adapter.checkAvailability()).resolves.toEqual(UNAVAILABLE);
  });

  it('text recognized before an error becomes a candidate, and the message is still set', () => {
    const { adapter, instances, events } = listening();
    instances[0].result([['I fixed', true], ['the build', false]]);
    instances[0].error('audio-capture');
    expect(candidates(events)).toEqual([{ type: 'candidate', candidate: { text: 'I fixed the build', method: 'voice' } }]);
    expect(adapter.getSnapshot()).toMatchObject({ listening: false, final: '', interim: '', error: 'voice.error.noMic' });
  });

  it('text recognized before the error that makes voice unavailable also becomes a candidate', () => {
    const { adapter, instances, events } = listening();
    instances[0].result([['I fixed the build', true]]);
    instances[0].error('service-not-allowed');
    expect(candidates(events)).toEqual([{ type: 'candidate', candidate: { text: 'I fixed the build', method: 'voice' } }]);
    expect(adapter.getSnapshot().availability).toEqual(UNAVAILABLE);
  });

  it('text kept from before a loop-guard stop also becomes a candidate', () => {
    const { adapter, instances, events } = listening();
    instances[0].result([['I fixed the build', true]]);
    tick(6000);
    instances[0].end(); // early end, text kept
    for (let i = 1; i <= 3; i++) {
      tick(100);
      instances[i].end(); // three quick ends with nothing heard
    }
    expect(adapter.getSnapshot().error).toBe('voice.error.service');
    expect(candidates(events)).toEqual([{ type: 'candidate', candidate: { text: 'I fixed the build', method: 'voice' } }]);
  });

  it('an error after the user pressed stop is handled the same way, once', () => {
    const { adapter, instances, events } = listening();
    instances[0].result([['I fixed the build', true]]);
    adapter.stopListening();
    instances[0].error('audio-capture');
    instances[0].end();
    expect(candidates(events)).toHaveLength(1);
    expect(adapter.getSnapshot().error).toBe('voice.error.noMic');
  });
});
