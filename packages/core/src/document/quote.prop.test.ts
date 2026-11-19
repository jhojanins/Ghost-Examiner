import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeForQuote, QUOTE_MAX, QUOTE_MIN, verifyQuote } from './quote';

// Characters whose case round-trips and that normalize one code point at a time.
const pool = 'abcdefghijklmnopqrstuvwxyzáéíóúñü0123456789.,;:¿?¡!()"\'“”‘’–—-'.split('');
const space = [' ', '  ', '\n', '\t', ' \n '];
const excerptText = fc
  .array(fc.oneof({ weight: 6, arbitrary: fc.constantFrom(...pool) }, { weight: 1, arbitrary: fc.constantFrom(...space) }), {
    minLength: 20,
    maxLength: 400,
  })
  .map((cs) => cs.join(''));
/** Random case per character, and each whitespace run replaced by another whitespace run. */
const reshape = (s: string, flips: boolean[], runs: string[]) => {
  let i = 0;
  let r = 0;
  return s.replace(/\s+|\S/g, (m) => (/\s/.test(m) ? runs[r++ % runs.length] : flips[i++ % flips.length] ? m.toUpperCase() : m));
};

describe('verifyQuote properties', () => {
  it('P24a: any slice of the excerpt verifies after any change of case and whitespace', async () => {
    await fc.assert(
      fc.property(
        excerptText,
        fc.nat(),
        fc.integer({ min: QUOTE_MIN, max: QUOTE_MAX }),
        fc.array(fc.boolean(), { minLength: 1 }),
        fc.array(fc.constantFrom(...space), { minLength: 1 }),
        (text, from, len, flips, runs) => {
          const start = from % text.length;
          const slice = text.slice(start, start + len);
          const n = normalizeForQuote(slice).length;
          fc.pre(n >= QUOTE_MIN && n <= QUOTE_MAX);
          expect(verifyQuote(reshape(slice, flips, runs), text)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('P24b: a quote verifies exactly when some slice of the excerpt normalizes to it (brute-force reference)', async () => {
    const short = excerptText.map((t) => t.slice(0, 90));
    // Real slices, changed by one character, or made up.
    const quoteFor = (text: string) =>
      fc.oneof(
        fc.tuple(fc.nat(), fc.integer({ min: 10, max: 40 })).map(([f, l]) => text.slice(f % text.length, (f % text.length) + l)),
        fc
          .tuple(fc.nat(), fc.integer({ min: 12, max: 40 }), fc.nat(), fc.constantFrom(...pool))
          .map(([f, l, at, c]) => {
            const s = text.slice(f % text.length, (f % text.length) + l);
            const k = at % Math.max(s.length, 1);
            return s.slice(0, k) + c + s.slice(k + 1);
          }),
        fc.array(fc.constantFrom(...pool), { minLength: 12, maxLength: 30 }).map((cs) => cs.join('')),
      );
    const reference = (quote: string, text: string) => {
      const q = normalizeForQuote(quote);
      if (q.length < QUOTE_MIN || q.length > QUOTE_MAX) return false;
      for (let i = 0; i < text.length; i++) for (let j = i + 1; j <= text.length; j++) if (normalizeForQuote(text.slice(i, j)) === q) return true;
      return false;
    };
    await fc.assert(
      fc.property(short.chain((text) => fc.tuple(fc.constant(text), quoteFor(text))), ([text, quote]) => {
        expect(verifyQuote(quote, text)).toBe(reference(quote, text));
      }),
      { numRuns: 150 },
    );
  });
});
