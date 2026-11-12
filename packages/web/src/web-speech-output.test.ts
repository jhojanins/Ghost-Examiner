import { buildTimeline, wordAt } from '@ghost-examiner/core';
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

describe('createWebSpeechOutput: mouth resync on boundary events', () => {
  // "Tell me more.": Tell 0-260 ms (char 0), me 260-390 (char 5), more. 390-650 (char 8).
  const word = (charIndex: number) => ({ name: 'word', charIndex });
  /** A spoken line that started at 5000 and is `ms` into its audio. */
  async function speaking(ms: number) {
    const setup = unlocked();
    const playback = setup.output.speak(line);
    setup.utterances[0].fire('start');
    await vi.advanceTimersByTimeAsync(ms);
    const at = () => wordAt(line.timeline, clock.now() - playback.origin());
    return { ...setup, playback, utterance: setup.utterances[0], at };
  }

  it('a word boundary ahead of the estimate jumps to that word', async () => {
    const { playback, utterance, at } = await speaking(100);
    expect(at()).toBe(0);
    utterance.fire('boundary', word(8));
    expect(at()).toBe(2);
    expect(playback.origin()).toBe(clock.now() - 390);
  });

  it('a boundary behind the estimate holds on the current word, never moving back', async () => {
    const { playback, utterance, at } = await speaking(300);
    expect(at()).toBe(1);
    utterance.fire('boundary', word(0));
    expect(at()).toBe(1);
    expect(playback.origin()).toBe(clock.now() - 260); // waits at the start of "me"
  });

  it('a boundary on the current word keeps the origin, so the mouth never stutters', async () => {
    const { playback, utterance } = await speaking(300);
    const before = playback.origin();
    utterance.fire('boundary', word(5));
    expect(playback.origin()).toBe(before);
  });

  it('a character inside the current word counts as that word', async () => {
    const { playback, utterance } = await speaking(100);
    const before = playback.origin();
    utterance.fire('boundary', word(3)); // the "l" at the end of "Tell"
    expect(playback.origin()).toBe(before);
  });

  it('a sentence boundary changes nothing', async () => {
    const { playback, utterance } = await speaking(100);
    const before = playback.origin();
    utterance.fire('boundary', { name: 'sentence', charIndex: 8 });
    expect(playback.origin()).toBe(before);
  });

  it('a boundary before the start event changes nothing', () => {
    const { output, utterances } = unlocked();
    const playback = output.speak(line);
    utterances[0].fire('boundary', word(8));
    expect(playback.origin()).toBe(Infinity);
  });

  it('a boundary from an older utterance changes nothing', async () => {
    const { output, utterances } = unlocked();
    output.speak(line);
    utterances[0].fire('start');
    const second = output.speak(line);
    utterances[1].fire('start');
    await vi.advanceTimersByTimeAsync(100);
    const before = second.origin();
    utterances[0].fire('boundary', word(8));
    expect(second.origin()).toBe(before);
  });
});

