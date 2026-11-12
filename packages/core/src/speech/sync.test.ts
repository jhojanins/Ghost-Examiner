import { describe, expect, it } from 'vitest';
import { resync, wordAt, wordIndexAt } from './sync';
import { buildTimeline } from './timeline';

describe('wordIndexAt', () => {
  it('maps a character inside a word to that word', () => {
    // "Tell me more." → Tell 0..3, me 5..6, more. 8..12
    expect([0, 3, 5, 6, 8, 12].map((c) => wordIndexAt('Tell me more.', c))).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('maps whitespace to the next word, including leading whitespace', () => {
    expect(wordIndexAt('Tell me more.', 4)).toBe(1);
    expect(wordIndexAt('Tell  me', 5)).toBe(1);
    expect(wordIndexAt('  hi there', 0)).toBe(0);
  });

  it('maps a position past the end, or trailing whitespace, to the last word', () => {
    expect(wordIndexAt('Tell me more.', 13)).toBe(2);
    expect(wordIndexAt('Tell me more.', 100)).toBe(2);
    expect(wordIndexAt('hi there  ', 9)).toBe(1);
  });

  it('maps a negative position to the first word', () => {
    expect(wordIndexAt('hi there', -3)).toBe(0);
  });

  it('counts UTF-16 code units: both halves of "👻" belong to it', () => {
    expect([0, 1, 2, 3].map((c) => wordIndexAt('👻 boo', c))).toEqual([0, 0, 1, 1]);
  });

  it('returns -1 for a line with no words', () => {
    expect(wordIndexAt('', 0)).toBe(-1);
    expect(wordIndexAt(' \n ', 1)).toBe(-1);
  });
});

// Tell 0..260, me 260..390, more. 390..650, then a 400 ms pause: duration 1050.
const line = buildTimeline('Tell me more.', 'en');
const empty = buildTimeline('', 'en');

describe('wordAt', () => {
  it('is the last word that has started, or -1 before the first', () => {
    expect([-1, 0, 259, 260, 389, 390, 2000].map((e) => wordAt(line, e))).toEqual([-1, 0, 0, 1, 1, 2, 2]);
  });

  it('is -1 for a timeline with no words', () => {
    expect(wordAt(empty, 5)).toBe(-1);
  });
});

describe('resync', () => {
  it('jumps forward to the reported word when the audio is ahead', () => {
    expect(resync(line, 100, 2)).toBe(390);
  });

  it('keeps elapsed when the reported word is the current one, so the mouth never stutters', () => {
    expect(resync(line, 300, 1)).toBe(300);
  });

  it('holds on the current word start when the estimate is ahead of the audio', () => {
    expect(resync(line, 500, 0)).toBe(390);
  });

  it('clamps an out-of-range word index', () => {
    expect(resync(line, 100, 9)).toBe(390); // last word
    expect(resync(line, 300, -4)).toBe(260); // first word is behind "me": hold on "me"
  });

  it('jumps to the reported word when no word has started yet', () => {
    expect(resync(line, -50, 1)).toBe(260);
  });

  it('returns elapsed unchanged for a timeline with no words', () => {
    expect(resync(empty, 123, 0)).toBe(123);
  });
});
