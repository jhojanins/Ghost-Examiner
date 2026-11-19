import type { Locale } from '../../i18n/i18n';
import type { DefenseRequest } from './prompts';
import type { ExcerptInput } from './types';

/**
 * The proxy's check of a request body `{ task, locale, input }` (design §3.2 and §5). The client
 * builds these inputs, but the proxy trusts none of it: exact keys, known values, types and size
 * caps. The output cap comes from the task, never from the body.
 */
export const MAX_OUTPUT_TOKENS = { 'defense-questions': 800, 'defense-reply': 400, 'defense-summary': 500 } as const;
const EXCERPTS_MAX_CHARS = 6000; // Req 9.4
const EXCERPTS_MAX = 60;
const QUESTION_MAX = 300; // TEXT_MAX of the output guards
const QUOTE_MAX_RAW = 600; // a verified quote is at most 300 characters once whitespace is collapsed
const ANSWER_MAX = 2000;
const TURN_ANSWER_MAX = 400;
const TURNS_MAX = 16; // 8 questions, each with one follow-up
const EXCERPT_ID = /^e\d{1,4}$/;
const KINDS = ['correction', 'follow-up', 'acknowledgment', 'not-in-file', 'unsupported'] as const;

export type RequestProblem = 'shape' | 'task' | 'locale' | 'input' | 'too-large';
export type ParsedRequest = { ok: true; value: DefenseRequest } | { ok: false; reason: RequestProblem };

type Json = Record<string, unknown>;
const isPlain = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const hasKeys = (v: unknown, keys: string[]): v is Json => isPlain(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const isText = (v: unknown): v is string => typeof v === 'string';
const filled = (v: unknown): v is string => isText(v) && v.trim() !== '';

class Problem extends Error {
  constructor(readonly reason: RequestProblem) {
    super(reason);
  }
}
const fail = (reason: RequestProblem): never => {
  throw new Problem(reason);
};
const capped = (s: string, max: number) => (s.length > max ? fail('too-large') : s);

function excerptsOf(v: unknown): ExcerptInput[] {
  if (!Array.isArray(v) || v.length === 0) return fail('input');
  if (v.length > EXCERPTS_MAX) return fail('too-large');
  const ids = new Set<string>();
  let total = 0;
  const out = v.map((e) => {
    if (!hasKeys(e, ['id', 'text']) || !isText(e.id) || !EXCERPT_ID.test(e.id) || !filled(e.text) || ids.has(e.id)) return fail('input');
    ids.add(e.id);
    total += e.text.length;
    return { id: e.id, text: e.text };
  });
  return total > EXCERPTS_MAX_CHARS ? fail('too-large') : out;
}

function inputOf(task: DefenseRequest['task'], input: unknown): DefenseRequest['input'] {
  switch (task) {
    case 'defense-questions': {
      if (!hasKeys(input, ['excerpts', 'count', 'fileLang'])) return fail('input');
      const { count, fileLang } = input;
      if (!Number.isInteger(count) || (count as number) < 3 || (count as number) > 8 || (fileLang !== 'en' && fileLang !== 'es')) return fail('input');
      return { excerpts: excerptsOf(input.excerpts), count: count as number, fileLang };
    }
    case 'defense-reply': {
      if (!hasKeys(input, ['excerpts', 'question', 'quote', 'answer', 'followUpAllowed'])) return fail('input');
      const { question, quote, answer, followUpAllowed } = input;
      if (!filled(question) || !isText(quote) || !filled(answer) || typeof followUpAllowed !== 'boolean') return fail('input');
      return {
        excerpts: excerptsOf(input.excerpts),
        question: capped(question, QUESTION_MAX),
        quote: capped(quote, QUOTE_MAX_RAW),
        answer: capped(answer, ANSWER_MAX),
        followUpAllowed,
      };
    }
    case 'defense-summary': {
      if (!hasKeys(input, ['excerpts', 'turns']) || !Array.isArray(input.turns) || input.turns.length === 0) return fail('input');
      if (input.turns.length > TURNS_MAX) return fail('too-large');
      const turns = input.turns.map((t) => {
        if (!hasKeys(t, ['question', 'answer', 'kind']) || !filled(t.question) || !isText(t.answer) || !(KINDS as readonly unknown[]).includes(t.kind)) return fail('input');
        return { question: capped(t.question, QUESTION_MAX), answer: capped(t.answer, TURN_ANSWER_MAX), kind: t.kind as (typeof KINDS)[number] };
      });
      return { excerpts: excerptsOf(input.excerpts), turns };
    }
  }
}

/** Checks a parsed JSON body. Never throws. */
export function parseDefenseRequest(body: unknown): ParsedRequest {
  try {
    if (!hasKeys(body, ['task', 'locale', 'input'])) return { ok: false, reason: 'shape' };
    const { task, locale } = body;
    if (task !== 'defense-questions' && task !== 'defense-reply' && task !== 'defense-summary') return { ok: false, reason: 'task' };
    if (locale !== 'en' && locale !== 'es') return { ok: false, reason: 'locale' };
    const value = { task, locale: locale as Locale, maxOutputTokens: MAX_OUTPUT_TOKENS[task], input: inputOf(task, body.input) } as DefenseRequest;
    return { ok: true, value };
  } catch (e) {
    if (e instanceof Problem) return { ok: false, reason: e.reason };
    throw e;
  }
}
