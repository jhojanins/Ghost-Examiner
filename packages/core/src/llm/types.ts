import type { Locale } from '../i18n/i18n';

export type LLMTask = 'evaluate-answer'; // spec (e) adds 'generate-questions' | 'follow-up'

/** Input for `evaluate-answer`, already resolved to the request's locale. */
export interface EvaluateInput {
  question: string;
  keyPoints: { label: string; cues: string[] }[];
  answer: string;
}

export interface LLMRequest {
  task: LLMTask;
  locale: Locale;
  input: EvaluateInput;
  maxOutputTokens: number;
}

export type LLMResult = { ok: true; text: string } | { ok: false; error: 'rate-limited' | 'unavailable' | 'bad-output' | 'too-large' };

/** All LLM access goes through this interface (Req 8.1). */
export interface LLMProvider {
  readonly id: 'demo' | 'proxy' | 'gemini' | 'groq';
  readonly isDemo: boolean;
  complete(req: LLMRequest): Promise<LLMResult>;
}
