---
name: testing-strategy
description: "How to test Ghost Examiner: Vitest unit tests, fast-check property tests, React component tests, Playwright end-to-end tests, automated axe accessibility checks, and manual verification in the browser through the Playwright MCP server. Use when writing or running tests, setting up test tooling, verifying a task before marking it done, or debugging failing or flaky tests."
metadata:
  project: ghost-examiner
---

# Testing strategy

## Layers
| Layer | Tooling | Environment | Notes |
|---|---|---|---|
| packages/core | Vitest + fast-check | Node | Pure logic; inject `Clock`, no real timers |
| packages/web | Vitest | jsdom | Fakes for `speechSynthesis`, `SpeechRecognition`, `getUserMedia`, `fetch` |
| packages/ui | Vitest + Testing Library | jsdom | Query by role and label; test ids only for SVG internals |
| apps | Playwright Test + `@axe-core/playwright` | Chromium, WebKit, Firefox | Demo mode; Firefox covers "no speech recognition" fallback |

Exact script names are fixed in spec (a). Always run single-shot (`vitest run`), never watch mode.

## Automated accessibility check
```ts
import AxeBuilder from '@axe-core/playwright';
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  .analyze();
expect(results.violations).toEqual([]);
```
- Run per screen, in EN and ES, with `page.emulateMedia({ reducedMotion: 'reduce' })` and `'no-preference'`.
- Any accepted exception is documented in the test with the reason.

## Browser fakes and determinism
- Speech: `page.addInitScript` installs a fake `speechSynthesis` that fires `start`, `boundary` and `end` on a schedule.
- Time: use `page.clock` for Morse timing and silence detection; no fixed sleeps.
- Camera: launch with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`.
- Privacy test: `page.on('request')` with an allowlist. In demo mode, only same-origin requests (plus the model CDN when the camera is on). Fail on anything else, and on any request carrying media.

## Verification through Playwright MCP
1. Make sure the dev server is running (ask the user, or start it as a background process).
2. `browser_navigate` to the screen; `browser_snapshot` to read the accessibility tree before acting (reconnaissance first, then act with element refs).
3. Drive it by keyboard only: `browser_press_key` with Tab, Shift+Tab, Enter, Space, Escape.
4. Check: captions appear for ghost lines, muted mode works, ES/EN switch updates text and `lang`, confirmation step appears before evaluation, no console errors (`browser_console_messages`).
5. Screenshots only when judging visuals (contrast, layout, ghost pose); snapshots are cheaper.
6. Report what was verified and what could not be.

## Rules
- Web-first assertions (`await expect(locator).toBeVisible()`); don't wait for `networkidle`.
- New input adapters ship with: unit tests, a confirmation-flow test, and an axe check of their widget.
- A failing property-test counterexample becomes a regression test.
- Flaky test = bug. Fix the cause, don't add retries.
