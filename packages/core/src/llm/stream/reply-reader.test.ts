import { describe, expect, it } from 'vitest';
import { createReplyReader, type ReaderEvent } from './reply-reader';

const REPLY = {
  kind: 'correction',
  excerptId: 'e2',
  quote: 'We chose a queue because it was "simple".',
  say: ['Your file says something a little different.', 'Compare it with your answer.'],
};
/** Feeds the text in chunks of the given sizes (the last size repeats), then ends. */
function run(text: string, sizes: number[] = [text.length]): ReaderEvent[] {
  const reader = createReplyReader();
  const events: ReaderEvent[] = [];
  let at = 0;
  for (let i = 0; at < text.length; i++) {
    const n = sizes[Math.min(i, sizes.length - 1)];
    events.push(...reader.push(text.slice(at, at + n)));
    at += n;
  }
  events.push(...reader.end());
  return events;
}

describe('createReplyReader (design §3.4)', () => {
  it('emits the head, then each say sentence as its string closes, then end with the whole reply', () => {
    expect(run(JSON.stringify(REPLY), [7])).toEqual([
      { type: 'head', head: { kind: 'correction', excerptId: 'e2', quote: REPLY.quote } },
      { type: 'sentence', text: REPLY.say[0] },
      { type: 'sentence', text: REPLY.say[1] },
      { type: 'end', value: REPLY },
    ]);
  });
  it('a head that arrives across chunks, one character at a time, with escapes and whitespace', () => {
    const text = '{\n  "kind" : "acknowledgment",\n  "quote": "It said \\"slow\\" \\u00e9",\n  "say" : [ "Good.\\nClear." ]\n}';
    const events = run(text, [1]);
    expect(events[0]).toEqual({ type: 'head', head: { kind: 'acknowledgment', quote: 'It said "slow" é' } });
    expect(events[1]).toEqual({ type: 'sentence', text: 'Good.\nClear.' });
    expect(events.at(-1)?.type).toBe('end');
  });
  it('never emits a sentence before the head, so the quote can be checked before anything is said', () => {
    const reader = createReplyReader();
    const first = reader.push('{"kind":"not-in-file","say":["That is not in');
    expect(first).toEqual([{ type: 'head', head: { kind: 'not-in-file' } }]);
    expect(reader.push(' your file."')).toEqual([{ type: 'sentence', text: 'That is not in your file.' }]);
    expect(reader.push(']}')).toEqual([]);
  });
  it('emits a follow-up after the sentences; it is in the end value', () => {
    const r = { kind: 'follow-up', say: ['That is a start.'], followUp: 'What happens when the queue is full?' };
    expect(run(JSON.stringify(r), [5]).at(-1)).toEqual({ type: 'end', value: r });
  });
  it('a sentence over 300 characters ends the stream as bad-output, and nothing after it is emitted', () => {
    const text = JSON.stringify({ kind: 'acknowledgment', say: ['Fine.', 'a'.repeat(301), 'Later.'] });
    const events = run(text, [10]);
    expect(events.map((e) => e.type)).toEqual(['head', 'sentence', 'error']);
    expect(events.at(-1)).toEqual({ type: 'error', error: 'bad-output' });
  });
  it('a sentence with markup or a link ends the stream as bad-output', () => {
    for (const s of ['<img src=x>', 'See https://evil.example']) {
      expect(run(JSON.stringify({ kind: 'acknowledgment', say: [s] })).map((e) => e.type)).toEqual(['head', 'error']);
    }
  });
  it('bad-output when the say key comes first (the head would come after a sentence), or the JSON is broken or cut', () => {
    expect(run('{"say":["Hi."],"kind":"acknowledgment"}').map((e) => e.type)).toEqual(['error']);
    expect(run('{"kind":"acknowledgment","say":["Hi."]').at(-1)).toEqual({ type: 'error', error: 'bad-output' }); // cut midway
    expect(run('not json').map((e) => e.type)).toEqual(['error']);
    expect(run('{"kind":"acknowledgment","say":"Hi."}').at(-1)?.type).toBe('error'); // say must be an array
  });
  it('bad-output for a reply without say, a second say key, or a say item that is not a string', () => {
    expect(run('{"kind":"acknowledgment"}')).toEqual([{ type: 'error', error: 'bad-output' }]);
    // A second say key is caught as soon as it is read, before its sentences are spoken.
    const twice = createReplyReader();
    expect(twice.push('{"kind":"acknowledgment","say":["Hi."],"say":["Again."').map((e) => e.type)).toEqual(['head', 'sentence', 'error']);
    // Nested values and non-strings in say fail at once: nothing hidden inside them is ever spoken.
    for (const item of ['{}', '[]', '[ ]', '42', 'true', 'null']) {
      const reader = createReplyReader();
      expect(reader.push(`{"kind":"acknowledgment","say":["Hi.",${item}`).map((e) => e.type), item).toEqual(['head', 'sentence', 'error']);
    }
  });
  it('ignores pushes after an error or the end', () => {
    const reader = createReplyReader();
    expect(reader.push('nope')).toEqual([{ type: 'error', error: 'bad-output' }]); // once
    expect(reader.end()).toEqual([]);
    expect(reader.push('{"kind":"x"}')).toEqual([]);
    expect(reader.end()).toEqual([]);
  });
  it('caps the total text at 16,000 characters', () => {
    const reader = createReplyReader();
    expect(reader.push(`{"kind":"acknowledgment","say":["${'a'.repeat(16_000)}`).at(-1)).toEqual({ type: 'error', error: 'bad-output' });
  });
});
