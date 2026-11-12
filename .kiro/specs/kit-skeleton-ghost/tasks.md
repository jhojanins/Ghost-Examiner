# Tasks: (a) Kit skeleton + animated ghost persona

Implements `requirements.md` and `design.md` in this folder. Each task is one logical unit with one success criterion (**Done when**). The definition of done in `.kiro/steering/workflow.md` applies to every task. Always load `lean-code`, plus the skills listed per task.

Browser checks: tasks 1 to 26 have no runnable app, so they skip the Playwright MCP and axe steps (workflow exception) and rely on unit and component tests. From task 27 on, every UI task includes a keyboard walk-through with Playwright MCP and an axe run.

Tasks 1 and 33 trace to repository rules in `structure.md` steering rather than to a spec requirement.

## Phase 1: Day 5 vertical slice (Nov 11 to 15)

### Repository and workspace
- [x] 1. Add the MIT `LICENSE` and `.gitignore`
  - `LICENSE`: MIT, copyright 2026, owner's name (asked at task start). `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`, `.netlify`, `.playwright-mcp`.
  - **Done when:** `git check-ignore -v .kiro/steering/product.md` prints nothing, `git check-ignore .playwright-mcp/x.yml` prints the path, and after the owner pushes, `gh api repos/jhojanins/Ghost-Examiner --jq .license.spdx_id` prints `MIT`.
  - _Requirements: 1.4; steering `structure.md`_

- [x] 2. Create the pnpm workspace
  - Ask the owner before running `npm install -g pnpm`. Root `package.json` (scripts, `packageManager`, no runtime deps, no `react`), `pnpm-workspace.yaml`, `tsconfig.base.json`, and the five folders with `package.json`, `tsconfig.json` and an empty `src/index.ts`.
  - **Done when:** `pnpm install` succeeds and `pnpm typecheck` exits 0 across all five workspaces.
  - _Requirements: 1.1, 1.2_

- [x] 3. Add the test and lint tooling
  - `vitest.config.ts` with projects `core` (node), `web` (jsdom), `ui` (jsdom), `passWithNoTests`; `eslint.config.js` with typescript-eslint and react-hooks for `packages/ui` and `apps/*`.
  - **Done when:** `pnpm test` and `pnpm lint` each exit 0 and return to the prompt without a watcher.
  - _Requirements: 1.2, 1.3_ · Skills: `testing-strategy`

- [x] 4. Enforce the package boundaries
  - `packages/core/tsconfig.json`: `lib: ["ES2022"]`, `types: []`, no `jsx`. `packages/web/tsconfig.json`: adds `DOM`. Neither package lists `react`. `exports` point at `./src/index.ts`.
  - **Done when:** a temporary probe file in core that imports `react` and uses `window` makes `pnpm typecheck` fail with both errors; a probe in web importing `react` fails too; both probes are deleted and typecheck passes again. The error output goes in the task report.
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

### packages/core
- [x] 5. i18n: `Locale`, `defineCatalog`, `format`, `pickLocale`
  - **Done when:** unit tests pass for `pickLocale` (`es-MX` → es, `en-GB` → en, `fr` → en, empty → en) and `format`; a `@ts-expect-error` test with a missing key and one with an extra key in `es` both typecheck (meaning the errors happen).
  - _Requirements: 9.1, 9.3_

- [x] 6. Input types and keyboard adapter
  - `InputAdapter` types from the architecture; `createKeyboardAdapter()` with `submit`.
  - **Done when:** unit tests show `submit('  ')` returns `{ ok: false, reason: 'empty' }` with no event, `submit(' Hi ')` emits one candidate with text `Hi` and method `keyboard`, and `supports` lists all three answer kinds.
  - _Requirements: 6.1, 6.3, 6.4_

- [x] 7. Engine: types, `initialState`, `reduce`
  - Transition table from design §3.3, including Edit (`draft`), Retry, the `confirmedBrand`, and `locale-changed` re-evaluation in feedback.
  - **Done when:** one example test per row of the design's transition table passes, and a `@ts-expect-error` test shows a plain object can't be passed where `ConfirmedAnswer` is required.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 7.3, 7.4, 7.5, 9.2_

- [x] 8. Engine property tests
  - Generators use only non-empty packs (an empty pack is rejected by `validatePack`, task 9).
  - **Done when:** fast-check properties P1, P2 and P3 (design §9) pass with 100 runs, each with an event-sequence generator built from valid events (no heavy filtering).
  - _Requirements: 12.1, 5.2, 5.4_ · Skills: `testing-strategy`

- [x] 9. Pack validator
  - A pack with zero questions is always an `error`, even in Preview, because `reduce` would throw on it (owner decision after task 7). `PackIssue` gets a pack-level shape for it; the exact shape is reported in the task.
  - **Done when:** `validatePack` unit tests cover one adapter + `preview: true` (warning), one adapter + `preview: false` (error), two adapters (no issue), a pack with zero questions (error with `preview: true` and `false`), and property P4 passes.
  - _Requirements: 5.5_

