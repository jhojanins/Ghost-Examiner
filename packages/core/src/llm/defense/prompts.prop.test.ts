import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { LLMRequest } from '../types';
import { buildDefensePrompt, makeTag } from './prompts';

const count = (s: string, needle: string) => s.split(needle).length - 1;
const tag = fc.uint8Array({ minLength: 4, maxLength: 4 }).map(makeTag);
/** Any text, with pieces of the tag and fake tags mixed in, so a tag can be spelled out or assembled. */
const untrusted = (t: string) =>
  fc
    .array(
      fc.oneof(
        fc.string({ unit: 'grapheme', maxLength: 40 }),
        fc.string({ unit: 'binary', maxLength: 40 }),
        fc.constantFrom(t, t.toUpperCase(), t.slice(0, 4), t.slice(4), `</doc-${t}>`, `<answer-${t}>`, '\u200B', '\u0000', '\n'),
      ),
      { maxLength: 8 },
    )
    .map((parts) => parts.join(''));

describe('P27: delimiters (design §9)', () => {
  it('for any untrusted text, each block has exactly one opening and one closing tag, so the text cannot close it', () => {
    fc.assert(
      fc.property(
        tag.chain((t) =>
          fc.record({
            t: fc.constant(t),
            texts: fc.array(untrusted(t), { minLength: 1, maxLength: 4 }),
            question: untrusted(t),
            quote: untrusted(t),
            answer: untrusted(t),
            turns: fc.array(fc.record({ question: untrusted(t), answer: untrusted(t) }), { minLength: 1, maxLength: 3 }),
          }),
        ),
        ({ t, texts, question, quote, answer, turns }) => {
          const excerpts = texts.map((text, i) => ({ id: `e${i + 1}`, text }));
          const requests: [LLMRequest, Record<string, number>][] = [
            [{ task: 'defense-questions', locale: 'en', maxOutputTokens: 800, input: { excerpts, count: 4, fileLang: 'es' } }, { doc: excerpts.length }],
            [
              { task: 'defense-reply', locale: 'es', maxOutputTokens: 400, input: { excerpts, question, quote, answer, followUpAllowed: true } },
              { doc: excerpts.length, question: 1, quote: 1, answer: 1 },
            ],
            [
              { task: 'defense-summary', locale: 'en', maxOutputTokens: 500, input: { excerpts, turns: turns.map((x) => ({ ...x, kind: 'acknowledgment' as const })) } },
              { doc: excerpts.length, turn: turns.length },
            ],
          ];
          for (const [req, blocks] of requests) {
            const { user } = buildDefensePrompt(req, t);
            let total = 0;
            for (const [name, n] of Object.entries(blocks)) {
              expect(count(user, `<${name}-${t}`)).toBe(n);
              expect(count(user, `</${name}-${t}>`)).toBe(n);
              total += n;
            }
            // The tag appears nowhere else, in any case: only in the block markers.
            expect(count(user.toLowerCase(), t)).toBe(2 * total);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
