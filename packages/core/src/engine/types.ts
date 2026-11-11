import type { Locale, Localized } from '../i18n/i18n';
import type { AnswerCandidate, AnswerKind } from '../input/types';

export interface KeyPoint {
  label: Localized<string>;
  cues: Localized<string[]>; // lowercase keywords
}
export interface Question {
  id: string;
  kind: AnswerKind;
  prompt: Localized<string>;
  keyPoints: KeyPoint[];
}
export interface QuestionPack {
  id: string;
  greeting: Localized<string>;
  closing: Localized<string>;
  questions: Question[];
}

/** Design §3.7. Lives here because the engine's `feedback-ready` event carries it. */
export interface Feedback {
  summary: string;
  strength: string;
  improvement: string;
  reaction: 'approving' | 'skeptical';
  locale: Locale;
}

// Not exported: only reduce() can brand an answer as confirmed (Req 5.3).
declare const confirmedBrand: unique symbol;
export type ConfirmedAnswer = AnswerCandidate & { readonly candidateId: number; readonly [confirmedBrand]: true };

export type Phase = 'intro' | 'privacy' | 'asking' | 'answering' | 'confirming' | 'evaluating' | 'feedback' | 'summary';

/**
 * What the ghost says. Pack lines stay localized so a language switch can re-resolve them
 * (Req 9.2); feedback summaries come from the evaluator as text in one locale.
 */
export type LineRef = { localized: Localized<string> } | { text: string; locale: Locale };

export type SessionEvent =
  | { type: 'start' }
  | { type: 'privacy-accepted' }
  | { type: 'line-done'; lineId: number }
  | { type: 'candidate'; candidate: AnswerCandidate }
  | { type: 'retry' }
  | { type: 'edit' }
  | { type: 'confirm'; candidateId: number }
  | { type: 'feedback-ready'; feedback: Feedback }
  | { type: 'next' }
  | { type: 'locale-changed'; locale: Locale };

export type Effect =
  | { type: 'speak'; lineId: number; line: LineRef }
  | { type: 'evaluate'; question: Question; answer: ConfirmedAnswer; locale: Locale };

export interface SessionState {
  pack: QuestionPack;
  locale: Locale;
  phase: Phase;
  questionIndex: number;
  lineId: number; // id of the last line spoken; 0 before the first
  candidateCount: number; // source of new candidateIds
  candidate?: AnswerCandidate & { candidateId: number };
  draft?: string; // candidate text kept after Edit (Req 7.3)
  confirmed?: ConfirmedAnswer;
  feedback?: Feedback;
}
