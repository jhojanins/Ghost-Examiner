import { checkSentence } from './sentences';

/**
 * Reads a streamed `defense-reply` JSON incrementally (ghost-defense-live design §3.4, Req 5.1,
 * 5.4). Fed text chunks in any split, it emits:
 * - `head` once `kind` (and `excerptId`, `quote` if present) are complete: when the `say` key
 *   starts, since the schema puts them first. The app checks the head (the quote) before saying
 *   anything;
 * - each `say` string as soon as it closes, after the per-sentence check of Req 9.6;
 * - `end` with the whole object, for the full guard.
 * Anything else (the say key first, a failed sentence, broken or cut JSON, over 16,000
 * characters) emits `error: bad-output` and nothing after it.
 *
 * It scans characters with string and escape state and tracks only the top level and the `say`
 * array, which is all the fixed reply shape needs. Strings are decoded with `JSON.parse`.
 */
export type ReplyHead = { kind: string; excerptId?: string; quote?: string };
export type ReaderEvent =
  | { type: 'head'; head: ReplyHead }
  | { type: 'sentence'; text: string }
  | { type: 'end'; value: unknown }
  | { type: 'error'; error: 'bad-output' };

export interface ReplyReader {
  push(chunk: string): ReaderEvent[];
  end(): ReaderEvent[];
}

const TEXT_MAX = 16_000;
const HEAD_KEYS = new Set(['kind', 'excerptId', 'quote']);

export function createReplyReader(): ReplyReader {
  let text = '';
  let at = 0; // next character to scan
  let depth = 0; // brackets and braces
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  let lastKey: string | undefined; // the last top-level key read
  let expectKey = false; // a string at depth 1 here is a key
  let inSay = false; // inside the say array (depth 2)
  let awaitingSay = false; // after the say key, before its value starts
  let headSent = false;
  let done = false;

  const fail = (): ReaderEvent[] => {
    done = true;
    return [{ type: 'error', error: 'bad-output' }];
  };

  /** The head fields, read from the text before the say key, closed as an object. */
  function head(sayKeyStart: number): ReaderEvent | undefined {
    const before = text.slice(0, sayKeyStart).replace(/,\s*$/, '');
    let value: unknown;
    try {
      value = JSON.parse(`${before}}`);
    } catch {
      return undefined;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const fields = value as Record<string, unknown>;
    if (typeof fields.kind !== 'string' || !Object.keys(fields).every((k) => HEAD_KEYS.has(k))) return undefined;
    if (Object.values(fields).some((v) => typeof v !== 'string')) return undefined;
    return { type: 'head', head: fields as ReplyHead };
  }

  function scan(): ReaderEvent[] {
    const events: ReaderEvent[] = [];
    for (; at < text.length; at++) {
      const ch = text[at];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') {
          inString = false;
          const raw = text.slice(stringStart, at + 1);
          if (depth === 1 && expectKey) {
            lastKey = JSON.parse(raw) as string;
            expectKey = false;
            if (lastKey === 'say') {
              // A second say key fails here too: the text before it then holds say, not a head key.
              const h = head(stringStart);
              if (!h) return [...events, ...fail()];
              headSent = true;
              awaitingSay = true;
              events.push(h);
            }
          } else if (depth === 2 && inSay) {
            const sentence = JSON.parse(raw) as string;
            if (!checkSentence(sentence)) return [...events, ...fail()];
            events.push({ type: 'sentence', text: sentence });
          }
        }
        continue;
      }
      // The first character of the say value, after its colon, must open an array.
      if (awaitingSay && ch !== ':' && !/\s/.test(ch)) {
        if (ch !== '[') return [...events, ...fail()];
        awaitingSay = false;
      }
      if (ch === '"') {
        inString = true;
        stringStart = at;
      } else if (ch === '{' || ch === '[') {
        if (depth === 0 && ch !== '{') return [...events, ...fail()];
        if (inSay) return [...events, ...fail()]; // say items are strings only
        depth++;
        if (depth === 1) expectKey = true;
        if (depth === 2) {
          if (lastKey === 'say' && ch !== '[') return [...events, ...fail()];
          inSay = lastKey === 'say';
        }
      } else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 1) inSay = false;
        if (depth < 0) return [...events, ...fail()];
      } else if (ch === ',' && depth === 1) {
        expectKey = true;
      } else if (inSay && ch !== ',' && !/\s/.test(ch)) {
        return [...events, ...fail()]; // a number, true, false or null in say
      } else if (depth === 0 && !/\s/.test(ch)) {
        return [...events, ...fail()]; // anything outside the top-level object
      }
    }
    return events;
  }

  return {
    push(chunk) {
      if (done) return [];
      text += chunk;
      if (text.length > TEXT_MAX) return fail();
      return scan();
    },
    end() {
      if (done) return [];
      done = true;
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        return [{ type: 'error', error: 'bad-output' }];
      }
      if (!headSent) return [{ type: 'error', error: 'bad-output' }];
      return [{ type: 'end', value }];
    },
  };
}
