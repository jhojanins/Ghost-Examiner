import { buildTimeline } from '@ghost-examiner/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebSpeechOutput, type SynthLike, type UtteranceCtor, type UtteranceLike } from './web-speech-output';

const clock = { now: () => Date.now() }; // Date is faked by vi.useFakeTimers()
const text = 'Tell me more.';
const line = { text, locale: 'en' as const, timeline: buildTimeline(text, 'en') }; // 1050 ms

function track(done: Promise<void>) {
  const state = { resolved: false };
  void done.then(() => (state.resolved = true));
  return state;
}

/**
 * A fake `speechSynthesis` and `SpeechSynthesisUtterance`. Like Chrome, `cancel()` fires an
 * `interrupted` error on every utterance that was spoken and has not ended; here it fires
 * synchronously, the harshest order for the code under test.
 */
function fakes(initialVoices: SpeechSynthesisVoice[] = [alex]) {
  let voices = initialVoices;
  const voicesChanged: (() => void)[] = [];
  const utterances: FakeUtterance[] = [];
  const spoken: FakeUtterance[] = [];
  class FakeUtterance implements UtteranceLike {
    lang = '';
    voice: SpeechSynthesisVoice | null = null;
    rate = 1;
    onstart: UtteranceLike['onstart'] = null;
    onend: UtteranceLike['onend'] = null;
    onerror: UtteranceLike['onerror'] = null;
    onboundary: UtteranceLike['onboundary'] = null;
    ended = false;
    constructor(readonly text: string) {
      utterances.push(this);
    }
    /** Fires one of the utterance's events; the cast stands in for the browser's `this` binding. */
    fire(type: 'start' | 'end' | 'error' | 'boundary', ev: object = {}) {
      if (type === 'end' || type === 'error') this.ended = true;
      const handler = this[`on${type}`] as ((e: object) => void) | null;
      handler?.(ev);
    }
  }
  const synth = {
    speak: vi.fn((u: UtteranceLike) => void spoken.push(u as FakeUtterance)),
    cancel: vi.fn(() => {
      for (const u of spoken) if (!u.ended) u.fire('error', { error: 'interrupted' });
    }),
    getVoices: () => voices,
    addEventListener: vi.fn((_: 'voiceschanged', listener: () => void) => void voicesChanged.push(listener)),
  } satisfies SynthLike;
  /** The browser's voice list changes, as when voices finish loading. */
  const setVoices = (next: SpeechSynthesisVoice[]) => {
    voices = next;
    for (const listener of voicesChanged) listener();
  };
  return { synth, Utterance: FakeUtterance satisfies UtteranceCtor, utterances, spoken, setVoices };
}

const voice = (name: string, lang: string, localService = true, isDefault = false): SpeechSynthesisVoice => ({
  name,
  lang,
  localService,
  default: isDefault,
  voiceURI: name,
});
const alex = voice('Alex', 'en-US');
const daniel = voice('Daniel', 'en-GB');
const network = voice('Google US English', 'en-US', false, true);
const paulina = voice('Paulina', 'es-MX');
const monica = voice('Mónica', 'es-ES', true, true);

beforeEach(() => vi.useFakeTimers({ now: 5000 }));
afterEach(() => vi.useRealTimers());

