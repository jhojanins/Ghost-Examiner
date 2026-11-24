import { describe, expect, it } from 'vitest';
import { labelMode, visibleSentences } from './reply-text';

const say = ['One.', 'Two.', 'Three.'];

describe('visibleSentences (owner decision 2026-11-20)', () => {
  it('with the voice on, a streamed reply shows the sentences that have started playing', () => {
    expect(visibleSentences(say, 1, { on: true })).toEqual(['One.']);
    expect(visibleSentences(say, 3, { on: true })).toEqual(say);
  });
  it('with the voice off, or no voice available, it shows every sentence that arrived, at once', () => {
    expect(visibleSentences(say, 1, { on: false })).toEqual(say);
    for (const reason of ['no-api', 'no-voice', 'failed'] as const) expect(visibleSentences(say, 1, { on: true, reason })).toEqual(say);
  });
  it('a reply that was not streamed shows whole', () => {
    expect(visibleSentences(say, undefined, { on: true })).toEqual(say);
  });
});

describe('labelMode (owner decision 2026-11-20)', () => {
  it('a reply on screen from the demo rules is labeled as one demo turn, unless the session is all demo', () => {
    expect(labelMode({ mode: 'mixed', replyFrom: 'demo' })).toBe('turn-demo');
    expect(labelMode({ mode: 'demo', replyFrom: 'demo' })).toBe('demo');
    expect(labelMode({ mode: 'mixed', replyFrom: 'ai' })).toBe('mixed');
    expect(labelMode({ mode: 'ai' })).toBe('ai');
    expect(labelMode(undefined)).toBe('demo');
  });
});
