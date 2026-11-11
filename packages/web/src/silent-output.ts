import type { Clock, Timeline } from '@ghost-examiner/core';

/**
 * Plays a ghost line. `startedAt` is the clock time the line started, so the ghost's mouth and
 * the captions read the same timeline on the same clock origin (design §4.2).
 */
export interface SpeechOutput {
  speak(timeline: Timeline): { startedAt: number; done: Promise<void> };
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
    speak(timeline) {
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
      return { startedAt, done };
    },
    cancel,
  };
}
