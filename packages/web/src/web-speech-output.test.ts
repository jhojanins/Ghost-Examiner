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
function fakes() {
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
    getVoices: () => [] as SpeechSynthesisVoice[],
    addEventListener: vi.fn(),
  } satisfies SynthLike;
  return { synth, Utterance: FakeUtterance satisfies UtteranceCtor, utterances, spoken };
}

beforeEach(() => vi.useFakeTimers({ now: 5000 }));
afterEach(() => vi.useRealTimers());

describe('createWebSpeechOutput: no speech API', () => {
  it.each([
    ['no speechSynthesis', { Utterance: fakes().Utterance }],
    ['no SpeechSynthesisUtterance', { synth: fakes().synth }],
  ])('%s: sound is off with reason no-api, and setOn(true) cannot turn it on', (_, api) => {
    const output = createWebSpeechOutput({ ...api, clock });
    expect(output.getSnapshot()).toEqual({ on: false, reason: 'no-api' });
    output.unlock();
    output.setOn(true);
    expect(output.getSnapshot()).toEqual({ on: false, reason: 'no-api' });
  });

  it('plays every line on the clock, like SilentOutput', async () => {
    const output = createWebSpeechOutput({ clock });
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
    const output = createWebSpeechOutput({ clock });
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
    expect(createWebSpeechOutput({ synth, Utterance, clock }).getSnapshot()).toEqual({ on: true });
  });

  it('creates no utterance before unlock(), and one with the line text after it', () => {
    const { synth, Utterance, utterances } = fakes();
    const output = createWebSpeechOutput({ synth, Utterance, clock });

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
    const output = createWebSpeechOutput({ synth, Utterance, clock });
    output.unlock();
    output.setOn(false);
    output.speak(line);
    expect(utterances).toHaveLength(0);
  });

  it('cancel() on a line waiting for audio resolves it and cancels the synth', async () => {
    const { synth, Utterance } = fakes();
    const output = createWebSpeechOutput({ synth, Utterance, clock });
    output.unlock();
    const { done } = output.speak(line);
    output.cancel();
    expect(synth.cancel).toHaveBeenCalled();
    await expect(done).resolves.toBeUndefined();
  });

  it('setOn notifies subscribers once per change, with a stable snapshot between changes', () => {
    const { synth, Utterance } = fakes();
    const output = createWebSpeechOutput({ synth, Utterance, clock });
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
