import type { Page } from '@playwright/test';

/**
 * A fake `/api/llm/stream` inside the page (ghost-defense-live task 23). Playwright's
 * `route.fulfill` sends a body whole, so a streamed reply can't be chunked from the route. This
 * replaces `fetch` for that one path only; every other request still goes out and through the
 * test's network guard. The test drives the stream through `window.__llmStream`.
 */
export interface FakeStreamControl {
  /** Requests made so far, with their parsed bodies. */
  bodies: unknown[];
  /** How many requests the app aborted. */
  aborted: number;
  /** Answers the latest request with a 200 and an open body. */
  open(): void;
  /** Sends a chunk of text on the open body. */
  push(text: string): void;
  close(): void;
  /** Answers the latest request with an error status instead. */
  fail(status: number): void;
}
declare global {
  interface Window {
    __llmStream?: FakeStreamControl;
  }
}

/** Runs inside the page (serialized by Playwright), so it may not use anything from this module. */
export function fakeLlmStream() {
  const real = window.fetch.bind(window);
  let current: { resolve: (r: Response) => void; controller?: ReadableStreamDefaultController<Uint8Array> } | undefined;
  const control: FakeStreamControl = {
    bodies: [],
    aborted: 0,
    open() {
      if (!current) return;
      const c = current;
      c.resolve(new Response(new ReadableStream<Uint8Array>({ start: (ctl) => void (c.controller = ctl) }), { status: 200 }));
    },
    push(text) {
      current?.controller?.enqueue(new TextEncoder().encode(text));
    },
    close() {
      current?.controller?.close();
    },
    fail(status) {
      current?.resolve(new Response('{"error":"scripted"}', { status, headers: { 'content-type': 'application/json' } }));
    },
  };
  window.__llmStream = control;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.endsWith('/api/llm/stream')) return real(input, init);
    control.bodies.push(JSON.parse(String(init?.body ?? '{}')));
    return new Promise<Response>((resolve, reject) => {
      const entry: NonNullable<typeof current> = { resolve };
      current = entry;
      init?.signal?.addEventListener('abort', () => {
        control.aborted++;
        try {
          entry.controller?.error(new DOMException('aborted', 'AbortError'));
        } catch {
          // already closed
        }
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
  };
}

/** Installs the fake before the page's own scripts run; call before `page.goto`. */
export async function installFakeLlmStream(page: Page) {
  await page.addInitScript(fakeLlmStream);
}
