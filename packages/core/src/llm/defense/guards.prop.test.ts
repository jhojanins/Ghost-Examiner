import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { splitExcerpts } from '../../document/excerpts';
import { parseDefenseQuestions, parseDefenseReply, parseDefenseSummary } from './guards';

// A fictional document and neutral English words for generated text.
const paragraphs = [
  'We chose a message queue because the payment service takes about four seconds to answer each request.',
  'The checkout page now answers in under one second for most users during the busy evening hours.',
  'We measured the results over two weeks with a small group of volunteers from the student club.',
];
const excerpts = splitExcerpts(paragraphs.join('\n\n'), { maxChars: 120 });
const words = paragraphs.map((p) => p.replace(/\.$/, '').split(' '));
const pool = ['why', 'how', 'did', 'you', 'the', 'queue', 'design', 'result', 'choose', 'explain', 'this', 'work', 'users'];
const sentence = fc.array(fc.constantFrom(...pool), { minLength: 2, maxLength: 12 }).map((ws) => `${ws.join(' ')}.`);
/** A verified quote: 4 to 9 consecutive words of one paragraph (each paragraph is one excerpt). */
const grounded = fc
  .tuple(fc.nat({ max: 2 }), fc.nat({ max: 8 }), fc.integer({ min: 4, max: 9 }))
  .map(([e, from, len]) => ({ excerptId: excerpts[e].id, quote: words[e].slice(from, from + len).join(' ') }));
const ctx = { excerpts, locale: 'en' as const };

const questions = fc.array(fc.tuple(grounded, sentence).map(([g, prompt]) => ({ ...g, prompt })), { minLength: 1, maxLength: 6 }).map((qs) => ({ questions: qs }));
const reply = fc.oneof(
  fc.tuple(grounded, fc.array(sentence, { minLength: 1, maxLength: 4 })).map(([g, say]) => ({ kind: 'correction', ...g, say })),
  fc.tuple(fc.array(sentence, { minLength: 1, maxLength: 4 }), sentence).map(([say, followUp]) => ({ kind: 'follow-up', say, followUp })),
  fc.array(sentence, { minLength: 1, maxLength: 4 }).map((say) => ({ kind: 'acknowledgment', say })),
  fc.array(sentence, { minLength: 1, maxLength: 4 }).map((say) => ({ kind: 'not-in-file', say })),
);
const summary = fc
  .tuple(sentence, fc.array(fc.tuple(grounded, sentence).map(([g, point]) => ({ ...g, point })), { maxLength: 3 }))
  .map(([strength, review]) => ({ strength, review }));

type Json = Record<string, unknown>;
const MUTATIONS = ['extra-key', 'wrong-type', 'too-long', 'unknown-id', 'markup'] as const;
/** One change that must make any valid output invalid (P28). `item` is the object holding the fields. */
function mutate(item: Json, textKey: string, mutation: (typeof MUTATIONS)[number]) {
  switch (mutation) {
    case 'extra-key':
      item.score = 10;
      break;
    case 'wrong-type':
      item[textKey] = Array.isArray(item[textKey]) ? 'not a list' : 42;
      break;
    case 'too-long':
      item[textKey] = Array.isArray(item[textKey]) ? ['x'.repeat(301)] : 'x'.repeat(301);
      break;
    case 'unknown-id':
      item.excerptId = 'e999';
      if (!('quote' in item)) item.quote = 'a quote that is long enough';
      break;
    case 'markup':
      item[textKey] = Array.isArray(item[textKey]) ? ['Read <b>this</b>.'] : 'Read [this](https://example.com).';
      break;
  }
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const mutation = fc.constantFrom(...MUTATIONS);

describe('P28: defense output guards', () => {
  it('valid question lists pass; one change to one question fails', async () => {
    await fc.assert(
      fc.property(questions, mutation, fc.nat(), (valid, m, at) => {
        expect(parseDefenseQuestions(valid, { ...ctx, count: 4 })).toEqual({ ok: true, value: valid.questions });
        const bad = clone(valid);
        mutate(bad.questions[at % bad.questions.length] as unknown as Json, 'prompt', m);
        expect(parseDefenseQuestions(bad, { ...ctx, count: 4 }).ok).toBe(false);
      }),
    );
  });

  it('valid replies pass; one change fails', async () => {
    await fc.assert(
      fc.property(reply, mutation, (valid, m) => {
        expect(parseDefenseReply(valid, { ...ctx, followUpAllowed: true })).toEqual({ ok: true, value: valid });
        const bad = clone(valid) as Json;
        mutate(bad, 'say', m);
        expect(parseDefenseReply(bad, { ...ctx, followUpAllowed: true }).ok).toBe(false);
      }),
    );
  });

  it('valid summaries pass; one change to the summary or a review point fails', async () => {
    await fc.assert(
      fc.property(summary, mutation, fc.nat(), (valid, m, at) => {
        expect(parseDefenseSummary(valid, ctx)).toEqual({ ok: true, value: valid });
        const bad = clone(valid);
        if (bad.review.length > 0 && m !== 'too-long') mutate(bad.review[at % bad.review.length] as unknown as Json, 'point', m);
        else mutate(bad as unknown as Json, 'strength', m === 'unknown-id' ? 'extra-key' : m);
        expect(parseDefenseSummary(bad, ctx).ok).toBe(false);
      }),
    );
  });
});
