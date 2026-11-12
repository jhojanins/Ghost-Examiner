import type { Clock, Timeline } from '@ghost-examiner/core';
import type { Playback, SpeechOutput } from './silent-output';

/**
 * The members of `SpeechSynthesisUtterance` and `speechSynthesis` this output uses, so unit
 * tests can pass fakes (spec b design §3.2). They reuse the DOM shapes, so the real objects fit
 * with no cast (checked by a type test).
 */
export type UtteranceLike = Pick<SpeechSynthesisUtterance, 'lang' | 'voice' | 'rate' | 'onstart' | 'onend' | 'onerror' | 'onboundary'>;
export type UtteranceCtor = new (text: string) => UtteranceLike;
export interface SynthLike {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  getVoices(): readonly SpeechSynthesisVoice[];
  addEventListener(type: 'voiceschanged', listener: () => void): void;
}

/** What the sound control shows (Req 2.1): whether sound is on, and why it can't be, if so. */
export interface SoundView {
  on: boolean;
  reason?: 'no-api' | 'no-voice' | 'failed';
}

export interface VoiceOutput extends SpeechOutput {
  getSnapshot(): SoundView;
  subscribe(listener: () => void): () => void;
  setOn(on: boolean): void;
  /** The privacy notice was accepted (Req 2.2); browsers also need this user activation to speak. */
  unlock(): void;
}

export interface WebSpeechDeps {
  synth?: SynthLike;
  Utterance?: UtteranceCtor;
  clock: Clock;
}

/** One line: spoken aloud, or played on the clock (muted) like SilentOutput. */
interface Line {
  text: string;
  timeline: Timeline;
  anchor: number; // the timeline's time origin; Infinity while spoken audio hasn't started
  audio: boolean; // spoken aloud, rather than on the clock
  started: boolean; // the audio started
  settled: boolean; // `done` resolved
  finish: () => void;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * The ghost's voice (spec b design §3.2, Req 1, 2). Without the speech API, before `unlock()`,
 * or with sound off, a line plays on the clock exactly like SilentOutput, so captions and the
 * mouth carry it. One line at a time: a new `speak` ends the previous line.
 */
export function createWebSpeechOutput(deps: WebSpeechDeps): VoiceOutput {
  const { synth, Utterance, clock } = deps;
  const api = synth && Utterance ? { synth, Utterance } : undefined;
  let on = true; // sound on by default (Req 2.2)
  let unlocked = false;
  let current: Line | undefined;
  const listeners = new Set<() => void>();

  const viewNow = (): SoundView => (api ? { on } : { on: false, reason: 'no-api' });
  let view = viewNow();

  /** Recomputes the view; replaces the snapshot and notifies only when something changed. */
  function refresh() {
    const next = viewNow();
    if (next.on === view.on && next.reason === view.reason) return;
    view = next;
    for (const listener of listeners) listener();
  }

  function settle(line: Line) {
    if (line.settled) return;
    line.settled = true;
    clearTimeout(line.timer);
    if (current === line) current = undefined;
    line.finish();
  }

  /** Ends the line when its timeline, read from the current origin, ends. */
  function runOnClock(line: Line) {
    clearTimeout(line.timer);
    line.timer = setTimeout(() => settle(line), Math.max(0, line.anchor + line.timeline.duration - clock.now()));
  }

  function speakAloud(line: Line, { synth, Utterance }: NonNullable<typeof api>) {
    line.audio = true;
    line.anchor = Infinity;
    synth.speak(new Utterance(line.text));
  }

  function cancel() {
    const line = current;
    if (!line) return;
    settle(line); // first, so the synth's own "interrupted" error finds nothing to act on
    if (line.audio) api?.synth.cancel();
  }

  return {
    speak({ text, timeline }): Playback {
      cancel();
      const startedAt = clock.now();
      let finish!: () => void;
      const done = new Promise<void>((resolve) => (finish = resolve));
      const line: Line = { text, timeline, anchor: startedAt, audio: false, started: false, settled: false, finish };
      current = line;
      if (api && unlocked && on) speakAloud(line, api);
      else runOnClock(line);
      return { startedAt, origin: () => line.anchor, audible: () => line.audio && line.started, done };
    },
    cancel,
    getSnapshot: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setOn(next) {
      on = next; // without the API the view stays "off, no-api" whatever the user picks
      refresh();
    },
    unlock() {
      unlocked = true;
    },
  };
}