- [x] 10. Speech timeline
  - `buildTimeline(text, locale)` with phase 1 visemes and the timing rules in design §3.5.
  - **Done when:** properties P5 and P6 pass, and example tests show "Mamá, hola." yields `MBP`/`A` cues, a comma pause of 200 ms and a final `rest`.
  - _Requirements: 4.3_ · Skills: `ghost-svg-animation`

- [x] 11. Ghost pose
  - `ghostPose(state, now, { reducedMotion })`: viseme lookup, seeded blink; no float.
  - **Done when:** properties P7 and P8 pass, and an example test shows the viseme at a given time matches the timeline cue.
  - _Requirements: 3.3, 3.6, 3.9_ · Skills: `ghost-svg-animation`

- [x] 12. LLM types, `withFallback`, `isFeedback`
  - **Done when:** unit tests show `withFallback(failing, working)` returns the working result, `withFallback(failing, failing)` returns the last error, and `isFeedback` rejects missing fields, extra fields, wrong types and an unknown reaction.
  - _Requirements: 8.1_ · Skills: `netlify-proxy-safety`

- [x] 13. Demo provider, evaluator and feedback copy
  - Heuristic from design §3.7; EN and ES feedback templates in the kit catalog, written with the persona rules ("tú").
  - **Done when:** property P9 passes; example tests show an answer covering 2 of 3 key points gets `approving` with the right strength and improvement, a 5-word answer gets the "say a bit more" improvement, and the same input in `es` returns Spanish text.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.4_ · Skills: `ghost-persona`

### packages/web
- [x] 14. Clock, browser locale and SilentOutput
  - **Done when:** with fake timers, `createSilentOutput(clock).speak(timeline).done` resolves exactly at `timeline.duration`, `cancel()` resolves it early without error, and `browserLocale()` returns `es` for a stubbed `navigator.languages` of `['es-CO']`.
  - _Requirements: 4.1, 9.1_

- [x] 15. Session runtime
  - `createSession` per design §4.1, with fake speech and evaluator in tests.
  - **Done when:** an integration test drives start → privacy-accepted → candidate (before `line-done`) → confirm and receives feedback; a strict build with one adapter returns `{ blocked }`; a Preview build calls `console.warn` and starts; `locale-changed` re-resolves the current line text.
  - _Requirements: 4.6, 5.5, 9.2_

### packages/ui
- [x] 16. Tokens and AppShell
  - `tokens.css` (design §5.3 table), `AppShell` with header (title, language switch slot, privacy link, Preview badge text), skip link, `<main>`, and `<html lang>` update.
  - **Done when:** component tests show the Preview badge text renders only when `preview` is true, in EN and ES; the skip link targets `<main>`; `document.documentElement.lang` matches the locale prop.
  - _Requirements: 9.2, 10.4, 11.5_ · Skills: `a11y-review`, `ghost-persona`

- [x] 17. LanguageSwitch
  - **Done when:** component tests show two buttons with `aria-pressed` reflecting the current locale, each label carrying its own `lang`, and clicking "Español" calls `onChange('es')`.
  - _Requirements: 9.2_ · Skills: `a11y-review`

- [x] 18. Ghost SVG
  - Hand-drawn SVG per design §5.3: palette, dark outlines on orange parts, glasses, bow tie, clipboard, 4 expressions, 4 mouth paths, `role="img"` with localized labels.
  - **Done when:** component tests show, for each of the 4 expressions and 4 visemes, the right mouth path is visible and the `aria-label` matches the expression in EN and ES; a test asserts every color used in the SVG is one of the design palette values (so no purple can slip in).
  - _Requirements: 3.1, 3.2 (phase 1), 3.5, 3.8, 3.11_ · Skills: `ghost-svg-animation`, `a11y-review`

- [x] 19. `useGhostPose` animation hook
  - One `requestAnimationFrame` loop, writes through refs, reads `prefers-reduced-motion`.
  - **Done when:** a test with a mocked rAF and `matchMedia` shows blinking toggles the eye attributes without re-rendering the component, and with `reduce` the eyes never close.
  - _Requirements: 3.3, 3.4, 3.6_ · Skills: `ghost-svg-animation`

- [x] 20. Captions and Transcript
  - **Done when:** component tests show the full line renders at once, the word at the mocked time has the underline-and-bold class, captions are `aria-hidden`, and a finished line appears once in the transcript list and once in the polite live region.
  - _Requirements: 4.1, 4.2, 4.4, 4.5_ · Skills: `ghost-svg-animation`, `a11y-review`

