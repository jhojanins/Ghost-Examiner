import { describe, expect, it } from 'vitest';
import { checkSentence, splitSentences } from './sentences';

describe('splitSentences (design §3.4)', () => {
  it('splits at . ! ? … followed by a space or the end', () => {
    expect(splitSentences('Good start. Why a queue? It was slow!  Then… it worked')).toEqual(['Good start.', 'Why a queue?', 'It was slow!', 'Then…', 'it worked']);
  });
  it('keeps EN and ES abbreviations together', () => {
    expect(splitSentences('Use a queue, e.g. a list. Dr. Ruiz agreed, i.e. she liked it.')).toEqual(['Use a queue, e.g. a list.', 'Dr. Ruiz agreed, i.e. she liked it.']);
    expect(splitSentences('Usa una cola, p. ej. una lista. La Sra. Ruiz y el Dr. Pérez. Bien.')).toEqual(['Usa una cola, p. ej. una lista.', 'La Sra. Ruiz y el Dr. Pérez.', 'Bien.']);
    // "etc." also ends sentences; it is kept as an abbreviation, so a rare missed split joins two short lines.
    expect(splitSentences('Tubos, cables, etc. del club.')).toEqual(['Tubos, cables, etc. del club.']);
  });
  it('never splits inside quotes, straight or typographic', () => {
    expect(splitSentences('Your file says "It was slow. Very slow." Compare it.')).toEqual(['Your file says "It was slow. Very slow."', 'Compare it.']);
    expect(splitSentences('Tu archivo dice «Fue lento. Muy lento.» Compáralo.')).toEqual(['Tu archivo dice «Fue lento. Muy lento.»', 'Compáralo.']);
  });
  it('does not split decimals or numbers like 7.4', () => {
    expect(splitSentences('The score was 7.4 out of 10. Good.')).toEqual(['The score was 7.4 out of 10.', 'Good.']);
  });
  it('gives nothing for blank text and collapses whitespace inside sentences', () => {
    expect(splitSentences('  \n ')).toEqual([]);
    expect(splitSentences('One\nline  here. Two.')).toEqual(['One line here.', 'Two.']);
  });
});

describe('checkSentence (Req 9.6)', () => {
  it('accepts plain text up to 300 characters; rejects empty, longer, markup and links', () => {
    expect(checkSentence('That matches your file.')).toBe(true);
    expect(checkSentence('a'.repeat(300))).toBe(true);
    expect(checkSentence('a'.repeat(301))).toBe(false);
    expect(checkSentence('  ')).toBe(false);
    for (const bad of ['<b>Bold</b>', 'See [this](x)', 'Visit https://x.example', 'www.example.com', '```code```']) expect(checkSentence(bad), bad).toBe(false);
  });
});
