import { pickVoice, resync, wordIndexAt, type Clock, type Locale, type Timeline, type VoiceInfo } from '@ghost-examiner/core';
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
  /** The browser's preferred languages (`navigator.languages`), for the voice's region. */
  languages: readonly string[];
}

/** How long an empty voice list counts as "still loading" (some systems never fire voiceschanged). */
const VOICES_GRACE_MS = 2000;
/** A spoken line that hasn't started by then counts as failed (Req 1.6; macOS hang, Chromium 572750556). */
const START_TIMEOUT_MS = 2000;
/** A started line with no `end` by origin + max(2 × duration, duration + 5 s) counts as failed (task 13b). */
const endDeadline = (duration: number) => Math.max(2 * duration, duration + 5000);

/** One line: spoken aloud, or played on the clock (muted) like SilentOutput. */
interface Line {
  text: string;
  timeline: Timeline;
  anchor: number; // the timeline's time origin; Infinity while spoken audio hasn't started
  audio: boolean; // spoken aloud, rather than on the clock
  started: boolean; // the audio started
  settled: boolean; // `done` resolved
  finish: () => void;
  timer?: ReturnType<typeof setTimeout>; // one at a time: start timeout, end watchdog, or the clock end
  /**
   * Held only to keep the utterance alive while it speaks: some Chrome versions have been reported
   * to garbage-collect an utterance mid-speech and then never fire its `end` event (task 13b).
   */
  utterance?: UtteranceLike;
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
  let lastLocale: Locale | undefined; // language of the latest line: the one the "no-voice" reason is about
  let voicesLoading = true;
  let failed = false; // the voice failed; muted until the user turns sound on again (Req 1.6)
  const listeners = new Set<() => void>();

  /** The local voice `pickVoice` chooses for `locale` (Req 1.3), from the current voice list. */
  function voiceFor(locale: Locale): SpeechSynthesisVoice | undefined {
    const voices = api?.synth.getVoices() ?? [];
    const infos: VoiceInfo[] = voices.map((v) => ({ name: v.name, lang: v.lang, localService: v.localService, isDefault: v.default }));
    const chosen = pickVoice(infos, locale, deps.languages);
    return chosen && voices[infos.indexOf(chosen)];
  }

  function reasonNow(): SoundView['reason'] {
    if (!api) return 'no-api';
    if (failed) return 'failed';
    if (api.synth.getVoices().length === 0) return voicesLoading ? undefined : 'no-voice';
    if (lastLocale && !voiceFor(lastLocale)) return 'no-voice';
    return undefined;
  }

  const viewNow = (): SoundView => {
    const reason = reasonNow();
    if (reason === 'no-api') return { on: false, reason };
    return reason ? { on, reason } : { on };
  };
  let view = viewNow();

  if (api) {
    api.synth.addEventListener('voiceschanged', () => refresh()); // Req 1.5
    setTimeout(() => {
      voicesLoading = false;
      refresh();
    }, VOICES_GRACE_MS);
  }

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

  /**
   * Events count only while the line is still audio and not ended. An older line is always
   * settled (a new `speak` cancels it first), so its events never count.
   */
  const live = (line: Line) => line.audio && !line.settled;

  /**
   * The line goes on muted, on the clock, from its current origin, or from now if the audio never
   * started. `audio` turns false before `synth.cancel()`, so the "interrupted" error that the
   * cancel causes finds the line no longer live.
   */
  function mute(line: Line) {
    line.audio = false;
    if (!line.started) line.anchor = clock.now();
    runOnClock(line);
    api?.synth.cancel();
  }

  /** The voice failed: this line goes on muted, and so does the session until sound is turned on. */
  function fail(line: Line) {
    failed = true;
    on = false;
    mute(line);
    refresh();
  }

  /** (Re)arms the end watchdog from the current origin; called on start and on every resync. */
  function watch(line: Line) {
    clearTimeout(line.timer);
    line.timer = setTimeout(() => fail(line), Math.max(0, line.anchor + endDeadline(line.timeline.duration) - clock.now()));
  }

  function speakAloud(line: Line, voice: SpeechSynthesisVoice, { synth, Utterance }: NonNullable<typeof api>) {
    line.audio = true;
    line.anchor = Infinity;
    line.timer = setTimeout(() => fail(line), START_TIMEOUT_MS); // replaced on start; cleared by mute or settle
    const utterance = new Utterance(line.text);
    line.utterance = utterance;
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 1;
    utterance.onstart = () => {
      if (!live(line)) return;
      line.started = true;
      line.anchor = clock.now();
      watch(line); // replaces the start timeout
    };
    // Our own cancel() never reaches here (the line is settled or muted first), so an
    // "interrupted" or "canceled" error comes from outside: go on muted, but keep sound on.
    utterance.onerror = (e) => {
      if (!live(line)) return;
      if (e.error === 'interrupted' || e.error === 'canceled') mute(line);
      else fail(line);
    };
    // Req 3.2: shift the origin so the reported word is current. Without boundary events
    // (many network voices) the origin stays at `start` and the estimate drives the mouth (Req 3.4).
    utterance.onboundary = (e) => {
      if (!live(line) || !line.started || e.name !== 'word') return;
      const now = clock.now();
      line.anchor = now - resync(line.timeline, now - line.anchor, wordIndexAt(line.text, e.charIndex));
      watch(line); // the deadline follows the origin
    };
    utterance.onend = () => {
      if (live(line)) settle(line);
    };
    synth.speak(utterance);
  }

  function cancel() {
    const line = current;
    if (!line) return;
    settle(line); // first, so the synth's own "interrupted" error finds nothing to act on
    if (line.audio) api?.synth.cancel();
  }

  return {
    speak({ text, locale, timeline }): Playback {
      cancel();
      lastLocale = locale;
      refresh();
      const startedAt = clock.now();
      let finish!: () => void;
      const done = new Promise<void>((resolve) => (finish = resolve));
      const line: Line = { text, timeline, anchor: startedAt, audio: false, started: false, settled: false, finish };
      current = line;
      // A line with no words stays on the clock: an empty utterance may never fire `start`,
      // and the start timeout would then mute the whole session.
      const voice = api && unlocked && on && timeline.words.length > 0 ? voiceFor(locale) : undefined;
      if (api && voice) speakAloud(line, voice, api);
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
      if (next) failed = false; // Req 1.6: the user can turn sound on again after a failure
      else if (current && live(current)) mute(current); // Req 2.3: the audio stops at once
      refresh();
    },
    unlock() {
      unlocked = true;
    },
  };
}