- [x] 21. PrivacyDialog
  - Native `<dialog>` with `showModal()`; text from design and steering (local processing in demo mode, no sensitive or personal data).
  - Esc must really return to the intro screen (design §8). The engine has no event for it and stays in `privacy`, so the app shows the intro screen with a Start button that reopens the dialog (task 27 wires this).
  - **Done when:** component tests show the dialog opens modal with focus inside, Accept calls `onAccept`, Esc calls `onDismiss` without `onAccept`, and the read-only mode has only a Close button.
  - _Requirements: 10.1, 10.2, 10.3_ · Skills: `a11y-review`, `ghost-persona`

- [x] 22. KeyboardInput
  - **Done when:** component tests show a visible label tied to the textarea, paste works, Ctrl+Enter and Cmd+Enter submit, an empty submit shows the inline error linked by `aria-describedby` and keeps focus, and the `draft` prop prefills the text.
  - _Requirements: 6.2, 6.3, 6.4, 7.3_ · Skills: `a11y-review`

- [x] 23. ConfirmAnswer
  - **Done when:** component tests show the heading receives focus on mount, the answer text and the method label ("Typed" / "Escrito") render, and Confirm, Edit and Retry call their handlers.
  - _Requirements: 7.1, 7.2_ · Skills: `a11y-review`, `ghost-persona`

- [x] 24. FeedbackPanel
  - **Done when:** component tests show the "Practice feedback" heading (EN and ES), strength and improvement, the feedback's `lang` attribute, focus on the heading at mount, and Next calling its handler.
  - _Requirements: 8.2, 8.5_ · Skills: `a11y-review`, `ghost-persona`

- [x] 25. `useSession` hook
  - `useSyncExternalStore` over the runtime handle.
  - **Done when:** a component test with a fake handle re-renders on `subscribe` notifications and not otherwise, and `dispatch` reaches the handle.
  - _Requirements: 5.1_

- [x] 26. Ghost state mapping
  - Session view + playback → `GhostState` per design §5.2.
  - **Done when:** a unit test covers each row of the design's mapping table.
  - _Requirements: 3.4_

### Apps, build and deploy
- [x] 27. ghost-interview slice wiring
  - `config.ts` (`preview: true`), `content/pack.ts` (one fictional question, 3 key points, EN/ES cues), `messages.ts`, `App.tsx` wiring only, `vite.config.ts` with `base: '/interview/'`.
  - `useGhostPose` (task 19) real-browser check: **done in task 21** on its harness page (Chromium, 13 s per run at 60 fps): blinks of 117 ms, 3.5 s and 5.0 s apart; none with `reducedMotion: 'reduce'`; exactly one mouth shape visible in every frame, changing while a caption word is marked and at `rest` otherwise. Task 27 only re-checks that the mouth and captions move together with the real session runtime (its `startedAt` comes from `SilentOutput`, not the harness).
  - Focus after a language switch in the feedback phase (found in task 24): the engine re-evaluates, so the app goes feedback → evaluating → feedback. If `FeedbackPanel` unmounts during `evaluating` and mounts again, it moves focus to its heading, away from the language button the user just pressed. Keep the panel mounted through the re-evaluation, or keep focus on the language switch, and check it by keyboard.
  - Owner decision: the ghost stops speaking when the user submits an answer while the question line is still playing. The runtime cancels the line on entering `confirming` (done in task 27, with tests).
  - Demo feedback is labeled honestly: whenever the evaluator's provider is a demo provider (`isDemo`), the feedback panel shows a visible line, from the `en`/`es` catalogs, saying it is a keyword-based demo evaluation (for example "Demo evaluation: based on keywords, not a full reading of your answer." / "Evaluación de demostración: se basa en palabras clave, no en una lectura completa de tu respuesta."). It sits next to the "Practice feedback" heading from task 24, and the walk-through checks it in EN and ES.
  - Esc on the privacy dialog: while the engine stays in `privacy`, the app shows the intro screen with a Start button; Start reopens the dialog (it does not dispatch `start` again, which the engine would ignore).
  - **Done when:** with the dev server running in the background, a Playwright MCP keyboard-only walk-through completes greeting → privacy → question → typed answer → confirm → feedback → closing in EN, switches to ES mid-session without losing progress, shows the Preview label, and logs no console errors. It also presses Esc on the privacy dialog, sees the intro screen with Start, and reaches the question after Start → Accept. Report includes the snapshot excerpts.
  - _Requirements: 11.1, 11.3, 11.4, 4.6, 9.2_ · Skills: `a11y-review`, `ghost-persona`