describe('createWebSpeechOutput: failure and mute paths', () => {
  const duration = line.timeline.duration; // 1050 ms

  it('no start within 2 s: cancel the synth, play the line on the clock from then, sound off as failed', async () => {
    const { output, synth } = unlocked();
    const listener = vi.fn();
    output.subscribe(listener);
    const playback = output.speak(line);
    const state = track(playback.done);

    await vi.advanceTimersByTimeAsync(1999);
    expect(synth.cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(playback.origin()).toBe(7000);
    expect(playback.audible()).toBe(false);
    expect(output.getSnapshot()).toEqual({ on: false, reason: 'failed' });
    expect(listener).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(duration - 1);
    expect(state.resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.resolved).toBe(true);
  });

  it('a start before 2 s clears the timeout', async () => {
    const { output, utterances, synth } = unlocked();
    output.speak(line);
    await vi.advanceTimersByTimeAsync(1500);
    utterances[0].fire('start');
    await vi.advanceTimersByTimeAsync(5000);
    expect(synth.cancel).not.toHaveBeenCalled();
    expect(output.getSnapshot()).toEqual({ on: true });
  });

  it('an utterance error: the line continues on the clock from its origin, sound off as failed', async () => {
    const { output, utterances, synth } = unlocked();
    const playback = output.speak(line);
    await vi.advanceTimersByTimeAsync(300);
    utterances[0].fire('start');
    await vi.advanceTimersByTimeAsync(100);
    utterances[0].fire('error', { error: 'synthesis-failed' });

    expect(synth.cancel).toHaveBeenCalled();
    expect(playback.origin()).toBe(5300);
    expect(playback.audible()).toBe(false);
    expect(output.getSnapshot()).toEqual({ on: false, reason: 'failed' });
    const state = track(playback.done);
    await vi.advanceTimersByTimeAsync(5300 + duration - clock.now() - 1);
    expect(state.resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.resolved).toBe(true);
  });

  it('an error before the start event plays the line on the clock from that moment', async () => {
    const { output, utterances } = unlocked();
    const playback = output.speak(line);
    await vi.advanceTimersByTimeAsync(200);
    utterances[0].fire('error', { error: 'not-allowed' });
    expect(playback.origin()).toBe(5200);
    expect(output.getSnapshot().reason).toBe('failed');
  });

  it.each(['interrupted', 'canceled'])(
    'an %s error the app did not cause: the line continues on the clock, and sound stays on',
    async (error) => {
      const { output, utterances } = unlocked();
      const playback = output.speak(line);
      utterances[0].fire('start');
      await vi.advanceTimersByTimeAsync(100);
      utterances[0].fire('error', { error });
      expect(playback.audible()).toBe(false);
      expect(output.getSnapshot()).toEqual({ on: true });
      const state = track(playback.done);
      await vi.advanceTimersByTimeAsync(duration - 100 - 1); // ends at 5000 + duration
      expect(state.resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(state.resolved).toBe(true);
      output.speak(line);
      expect(utterances).toHaveLength(2); // the next line is spoken
    },
  );

  it('cancel() on a started line resolves at once; the synth error it causes changes nothing', async () => {
    const { output, utterances, synth } = unlocked();
    const playback = output.speak(line);
    utterances[0].fire('start');
    output.cancel(); // the fake synth fires "interrupted" right away
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    await expect(playback.done).resolves.toBeUndefined();
    expect(clock.now()).toBe(5000);
    expect(output.getSnapshot()).toEqual({ on: true });
  });

  it('sound off mid-line: the audio stops and the line ends on the clock; sound on again speaks the next line', async () => {
    const { output, utterances, synth } = unlocked();
    const playback = output.speak(line);
    utterances[0].fire('start');
    await vi.advanceTimersByTimeAsync(400);
    output.setOn(false);
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(playback.audible()).toBe(false);
    expect(playback.origin()).toBe(5000);
    expect(output.getSnapshot()).toEqual({ on: false });

    output.setOn(true); // the current line stays muted (Req 2.4: the next line is spoken)
    const state = track(playback.done);
    await vi.advanceTimersByTimeAsync(duration - 400 - 1);
    expect(state.resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.resolved).toBe(true);
    expect(utterances).toHaveLength(1);
    output.speak(line);
    expect(utterances).toHaveLength(2);
  });

  it('after sound off, late events of the muted line change nothing', async () => {
    const { output, utterances } = unlocked();
    const playback = output.speak(line);
    utterances[0].fire('start');
    await vi.advanceTimersByTimeAsync(100);
    output.setOn(false);
    const state = track(playback.done);
    utterances[0].fire('boundary', { name: 'word', charIndex: 8 });
    utterances[0].fire('end');
    await vi.advanceTimersByTimeAsync(0);
    expect(playback.origin()).toBe(5000); // the clock line keeps its origin
    expect(state.resolved).toBe(false); // and ends on the clock, not on the late `end`
  });

  it('sound off while waiting for the start event plays the line on the clock from then', async () => {
    const { output } = unlocked();
    const playback = output.speak(line);
    await vi.advanceTimersByTimeAsync(250);
    output.setOn(false);
    expect(playback.origin()).toBe(5250);
  });

  it('after a failure, lines play muted until the user turns sound on again', async () => {
    const { output, utterances } = unlocked();
    output.speak(line);
    utterances[0].fire('error', { error: 'synthesis-failed' });
    output.speak(line);
    expect(utterances).toHaveLength(1);

    output.setOn(true);
    expect(output.getSnapshot()).toEqual({ on: true });
    output.speak(line);
    expect(utterances).toHaveLength(2);
  });

  it('a line with no words never becomes an utterance, so it cannot time out as a failure', async () => {
    const { output, utterances } = unlocked();
    const empty = { text: ' ', locale: 'en' as const, timeline: buildTimeline(' ', 'en') };
    const state = track(output.speak(empty).done);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.resolved).toBe(true);
    expect(utterances).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(output.getSnapshot()).toEqual({ on: true });
  });
});

describe('createWebSpeechOutput: end watchdog (task 13b)', () => {
  const duration = line.timeline.duration; // 1050 ms: the deadline is duration + 5 s
  const word = (charIndex: number) => ({ name: 'word', charIndex });

  /** A spoken line that started at 5000. */
  function started(l = line) {
    const setup = unlocked();
    const playback = setup.output.speak(l);
    setup.utterances[0].fire('start');
    return { ...setup, playback, utterance: setup.utterances[0] };
  }

  it('a short line with no end fails at origin + duration + 5 s', async () => {
    const { output, synth, playback } = started();
    const state = track(playback.done);
    await vi.advanceTimersByTimeAsync(duration + 5000 - 1);
    expect(output.getSnapshot()).toEqual({ on: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(output.getSnapshot()).toEqual({ on: false, reason: 'failed' });
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // its timeline is long over: the clock end is a 0 ms timer (1 ms, as in browsers)
    expect(state.resolved).toBe(true);
  });

  it('a long line with no end fails at origin + 2 x duration', async () => {
    const text = Array.from({ length: 30 }, () => 'word').join(' ');
    const long = { text, locale: 'en' as const, timeline: buildTimeline(text, 'en') };
    expect(long.timeline.duration).toBeGreaterThan(5000);
    const { output } = started(long);
    await vi.advanceTimersByTimeAsync(2 * long.timeline.duration - 1);
    expect(output.getSnapshot()).toEqual({ on: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(output.getSnapshot().reason).toBe('failed');
  });

  it('a boundary that moves the origin later moves the deadline later', async () => {
    const { output, utterance, playback } = started();
    await vi.advanceTimersByTimeAsync(300);
    utterance.fire('boundary', word(0)); // the estimate is ahead: hold on "me"
    expect(playback.origin()).toBe(5040);
    await vi.advanceTimersByTimeAsync(5040 + duration + 5000 - clock.now() - 1);
    expect(output.getSnapshot()).toEqual({ on: true }); // past the first deadline (11050)
    await vi.advanceTimersByTimeAsync(1);
    expect(output.getSnapshot().reason).toBe('failed');
  });

  it('a boundary that moves the origin earlier moves the deadline earlier', async () => {
    const { output, utterance, playback } = started();
    await vi.advanceTimersByTimeAsync(100);
    utterance.fire('boundary', word(8)); // the audio is ahead: jump to "more."
    expect(playback.origin()).toBe(4710);
    await vi.advanceTimersByTimeAsync(4710 + duration + 5000 - clock.now() - 1);
    expect(output.getSnapshot()).toEqual({ on: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(output.getSnapshot().reason).toBe('failed');
  });

  it('end before the deadline, sound off, and cancel() each stop the watchdog', async () => {
    const ended = started();
    ended.utterance.fire('end');
    const muted = started();
    muted.output.setOn(false);
    const cancelled = started();
    cancelled.output.cancel();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(ended.output.getSnapshot()).toEqual({ on: true });
    expect(muted.output.getSnapshot()).toEqual({ on: false });
    expect(cancelled.output.getSnapshot()).toEqual({ on: true });
  });
});

describe('createWebSpeechOutput: setLocale (task 19, open point from task 11)', () => {
  it('the no-voice reason follows the UI language even when no line plays', () => {
    const { output } = unlocked([alex]); // English only
    const listener = vi.fn();
    output.subscribe(listener);
    output.setLocale('es');
    expect(output.getSnapshot()).toEqual({ on: true, reason: 'no-voice' });
    expect(listener).toHaveBeenCalledTimes(1);
    output.setLocale('en');
    expect(output.getSnapshot()).toEqual({ on: true });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('works before any line was spoken, and a later line in another language still wins', () => {
    const { output } = unlocked([alex]);
    output.setLocale('es');
    expect(output.getSnapshot().reason).toBe('no-voice');
    output.speak(line); // an English line
    expect(output.getSnapshot()).toEqual({ on: true });
  });

  it('changes nothing about the line that is playing', () => {
    const { output, utterances } = unlocked([alex, paulina]);
    const playback = output.speak(line);
    utterances[0].fire('start');
    output.setLocale('es');
    expect(playback.audible()).toBe(true);
    expect(utterances).toHaveLength(1);
  });
});
