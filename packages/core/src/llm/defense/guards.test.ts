import { describe, expect, it } from 'vitest';
import { splitExcerpts } from '../../document/excerpts';
import { parseDefenseQuestions, parseDefenseReply, parseDefenseSummary } from './guards';

const doc = [
  '# Design',
  'We chose a message queue because the payment API takes about four seconds to answer.',
  '# Results',
  'The checkout page now answers in under one second for most users.',
].join('\n\n');
const excerpts = splitExcerpts(doc, { maxChars: 1500 });
const ctx = { excerpts, locale: 'en' as const };
const quote = 'the payment API takes about four seconds';

describe('parseDefenseQuestions', () => {
  it('accepts grounded questions and drops one whose quote is not in its own excerpt', () => {
    const r = parseDefenseQuestions(
      {
        questions: [
          { excerptId: 'e1', quote, prompt: 'Why did you choose a queue for this?' },
          { excerptId: 'e2', quote, prompt: 'What does this result mean for users?' }, // quote is in e1, not e2
        ],
      },
      { ...ctx, count: 4 },
    );
    expect(r).toEqual({ ok: true, value: [{ excerptId: 'e1', quote, prompt: 'Why did you choose a queue for this?' }] });
  });

  it('rejects more than count + 2 questions, an unknown excerpt id, and markup in a prompt', () => {
    const q = { excerptId: 'e1', quote, prompt: 'Why a queue?' };
    expect(parseDefenseQuestions({ questions: Array(7).fill(q) }, { ...ctx, count: 4 }).ok).toBe(false);
    expect(parseDefenseQuestions({ questions: [{ ...q, excerptId: 'e9' }] }, { ...ctx, count: 4 }).ok).toBe(false);
    expect(parseDefenseQuestions({ questions: [{ ...q, prompt: 'See <b>this</b>' }] }, { ...ctx, count: 4 }).ok).toBe(false);
    expect(parseDefenseQuestions({ questions: [{ ...q, prompt: 'Read [this](https://x.y)' }] }, { ...ctx, count: 4 }).ok).toBe(false);
  });
});

describe('parseDefenseReply', () => {
  const reply = (r: object, followUpAllowed = true) => parseDefenseReply(r, { ...ctx, followUpAllowed });

  it('accepts each kind with its required fields', () => {
    expect(reply({ kind: 'correction', excerptId: 'e1', quote, say: ['Your file says it takes four seconds.'] }).ok).toBe(true);
    expect(reply({ kind: 'follow-up', say: ['Partly.'], followUp: 'What would happen if the queue filled up?' }).ok).toBe(true);
    expect(reply({ kind: 'acknowledgment', say: ['That matches your file well.'] }).ok).toBe(true);
    expect(reply({ kind: 'not-in-file', say: ['Your file does not cover the database.'] }).ok).toBe(true);
  });

  it('rejects a correction without a quote, a follow-up when none is allowed, and a quote on not-in-file', () => {
    expect(reply({ kind: 'correction', say: ['No.'] }).ok).toBe(false);
    expect(reply({ kind: 'follow-up', say: ['Partly.'], followUp: 'Why?' }, false).ok).toBe(false);
    expect(reply({ kind: 'follow-up', say: ['Partly.'] }).ok).toBe(false);
    expect(reply({ kind: 'not-in-file', excerptId: 'e1', quote, say: ['Not covered.'] }).ok).toBe(false);
    expect(reply({ kind: 'acknowledgment', excerptId: 'e1', say: ['Good.'] }).ok).toBe(false); // id without quote
    expect(reply({ kind: 'praise', say: ['Great.'] }).ok).toBe(false);
  });

  it('rejects zero or more than 4 sentences, and a sentence over 300 characters', () => {
    expect(reply({ kind: 'acknowledgment', say: [] }).ok).toBe(false);
    expect(reply({ kind: 'acknowledgment', say: ['A.', 'B.', 'C.', 'D.', 'E.'] }).ok).toBe(false);
    expect(reply({ kind: 'acknowledgment', say: ['x'.repeat(301)] }).ok).toBe(false);
  });

  it('turns a correction whose quote is not in the file into an unsupported reply (Req 6.3)', () => {
    expect(reply({ kind: 'correction', excerptId: 'e1', quote: 'the payment API takes ten seconds', say: ['Wrong.'] })).toEqual({
      ok: true,
      value: { kind: 'unsupported', say: [] },
    });
  });

  it('keeps an acknowledgment but drops its quote when the quote is not in the file', () => {
    expect(reply({ kind: 'acknowledgment', excerptId: 'e2', quote, say: ['Good point.'] })).toEqual({
      ok: true,
      value: { kind: 'acknowledgment', say: ['Good point.'] },
    });
  });

  it('rejects a reply in the other language (Req 14.1)', () => {
    const es = { kind: 'acknowledgment', say: ['Tu respuesta es buena y coincide con lo que dice el archivo.'] };
    expect(reply(es).ok).toBe(false);
    expect(parseDefenseReply(es, { ...ctx, locale: 'es', followUpAllowed: true }).ok).toBe(true);
  });

  it('accepts only plain objects with own keys (no prototype tricks)', () => {
    expect(reply(JSON.parse('{"kind":"acknowledgment","say":["Fine."],"__proto__":{"x":1}}')).ok).toBe(false);
    expect(reply(Object.create({ kind: 'acknowledgment', say: ['Fine.'] })).ok).toBe(false);
    expect(parseDefenseReply(null, { ...ctx, followUpAllowed: true }).ok).toBe(false);
  });
});

describe('parseDefenseSummary', () => {
  it('accepts a strength and up to 3 review points, dropping a point whose quote is not verified', () => {
    const r = parseDefenseSummary(
      {
        strength: 'You explained why you chose the queue.',
        review: [
          { excerptId: 'e1', quote, point: 'Check the timing you described.' },
          { excerptId: 'e2', quote, point: 'Explain the result.' },
        ],
      },
      ctx,
    );
    expect(r).toEqual({ ok: true, value: { strength: 'You explained why you chose the queue.', review: [{ excerptId: 'e1', quote, point: 'Check the timing you described.' }] } });
  });

  it('rejects 4 review points and a missing strength', () => {
    const p = { excerptId: 'e1', quote, point: 'Review this.' };
    expect(parseDefenseSummary({ strength: 'Good.', review: [p, p, p, p] }, ctx).ok).toBe(false);
    expect(parseDefenseSummary({ review: [p] }, ctx).ok).toBe(false);
  });
});
