import type { KitMessageKey } from '@ghost-examiner/core';

/** Limits of ghost-defense-live Req 1.6 (owner decision 1). */
export const MAX_BYTES = 2 * 1024 * 1024;
export const MIN_CHARS = 300;
export const MAX_CHARS = 60_000;
const EXTENSIONS = ['.txt', '.md'];

export type ParsedText = { ok: true; text: string; truncated: boolean } | { ok: false; error: KitMessageKey };

/**
 * Applies the length rules to extracted text: NFC (so quotes can be checked one character at a
 * time), `\n` line ends, at least 300 characters, and only the first 60,000 used (Req 1.6).
 */
function checked(raw: string): ParsedText {
  const text = raw.replace(/\r\n?/g, '\n').normalize('NFC');
  if (text.trim().length < MIN_CHARS) return { ok: false, error: 'defense.error.short' };
  return text.length > MAX_CHARS ? { ok: true, text: text.slice(0, MAX_CHARS), truncated: true } : { ok: true, text, truncated: false };
}

/**
 * Reads a `.txt` or `.md` file in the browser (Req 1.3, 1.8): nothing leaves the device. The type
 * is judged by extension only (browsers give `.md` an empty or generic MIME type); strict UTF-8
 * decoding then rejects anything that isn't text.
 */
export async function parseTextFile(file: File): Promise<ParsedText> {
  const name = file.name.toLowerCase();
  if (!EXTENSIONS.some((ext) => name.endsWith(ext))) return { ok: false, error: 'defense.error.type' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'defense.error.size' };
  let raw: string;
  try {
    raw = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return { ok: false, error: 'defense.error.encoding' };
  }
  return checked(raw);
}

/** Pasted text gets the same rules as a file (Req 1.7). */
export function parsePastedText(raw: string): ParsedText {
  return checked(raw);
}
