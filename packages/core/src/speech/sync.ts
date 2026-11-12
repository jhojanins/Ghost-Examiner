import { tokenize } from './timeline';

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
