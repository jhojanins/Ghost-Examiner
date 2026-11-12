import { speechLang, type Availability, type InputAdapter, type InputContext } from '@ghost-examiner/core';

/**
 * The members of `SpeechRecognition` / `webkitSpeechRecognition` this adapter uses (spec b design
 * §3.3). TypeScript's DOM lib has the event types but not the recognizer itself, so these are
 * local; the DOM's `SpeechRecognitionEvent` fits `RecognitionResultEventLike`.
 */
export interface RecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}
export interface RecognitionResultEventLike {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: RecognitionResultLike };
}
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEventLike) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionCtor = new () => RecognitionLike;

/** What the voice controls show (spec b design §3.3). */
export interface VoiceView {
  availability: Availability;
  listening: boolean;
  final: string; // text the recognizer has settled
  interim: string; // text it may still change
  error?: string; // kit catalog key
}

export interface VoiceAdapter extends InputAdapter {
  getSnapshot(): VoiceView;
  subscribe(listener: () => void): () => void;
  /** Start listening (the voice button); the browser asks for the microphone on the first time. */
  listen(): void;
}

export interface VoiceAdapterDeps {
  /** `SpeechRecognition ?? webkitSpeechRecognition`, or undefined when the browser has neither. */
  Recognition?: RecognitionCtor;
  /** The browser's preferred languages (`navigator.languages`), for the recognition region. */
  languages: readonly string[];
}

const UNAVAILABLE: Availability = { available: false, reason: 'voice.unavailable' };

/**
 * Errors that mean this browser can't recognize speech at all, so voice becomes unavailable (the
 * keyboard fallback) rather than an error message (owner rule after task 21):
 * - `service-not-allowed`: the browser has no recognition service for the page (spec meaning);
 * - `network`: the API exists but its service doesn't answer. Brave behaves like this (its build
 *   has no speech service).
 */
const cannotRun = (code: string) => code === 'service-not-allowed' || code === 'network';

/**
 * Voice answers with the browser's speech recognition (spec b design §3.3, Req 4). Feature
 * detection never creates a recognizer, so the microphone is only requested when the user starts
 * listening (Req 4.3). A recognizer that can't be created, can't start, or reports that the
 * service can't run makes voice unavailable for the rest of the page, with a reason.
 */
export function createVoiceAdapter(deps: VoiceAdapterDeps): VoiceAdapter {
  const { Recognition } = deps;
  let availability: Availability = Recognition ? { available: true } : UNAVAILABLE;
  let ctx: InputContext | undefined; // the question the adapter is armed for
  let recognizer: RecognitionLike | undefined;
  let view: VoiceView = { availability, listening: false, final: '', interim: '' };
  const listeners = new Set<() => void>();

  function update(patch: Partial<VoiceView>) {
    view = { ...view, ...patch };
    for (const listener of listeners) listener();
  }

  function becomeUnavailable() {
    availability = UNAVAILABLE;
    recognizer = undefined;
    update({ availability, listening: false });
  }

  function listen() {
    if (!Recognition || !availability.available || !ctx || recognizer) return;
    const locale = ctx.locale;
    try {
      const r = new Recognition();
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.lang = speechLang(locale, deps.languages);
      r.onerror = (e) => {
        if (r === recognizer && cannotRun(e.error)) becomeUnavailable();
      };
      r.onend = () => {
        if (r !== recognizer) return; // an aborted or failed recognizer
        recognizer = undefined;
        update({ listening: false });
      };
      recognizer = r;
      r.start();
      update({ listening: true });
    } catch {
      becomeUnavailable(); // no constructor that works, or start() refused
    }
  }

  return {
    id: 'voice',
    requires: { camera: false, microphone: true },
    experimental: false,
    supports: ['free-text'],
    checkAvailability: async () => availability,
    start(context) {
      ctx = context;
    },
    stop() {
      ctx = undefined;
      const r = recognizer;
      recognizer = undefined;
      if (r) {
        r.abort();
        update({ listening: false });
      }
    },
    getSnapshot: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listen,
  };
}
