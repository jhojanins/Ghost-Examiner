import type { Locale } from '../i18n/i18n';

// From docs/ARCHITECTURE.md §3.1, trimmed to what the specs use. Spec (b) adds `partial` (the
// runtime needs it for barge-in); listening status and errors stay inside the voice adapter's own
// view (spec b design §2.1). The optional candidate fields (`confidence`, `alternatives`, `trace`)
// arrive when an adapter produces them.

export type InputMethodId = 'keyboard' | 'voice' | 'morse' | 'sign';
export type AnswerKind = 'free-text' | 'choice' | 'yes-no';

export type Availability =
  | { available: true }
  | { available: false; reason: string }; // kit catalog key, shown to the user localized

export interface InputContext {
  question: { id: string; kind: AnswerKind };
  locale: Locale;
}

export interface AnswerCandidate {
  text: string;
  method: InputMethodId;
}

export type InputEvent =
  | { type: 'candidate'; candidate: AnswerCandidate }
  | { type: 'partial'; text: string }; // all text recognized so far in this turn, before any confirmation

export interface InputAdapter {
  readonly id: InputMethodId;
  readonly requires: { camera: boolean; microphone: boolean };
  readonly experimental: boolean;
  readonly supports: readonly AnswerKind[];
  checkAvailability(): Promise<Availability>;
  start(ctx: InputContext, emit: (e: InputEvent) => void): void;
  stop(): void;
  /** The UI language changed while started; keep the turn going in the new language (spec b Req 4.6). */
  setLocale?(locale: Locale): void;
}
