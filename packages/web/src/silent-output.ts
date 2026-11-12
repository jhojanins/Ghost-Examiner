import type { Clock, Locale, Timeline } from '@ghost-examiner/core';

/**
 * One playing ghost line (spec b design §3.1). The ghost's mouth and the captions read the line's
 * timeline from `origin()`, every frame, so a boundary resync moves both without a React render.
 */
export interface Playback {
  /** Clock time `speak` was called; fixed, so it identifies the playback. */
  startedAt: number;
  /** Current time origin of the timeline. Infinity while a spoken line has not started yet. */
  origin(): number;
  /** True while this playback is real audio. */
  audible(): boolean;
  /** Resolves when the line ends or is cancelled. */
  done: Promise<void>;
}

/** Plays a ghost line: muted (SilentOutput) or spoken (WebSpeechOutput, spec b). */
export interface SpeechOutput {
  speak(line: { text: string; locale: Locale; timeline: Timeline }): Playback;
  cancel(): void;
}

/**
 * Muted speech (Req 4.1): no audio, the line simply lasts `timeline.duration` ms. Captions and
 * the mouth carry it. One line at a time: a new `speak` ends the previous line.
 */
type Line = { timer: ReturnType<typeof setTimeout>; finish: () => void };

export function createSilentOutput(clock: Clock): SpeechOutput {
  let current: Line | undefined;

  const cancel = () => {
    if (!current) return;
    clearTimeout(current.timer);
    current.finish();
    current = undefined;
  };

  return {
    speak({ timeline }) {
      cancel();
      const startedAt = clock.now();
      const done = new Promise<void>((finish) => {
        const line: Line = {
          finish,
          timer: setTimeout(() => {
            if (current === line) current = undefined;
            finish();
          }, timeline.duration),
        };
        current = line;
      });
      return { startedAt, origin: () => startedAt, audible: () => false, done };
    },
    cancel,
  };
}
