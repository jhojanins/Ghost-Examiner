import type { Page } from '@playwright/test';

/**
 * A fake `SpeechRecognition` / `webkitSpeechRecognition` for end-to-end tests (spec b tasks 33 and
 * 34, design §8), installed before any page script runs. No microphone and no network are used.
 *
 * - `working`: the test makes the recognizer "hear" text through `window.__fakeRecognition.control`.
 * - `brave`: the API exists, but `start()` fails with a `network` error and then ends, as in Brave,
 *   whose build has no speech service.
 * - `none`: neither global exists, as in Firefox.
 *
 * Like the browser, `stop()` ends the recognizer after the last results, and `abort()` fires an
 * `aborted` error, then `end`. Both happen on a microtask, so they work with the page clock
 * installed. Every call and event goes into `window.__fakeRecognition.log`.
 */
export type FakeRecognitionVariant = 'working' | 'brave' | 'none';

export interface FakeRecognitionEntry {
  type: 'new' | 'start' | 'stop' | 'abort' | 'result' | 'error' | 'end';
  lang?: string;
  text?: string;
  error?: string;
}

declare global {
  interface Window {
    __fakeRecognition?: {
      log: FakeRecognitionEntry[];
      control: {
        /** The current recognizer reports all its results so far: `[text, isFinal]` each. */
        result(results: [string, boolean][]): void;
        error(code: string): void;
        end(): void;
        /** How many recognizers are listening now (0 or 1). */
        active(): number;
      };
    };
  }
}

/**
 * Runs inside the page (serialized by Playwright), so it may not use anything from this module.
 * Exported so the Playwright MCP walk-through can install the very same fake.
 */
export function fakeSpeechRecognition({ variant = 'working' }: { variant?: FakeRecognitionVariant }) {
  const w = window as unknown as Record<string, unknown>;
  if (variant === 'none') {
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) delete w[name];
    return;
  }
  const log: FakeRecognitionEntry[] = [];
  const listening = new Set<FakeRecognition>(); // the recognizer listening now (0 or 1)
  const current = () => [...listening][0];
  type Handler = ((event: unknown) => void) | null;

  class FakeRecognition {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onresult: Handler = null;
    onerror: Handler = null;
    onend: Handler = null;
    onstart: Handler = null;
    private ended = false;
    constructor() {
      log.push({ type: 'new' });
    }
    start() {
      log.push({ type: 'start', lang: this.lang });
      listening.clear();
      listening.add(this);
      if (variant === 'brave') {
        queueMicrotask(() => {
          this.fail('network');
          this.finish();
        });
      }
    }
    stop() {
      log.push({ type: 'stop' });
      queueMicrotask(() => this.finish());
    }
    abort() {
      log.push({ type: 'abort' });
      queueMicrotask(() => {
        this.fail('aborted');
        this.finish();
      });
    }
    report(results: [string, boolean][]) {
      if (this.ended) return;
      log.push({ type: 'result', text: results.map(([t]) => t).join(' ') });
      const list = results.map(([transcript, isFinal]) => Object.assign([{ transcript, confidence: 0.9 }], { isFinal }));
      this.onresult?.({ resultIndex: 0, results: list });
    }
    fail(code: string) {
      if (this.ended) return;
      log.push({ type: 'error', error: code });
      this.onerror?.({ error: code, message: '' });
    }
    finish() {
      if (this.ended) return;
      this.ended = true;
      listening.delete(this);
      log.push({ type: 'end' });
      this.onend?.({});
    }
  }

  window.__fakeRecognition = {
    log,
    control: {
      result: (results) => current()?.report(results),
      error: (code) => current()?.fail(code),
      end: () => current()?.finish(),
      active: () => listening.size,
    },
  };
  for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    Object.defineProperty(window, name, { value: FakeRecognition, configurable: true, writable: true });
  }
}

/** Installs the fake before the page's own scripts run; call before `page.goto`. */
export async function installFakeRecognition(page: Page, variant: FakeRecognitionVariant = 'working') {
  await page.addInitScript(fakeSpeechRecognition, { variant });
}

/** Everything the fake did so far, in order. */
export async function recognitionLog(page: Page): Promise<FakeRecognitionEntry[]> {
  return page.evaluate(() => window.__fakeRecognition?.log ?? []);
}