- [x] 28. Slice end-to-end test with network and axe checks
  - `apps/ghost-interview/e2e/slice.spec.ts` (Chromium), `webServer` with `vite preview`.
  - **Done when:** `pnpm e2e` passes and covers: the keyboard-only flow, typing an answer and submitting it shows the confirmation view with that exact text (catches a keyboard adapter that was never `start()`ed, since `submit()` then returns `ok` but emits nothing), confirmation before feedback, captions and transcript per line, the request allowlist (any foreign origin fails the test), and axe (WCAG 2.2 AA tags) with zero violations on intro, privacy dialog, answering, confirming and feedback screens in EN with default motion.
  - _Requirements: 12.2, 12.3 (phase 1), 12.4_ · Skills: `testing-strategy`, `a11y-review`

- [x] 29. ghost-defense shell
  - `config.ts` (`preview: true`), title, amber accent, idle ghost, "in development" message with a link to `/interview/`, `base: '/defense/'`.
  - **Done when:** a Playwright MCP keyboard walk-through shows the shell, the Preview label, the language switch and the link; axe reports zero violations on the page in EN.
  - _Requirements: 11.2, 11.3, 11.4, 11.5_ · Skills: `a11y-review`, `ghost-persona`

- [x] 30. Landing page and site assembly
  - `site/index.html` (bilingual, no JS) and `scripts/build-site.mjs`.
  - **Done when:** `pnpm build` produces `dist/index.html`, `dist/interview/index.html` and `dist/defense/index.html`; serving `dist/` locally and opening each path with Playwright MCP shows the right page with working asset paths; axe reports zero violations on the landing page.
  - _Requirements: 13.1_ · Skills: `a11y-review`

- [ ] 31. `netlify.toml` and `docs/DEPLOY.md`
  - Config from design §7 and step-by-step setup for the owner (import, `release` as production branch, branch deploys for `main`, the 15-credit import cost).
  - **Done when:** `netlify.toml` matches design §7, and the owner reads `docs/DEPLOY.md` and confirms every step is clear before the import in task 34. The build itself is verified locally by task 30 and on Node 24 in CI by task 32.
  - _Requirements: 13.2_ · Skills: `kiroween-checklist`

- [ ] 32. CI workflow
  - `.github/workflows/ci.yml`: Node 24, pnpm, frozen lockfile, typecheck, lint, test, build.
  - **Done when:** after the owner approves the push, the workflow run on `main` is green (`gh run list --limit 1` shows success).
  - _Requirements: 13.4_

- [ ] 33. README
  - What it is; `packages/` = the skeleton, `apps/` = the two apps; how to run; demo mode; accessibility and privacy summary; Kiro usage pointer; license.
  - **Done when:** the README states the skeleton/apps split in its first screen of text, every command in it runs as written, and the `kiroween-checklist` README items are checked.
  - _Steering `structure.md`_ · Skills: `kiroween-checklist`

- [ ] 34. Day 5 checkpoint: public branch-deploy URL
  - Owner imports the repo into Netlify following `DEPLOY.md` (the pre-approved production deploy) and enables branch deploys for `main`.
  - **Done when:** the `main` branch-deploy URL opens in Playwright MCP, the full slice works by keyboard at `/interview/`, `/defense/` and `/` load, no request leaves the site's origin, and the URL is recorded in `docs/KIRO_USAGE.md` and the README.
  - _Requirements: 13.3_ · Skills: `kiroween-checklist`

## Phase 2: after the slice (same spec)
- [ ] 35. Expressions `attentive`, `amused`, `surprised`
  - Types, SVG brow and eye shapes, labels; listening uses `attentive`.
  - **Done when:** the Ghost component tests cover all 7 expressions and the mapping test uses `attentive` for answering and confirming.
  - _Requirements: 3.2, 3.4_ · Skills: `ghost-svg-animation`, `a11y-review`

- [ ] 36. Mouth shapes `E`, `U`, `FV`
  - Types, SVG paths, timeline rules `e, i` → `E`, `u` → `U`, `f, v` → `FV`.
  - **Done when:** P5 and P6 still pass and example tests show the new visemes for "fue", "mi", "voz".
  - _Requirements: 3.2, 4.3_ · Skills: `ghost-svg-animation`

- [ ] 37. Floating and the motion toggle
  - `float` in `GhostPose`, wrapper `<div>` transform, "Pause motion" button in the header.
  - **Done when:** P7 covers `float === 0` under reduced motion; a component test shows the toggle sets `aria-pressed` and stops both floating and blinking; a Playwright MCP check confirms the toggle is reachable by keyboard.
  - _Requirements: 3.6, 3.7, 3.10_ · Skills: `ghost-svg-animation`, `a11y-review`

- [ ] 38. Full axe matrix
  - **Done when:** `pnpm e2e` runs axe with zero violations on every slice screen and the ghost-defense shell in EN and ES, each with `reducedMotion` `reduce` and `no-preference`.
  - _Requirements: 12.3_ · Skills: `testing-strategy`, `a11y-review`
