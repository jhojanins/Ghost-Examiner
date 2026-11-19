import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createReplyReader, type ReaderEvent } from './reply-reader';

// Valid replies in the schema's key order: kind, excerptId, quote, say, followUp (design §3.2).
const text = fc.string({ unit: 'grapheme', minLength: 1, maxLength: 80 }).filter((s) => s.trim() !== '' && !/<|```|\]\(|https?:|www\./i.test(s));
const reply = fc
  .record(
    {
      kind: fc.constantFrom('correction', 'follow-up', 'acknowledgment', 'not-in-file'),
      excerptId: fc.integer({ min: 1, max: 99 }).map((n) => `e${n}`),
      quote: text,
      say: fc.array(text, { minLength: 1, maxLength: 4 }),
      followUp: text,
    },
    { requiredKeys: ['kind', 'say'] },
  )
  .map(({ kind, excerptId, quote, say, followUp }) => ({
    kind,
    ...(excerptId !== undefined && { excerptId }),
    ...(quote !== undefined && { quote }),
    say,
    ...(followUp !== undefined && { followUp }),
  }));
/** Cut points: the text is fed as the pieces between them. */
const cuts = fc.array(fc.nat(), { maxLength: 30 });

function feed(json: string, points: number[]): ReaderEvent[] {
  const at = [...new Set(points.map((p) => p % (json.length + 1)))].sort((a, b) => a - b);
  const reader = createReplyReader();
  const events: ReaderEvent[] = [];
  let from = 0;
  for (const to of [...at, json.length]) {
    events.push(...reader.push(json.slice(from, to)));
    from = to;
  }
  return [...events, ...reader.end()];
}

describe('P25: createReplyReader (design §9)', () => {
  it('for any valid reply and any chunking of its JSON, the head and sentences equal those of the whole text, in order, head first', () => {
    fc.assert(
      fc.property(reply, cuts, fc.boolean(), (r, points, pretty) => {
        const json = pretty ? JSON.stringify(r, null, 2) : JSON.stringify(r);
        const whole = feed(json, []);
        const chunked = feed(json, points);
        expect(chunked).toEqual(whole);
        expect(chunked[0].type).toBe('head');
        expect(chunked.filter((e) => e.type === 'sentence').map((e) => (e as { text: string }).text)).toEqual(r.say);
        expect(chunked.at(-1)).toEqual({ type: 'end', value: r });
        const { kind, excerptId, quote } = r as { kind: string; excerptId?: string; quote?: string };
        expect(chunked[0]).toEqual({ type: 'head', head: { kind, ...(excerptId !== undefined && { excerptId }), ...(quote !== undefined && { quote }) } });
      }),
      { numRuns: 300 },
    );
  });
});
