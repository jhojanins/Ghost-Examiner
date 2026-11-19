import { describe, expect, it } from 'vitest';
import { normalizeForQuote, verifyQuote } from './quote';

const excerpt = 'We chose a “message queue” because the payment API is slow — about 4 seconds.\n\nIt   worked.';

describe('normalizeForQuote', () => {
  it('lowercases, unifies quotes and dashes, and collapses whitespace', () => {
    expect(normalizeForQuote('  We chose a “Message  QUEUE”\n— ok ')).toBe('we chose a "message queue" - ok');
    expect(normalizeForQuote('‘it’s’ – fine')).toBe("'it's' - fine");
  });

  it('composes accents the same way on both sides (NFC)', () => {
    expect(normalizeForQuote('Decisión')).toBe(normalizeForQuote('Decisio\u0301n'));
  });
});

describe('verifyQuote', () => {
  it('accepts an exact passage, whatever its case, quotes or line breaks', () => {
    expect(verifyQuote('we chose a "MESSAGE queue" because', excerpt)).toBe(true);
    expect(verifyQuote('slow - about 4 seconds. It worked.', excerpt)).toBe(true);
  });

  it('rejects a paraphrase or a changed word', () => {
    expect(verifyQuote('we picked a message queue because', excerpt)).toBe(false);
    expect(verifyQuote('the payment API is fast', excerpt)).toBe(false);
  });

  it('rejects quotes shorter than 12 or longer than 300 characters', () => {
    expect(verifyQuote('It worked.', excerpt)).toBe(false); // 10 characters
    expect(verifyQuote('x'.repeat(301), 'x'.repeat(400))).toBe(false);
    expect(verifyQuote('x'.repeat(300), 'x'.repeat(400))).toBe(true);
  });

  it('checks the quote against its own excerpt only', () => {
    const other = 'The results section says the queue was slow.';
    expect(verifyQuote('the queue was slow', other)).toBe(true);
    expect(verifyQuote('the queue was slow', excerpt)).toBe(false);
  });
});
