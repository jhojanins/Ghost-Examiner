import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { splitSentences } from './sentences';

// Words, abbreviations, numbers, punctuation and quotes, so splits and non-splits both happen.
const token = fc.oneof(
  { weight: 6, arbitrary: fc.stringMatching(/^[A-Za-zÁÉÍÓÚáéíóúñ]{1,8}$/) },
  fc.constantFrom('e.g.', 'i.e.', 'p. ej.', 'Dr.', 'Sra.', 'etc.', '7.4', '3.', 'a.', '.', '!', '?', '…', '"', '«', '»', '“', '”', ',', '¿', '¡'),
);
const space = fc.constantFrom(' ', '  ', '\n', '\t', ' \n ');
const text = fc.array(fc.tuple(token, space), { maxLength: 40 }).map((parts) => parts.map(([t, s]) => t + s).join(''));

describe('P26: splitSentences (design §9)', () => {
  it('joining the sentences with single spaces gives the text with whitespace collapsed; no sentence is empty', () => {
    let checked = 0;
    fc.assert(
      fc.property(fc.oneof(text, fc.string({ maxLength: 120 }), fc.string({ unit: 'grapheme', maxLength: 60 })), (t) => {
        const sentences = splitSentences(t);
        for (const s of sentences) {
          expect(s).not.toBe('');
          expect(s).toBe(s.trim());
        }
        expect(sentences.join(' ')).toBe(t.replace(/\s+/g, ' ').trim());
        if (sentences.length > 1) checked++;
      }),
      { numRuns: 500 },
    );
    expect(checked).toBeGreaterThan(0); // some generated texts really split
  });
});
