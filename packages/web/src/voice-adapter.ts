import { speechLang, type Availability, type Clock, type InputAdapter, type InputContext, type InputEvent } from '@ghost-examiner/core';

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
  /** Stop listening (the voice button again): the answer becomes a candidate once the last results arrive. */
  stopListening(): void;
}

export interface VoiceAdapterDeps {
  /** `SpeechRecognition ?? webkitSpeechRecognition`, or undefined when the browser has neither. */
  Recognition?: RecognitionCtor;
  /** For the loop guard (task 26): how soon a recognizer ended after it started. */
  clock: Clock;
  /** The browser's preferred languages (`navigator.languages`), for the recognition region. */
  languages: readonly string[];
}

const UNAVAILABLE: Availability = { available: false, reason: 'voice.unavailable' };

/** Loop guard (Req 4.9, design §3.3): this many early ends in a row, each this soon with no result, stop listening. */
const QUICK_ENDS = 3;
const QUICK_END_MS = 500;

/**
 * Errors that mean this browser can't recognize speech at all, so voice becomes unavailable (the
 * keyboard fallback) rather than an error message (owner rules after tasks 21 and 25):
 * - `service-not-allowed`: the browser has no recognition service for the page (spec meaning);
 * - `network` while nothing was ever recognized on this page: the API exists but its service
 *   doesn't answer. Brave behaves like this (its build has no speech service). After one success
 *   on the page, `network` is a transient error instead.
 */
const cannotRun = (code: string, everHeard: boolean) => code === 'service-not-allowed' || (code === 'network' && !everHeard);

/** Error messages (Req 4.10, design §3.3), as kit catalog keys; any other code is a service error. */
const ERRORS: Record<string, string> = {
  'not-allowed': 'voice.error.permission',
  'audio-capture': 'voice.error.noMic',
  network: 'voice.error.network',
  'language-not-supported': 'voice.error.language',
};
/** `aborted` is our own stop(); `no-speech` ends recognition early, which restarts it (task 26). */
const IGNORED = new Set(['aborted', 'no-speech']);

/** The results' text, final or not: trimmed pieces joined by one space (browsers differ in spacing). */
function textOf(event: RecognitionResultEventLike, isFinal: boolean): string {
  const pieces: string[] = [];
  for (let i = 0; i < event.results.length; i++) {
    const result = event.results[i];
    if (result.isFinal === isFinal) pieces.push(result[0].transcript.trim());
  }
  return pieces.filter(Boolean).join(' ');
}

const join = (...parts: string[]) => parts.filter(Boolean).join(' ');
const joined = (view: VoiceView) => join(view.final, view.interim);

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
  let emit: ((e: InputEvent) => void) | undefined;
  let recognizer: RecognitionLike | undefined;
  let stopping = false; // the user asked to stop: the next end turns the text into a candidate
  let committed = ''; // text kept from earlier recognizers in this turn (the browser ended them early)
  let quickEnds = 0; // early ends in a row that were too quick and heard nothing (loop guard)
  let everHeard = false; // something was recognized on this page (the network rule)
  let view: VoiceView = { availability, listening: false, final: '', interim: '' };
  const listeners = new Set<() => void>();

  function update(patch: Partial<VoiceView>) {
    view = { ...view, ...patch };
    for (const listener of listeners) listener();
  }

  /**
   * Ends listening for good: errors, the loop guard and "unavailable". Text recognized so far becomes
   * a candidate (owner rule after task 25); it still goes to the confirmation step.
   */
  function finish(patch: Partial<VoiceView>) {
    const r = recognizer;
    recognizer = undefined;
    stopping = false;
    r?.abort(); // releases the microphone at once; its later events are ignored
    const text = joined(view).trim();
    committed = '';
    update({ listening: false, final: '', interim: '', ...patch });
    if (text) emit?.({ type: 'candidate', candidate: { text, method: 'voice' } });
  }

  function becomeUnavailable() {
    availability = UNAVAILABLE;
    finish({ availability });
  }

  /** Creates and starts one recognizer for the armed question; used by listen() and every restart. */
  function begin(context: InputContext) {
    if (!Recognition) return;
    try {
      const r = new Recognition();
      const startedAt = deps.clock.now();
      let heard = false;
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.lang = speechLang(context.locale, deps.languages);
      r.onresult = (e) => {
        if (r !== recognizer) return;
        const final = textOf(e, true);
        const interim = textOf(e, false);
        if (final || interim) heard = everHeard = true;
        update({ final: join(committed, final), interim });
        emit?.({ type: 'partial', text: joined(view) }); // live captions and barge-in (Req 5.1, 7.1)
      };
      r.onerror = (e) => {
        if (r !== recognizer || IGNORED.has(e.error)) return;
        if (cannotRun(e.error, everHeard)) becomeUnavailable();
        else finish({ error: ERRORS[e.error] ?? 'voice.error.service' }); // voice stays available: retry works
      };
      r.onend = () => {
        if (r !== recognizer) return; // an aborted or failed recognizer
        recognizer = undefined;
        if (!stopping) return endedEarly(heard, deps.clock.now() - startedAt);
        stopping = false;
        const text = joined(view).trim();
        if (!text) return update({ listening: false, error: 'voice.empty' }); // Req 4.8
        update({ listening: false, final: '', interim: '' });
        emit?.({ type: 'candidate', candidate: { text, method: 'voice' } }); // Req 4.7: to confirmation
      };
      recognizer = r;
      r.start();
    } catch {
      becomeUnavailable(); // no constructor that works, or start() refused
    }
  }

  /**
   * The browser ended recognition on its own (Req 4.9), e.g. after a pause: keep the text and listen
   * again, so speaking has no time limit. The loop guard stops a recognizer that keeps ending at once.
   */
  function endedEarly(heard: boolean, ms: number) {
    quickEnds = !heard && ms < QUICK_END_MS ? quickEnds + 1 : 0;
    if (quickEnds >= QUICK_ENDS) return finish({ error: 'voice.error.service' });
    committed = joined(view);
    update({ final: committed, interim: '' });
    if (ctx) begin(ctx);
  }

  function listen() {
    if (!Recognition || !availability.available || !ctx || recognizer) return;
    stopping = false;
    committed = '';
    quickEnds = 0;
    update({ listening: true, final: '', interim: '', error: undefined });
    begin(ctx);
  }

  return {
    id: 'voice',
    requires: { camera: false, microphone: true },
    experimental: false,
    supports: ['free-text'],
    checkAvailability: async () => availability,
    start(context, onEvent) {
      ctx = context;
      emit = onEvent;
    },
    stop() {
      ctx = undefined;
      emit = undefined;
      stopping = false;
      committed = '';
      const r = recognizer;
      recognizer = undefined;
      r?.abort();
      if (r || view.final || view.interim || view.error) update({ listening: false, final: '', interim: '', error: undefined });
    },
    /**
     * The UI language changed (Req 4.6): listening goes on in the new language and keeps the text so
     * far. Not while the user's stop is finishing: that answer is already on its way.
     */
    setLocale(locale) {
      if (!ctx) return;
      ctx = { ...ctx, locale };
      if (!recognizer || stopping) return;
      const old = recognizer;
      recognizer = undefined;
      old.abort(); // its late events are ignored
      committed = joined(view);
      quickEnds = 0;
      update({ final: committed, interim: '' });
      begin(ctx);
    },
    stopListening() {
      if (!recognizer) return;
      stopping = true;
      recognizer.stop(); // the browser sends its last results, then `end`
    },
    getSnapshot: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listen,
  };
}
