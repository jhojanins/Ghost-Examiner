import type { Locale } from '../../i18n/i18n';

/** An excerpt as sent to a provider: its id and text only (design §3.2). */
export interface ExcerptInput {
  id: string;
  text: string;
}
/** `defense-questions`: grounded questions about a sample of the file. */
export interface DefenseQuestionsInput {
  excerpts: ExcerptInput[];
  count: number;
  fileLang: Locale;
}
/** `defense-reply`: the ghost's reply to one confirmed answer. */
export interface DefenseReplyInput {
  excerpts: ExcerptInput[];
  question: string;
  quote: string;
  answer: string;
  followUpAllowed: boolean;
}
/** `defense-summary`: the end-of-session summary. */
export interface DefenseSummaryInput {
  turns: { question: string; answer: string; kind: ReplyKind | 'unsupported' }[];
  excerpts: ExcerptInput[];
}

/** A question tied to the passage it is about. */
export interface DefenseQuestion {
  excerptId: string;
  quote: string;
  prompt: string;
}
export type ReplyKind = 'correction' | 'follow-up' | 'acknowledgment' | 'not-in-file';
/**
 * A checked reply. `unsupported` is never accepted from a model: it is what a correction becomes
 * when its quote isn't in the file (Req 6.3), and the app then says its own local line.
 */
export interface DefenseReply {
  kind: ReplyKind | 'unsupported';
  excerptId?: string;
  quote?: string;
  say: string[];
  followUp?: string;
}
export interface DefenseSummary {
  strength: string;
  review: { excerptId: string; quote: string; point: string }[];
}
