import { prepareUntrusted, splitExcerpts, verifyQuote } from '@ghost-examiner/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_BYTES, MAX_CHARS, MIN_CHARS, parsePastedText, parseTextFile } from './parse-text';

const text = (n: number) => 'Our queue design. '.repeat(Math.ceil(n / 18)).slice(0, n);
const file = (content: BlobPart, name: string, type = '') => new File([content], name, { type });

afterEach(() => vi.unstubAllGlobals());

describe('parseTextFile', () => {
  it('reads .txt and .md files (with or without a MIME type) as UTF-8, NFC, with \\n line ends', async () => {
    expect(await parseTextFile(file(text(400), 'essay.txt', 'text/plain'))).toEqual({ ok: true, text: text(400), truncated: false });
    const md = `# Diseño\r\n\r\nDecisio\u0301n: ${text(400)}`;
    const r = await parseTextFile(file(md, 'notes.MD'));
    expect(r).toEqual({ ok: true, text: md.replace(/\r\n/g, '\n').normalize('NFC'), truncated: false });
  });

  it('removes a UTF-8 byte order mark', async () => {
    const r = await parseTextFile(file(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text(400))]), 'a.txt'));
    expect(r).toEqual({ ok: true, text: text(400), truncated: false });
  });

  it('rejects other types, files over 2 MB, and invalid UTF-8, each with what to do', async () => {
    expect(await parseTextFile(file(text(400), 'thesis.docx'))).toEqual({ ok: false, error: 'defense.error.type' });
    expect(await parseTextFile(file(text(400), 'image.png', 'image/png'))).toEqual({ ok: false, error: 'defense.error.type' });
    expect(await parseTextFile(file(new Uint8Array(MAX_BYTES + 1).fill(97), 'big.txt'))).toEqual({ ok: false, error: 'defense.error.size' });
    expect(await parseTextFile(file(new Uint8Array([0x61, 0xff, 0xfe, 0x62]), 'latin1.txt'))).toEqual({ ok: false, error: 'defense.error.encoding' });
  });

  it('rejects text under 300 characters and keeps only the first 60,000', async () => {
    expect(await parseTextFile(file(`  ${text(MIN_CHARS - 1)}\n\n`, 'short.txt'))).toEqual({ ok: false, error: 'defense.error.short' });
    expect(await parseTextFile(file(text(MIN_CHARS), 'ok.txt'))).toMatchObject({ ok: true });
    expect(await parseTextFile(file(text(MAX_CHARS + 10), 'long.txt'))).toEqual({ ok: true, text: text(MAX_CHARS), truncated: true });
  });

  it('sends nothing anywhere', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await parseTextFile(file(text(400), 'essay.txt'));
    parsePastedText(text(400));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('invisible characters (owner decision 2026-11-19, after phase 2)', () => {
  // A zero-width space, a zero-width joiner, a bidi override and a control character inside a sentence.
  const sentence = 'We chose a mes\u200Bsage qu\u200Deue be\u202Ecause the pay\u0007ment service was slow.';
  const clean = 'We chose a message queue because the payment service was slow.';
  it('removes zero-width and control characters once, when the file or paste is parsed, keeping line breaks and tabs', async () => {
    const body = `${sentence}\n\tIndented line.\n${text(400)}`;
    const r = await parseTextFile(file(body, 'notes.md'));
    expect(r).toEqual({ ok: true, text: `${clean}\n\tIndented line.\n${text(400)}`, truncated: false });
    expect(parsePastedText(body)).toEqual(r);
  });
  it('a quote that spans such a character verifies in the browser and survives the proxy cleaning unchanged', async () => {
    const r = await parseTextFile(file(`# Design\n\n${sentence} ${text(400)}`, 'notes.md'));
    if (!r.ok) throw new Error('parse failed');
    const [excerpt] = splitExcerpts(r.text, { maxChars: 1500 });
    const quote = 'a message queue because the payment';
    expect(verifyQuote(quote, excerpt.text)).toBe(true);
    // The proxy cleans what it receives again; the text the browser checked quotes against is already clean.
    expect(prepareUntrusted(excerpt.text, '7f3a9c0e').text).toBe(excerpt.text);
  });
});
describe('parsePastedText', () => {
  it('uses the same length rules as a file', () => {
    expect(parsePastedText(text(400))).toEqual({ ok: true, text: text(400), truncated: false });
    expect(parsePastedText('   ')).toEqual({ ok: false, error: 'defense.error.short' });
    expect(parsePastedText(text(MAX_CHARS + 1))).toEqual({ ok: true, text: text(MAX_CHARS), truncated: true });
  });
});
