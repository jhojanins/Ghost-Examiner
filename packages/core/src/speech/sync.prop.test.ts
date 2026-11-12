import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n/i18n';
import { wordIndexAt } from './sync';
import { buildTimeline, tokenize } from './timeline';

const locale = fc.constantFrom<Locale>('en', 'es');
// Same generator idea as timeline.prop.test.ts: word-like tokens joined by mixed whitespace
// (with leading whitespace), plus arbitrary Unicode strings and graphemes.
const token = fc.string({
  unit: fc.constantFrom(...[...'abeimopfvhlnstuyáéíóúñü19,.?!¿¡-👻']), // spread keeps "👻" whole (2 code units)
  minLength: 1,
  maxLength: 10,
});
const space = fc.constantFrom(' ', '  ', '\n', '\t');
const wordy = fc
  .tuple(fc.constantFrom('', ' ', '\t '), fc.array(fc.tuple(token, space), { maxLength: 15 }))
  .map(([lead, parts]) => lead + parts.map(([w, sep]) => w + sep).join(''));
const text = fc.oneof(wordy, fc.string({ unit: 'grapheme' }), fc.string());

describe('sync properties', () => {
  it('P11: every character inside a word maps to that word; indexes stay in range and never decrease; tokens match the timeline', () => {
    fc.assert(
      fc.property(text, locale, (s, loc) => {
        const tokens = tokenize(s);
        expect(tokens.map((t) => t.text)).toEqual(buildTimeline(s, loc).words.map((w) => w.text));

        tokens.forEach((t, i) => {
          for (let c = t.from; c < t.from + t.text.length; c++) expect(wordIndexAt(s, c)).toBe(i);
        });

        let previous = -Infinity;
        for (let c = -2; c <= s.length + 2; c++) {
          const index = wordIndexAt(s, c);
          if (tokens.length === 0) expect(index).toBe(-1);
          else {
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(tokens.length);
          }
          expect(index).toBeGreaterThanOrEqual(previous);
          previous = index;
        }
      }),
      { numRuns: 200 },
    );
  });
});
