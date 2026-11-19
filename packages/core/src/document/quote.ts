/** A quote must be long enough to point at one place, and short enough to read (design §3.1). */
export const QUOTE_MIN = 12;
export const QUOTE_MAX = 300;

/**
 * The comparison form of a quote and of an excerpt (Req 6.2): NFC, lowercase, typographic quotes
 * and dashes made plain, whitespace runs collapsed to one space, trimmed. Every step works one
 * character at a time, so a slice of a text normalizes to a slice of the normalized text.
 */
export function normalizeForQuote(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/ς/g, 'σ') // final sigma depends on context; make it context-free
    .replace(/[“”„‟«»″]/g, '"')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when `quote`, normalized, has 12 to 300 characters and appears in `excerpt`, normalized
 * the same way (Req 6.1, 6.2). Callers pass the quote's own excerpt, so a passage found elsewhere
 * in the file doesn't count.
 */
export function verifyQuote(quote: string, excerpt: string): boolean {
  const q = normalizeForQuote(quote);
  if (q.length < QUOTE_MIN || q.length > QUOTE_MAX) return false;
  return normalizeForQuote(excerpt).includes(q);
}
