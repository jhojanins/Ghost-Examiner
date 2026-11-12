import { tokenize, type Timeline } from './timeline';

/**
 * Index of the word a boundary event's `charIndex` points at (spec b design §2.3, Req 3.3):
 * the word that contains the position; whitespace maps to the next word; a position past the
 * last word maps to the last word. -1 when the line has no words. `charIndex` counts UTF-16
 * code units, like `tokenize` offsets, so the index matches `buildTimeline(text).words`.
 */
export function wordIndexAt(text: string, charIndex: number): number {
  const tokens = tokenize(text);
  if (tokens.length === 0) return -1;
  const index = tokens.findIndex((t) => t.from + t.text.length > charIndex);
  return index === -1 ? tokens.length - 1 : index;
}

/** Index of the last word that has started at `elapsed` ms into the line; -1 before the first. */
export function wordAt(timeline: Timeline, elapsed: number): number {
  let index = -1;
  for (const word of timeline.words) {
    if (word.start > elapsed) break;
    index = word.index;
  }
  return index;
}

/**
 * New elapsed time for a line after a boundary event reports `wordIndex` (spec b design §2.3,
 * Req 3.2): jump forward when the audio is ahead, keep `elapsed` when they agree (no stutter),
 * and hold on the current word's start when the estimate is ahead, so the caption marker never
 * moves backwards. Afterwards `wordAt` is max(wordIndex, current word) (P12).
 */
export function resync(timeline: Timeline, elapsed: number, wordIndex: number): number {
  const { words } = timeline;
  if (words.length === 0) return elapsed;
  const reported = Math.min(Math.max(wordIndex, 0), words.length - 1);
  const current = wordAt(timeline, elapsed);
  if (reported > current) return words[reported].start;
  if (reported === current) return elapsed;
  return words[current].start;
}
