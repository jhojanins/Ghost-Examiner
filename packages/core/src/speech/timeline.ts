import type { Locale } from '../i18n/i18n';

export type Viseme = 'rest' | 'A' | 'O' | 'MBP'; // phase 2 adds 'E' | 'U' | 'FV'
export interface WordCue {
  index: number;
  text: string;
  start: number;
  end: number;
}
export interface MouthCue {
  start: number;
  end: number;
  viseme: Viseme;
}
/** Words (for captions) and mouth shapes (for the ghost) on one shared clock, in ms from line start. */
export interface Timeline {
  words: WordCue[];
  mouth: MouthCue[];
  duration: number;
}

const MS_PER_LETTER: Record<Locale, number> = { en: 65, es: 60 };
const MIN_WORD_MS = 120;
const COMMA_PAUSE_MS = 200;
const STOP_PAUSE_MS = 400;
const LETTER = /[\p{L}\p{N}]/u;

/** Lowercase, then strip accents ("Á" → "a", "ñ" → "n"). */
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/** Phase 1 letter rules (design §3.5); undefined means "keep the previous shape". */
function visemeFor(letter: string): Viseme | undefined {
  if ('aei'.includes(letter)) return 'A';
  if ('ou'.includes(letter)) return 'O';
  if ('mbpfv'.includes(letter)) return 'MBP';
  return undefined;
}

function pauseAfter(token: string): number {
  const tail = /[^\p{L}\p{N}]*$/u.exec(token)?.[0] ?? '';
  if (/[.?!]/.test(tail)) return STOP_PAUSE_MS;
  if (tail.includes(',')) return COMMA_PAUSE_MS;
  return 0;
}

/**
 * The words of a line, split on whitespace, with each word's start offset in UTF-16 code units
 * (the unit of a boundary event's `charIndex`). `buildTimeline` uses this split, so word index
 * `i` means the same word in the timeline and in boundary resync (spec b design §2.3).
 */
export function tokenize(text: string): { text: string; from: number }[] {
  return [...text.matchAll(/\S+/g)].map((m) => ({ text: m[0], from: m.index }));
}

/**
 * Builds the speech timeline for one ghost line (Req 4.3). Pure and deterministic: the
 * result depends only on the text and locale, never on a clock.
 */
export function buildTimeline(text: string, locale: Locale): Timeline {
  const tokens = tokenize(text).map((t) => t.text);
  const words: WordCue[] = [];
  const mouth: MouthCue[] = [];
  const push = (start: number, end: number, viseme: Viseme) => {
    const last = mouth[mouth.length - 1];
    if (last?.viseme === viseme) last.end = end;
    else mouth.push({ start, end, viseme });
  };

  let t = 0;
  let shape: Viseme = 'rest';
  tokens.forEach((token, index) => {
    const letters = [...normalize(token)].filter((c) => LETTER.test(c));
    const duration = Math.max(MIN_WORD_MS, letters.length * MS_PER_LETTER[locale]);
    const slot = duration / Math.max(letters.length, 1);
    words.push({ index, text: token, start: t, end: t + duration });

    if (letters.length === 0) push(t, t + duration, shape); // e.g. "-" or an emoji
    letters.forEach((letter, i) => {
      shape = visemeFor(letter) ?? shape;
      push(t + i * slot, t + (i + 1) * slot, shape);
    });
    t += duration;

    // The line always ends at rest: without final punctuation it closes like a comma.
    const isLast = index === tokens.length - 1;
    const pause = pauseAfter(token) || (isLast ? COMMA_PAUSE_MS : 0);
    if (pause > 0) {
      push(t, t + pause, 'rest');
      shape = 'rest';
      t += pause;
    }
  });

  return { words, mouth, duration: t };
}
