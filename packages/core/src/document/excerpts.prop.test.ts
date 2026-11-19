import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { splitExcerpts } from './excerpts';

// Document-like text: headings, paragraphs of sentences, blank lines and stray line breaks.
const word = fc.stringMatching(/^[a-záéíóúñ]{1,9}$/);
const sentence = fc
  .tuple(fc.array(word, { minLength: 1, maxLength: 14 }), fc.constantFrom('.', '?', '!', '', ';'))
  .map(([ws, end]) => ws.join(' ') + end);
const paragraph = fc
  .tuple(fc.array(sentence, { minLength: 1, maxLength: 8 }), fc.constantFrom(' ', '\n'))
  .map(([ss, joiner]) => ss.join(joiner));
const heading = fc.tuple(fc.constantFrom('#', '##', '###'), fc.array(word, { minLength: 1, maxLength: 4 })).map(([h, ws]) => `${h} ${ws.join(' ')}`);
const block = fc.oneof({ weight: 4, arbitrary: paragraph }, { weight: 1, arbitrary: heading });
const separator = fc.constantFrom('\n\n', '\n \n', '\n\n\n', '\n\t\n  ');
const documentText = fc
  .tuple(fc.constantFrom('', '\n', '  '), fc.array(fc.tuple(block, separator), { minLength: 1, maxLength: 12 }), fc.constantFrom('', '\n', '\n\n'))
  .map(([lead, parts, tail]) => lead + parts.map(([b, s]) => b + s).join('').trimEnd() + tail);
const anyText = fc.oneof(documentText, fc.string({ maxLength: 400 }));
const maxChars = fc.integer({ min: 40, max: 400 });

describe('splitExcerpts properties', () => {
  it('P23: in order, no overlap, covering the text, within the limit unless one sentence is longer, stable ids', async () => {
    await fc.assert(
      fc.property(anyText, maxChars, (text, max) => {
        const excerpts = splitExcerpts(text, { maxChars: max });
        expect(splitExcerpts(text, { maxChars: max })).toEqual(excerpts); // same text, same result
        if (text.trim() === '') {
          expect(excerpts).toEqual([]);
          return;
        }
        expect(excerpts[0].start).toBe(0);
        expect(excerpts[excerpts.length - 1].end).toBe(text.length);
        excerpts.forEach((e, i) => {
          expect(e.id).toBe(`e${i + 1}`);
          expect(e.end).toBeGreaterThan(e.start);
          expect(e.text).toBe(text.slice(e.start, e.end));
          if (i > 0) expect(e.start).toBe(excerpts[i - 1].end);
          if (e.text.length > max) {
            // Only a single sentence (one piece with no sentence end or blank line inside) may be longer.
            const body = e.text.trimEnd();
            expect(body, e.text).not.toMatch(/[.!?…][ \t\n]+\S/);
            expect(body, e.text).not.toMatch(/\n[ \t]*\n/);
          }
        });
        expect(excerpts.map((e) => e.text).join('')).toBe(text);
      }),
      { numRuns: 200 },
    );
  });
});
