import { describe, expect, it } from 'vitest';
import { wordIndexAt } from './sync';

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
