import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n/i18n';
import { resync, wordAt, wordIndexAt } from './sync';
import { buildTimeline, tokenize, type Timeline } from './timeline';

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

  it('P12: after resync the current word is max(reported word, current word), and a matching boundary keeps elapsed', () => {
    let jumped = 0;
    let kept = 0;
    let held = 0;
    // Raw values cover times before and after the line and out-of-range indexes. Raw values
    // alone rarely hit "estimate ahead" (most generated lines have one word and fast-check
    // biases toward the bounds), so half the time elapsed falls inside a random word and the
    // reported index is near the current word.
    const raw = fc.record({
      elapsed: fc.double({ min: -500, max: 20_000, noNaN: true }),
      w: fc.integer({ min: -3, max: 40 }),
    });
    const relative = fc.record({
      word: fc.nat(40),
      within: fc.double({ min: 0, max: 0.99, noNaN: true }),
      offset: fc.integer({ min: -3, max: 3 }),
    });
    type Pick = { elapsed: number; w: number } | { word: number; within: number; offset: number };
    const place = (t: Timeline, pick: Pick): { elapsed: number; w: number } => {
      if ('elapsed' in pick) return pick;
      if (t.words.length === 0) return { elapsed: pick.within, w: pick.offset };
      const word = t.words[pick.word % t.words.length];
      return { elapsed: word.start + pick.within * (word.end - word.start), w: word.index + pick.offset };
    };
    fc.assert(
      fc.property(
        fc.oneof(wordy, text),
        locale,
        fc.oneof(raw, relative),
        (s, loc, pick) => {
          const t = buildTimeline(s, loc);
          const { elapsed, w } = place(t, pick);
          const result = resync(t, elapsed, w);
          if (t.words.length === 0) {
            expect(result).toBe(elapsed);
            return;
          }
          const clamped = Math.min(Math.max(w, 0), t.words.length - 1);
          const current = wordAt(t, elapsed);
          expect(wordAt(t, result)).toBe(Math.max(clamped, current));
          if (clamped === current) {
            expect(result).toBe(elapsed);
            kept++;
          } else if (clamped > current) jumped++;
          else held++;
        },
      ),
      { numRuns: 300 },
    );
    // All three cases of design §2.3 were exercised.
    expect(jumped).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
    expect(held).toBeGreaterThan(0);
  });
});
