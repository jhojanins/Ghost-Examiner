import type { Locale } from '../i18n/i18n';

import type { DefenseQuestionsInput, DefenseReplyInput, DefenseSummaryInput } from './defense/types';

/** The fixed tasks (spec ghost-defense-live Req 9.1); nothing else can be asked of a provider. */
export type LLMTask = 'evaluate-answer' | 'defense-questions' | 'defense-reply' | 'defense-summary';

/** Input for `evaluate-answer`, already resolved to the request's locale. */
export interface EvaluateInput {
  question: string;
  keyPoints: { label: string; cues: string[] }[];
  answer: string;
}

interface RequestBase {
  locale: Locale;
  maxOutputTokens: number;
}
/** One request per task, each with its own input shape. */
export type LLMRequest =
  | (RequestBase & { task: 'evaluate-answer'; input: EvaluateInput })
  | (RequestBase & { task: 'defense-questions'; input: DefenseQuestionsInput })
  | (RequestBase & { task: 'defense-reply'; input: DefenseReplyInput })
  | (RequestBase & { task: 'defense-summary'; input: DefenseSummaryInput });

export type LLMResult = { ok: true; text: string } | { ok: false; error: 'rate-limited' | 'unavailable' | 'bad-output' | 'too-large' };

/** All LLM access goes through this interface (Req 8.1). */
export interface LLMProvider {
  readonly id: 'demo' | 'proxy' | 'gemini' | 'groq';
  readonly isDemo: boolean;
  complete(req: LLMRequest): Promise<LLMResult>;
}
