import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n/i18n';
import { buildTimeline } from './timeline';

const locale = fc.constantFrom<Locale>('en', 'es');
// Word-like tokens with accents, digits and punctuation, joined by mixed whitespace,
// plus arbitrary Unicode strings for robustness.
const token = fc.string({
  unit: fc.constantFrom(...'abeimopfvhlnstuyáéíóúñü19,.?!¿¡-'.split('')),
  minLength: 1,
  maxLength: 10,
});
const wordy = fc
  .array(fc.tuple(token, fc.constantFrom(' ', '  ', '\n', '\t')), { maxLength: 15 })
  .map((parts) => parts.map(([w, sep]) => w + sep).join(''));
const text = fc.oneof(wordy, fc.string({ unit: 'grapheme' }), fc.string());

const tokensOf = (s: string) => s.split(/\s+/).filter(Boolean);

describe('timeline properties', () => {
  it('P5: word cues are ordered, non-overlapping and cover every word; mouth cues tile the line and end at rest', () => {
    fc.assert(
      fc.property(text, locale, (s, loc) => {
        const { words, mouth, duration } = buildTimeline(s, loc);
        const tokens = tokensOf(s);

        expect(words.map((w) => w.text)).toEqual(tokens);
        words.forEach((w, i) => {
          expect(w.index).toBe(i);
          expect(w.end).toBeGreaterThan(w.start);
          if (i > 0) expect(w.start).toBeGreaterThanOrEqual(words[i - 1].end);
        });

        if (tokens.length === 0) {
          expect(mouth).toEqual([]);
          expect(duration).toBe(0);
          return;
        }
        expect(mouth[0].start).toBe(0);
        mouth.forEach((c, i) => {
          expect(c.end).toBeGreaterThan(c.start);
          if (i > 0) expect(c.start).toBe(mouth[i - 1].end); // contiguous, so ordered and non-overlapping
        });
        const last = mouth[mouth.length - 1];
        expect(last.viseme).toBe('rest');
        expect(last.end).toBe(duration);
      }),
      { numRuns: 100 },
    );
  });

  it('P6: appending words never decreases duration', () => {
    fc.assert(
      fc.property(text, wordy, locale, (s, more, loc) => {
        expect(buildTimeline(`${s} ${more}`, loc).duration).toBeGreaterThanOrEqual(buildTimeline(s, loc).duration);
      }),
      { numRuns: 100 },
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(text, locale, (s, loc) => {
        expect(buildTimeline(s, loc)).toEqual(buildTimeline(s, loc));
      }),
      { numRuns: 100 },
    );
  });
});
