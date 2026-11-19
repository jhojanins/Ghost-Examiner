/**
 * A numbered piece of the extracted text (spec ghost-defense-live design §3.1). Excerpts tile the
 * text exactly: `text === source.slice(start, end)`, and they follow each other with no gap, so a
 * quote can always be traced back to a place in the file.
 */
export interface Excerpt {
  /** Positional: `e1`, `e2`… The same text always gives the same ids. */
  id: string;
  /** The Markdown heading of the section this excerpt is in, if any. */
  heading?: string;
  text: string;
  start: number;
  end: number;
}

/** A blank line and every whitespace after it ends a block (a paragraph or a heading). */
const BLOCK_SEPARATOR = /\n[ \t]*\n\s*/g;
/** A sentence ends at `.`, `!`, `?` or `…` followed by whitespace. */
const SENTENCE_END = /[.!?…]+[ \t\n]+/g;
/** A block whose first line is a Markdown heading (`# Title`) opens a section. */
const HEADING = /^#{1,6}[ \t]+(\S[^\n]*)/;

interface Piece {
  start: number;
  end: number;
  /** The section heading, when this piece starts a heading block. */
  opensSection?: string;
}

/** Block boundaries; leading whitespace belongs to the first block, separators to the block before them. */
function blocks(text: string): { start: number; end: number }[] {
  const starts = [0];
  for (const m of text.matchAll(BLOCK_SEPARATOR)) {
    const end = m.index + m[0].length;
    if (text.slice(0, end).trim() === '') continue; // still in the leading whitespace
    if (end < text.length) starts.push(end);
  }
  return starts.map((start, i) => ({ start, end: starts[i + 1] ?? text.length }));
}

/** A block longer than `maxChars` becomes one piece per sentence; a single sentence is never cut. */
function piecesOf(text: string, block: { start: number; end: number }, maxChars: number): Piece[] {
  if (block.end - block.start <= maxChars) return [block];
  const cuts = [block.start];
  const body = text.slice(block.start, block.end);
  for (const m of body.matchAll(SENTENCE_END)) {
    const at = block.start + m.index + m[0].length;
    if (at < block.end) cuts.push(at);
  }
  return cuts.map((start, i) => ({ start, end: cuts[i + 1] ?? block.end }));
}

/**
 * Splits extracted text into excerpts (Req 1.9): a Markdown heading always starts a new excerpt;
 * otherwise paragraphs are grouped up to `maxChars`, and a longer paragraph is cut at sentence ends.
 * Blank text gives no excerpts.
 */
export function splitExcerpts(text: string, opts: { maxChars: number }): Excerpt[] {
  if (text.trim() === '') return [];
  const pieces: Piece[] = [];
  for (const block of blocks(text)) {
    const title = HEADING.exec(text.slice(block.start, block.end).trimStart());
    const ps = piecesOf(text, block, opts.maxChars);
    if (title) ps[0] = { ...ps[0], opensSection: title[1].replace(/[ \t]+#+[ \t]*$/, '').trim() };
    pieces.push(...ps);
  }
  const excerpts: Excerpt[] = [];
  let heading: string | undefined;
  let current: { start: number; end: number; heading?: string } | undefined;
  const close = () => {
    if (!current) return;
    const e: Excerpt = { id: `e${excerpts.length + 1}`, text: text.slice(current.start, current.end), start: current.start, end: current.end };
    if (current.heading !== undefined) e.heading = current.heading;
    excerpts.push(e);
  };
  for (const piece of pieces) {
    if (piece.opensSection !== undefined) heading = piece.opensSection;
    const full = current !== undefined && piece.end - current.start > opts.maxChars;
    if (!current || piece.opensSection !== undefined || full) {
      close();
      current = { start: piece.start, end: piece.end };
      if (heading !== undefined) current.heading = heading;
    } else {
      current.end = piece.end;
    }
  }
  close();
  return excerpts;
}

/**
 * Picks the excerpts one request may carry (Req 9.4), within `budget` characters, in document
 * order. Without `around`: an evenly spaced sample of the whole document. With `around`: that
 * excerpt first, then its nearest neighbors. An excerpt larger than the budget is never included.
 */
export function selectExcerpts(excerpts: readonly Excerpt[], opts: { budget: number; around?: string }): Excerpt[] {
  const size = (e: Excerpt) => e.text.length;
  const target = opts.around === undefined ? -1 : excerpts.findIndex((e) => e.id === opts.around);
  if (target >= 0 && size(excerpts[target]) <= opts.budget) {
    const chosen = new Set([target]);
    let total = size(excerpts[target]);
    for (let d = 1; d < excerpts.length; d++) {
      for (const i of [target - d, target + d]) {
        if (i < 0 || i >= excerpts.length || total + size(excerpts[i]) > opts.budget) continue;
        chosen.add(i);
        total += size(excerpts[i]);
      }
    }
    return [...chosen].sort((a, b) => a - b).map((i) => excerpts[i]);
  }
  const fits = excerpts.filter((e) => size(e) <= opts.budget);
  const sum = (es: Excerpt[]) => es.reduce((n, e) => n + size(e), 0);
  if (sum(fits) <= opts.budget) return fits;
  for (let k = fits.length - 1; k >= 1; k--) {
    const picked = [...new Set(Array.from({ length: k }, (_, i) => (k === 1 ? 0 : Math.round((i * (fits.length - 1)) / (k - 1)))))].map((i) => fits[i]);
    if (sum(picked) <= opts.budget) return picked;
  }
  return [];
}
