import { describe, expect, it } from 'vitest';
import { buildTimeline, tokenize } from './timeline';

describe('buildTimeline', () => {
  it('"Mamá, hola." (es): MBP/A cues, a 200 ms comma pause and a final rest', () => {
    const t = buildTimeline('Mamá, hola.', 'es');
    // 4 letters x 60 ms = 240 ms per word; 200 ms after the comma; 400 ms at the end.
    expect(t.words).toEqual([
      { index: 0, text: 'Mamá,', start: 0, end: 240 },
      { index: 1, text: 'hola.', start: 440, end: 680 },
    ]);
    expect(t.words[1].start - t.words[0].end).toBe(200);
    expect(t.mouth).toEqual([
      { start: 0, end: 60, viseme: 'MBP' },
      { start: 60, end: 120, viseme: 'A' }, // "á" is normalized to "a"
      { start: 120, end: 180, viseme: 'MBP' },
      { start: 180, end: 240, viseme: 'A' },
      { start: 240, end: 500, viseme: 'rest' }, // comma pause, then "h" keeps the previous shape
      { start: 500, end: 620, viseme: 'O' }, // "o", then "l" keeps O
      { start: 620, end: 680, viseme: 'A' },
      { start: 680, end: 1080, viseme: 'rest' },
    ]);
    expect(t.duration).toBe(1080);
  });

  it('uses 65 ms per letter in English and a 120 ms minimum per word', () => {
    const t = buildTimeline('I see', 'en');
    expect(t.words).toEqual([
      { index: 0, text: 'I', start: 0, end: 120 },
      { index: 1, text: 'see', start: 120, end: 315 },
    ]);
  });

  it('pauses 400 ms after "?" and "!"', () => {
    const t = buildTimeline('Why? Yes! Ok', 'en');
    expect(t.words[1].start - t.words[0].end).toBe(400);
    expect(t.words[2].start - t.words[1].end).toBe(400);
  });

  it('returns an empty timeline for blank text', () => {
    expect(buildTimeline('  \n ', 'en')).toEqual({ words: [], mouth: [], duration: 0 });
  });
});

describe('tokenize', () => {
  it('splits on whitespace and keeps each token start offset', () => {
    expect(tokenize('  Hola,  mundo ')).toEqual([
      { text: 'Hola,', from: 2 },
      { text: 'mundo', from: 9 },
    ]);
  });

  it('counts offsets in UTF-16 code units, like boundary events report charIndex', () => {
    // "👻" is 2 code units, then a space.
    expect(tokenize('👻 hola\tqué\n¿tal?')).toEqual([
      { text: '👻', from: 0 },
      { text: 'hola', from: 3 },
      { text: 'qué', from: 8 },
      { text: '¿tal?', from: 12 },
    ]);
  });

  it('every token is the slice of the text at its offset', () => {
    const text = ' Tell me about a time,  you solved a   problem. ';
    for (const token of tokenize(text)) {
      expect(text.slice(token.from, token.from + token.text.length)).toBe(token.text);
    }
  });

  it('returns no tokens for blank text', () => {
    expect(tokenize(' \n\t ')).toEqual([]);
  });
});
