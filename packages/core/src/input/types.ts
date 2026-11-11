import type { Locale } from '../i18n/i18n';

// From docs/ARCHITECTURE.md §3.1, trimmed to what spec (a) uses. Later specs add the
// `status`, `partial` and `error` events and the optional candidate fields
// (`confidence`, `alternatives`, `trace`) when an adapter produces them.

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

export type InputEvent = { type: 'candidate'; candidate: AnswerCandidate };

export interface InputAdapter {
  readonly id: InputMethodId;
  readonly requires: { camera: boolean; microphone: boolean };
  readonly experimental: boolean;
  readonly supports: readonly AnswerKind[];
  checkAvailability(): Promise<Availability>;
  start(ctx: InputContext, emit: (e: InputEvent) => void): void;
  stop(): void;
}