describe('createWebSpeechOutput: no speech API', () => {
  it.each([
    ['no speechSynthesis', { Utterance: fakes().Utterance }],
    ['no SpeechSynthesisUtterance', { synth: fakes().synth }],
  ])('%s: sound is off with reason no-api, and setOn(true) cannot turn it on', (_, api) => {
    const output = createWebSpeechOutput({ ...api, clock, languages: [] });
    expect(output.getSnapshot()).toEqual({ on: false, reason: 'no-api' });
    output.unlock();
    output.setOn(true);
    expect(output.getSnapshot()).toEqual({ on: false, reason: 'no-api' });
  });

  it('plays every line on the clock, like SilentOutput', async () => {
    const output = createWebSpeechOutput({ clock, languages: [] });
    output.unlock();
    const playback = output.speak(line);
    expect(playback.startedAt).toBe(5000);
    expect(playback.origin()).toBe(5000);
    expect(playback.audible()).toBe(false);
    const state = track(playback.done);
    await vi.advanceTimersByTimeAsync(line.timeline.duration - 1);
    expect(state.resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.resolved).toBe(true);
  });

  it('cancel() and a new line end the current clock line early', async () => {
    const output = createWebSpeechOutput({ clock, languages: [] });
    const first = track(output.speak(line).done);
    const second = output.speak(line);
    await vi.advanceTimersByTimeAsync(0);
    expect(first.resolved).toBe(true);
    output.cancel();
    await expect(second.done).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('createWebSpeechOutput: unlock and the sound switch', () => {
  it('sound is on by default when the API exists', () => {
    const { synth, Utterance } = fakes();
    expect(createWebSpeechOutput({ synth, Utterance, clock, languages: [] }).getSnapshot()).toEqual({ on: true });
  });

  it('creates no utterance before unlock(), and one with the line text after it', () => {
    const { synth, Utterance, utterances } = fakes();
    const output = createWebSpeechOutput({ synth, Utterance, clock, languages: [] });

    const before = output.speak(line);
    expect(utterances).toHaveLength(0);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(before.origin()).toBe(before.startedAt); // a clock line

    output.unlock();
    const after = output.speak(line);
    expect(utterances.map((u) => u.text)).toEqual([text]);
    expect(synth.speak).toHaveBeenCalledWith(utterances[0]);
    expect(after.origin()).toBe(Infinity); // not started yet
    expect(after.audible()).toBe(false);
  });

  it('with sound off, lines play on the clock even after unlock()', () => {
    const { synth, Utterance, utterances } = fakes();
    const output = createWebSpeechOutput({ synth, Utterance, clock, languages: [] });
    output.unlock();
    output.setOn(false);
    output.speak(line);
    expect(utterances).toHaveLength(0);
  });

  it('cancel() on a line waiting for audio resolves it and cancels the synth', async () => {
    const { synth, Utterance } = fakes();
    const output = createWebSpeechOutput({ synth, Utterance, clock, languages: [] });
    output.unlock();
    const { done } = output.speak(line);
    output.cancel();
    expect(synth.cancel).toHaveBeenCalled();
    await expect(done).resolves.toBeUndefined();
  });

  it('setOn notifies subscribers once per change, with a stable snapshot between changes', () => {
    const { synth, Utterance } = fakes();
    const output = createWebSpeechOutput({ synth, Utterance, clock, languages: [] });
    const listener = vi.fn();
    const unsubscribe = output.subscribe(listener);
    const first = output.getSnapshot();
    expect(output.getSnapshot()).toBe(first);

    output.setOn(true); // no change
    expect(listener).not.toHaveBeenCalled();
    output.setOn(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(output.getSnapshot()).toEqual({ on: false });

    unsubscribe();
    output.setOn(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('the real DOM objects fit the minimal types (checked by typecheck)', () => {
    const fits = (synth: SpeechSynthesis, Utterance: typeof SpeechSynthesisUtterance) => ({
      synth: synth satisfies SynthLike,
      Utterance: Utterance satisfies UtteranceCtor,
    });
    expect(typeof fits).toBe('function');
  });
});

/** An unlocked output over fake speech: the state after the privacy notice was accepted. */
function unlocked(voices?: SpeechSynthesisVoice[], languages: readonly string[] = ['en-US']) {
  const f = fakes(voices);
  const output = createWebSpeechOutput({ synth: f.synth, Utterance: f.Utterance, clock, languages });
  output.unlock();
  return { ...f, output };
}
const spanish = { text: 'Cuéntame más.', locale: 'es' as const, timeline: buildTimeline('Cuéntame más.', 'es') };

describe('createWebSpeechOutput: voice choice and audio playback', () => {
  it('speaks with the pickVoice voice for the line language, its lang and rate 1', () => {
    const { output, utterances } = unlocked([network, alex, daniel, paulina, monica], ['en-GB', 'es-MX']);
    output.speak(line);
    output.speak(spanish);
    expect(utterances.map((u) => [u.text, u.voice?.name, u.lang, u.rate])).toEqual([
      [text, 'Daniel', 'en-GB', 1], // the preferred region; the network default is never used
      ['Cuéntame más.', 'Paulina', 'es-MX', 1], // the preferred region beats the default voice
    ]);
  });

  it('origin() is Infinity until the start event, then the start time; done resolves on end', async () => {
    const { output, utterances } = unlocked();
    const playback = output.speak(line);
    const state = track(playback.done);
    expect(playback.origin()).toBe(Infinity);

    await vi.advanceTimersByTimeAsync(300);
    utterances[0].fire('start');
    expect(playback.origin()).toBe(5300);
    expect(playback.audible()).toBe(true);

    await vi.advanceTimersByTimeAsync(5000); // audio may outlast the estimate: only `end` ends it
    expect(state.resolved).toBe(false);
    utterances[0].fire('end');
    await vi.advanceTimersByTimeAsync(0);
    expect(state.resolved).toBe(true);
    expect(playback.audible()).toBe(true); // it was heard
  });

  it('an end without a start resolves the line as not heard', async () => {
    const { output, utterances } = unlocked();
    const playback = output.speak(line);
    utterances[0].fire('end');
    await expect(playback.done).resolves.toBeUndefined();
    expect(playback.audible()).toBe(false);
  });

  it('ignores the events of an older utterance', async () => {
    const { output, utterances } = unlocked();
    output.speak(line);
    const second = output.speak(line);
    const state = track(second.done);
    utterances[0].fire('start');
    utterances[0].fire('end');
    await vi.advanceTimersByTimeAsync(0);
    expect(second.origin()).toBe(Infinity);
    expect(state.resolved).toBe(false);
  });

  it('no local voice for the language: that line plays on the clock and the view says no-voice', () => {
    const { output, utterances } = unlocked([alex, voice('Google español', 'es-ES', false)]);
    const listener = vi.fn();
    output.subscribe(listener);

    const muted = output.speak(spanish);
    expect(utterances).toHaveLength(0);
    expect(muted.origin()).toBe(muted.startedAt);
    expect(output.getSnapshot()).toEqual({ on: true, reason: 'no-voice' });
    expect(listener).toHaveBeenCalledTimes(1);

    output.speak(line); // English has a voice
    expect(utterances).toHaveLength(1);
    expect(output.getSnapshot()).toEqual({ on: true });
  });

  it('an empty voice list: no reason during the first 2 s, then no-voice; voices arriving clear it', async () => {
    const { output, utterances, setVoices } = unlocked([]);
    const listener = vi.fn();
    output.subscribe(listener);

    output.speak(line); // voices are still loading: muted, no reason yet
    expect(utterances).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1999);
    expect(output.getSnapshot()).toEqual({ on: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(output.getSnapshot()).toEqual({ on: true, reason: 'no-voice' });
    expect(listener).toHaveBeenCalledTimes(1);

    setVoices([alex]);
    expect(output.getSnapshot()).toEqual({ on: true });
    expect(listener).toHaveBeenCalledTimes(2);
    output.speak(line);
    expect(utterances.map((u) => u.voice?.name)).toEqual(['Alex']);
  });

  it('chooses again when the voice list changes', () => {
    const { output, utterances, setVoices } = unlocked([alex]);
    output.speak(spanish);
    expect(output.getSnapshot().reason).toBe('no-voice');
    setVoices([alex, paulina]);
    expect(output.getSnapshot()).toEqual({ on: true });
    output.speak(spanish);
    expect(utterances.map((u) => u.voice?.name)).toEqual(['Paulina']);
  });
});
