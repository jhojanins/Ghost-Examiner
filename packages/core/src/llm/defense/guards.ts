import type { Excerpt } from '../../document/excerpts';
import { verifyQuote } from '../../document/quote';
import type { Locale } from '../../i18n/i18n';
import { inLanguage } from './language';
import type { DefenseQuestion, DefenseReply, DefenseSummary, ReplyKind } from './types';

/**
 * Strict guards for untrusted model output (design §3.2, Req 9.2, 9.3), in the style of
 * `isFeedback`. A malformed output fails as a whole (`bad-output`). A well-formed item whose quote
 * isn't in its own excerpt is dropped instead (Req 6.3, 6.4).
 */
export type Parsed<T> = { ok: true; value: T } | { ok: false };
export interface GuardContext {
  excerpts: readonly Excerpt[];
  locale: Locale;
}

/** Longest model-written sentence or field, and the longest quote text accepted before verification. */
export const TEXT_MAX = 300;
const QUOTE_FIELD_MAX = 600;
const QUESTION_WORDS_MAX = 30;
const SAY_MAX = 4;
const REVIEW_MAX = 3;
const REPLY_KINDS: readonly unknown[] = ['correction', 'follow-up', 'acknowledgment', 'not-in-file'];
/** Markup or links in model text: tags, code fences, Markdown links, URLs (prompt-injection-defense skill). */
const MARKUP = /<|```|\]\(|https?:|www\./i;

class Invalid extends Error {}
const fail = (): never => {
  throw new Invalid();
};

/** A plain object with every required key, no key outside `required` and `optional`, all own. */
function record(v: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail();
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) fail();
  const keys = Reflect.ownKeys(v as object);
  const allowed = new Set([...required, ...optional]);
  if (!keys.every((k) => typeof k === 'string' && allowed.has(k))) fail();
  if (!required.every((k) => keys.includes(k))) fail();
  return v as Record<string, unknown>;
}
function text(v: unknown, maxWords = Infinity): string {
  if (typeof v !== 'string' || v.trim() === '' || v.length > TEXT_MAX || MARKUP.test(v)) fail();
  if ((v as string).trim().split(/\s+/).length > maxWords) fail();
  return v as string;
}
function list(v: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(v) || v.length < min || v.length > max) fail();
  return v as unknown[];
}
function quoteField(v: unknown): string {
  if (typeof v !== 'string' || v.trim() === '' || v.length > QUOTE_FIELD_MAX) fail();
  return v as string;
}
function excerptOf(v: unknown, ctx: GuardContext): Excerpt {
  return ctx.excerpts.find((e) => e.id === v) ?? fail();
}
function parse<T>(run: () => T, modelText: (value: T) => string[], locale: Locale): Parsed<T> {
  try {
    const value = run();
    if (!inLanguage(modelText(value).join(' '), locale)) return { ok: false };
    return { ok: true, value };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false };
    throw e;
  }
}

/** `defense-questions` output: `{ questions: { excerptId, quote, prompt }[] }`, at most `count + 2`. */
export function parseDefenseQuestions(value: unknown, ctx: GuardContext & { count: number }): Parsed<DefenseQuestion[]> {
  return parse(
    () => {
      const items = list(record(value, ['questions']).questions, 0, ctx.count + 2).map((item) => {
        const q = record(item, ['excerptId', 'quote', 'prompt']);
        return { excerpt: excerptOf(q.excerptId, ctx), quote: quoteField(q.quote), prompt: text(q.prompt, QUESTION_WORDS_MAX) };
      });
      return items.filter((q) => verifyQuote(q.quote, q.excerpt.text)).map((q) => ({ excerptId: q.excerpt.id, quote: q.quote, prompt: q.prompt }));
    },
    (qs) => qs.map((q) => q.prompt),
    ctx.locale,
  );
}

/** `defense-reply` output: `{ kind, excerptId?, quote?, say, followUp? }` with the rules of design §3.2. */
export function parseDefenseReply(value: unknown, ctx: GuardContext & { followUpAllowed: boolean }): Parsed<DefenseReply> {
  return parse(
    (): DefenseReply => {
      const r = record(value, ['kind', 'say'], ['excerptId', 'quote', 'followUp']);
      if (!REPLY_KINDS.includes(r.kind)) fail();
      const kind = r.kind as ReplyKind;
      const say = list(r.say, 1, SAY_MAX).map((s) => text(s));
      const hasQuote = 'quote' in r;
      if (hasQuote !== 'excerptId' in r) fail(); // an id and its quote come together
      if (kind === 'correction' && !hasQuote) fail();
      if (kind === 'not-in-file' && hasQuote) fail();
      if ((kind === 'follow-up') !== 'followUp' in r) fail();
      if (kind === 'follow-up' && !ctx.followUpAllowed) fail();
      const reply: DefenseReply = { kind, say };
      if (kind === 'follow-up') reply.followUp = text(r.followUp, QUESTION_WORDS_MAX);
      if (hasQuote) {
        const excerpt = excerptOf(r.excerptId, ctx);
        const quote = quoteField(r.quote);
        if (verifyQuote(quote, excerpt.text)) Object.assign(reply, { excerptId: excerpt.id, quote });
        else if (kind === 'correction') return { kind: 'unsupported', say: [] };
      }
      // Key order as the schema: kind, excerptId, quote, say, followUp.
      const { excerptId, quote, followUp } = reply;
      return {
        kind,
        ...(excerptId !== undefined && { excerptId }),
        ...(quote !== undefined && { quote }),
        say,
        ...(followUp !== undefined && { followUp }),
      };
    },
    (r) => [...r.say, r.followUp ?? ''],
    ctx.locale,
  );
}

/** `defense-summary` output: `{ strength, review: { excerptId, quote, point }[] }`, at most 3 points. */
export function parseDefenseSummary(value: unknown, ctx: GuardContext): Parsed<DefenseSummary> {
  return parse(
    () => {
      const s = record(value, ['strength', 'review']);
      const strength = text(s.strength);
      const review = list(s.review, 0, REVIEW_MAX).map((item) => {
        const p = record(item, ['excerptId', 'quote', 'point']);
        return { excerpt: excerptOf(p.excerptId, ctx), quote: quoteField(p.quote), point: text(p.point) };
      });
      return {
        strength,
        review: review.filter((p) => verifyQuote(p.quote, p.excerpt.text)).map((p) => ({ excerptId: p.excerpt.id, quote: p.quote, point: p.point })),
      };
    },
    (s) => [s.strength, ...s.review.map((p) => p.point)],
    ctx.locale,
  );
}
