/**
 * Sentences for speech, one line each (ghost-defense-live design §3.4, Req 5.1). Splits only at
 * whitespace that follows `. ! ? …`, so joining the sentences with single spaces gives back the
 * text with its whitespace collapsed (P26). It never splits inside quotes, and keeps EN and ES
 * abbreviations and numbers with their sentence.
 */
const ABBREVIATIONS = new Set(['e.g.', 'i.e.', 'etc.', 'vs.', 'dr.', 'dra.', 'mr.', 'mrs.', 'ms.', 'sr.', 'sra.', 'srta.', 'p.', 'ej.', 'pág.', 'no.', 'núm.', 'approx.', 'aprox.', 'fig.', 'cf.']);
const OPEN = new Set(['"', '«', '“', '„']);
const CLOSE: Record<string, string> = { '"': '"', '«': '»', '“': '”', '„': '“' };
const TERMINAL = /[.!?…]["»”’)]*$/;

export function splitSentences(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w !== '');
  const sentences: string[] = [];
  let current: string[] = [];
  let open: string | undefined; // the closing mark of the quote we are in
  for (const word of words) {
    current.push(word);
    for (const ch of word) {
      if (open !== undefined && ch === open) open = undefined;
      else if (open === undefined && OPEN.has(ch)) open = CLOSE[ch];
    }
    if (open !== undefined || !TERMINAL.test(word)) continue;
    const bare = word.toLowerCase().replace(/^["«“„(¿¡]+/, '');
    if (ABBREVIATIONS.has(bare)) continue;
    sentences.push(current.join(' '));
    current = [];
  }
  if (current.length > 0) sentences.push(current.join(' '));
  return sentences;
}

/** Longest spoken sentence (the guards' TEXT_MAX), and the markup or links that end a stream (Req 9.6). */
const SENTENCE_MAX = 300;
const MARKUP = /<|```|\]\(|https?:|www\./i;

/** The per-sentence check of Req 9.6: plain text, not blank, at most 300 characters. */
export function checkSentence(s: string): boolean {
  return s.trim() !== '' && s.length <= SENTENCE_MAX && !MARKUP.test(s);
}
