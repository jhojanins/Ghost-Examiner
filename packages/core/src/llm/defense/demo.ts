import { verifyQuote } from '../../document/quote';
import { format, type Locale } from '../../i18n/i18n';
import { kitMessages, type KitMessageKey } from '../../i18n/kit-messages';
import type { DefenseQuestionsInput, DefenseReplyInput, DefenseSummaryInput, ExcerptInput } from './types';

/**
 * The offline defense tasks (ghost-defense-live design §3.6, Req 9.7): deterministic heuristics
 * over the excerpts, with no network, clock or randomness. They return the same JSON shapes as a
 * real model, so their output goes through the same guards.
 */

/** Lowercase, accents removed: for matching cue phrases and words only, never for quotes. */
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
/** Words of 4+ letters that carry meaning in either language (function words left out). */
const IGNORED = new Set(
  'that this with from have were they them then than when what which would could should there their your about into also because since some more most such only very will just like does done here these those other para como pero porque esta este estos estas sobre cuando donde tambien entre desde hasta muy solo mismo misma tiene tienen hace hizo'.split(' '),
);
function contentWords(s: string): Set<string> {
  return new Set((fold(s).match(/\p{L}+/gu) ?? []).filter((w) => w.length >= 4 && !IGNORED.has(w)));
}

/** Sentences of an excerpt's body (heading lines left out), each a raw slice of the excerpt, cut to a quotable length. */
function sentences(excerpt: ExcerptInput): string[] {
  const body = excerpt.text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  return body
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .map((s) => (s.length <= 280 ? s : s.slice(0, s.lastIndexOf(' ', 280))))
    .filter((s) => s !== '' && verifyQuote(s, excerpt.text));
}

type QuestionKey = Extract<KitMessageKey, `defense.demo.q.${string}`>;
// In priority order: a sentence with the first matching cue decides the question.
const CUES: [RegExp, QuestionKey][] = [
  [/\b(we|i) (chose|decided|propose|picked|used)\b|\b(elegimos|elegi|decidimos|decidi|proponemos|usamos|utilizamos)\b/, 'defense.demo.q.alternative'],
  [/\b(because|since|so that)\b|\b(porque|ya que|para que)\b/, 'defense.demo.q.why'],
  [/\b(therefore|thus|in conclusion|we conclude)\b|\b(por lo tanto|en conclusion|concluimos|por eso)\b/, 'defense.demo.q.conclusion'],
  [/\d|\b(results?|measured|percent)\b|\b(resultados?|medimos|por ciento)\b/, 'defense.demo.q.measure'],
];
const PLAIN: QuestionKey[] = ['defense.demo.q.explain', 'defense.demo.q.defend'];

/** The sentence to ask about in an excerpt, and the question it calls for. */
function topicOf(excerpt: ExcerptInput, index: number): { quote: string; key: QuestionKey } | undefined {
  const ss = sentences(excerpt);
  for (const [cue, key] of CUES) {
    const s = ss.find((x) => cue.test(fold(x)));
    if (s) return { quote: s, key };
  }
  const plain = ss.find((s) => s.length >= 40) ?? ss[0];
  return plain === undefined ? undefined : { quote: plain, key: PLAIN[index % PLAIN.length] };
}

export function demoQuestions(input: DefenseQuestionsInput, locale: Locale) {
  const m = kitMessages[locale];
  const topics = input.excerpts.flatMap((e, i) => {
    const t = topicOf(e, i);
    return t ? [{ excerptId: e.id, ...t }] : [];
  });
  // Evenly spread over the file; fewer questions when the file has fewer parts.
  const k = Math.min(input.count, topics.length);
  const picked = Array.from({ length: k }, (_, i) => topics[k === 1 ? 0 : Math.round((i * (topics.length - 1)) / (k - 1))]);
  return { questions: picked.map((t) => ({ excerptId: t.excerptId, quote: t.quote, prompt: m[t.key] })) };
}

/** How many words of `passage` the answer uses. */
const overlap = (answer: Set<string>, passage: string) => [...contentWords(passage)].filter((w) => answer.has(w)).length;
const MATCHED_ENOUGH = 3;
const SHORT_ANSWER_WORDS = 5;

export function demoReply(input: DefenseReplyInput, locale: Locale) {
  const m = kitMessages[locale];
  const main = input.excerpts.find((e) => verifyQuote(input.quote, e.text)) ?? input.excerpts[0];
  const words = contentWords(input.answer);
  const longEnough = input.answer.trim().split(/\s+/).length >= SHORT_ANSWER_WORDS;
  if (main && longEnough && overlap(words, main.text) >= MATCHED_ENOUGH) {
    // Quote the sentence the answer is closest to.
    const best = sentences(main).reduce<{ s?: string; n: number }>((acc, s) => (overlap(words, s) > acc.n ? { s, n: overlap(words, s) } : acc), { n: 0 });
    return best.s ? { kind: 'acknowledgment', excerptId: main.id, quote: best.s, say: [m['defense.demo.ack']] } : { kind: 'acknowledgment', say: [m['defense.demo.ack']] };
  }
  if (input.followUpAllowed) return { kind: 'follow-up', say: [m['defense.demo.partly']], followUp: m['defense.demo.followUp'] };
  return main
    ? { kind: 'correction', excerptId: main.id, quote: input.quote, say: [m['defense.demo.correction']] }
    : { kind: 'acknowledgment', say: [m['defense.demo.partly']] };
}

export function demoSummary(input: DefenseSummaryInput, locale: Locale) {
  const m = kitMessages[locale];
  const strength = input.turns.some((t) => t.kind === 'acknowledgment') ? m['defense.demo.strength.ack'] : m['defense.demo.strength.effort'];
  const weak = input.turns.filter((t) => t.kind !== 'acknowledgment' && t.kind !== 'not-in-file').slice(0, 3);
  const review = weak.flatMap((t) => {
    const words = contentWords(`${t.question} ${t.answer}`);
    // The part of the file closest to the turn (the first one on a tie), and its first quotable sentence.
    const excerpt = input.excerpts.reduce<{ e?: ExcerptInput; n: number }>((acc, e) => (acc.e === undefined || overlap(words, e.text) > acc.n ? { e, n: overlap(words, e.text) } : acc), { n: -1 }).e;
    const quote = excerpt ? sentences(excerpt)[0] : undefined;
    return excerpt && quote ? [{ excerptId: excerpt.id, quote, point: format(m['defense.demo.review'], { question: t.question }) }] : [];
  });
  return { strength, review };
}
