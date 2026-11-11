import type { Feedback } from '../engine/types';
import { format } from '../i18n/i18n';
import { kitMessages } from '../i18n/kit-messages';
import type { EvaluateInput, LLMProvider } from './types';

const SHORT_ANSWER_WORDS = 8;

/** Lowercase, strip accents, collapse whitespace. */
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();

/** The heuristic of design §3.7. Pure: same input and locale, same feedback. */
function demoFeedback(input: EvaluateInput, locale: Feedback['locale']): Feedback {
  const m = kitMessages[locale];
  const answer = normalize(input.answer);
  const matched = input.keyPoints.map((k) => k.cues.some((cue) => normalize(cue) !== '' && answer.includes(normalize(cue))));
  const firstMatch = input.keyPoints.find((_, i) => matched[i]);
  const firstMiss = input.keyPoints.find((_, i) => !matched[i]);
  const words = answer === '' ? 0 : answer.split(' ').length;
  const approving = matched.filter(Boolean).length * 2 >= input.keyPoints.length;

  return {
    summary: approving ? m['feedback.summary.approving'] : m['feedback.summary.skeptical'],
    strength: firstMatch
      ? format(m['feedback.strength.covered'], { point: firstMatch.label })
      : m['feedback.strength.direct'],
    improvement:
      words < SHORT_ANSWER_WORDS
        ? m['feedback.improvement.more']
        : firstMiss
          ? format(m['feedback.improvement.add'], { point: firstMiss.label })
          : m['feedback.improvement.measurable'],
    reaction: approving ? 'approving' : 'skeptical',
    locale,
  };
}

/**
 * Deterministic offline provider (Req 8.1, 8.3): no network, no randomness, no clock. It
 * returns JSON text like a real provider, so its output goes through the same `isFeedback` guard.
 */
export function createDemoProvider(): LLMProvider {
  return {
    id: 'demo',
    isDemo: true,
    async complete(req) {
      return { ok: true, text: JSON.stringify(demoFeedback(req.input, req.locale)) };
    },
  };
}
