import type { Page } from '@playwright/test';

/**
 * A fake `speechSynthesis` and `SpeechSynthesisUtterance` for end-to-end tests (spec b task 18,
 * design §8), installed before any page script runs, so results never depend on the host's voices.
 *
 * - `two-voices`: one local en-US voice (the default) and one local es-MX voice.
 * - `en-only`: the local en-US voice only, so Spanish has no voice.
 * - `no-voices`: the API exists, but the voice list stays empty and `voiceschanged` never fires.
 * - `no-api`: neither global exists, as in a browser without speech synthesis.
 *
 * Automatic mode (the default): each utterance fires `start` after 50 ms, a `word` boundary at each
 * word's start, and `end` when the text is over, at 60 ms per character. That is close to the app's own estimate but not the
 * same rule, on purpose: the app must follow the boundaries, not its estimate. `cancel()` fires
 * `interrupted` on the utterance speaking and `canceled` on the queued ones, as Chrome does.
 * Manual mode (`manual: true`, task 19): nothing fires on its own; the test fires events on the
 * utterance speaking through `window.__fakeSpeech.control`, so assertions never depend on timing.
 * Every call and event goes into `window.__fakeSpeech.log` for the test to read.
 */
export type FakeSpeechVariant = 'two-voices' | 'en-only' | 'no-voices' | 'no-api';
export interface FakeSpeechOptions {
  variant?: FakeSpeechVariant;
  manual?: boolean;
}

export interface FakeSpeechEntry {
  type: 'speak' | 'cancel' | 'start' | 'boundary' | 'end' | 'error';
  text?: string;
  lang?: string;
  voice?: string;
  charIndex?: number;
  error?: string;
}

declare global {
  interface Window {
    __fakeSpeech?: {
      log: FakeSpeechEntry[];
      /** Manual mode: fire an event on the utterance speaking (no-op when none is). */
      control: {
        start(): void;
        boundary(charIndex: number): void;
        end(): void;
        error(code: string): void;
      };
    };
  }
}

/**
 * Runs inside the page (serialized by Playwright), so it may not use anything from this module.
 * Exported so the Playwright MCP walk-through can install the very same fake.
 */
export function fakeSpeechSynthesis({ variant = 'two-voices', manual = false }: FakeSpeechOptions) {
  const w = window as unknown as Record<string, unknown>;
  if (variant === 'no-api') {
    // Window attributes are own properties of the global object (WebIDL [Global]), so this removes them.
    for (const name of ['speechSynthesis', 'SpeechSynthesisUtterance']) delete w[name];
    return;
  }

  const MS_PER_CHAR = 60;
  const START_DELAY_MS = 50;
  const log: FakeSpeechEntry[] = [];

  const voice = (name: string, lang: string, isDefault: boolean) => ({
    name,
    lang,
    localService: true,
    default: isDefault,
    voiceURI: `fake:${name}`,
  });
  const english = voice('Fake English', 'en-US', true);
  const spanish = voice('Fake Español', 'es-MX', false);
  const voices = variant === 'two-voices' ? [english, spanish] : variant === 'en-only' ? [english] : [];

  type Handler = ((this: FakeUtterance, ev: Event) => unknown) | null;
  class FakeUtterance extends EventTarget {
    text: string;
    lang = '';
    voice: ReturnType<typeof voice> | null = null;
    rate = 1;
    pitch = 1;
    volume = 1;
    onstart: Handler = null;
    onend: Handler = null;
    onerror: Handler = null;
    onboundary: Handler = null;
    onpause: Handler = null;
    onresume: Handler = null;
    onmark: Handler = null;
    constructor(text = '') {
      super();
      this.text = text;
    }
    fire(type: 'start' | 'end' | 'error' | 'boundary', props: Record<string, unknown> = {}) {
      log.push({ type, text: this.text, ...props });
      const event = Object.assign(new Event(type), { utterance: this, charIndex: 0, elapsedTime: 0, name: '' }, props);
      this.dispatchEvent(event);
      (this as unknown as Record<string, Handler>)[`on${type}`]?.call(this, event);
    }
  }

  let speaking: { utterance: FakeUtterance; timers: ReturnType<typeof setTimeout>[] } | undefined;
  const queue: FakeUtterance[] = [];

  function next() {
    const utterance = queue.shift();
    speaking = undefined;
    if (!utterance) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    speaking = { utterance, timers };
    if (manual) return; // the test drives it through `control`
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, START_DELAY_MS + ms));
    at(0, () => utterance.fire('start'));
    for (const word of utterance.text.matchAll(/\S+/g)) {
      at(word.index * MS_PER_CHAR, () => utterance.fire('boundary', { name: 'word', charIndex: word.index }));
    }
    at(utterance.text.length * MS_PER_CHAR, () => {
      utterance.fire('end');
      next();
    });
  }

  const now = () => speaking?.utterance;
  window.__fakeSpeech = {
    log,
    control: {
      start: () => now()?.fire('start'),
      boundary: (charIndex) => now()?.fire('boundary', { name: 'word', charIndex }),
      end() {
        now()?.fire('end');
        next();
      },
      error(code) {
        now()?.fire('error', { error: code });
        next();
      },
    },
  };

  // A class, so `pending` and `speaking` stay live getters (Object.assign would copy their values once).
  class FakeSynth extends EventTarget {
    onvoiceschanged = null;
    paused = false;
    get pending() {
      return queue.length > 0;
    }
    get speaking() {
      return speaking !== undefined;
    }
    getVoices() {
      return [...voices];
    }
    speak(utterance: FakeUtterance) {
      log.push({ type: 'speak', text: utterance.text, lang: utterance.lang, voice: utterance.voice?.name });
      queue.push(utterance);
      if (!speaking) next();
    }
    cancel() {
      log.push({ type: 'cancel' });
      const current = speaking;
      const queued = queue.splice(0);
      speaking = undefined;
      if (current) {
        current.timers.forEach(clearTimeout);
        current.utterance.fire('error', { error: 'interrupted' });
      }
      for (const utterance of queued) utterance.fire('error', { error: 'canceled' });
    }
    pause() {}
    resume() {}
  }

  Object.defineProperty(window, 'speechSynthesis', { value: new FakeSynth(), configurable: true, writable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true, writable: true });
}

/** Installs the fake before the page's own scripts run; call before `page.goto`. */
export async function installFakeSpeech(page: Page, options: FakeSpeechOptions = {}) {
  await page.addInitScript(fakeSpeechSynthesis, options);
}

/** Everything the fake did so far, in order. */
export async function speechLog(page: Page): Promise<FakeSpeechEntry[]> {
  return page.evaluate(() => window.__fakeSpeech?.log ?? []);
}
