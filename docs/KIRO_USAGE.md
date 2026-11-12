# How we use Kiro

A running log of how Ghost Examiner is built with Kiro: steering, specs, skills, MCP, powers, hooks and property-based testing. Newest entries go at the bottom of each section. The judges' write-up is distilled from this file.

## Timeline
| Date | What | Kiro feature |
|---|---|---|
| 2026-11-10 | Project rules captured as always-included steering | Steering |
| 2026-11-10 | Architecture proposal with trade-offs (`docs/ARCHITECTURE.md`), researched with web search (Netlify credits, rate limiting, provider data terms) | Vibe session, web search |
| 2026-11-10 | Reviewed 5 community skills before importing; imported none, folded useful ideas into our own skills | Skills |
| 2026-11-10 | Created 8 project skills in `.kiro/skills/` | Skills |
| 2026-11-10 | Playwright MCP chosen for in-browser verification | MCP |
| 2026-11-10 | Definition of done added to steering (`workflow.md`) | Steering |
| 2026-11-10 | Architecture approved and marked final; kit moved to `packages/`; schedule rebuilt backwards from the Dec 1 freeze with a Day 5 vertical slice; signs and camera tier 2 made stretch goals | Steering, docs |
| 2026-11-10 | Camera ethics rule added (no emotion inference, no camera data in feedback); Context7 usage limited by steering | Steering |
| 2026-11-10 | Spec (a) requirements drafted | Specs |
| 2026-11-11 | `lean-code` skill written (own words, no import); `workflow.md` gains traceability and small-task rules | Skills, steering |
| 2026-11-11 | Steering slimmed: hosting details moved to `deploy-hosting.md` (`inclusion: fileMatch` on deploy files), LLM details to the `netlify-proxy-safety` skill, ghost details to `ghost-persona`; hard rules kept always-included | Steering (fileMatch) |
| 2026-11-11 | Owner-approved Preview exception to the 2-input rule recorded in steering and spec (a) requirements | Steering, specs |
| 2026-11-11 | Spec (a) design written | Specs |
| 2026-11-11 | Design approved with edits: no floating or motion toggle in phase 1; Devpost thumbnail palette, with contrast computed for every token pair (orange parts get a dark outline) | Specs |
| 2026-11-11 | Playwright MCP connected and smoke-tested; Context7 found not installed | MCP, powers |
| 2026-11-11 | Spec (a) tasks written (38 tasks, each with a "Done when" criterion) and approved; phase 2 scheduled for Nov 16 morning | Specs |
| 2026-11-11 | Context7 installed by the owner; one test lookup (fast-check `fc.assert` / `fc.property`) | Powers |
| 2026-11-11 | Task 2: pnpm 12.18.0 installed globally (owner-approved); workspace created; TypeScript pinned to 6.0.3 | Specs (task execution) |
| 2026-11-11 | Task 3: Vitest 5.1.0 (projects core/node, web/jsdom, ui/jsdom), ESLint 10.14.0 + typescript-eslint 8.72.2 + react-hooks 7.1.1, fast-check 4.10.2, jsdom 31.0.0, vite 8.3.7. Verified with temporary probes: environments are right, fast-check runs, lint catches `any`, unused vars and a conditional hook; probes deleted. `morse-input-pbt` skill updated for fast-check 4.10.2 | Specs, skills |
| 2026-11-11 | pnpm 12's supply-chain policy (minimum release age) flagged vite 8.3.8, published 17 hours earlier, and auto-added an exception to `pnpm-workspace.yaml`. We removed the exception and pinned vite 8.3.7 instead (2 days old, passes the policy) | Supply-chain hygiene |
| 2026-11-11 | Found: 5 skill files (`ghost-svg-animation`, `kiroween-checklist`, `netlify-proxy-safety`, `prompt-injection-defense`, `testing-strategy`) had invalid YAML frontmatter because their descriptions contained an unquoted `: `, so Kiro didn't load them | Skills |
| 2026-11-11 | Fixed by quoting each description (no wording change, checked by comparing parsed text with the previous commit). All 9 skills parse with a YAML parser; all 5 fixed skills now activate through `disclose_context` (they failed before) | Skills |
| 2026-11-11 | First hook created: "Core checks on save" (command action, no credits) | Hooks |
| 2026-11-11 | Task 4: package boundaries proven with temporary probes (deleted). Core: `react` import → TS2307, `window` → TS2304, JSX → TS17004; web: `react` import → TS2307 while `document` compiles; core tests see no `window`; a deep import past `exports` → TS2307 (tested in a throwaway folder outside the repo). The `window` error is the one this task adds; the others already held because `react` isn't installed and `jsx` is unset | Specs (task execution) |
| 2026-11-11 | Lesson: always quote skill `description` values in YAML frontmatter; validate with a parser after writing a skill | Skills |
| 2026-11-11 | Task 5: i18n in core (`Locale`, `defineCatalog`, `format`, `pickLocale`), test written first and seen failing. Catalog key checks are compile-time tests: `@ts-expect-error` lines that `pnpm typecheck` verifies (an unused directive is an error). A temporary probe showed the raw errors (TS2345 missing key, TS2353 extra key) and that importing `vitest` in core still leaves `window` undefined (TS2304). Known limit: an extra `es` key is caught only when `es` is an inline object literal | Specs (task execution) |
| 2026-11-11 | Owner decision on that limit: keep the `defineCatalog` signature; `structure.md` gains a convention that catalogs are written inline in the `defineCatalog` call, so extra-key errors are always caught | Steering |
| 2026-11-11 | Task 6: `InputAdapter` types and `createKeyboardAdapter()` in core, test written first and seen failing. Types trimmed from ARCHITECTURE.md §3.1 to what spec (a) uses (only the `candidate` event; no `confidence`, `alternatives`, `trace`); later specs add them with the adapters that produce them | Specs (task execution) |
| 2026-11-11 | Owner request: task 28's e2e criteria now include "typing and submitting shows the confirmation view with that exact text", so a keyboard adapter that was never `start()`ed is caught (`submit()` stays as is) | Specs |
| 2026-11-11 | Task 7: engine types, `initialState` and `reduce` in core, test written first and seen failing; one example test per row of the design §3.3 transition table, plus a `@ts-expect-error` test (probe confirmed the raw error: TS2322, `[confirmedBrand]` missing). Deviations from the design listed in the task report: `LineRef` shape, `Feedback` location, state field choices | Specs (task execution) |
| 2026-11-11 | Owner decisions on the gaps found in task 7, recorded in the spec: empty pack → `validatePack` error (task 9) and non-empty packs in task 8 generators; language switch during `evaluating` → known gap for spec (e) (design §8); Esc on the privacy dialog → back to the intro screen (tasks 21 and 27) | Specs |
| 2026-11-11 | Task 8: engine property tests P1, P2, P3 (fast-check, 100 runs each), with coverage counters and two mutation checks; details under "Property-based testing" | Property-based testing |
| 2026-11-11 | Task 9: `validatePack` with unit tests and property P4, test written first. `PackIssue` became a union with a `kind` field: `too-few-inputs` (per question) and `no-questions` (always an error, even in Preview); design §3.4 updated | Specs (task execution), property-based testing |
| 2026-11-11 | Task 10: `buildTimeline` (pure, no clock) with example tests and properties P5, P6, using the `ghost-svg-animation` skill. Where the skill (final version: `rate`, 7 visemes, `SpeechCue[]`) differs from spec (a)'s phase 1 design, the design was followed | Specs (task execution), skills, property-based testing |
| 2026-11-11 | `ghost-svg-animation` skill gains a version note: spec (a) phase 1 follows its design (`Timeline` shape, 4 visemes, 4 expressions, no float); the skill describes the later version | Skills |
| 2026-11-11 | Task 11: `ghostPose` (pure, `now` passed in, no float, seeded blink hash) with example tests and properties P7, P8; a dedicated test shows reduced motion removes blinking and changes nothing else | Specs (task execution), property-based testing |
| 2026-11-11 | Task 12: LLM types, `withFallback` and a strict `isFeedback` guard for untrusted model output, using the `netlify-proxy-safety` and `prompt-injection-defense` skills. The guard accepts only a plain object with exactly the five own keys, non-blank text up to 500 characters, and known `reaction`/`locale` values. 9 deliberate mutations, all caught. Finding: the unknown-key check only mattered when combined with a polluted `Object.prototype`, so that case got its own test | Specs (task execution), skills |
| 2026-11-11 | Design §8 gains the spec (e) note from task 12: BYOK providers in the browser must validate with `isFeedback` and return `bad-output`, so the chain falls back to demo | Specs |
| 2026-11-11 | Task 13: deterministic demo provider, `createLlmEvaluator` and the EN/ES feedback copy in the kit catalog (`kit-messages.ts`), written with the `ghost-persona` skill ("tú", gender-neutral, no joke after a weak answer). Example tests, property P9, 9 mutation checks | Specs (task execution), skills, property-based testing |
| 2026-11-11 | Owner copy review of task 13: the no-match strength now claims nothing the demo can't check ("Thank you for taking the time to answer." / "Gracias por tomarte el tiempo de responder."); task 27 gains a rule that the UI labels demo feedback as a keyword-based demo evaluation | Specs |
| 2026-11-11 | Task 14: first `packages/web` code. `Clock` interface in core (ARCHITECTURE.md §1), `systemClock` (`performance.now()`), `browserLocale()`, `SpeechOutput` and `createSilentOutput`; web now depends on core through `workspace:*`. Tested in jsdom with Vitest fake timers; 5 deliberate mutations, all caught | Specs (task execution) |
| 2026-11-11 | Owner copy fix: the no-match strength became "You took the time to answer." / "Te tomaste el tiempo de responder." to avoid a double "Thank you" / "Gracias" next to the summary. A new test checks every summary + strength + improvement combination in EN and ES for a repeated first word; it fails on the old copy | Specs |
| 2026-11-11 | Task 15: `createSession` in `packages/web` (design §4.1), tested with a hand-finished fake speech output and a fake evaluator. The runtime also starts and stops the input adapters (the design didn't say who calls `start()`), so a typed answer reaches the engine; the integration test submits through the real keyboard adapter. 6 deliberate mutations, all caught | Specs (task execution) |
| 2026-11-11 | Task 16: first UI task (tokens, `AppShell`), using the `a11y-review` and `ghost-persona` skills. Dependencies pinned to exact versions and old enough for pnpm 12's release-age policy, so no exception was needed (`pnpm-workspace.yaml` unchanged): react and react-dom 19.3.1; dev: @types/react and @types/react-dom 19.3.0, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @playwright/test 1.65.0, @axe-core/playwright 4.14.0 (axe-core 4.14.0). `@vitejs/plugin-react` not added: Vite 8 compiles JSX from `jsx: "react-jsx"` alone | Specs (task execution), skills, supply-chain hygiene |
| 2026-11-11 | Task 16 browser check with Playwright MCP on a temporary harness page (deleted before the commit): keyboard walk-through (Tab → skip link visible with a focus ring, Enter → focus on `<main>`, Shift+Tab → privacy button), axe 4.14.0 with WCAG 2.2 AA tags injected through `browser_run_code_unsafe` (`page.addScriptTag`), 8 runs (EN/ES × reduced motion on/off × Preview on/off): 0 violations; reflow at 320 px, 200% text and text spacing; screenshots in `.playwright-mcp/` (git-ignored) | MCP |
| 2026-11-11 | Owner decision to save credits: small UI tasks (like task 17) rely on component tests; the full Playwright MCP and axe check is kept for the larger UI tasks (18 ghost, 21 screens, 24 feedback panel) | Workflow, credit efficiency |
| 2026-11-11 | Task 17: `LanguageSwitch` (two native toggle buttons with `aria-pressed`, each label in its own `lang`, in a labeled group), using the `a11y-review` skill. Component tests only, per the owner decision above; 4 deliberate mutations, all caught | Specs (task execution) |
| 2026-11-11 | Lesson from task 17 (a commit ran in the same batch as a mutation script; checked afterwards, no mutation was committed): `workflow.md` now says to restore and diff each file after mutation checks, and to run `git commit` as its own step | Steering |
| 2026-11-11 | Task 18: hand-drawn Ghost SVG (glasses, bow tie, clipboard; 4 expressions, 4 mouth shapes, no smile), using the `ghost-svg-animation` and `a11y-review` skills. Playwright MCP: element screenshots of every expression and mouth shape at 2x size, reviewed by the agent; the first draft's "approving" was too close to "neutral" and its open mouth read a little like a grin, so both were redrawn before the owner saw them. Keyboard walk-through of the language switch (Tab, Enter, Shift+Tab, Space) with `<html lang>` and the ghost's label checked at each step. axe 4.14.0, 32 runs (EN/ES × reduced motion on/off × 4 expressions × 2 mouths): 0 violations, 0 incomplete. 5 deliberate mutations, all caught; one `sed` mutation silently failed to apply and was redone with `perl` | Specs (task execution), MCP |
| 2026-11-11 | Owner review of task 18: "approving" was too close to "neutral" at real size. Brows raised further and eyes opened wider (mouth unchanged); measured at 150 px wide: brows 11.2 px higher than neutral, eyes 14 px tall instead of 10. Comparison screenshot at app size; axe 0 violations in EN/ES × reduced motion on/off | Specs |
| 2026-11-11 | Task 19: `useGhostPose` (one `requestAnimationFrame` loop, writes blink and the visible mouth through a ref, reads `prefers-reduced-motion` and follows its changes). Tested with a hand-stepped rAF, a fake `matchMedia` and a React `Profiler` that counts renders. 6 deliberate mutations; "the loop restarts on every render" first survived (the test only counted pending frames), so the test now also checks the same frame id stays pending and no new media query is made | Specs (task execution) |
| 2026-11-11 | Task 20: `Captions` (full line at once, current word underlined and bold through a ref and its own requestAnimationFrame loop, `aria-hidden`, bold width reserved so the line never re-wraps) and `Transcript` (non-live list plus one visually hidden polite live region holding only the newest line, keyed by line id). Owner focus: a finished line is announced once, not twice. 8 deliberate mutations, all caught, including both double-announcement paths (a live list; a live region that accumulates lines). Not verified: real screen-reader output; jsdom and Playwright check the DOM, not what VoiceOver or NVDA say | Specs (task execution) |
| 2026-11-11 | Task 21: `PrivacyDialog` (native `<dialog>` with `showModal()`, consent and read-only modes, honest EN/ES text), using `a11y-review` and `ghost-persona`. jsdom 31 has no `showModal()`, so component tests use a small stand-in and the real modal behavior is checked in Chromium | Specs (task execution) |
| 2026-11-11 | Task 21 browser check found two real bugs the component tests could not: (1) Chromium fires `close` a moment after Esc, so pressing Enter right away to reopen the dialog was dismissed again by that late event; fixed by cancelling the browser's own close on Esc and letting the parent close it; (2) at 320 px the dialog was 14 px wider than the screen (`width` without `box-sizing: border-box`). Both got regression tests or checks; 10 keyboard rounds (EN/ES × 5) then passed. Also verified the useGhostPose blink and mouth in the real browser (the task 27 note) | MCP |
| 2026-11-11 | Steering `accessibility-ethics.md`: since the privacy notice says answers are gone when the page closes, no browser storage of answers, drafts, transcripts or feedback without first changing that text in EN and ES | Steering |
| 2026-11-11 | Slip: that steering commit ran in the same batch as the file edits, against the new `workflow.md` rule. Checked right after: the commit holds exactly the two intended lines and nothing was left out | Steering |
| 2026-11-11 | Task 22: `KeyboardInput` (labeled textarea, paste allowed, Ctrl/Cmd+Enter and a submit button, inline empty-answer error linked by `aria-describedby`, announced politely, focus kept in the field, `draft` prefill), using `a11y-review`; tested with the real keyboard adapter's `submit`. Component tests only (owner decision for small UI tasks). 9 deliberate mutations, all caught. Shared `.ge-button` styles moved from `PrivacyDialog.css` to `tokens.css` | Specs (task execution) |
| 2026-11-11 | Task 23: `ConfirmAnswer` (labeled region, heading focused once on mount, the answer exactly as interpreted with line breaks kept, input method label, Confirm / Edit / Answer again), using `a11y-review` and `ghost-persona`. Labels for all four input methods; gestures marked experimental and never called sign language. Component tests only; 6 deliberate mutations, all caught | Specs (task execution) |
| 2026-11-11 | Task 24: `FeedbackPanel` ("Practice feedback" heading focused once, strength and improvement in the feedback's own `lang`, visible keyword-based demo label only when the provider is a demo, Continue), using `a11y-review` and `ghost-persona`. Browser check with Playwright MCP on a temporary harness fed by the real demo provider and evaluator: keyboard walk-through in EN and ES (Tab, Enter, Space, Shift+Tab, language switch), axe 8 runs (EN/ES × reduced motion on/off × demo/not demo) with 0 violations, screenshots at 1200 and 320 px. 6 deliberate mutations, all caught. Task 27 gains a focus note for the language switch during feedback | Specs (task execution), MCP |
| 2026-11-11 | Task 25: `useSession` (`useSyncExternalStore` over the runtime handle; structural `SessionStore` type so ui still does not depend on web). Tested with a hand-driven fake handle and a React `Profiler`; 3 deliberate mutations, all caught | Specs (task execution) |
| 2026-11-11 | Task 26: `ghostState` (session view + playback → `GhostState`, rows of design §5.2 checked in table order; only a playing line carries its timeline). One test per table row. Of 6 mutations, 5 were caught; the 6th (dropping a phase guard on the feedback reaction) was equivalent because the engine stores feedback only in the feedback phase, so the guard was removed as code no test could distinguish | Specs (task execution) |
| 2026-11-11 | Task 27: ghost-interview slice wired in five commits (runtime change, scaffold and config, pack and messages, App wiring, walk-through fixes). Owner decision implemented: submitting during the question stops the ghost. The runtime now also keeps the transcript (lines that finished, were replaced or were cancelled) | Specs (task execution) |
| 2026-11-11 | Task 27 browser walk-through with Playwright MCP, keyboard only, scripted (`.playwright-mcp/task27-walk.js`, git-ignored): EN (with a switch to ES during feedback) and ES runs, 15 axe runs with 0 violations, screenshots of every phase, mouth and captions measured frame by frame with the real `SilentOutput` timing. Real bug found: after switching the language during feedback, an English answer was re-evaluated with Spanish cues only, so the result changed (approving → skeptical) on a language switch. Fix: the evaluator sends cues from both languages; new property test "a language switch never changes the judgement" | MCP, property-based testing |
| 2026-11-11 | `kiroween-checklist` skill: the demo video and Devpost text must present the keyword-based demo evaluator as a demo, never as understanding | Skills |
| 2026-11-11 | Task 28: `pnpm e2e` (Playwright Test 1.65.0 + @axe-core/playwright 4.14.0, Chromium only; the Chromium build was already in the Playwright cache, no download). It builds the app, serves it with `vite preview`, and runs the keyboard-only slice: confirmation with the exact typed text before feedback, captions and transcript for all four lines, the demo label, axe WCAG 2.2 AA on intro, privacy dialog, answering, confirming and feedback (0 violations). A network guard blocks and records every request to another origin, with a self-check test that it catches one. About 13 s per run (17 s on the first, cold run); 3 runs in a row, no flakes. 5 deliberate mutations of the app, all caught (foreign request, no confirmation view, adapter never started, low-contrast text, transcript not updated) | Specs (task execution), testing |
| 2026-11-12 | Task 29: ghost-defense shell (same kit shell and idle ghost, amber accent, "still in development" panel with a relative link to the interview app, read-only privacy notice). The kit's Preview explanation ("Keyboard only for now…") would be false here, so `AppShell` gained an optional `previewNote` and the shell says "Work in progress: there is nothing to answer here yet." Playwright MCP keyboard walk-through (skip link, language switch, privacy dialog, link) and axe in EN and ES × reduced motion on/off: 0 violations, 0 incomplete | Specs (task execution), MCP |
| 2026-11-12 | Task 30: bilingual landing page (`site/index.html`, no JavaScript, relative links) and `scripts/build-site.mjs`; root `pnpm build` builds both apps and assembles `dist/` (/, /interview/, /defense/) in under a second. Served `dist/` with `vite preview` and checked it with Playwright MCP: every page loads its own assets from its sub-path, no HTTP errors, no foreign requests, no console errors; keyboard links work landing → interview and defense → interview; axe on the landing page 0 violations (default and reduced motion, 1200 and 320 px) | Specs (task execution), MCP |
| 2026-11-12 | Task 31: `netlify.toml` (design §7) and `docs/DEPLOY.md`, written for a non-expert with a Spanish summary on top. Checked against current Netlify docs with web search: button and menu names, branch-deploy settings path, credit rules (failed deploys cost 0 credits), and two surprises now in the guide: `release` was still at the first commit, and new Netlify projects start private, so production and previews must be made public | Web search, specs |
| 2026-11-12 | Task 33: README (skeleton vs apps table on the first screen, honest Preview status, run commands, demo mode described as keyword-based, accessibility and privacy, Kiro usage pointers, license), using the `kiroween-checklist` skill. Every command in it was run as written: install, both dev servers, build, typecheck, lint, test, Playwright install, e2e. Live URL left as a placeholder until task 34 | Specs (task execution), skills |
| 2026-11-12 | Task 32: CI workflow written to mirror Netlify's install path (Node 24 + `corepack enable`, pnpm version from `packageManager`, frozen lockfile), then typecheck, lint, tests and the site build. Actions pinned to commit SHAs of their latest releases (looked up with `gh api`). Waiting for the owner's push to check the first run | Specs (task execution) |

## Credit check
- **2026-11-11, after task 27**: credits used so far: _(owner to fill in from the Kiro usage page; the agent cannot read that page)_.

## Revisit later
- **Landing page polish (Nov 25 to 28, owner request after task 30)**: a large ghost, a one-line pitch, two big buttons (Ghost Interview, Ghost Defense) and a language toggle. The page has no JavaScript today, so the toggle needs a no-JS approach (for example two static pages, `/` and `/es/`) or a small script; decide then. Re-run axe and the 320 px check after the change.
- **Caption word spacing (polish day, found in the task 27 walk-through)**: each caption word reserves the width of its bold form, so some gaps look uneven ("difficult  problem"). Look for a marker that keeps underline and bold without the uneven gaps, and keep the "no re-wrap" property.
- **Language of the user's answer (phase 2, owner note after task 23)**: the confirmed answer text in `ConfirmAnswer` has no `lang` attribute, so a screen reader may read it with the wrong voice when the user typed in a different language than the UI. Fix by storing the answer's language with the candidate and setting `lang` on the quoted answer.
- **Ghost polish day (around Nov 28, owner decision after task 18)**: the hands look like floating ovals next to the clipboard, and the body is tall for its width. Redraw both; re-run the Ghost component tests, screenshots of every expression and mouth shape, and axe.
- **TypeScript 7**: pinned to 6.0.3 because typescript-eslint 8.72.2 supports `typescript >=4.8.4 <6.1.0` and TypeScript 7.0.2 (the native compiler) is outside that range. Move to 7 when typescript-eslint's peer range includes it (`npm view typescript-eslint peerDependencies`).
- **pnpm install scripts**: `npm install -g pnpm` skipped pnpm's preinstall/postinstall scripts (npm's new `allowScripts` default). pnpm works without them so far. If pnpm misbehaves, the owner can run `npm install -g --allow-scripts=pnpm pnpm`.

## Steering (`.kiro/steering/`)
All files use `inclusion: always` and are kept short (about 1,600 words total) because they load on every turn. Deep guidance lives in skills, which load on demand.

| File | Purpose |
|---|---|
| `product.md` | What the kit and the two apps are, priorities, out of scope, hackathon constraints |
| `tech.md` | TypeScript, free hosting, `LLMProvider` interface, no keys in the client, Kiro credit-efficiency rules |
| `structure.md` | Repo layout, `/.kiro` tracked, kit in `packages/` (core, web, ui), exactly two apps in `apps/`, framework-agnostic core (no React, no DOM in `packages/core`), dependency direction |
| `accessibility-ethics.md` | Non-negotiables: 2+ input methods, confirmation before evaluation, captions, muted mode, optional local camera, signs labeled experimental, contrast, reduced motion, privacy notice |
| `workflow.md` | Definition of done: use relevant skills, run tests, verify in the browser through Playwright MCP, run axe, report, log here; traceability and small-task rules |
| `deploy-hosting.md` | `inclusion: fileMatch` on `netlify.toml`, `netlify/**`, `.github/workflows/**`, `scripts/**`, `site/**`, `docs/DEPLOY.md`: one Netlify site, `release` production branch, credit facts, Pages mirror |

## Skills (`.kiro/skills/`)
Each skill is a folder with a short `SKILL.md`. Its `description` is written to match only the requests where it matters, so it stays out of context otherwise.

| Skill | Loads when |
|---|---|
| `a11y-review` | Any UI, style, animation or copy change; WCAG 2.2 AA checklist mapped to success criteria and project rules |
| `morse-input-pbt` | Morse encoder/decoder, timing classifier or their tests; fast-check properties and generators |
| `ghost-persona` | Ghost dialogue, questions, feedback, error copy, prompt voice; bilingual phrase bank |
| `kiroween-checklist` | Release, README, demo video, submission |
| `ghost-svg-animation` | Ghost SVG, animation loop, text-driven lip-sync timeline, synced captions |
| `netlify-proxy-safety` | LLM proxy, providers, env vars, BYOK |
| `prompt-injection-defense` | Prompt templates, document parsing, evaluation, rendering model output |
| `testing-strategy` | Writing or running tests, verification before done |
| `lean-code` | Any code, config or test change, and splitting spec tasks; keeps diffs minimal and traceable to requirements |

### Community skill review (2026-11-10)
We read each `SKILL.md` and its license before deciding. Nothing was imported. Useful ideas were rewritten in our own words inside our skills, with credit below.

| Skill | License | Decision | Why |
|---|---|---|---|
| vercel-labs `vercel-react-best-practices` | MIT (stated in SKILL.md and repo README; the repo has no LICENSE file) | Not imported | ~70 rules, mostly Next.js/server-side; 108 KB `AGENTS.md`; would activate on every React task. Kept: lazy-load heavy modules, refs for high-frequency values, animate an SVG wrapper, reduce SVG precision |
| vercel-labs `web-design-guidelines` | No license field; fetched rules repo is MIT | Not imported | Fetches remote instructions on every run (content can change; costs tokens). Some rules conflict with ours (Title Case, which doesn't fit Spanish). Kept: SVG `transform-box`, pause control for motion > 5 s, focus-visible, no blocked paste or zoom |
| vercel-labs `vercel-composition-patterns` | MIT | Not imported (owner decision) | Small and relevant to `packages/ui` API design, but not needed |
| anthropics `frontend-design` | Apache 2.0 | Not imported | Good design-direction and UI-copy guidance; its "take aesthetic risk" push needs our readability rules on top. Kept: errors say what happened and how to fix it, plain-language copy |
| anthropics `webapp-testing` | Apache 2.0 | Not imported | Python Playwright with bundled scripts meant to run unread; duplicates Playwright MCP + Playwright Test. Kept: snapshot first, then act |

## MCP (`.kiro/settings/mcp.json`)
| Server | Use | Status |
|---|---|---|
| Playwright MCP (`npx @playwright/mcp@latest --browser chromium`) | Open the running app, drive it by keyboard, read the accessibility tree, check captions and console errors before a task is marked done | **Connected and tested 2026-11-11.** Config written by the owner (agent writes to `.kiro/settings/` are blocked by a permission rule). Chromium was already in the Playwright cache, so no install was run. |

### Playwright MCP smoke test (2026-11-11)
- `browser_navigate` to `https://example.com`, then `browser_snapshot`: page title "Example Domain", accessibility tree with six paragraphs (the same notice in English, Arabic, Chinese, French, Russian and Spanish) and one link, "Learn more" → `https://iana.org/help/example-domains`. `browser_close` closed the page.
- Side effect: Playwright MCP writes snapshot files to `.playwright-mcp/` in the workspace. That folder goes into `.gitignore` in the first spec (a) task.

## Powers
| Power | Status | Notes |
|---|---|---|
| Context7 | **Installed by the owner 2026-11-11.** Test: `resolve-library-id` ("fast-check") returned `/dubzzz/fast-check` (1,759 snippets, high reputation); one `query-docs` call on `fc.assert` / `fc.property` / `numRuns` / `seed` returned 5 snippets. Approximate cost: ~1,500 tokens to activate the power (one time per session) plus ~1,100 tokens for the two calls. Finding: fast-check v5 handles async predicates in `fc.property` and the docs say to always `await fc.assert` | Steering (`tech.md`) limits it to MediaPipe, Netlify Functions, fast-check, pdf.js and React 19, at most 2 lookups per question |
| Netlify | Not installed; decision Nov 14 to 15 when the slice builds | Alternative: the Netlify CLI (`netlify status`, `netlify deploy` for drafts, `netlify env:set`) does the same work with no context cost. Production deploys always need owner approval |
| ScoutQA, ElevenLabs, SonarQube, Snyk, Figma | Not installed (owner decision) | Any future power is proposed with its context and credit cost first |
| Own skills packaged as a power | Stretch, Nov 28 | Agent Plugins format: `plugin.json` with keywords + `skills/` |

## Manual steps done by the owner
| Date | Step |
|---|---|
| 2026-11-10 | Created the public GitHub repo `jhojanins/Ghost-Examiner`, connected the remote, first commit "Add steering, skills and architecture" (no LICENSE file yet; added in task 1 of spec a) |
| 2026-11-10 | Created `.kiro/settings/mcp.json` with Playwright MCP and `--browser chromium`; installed Chromium |
| 2026-11-11 | Installed the Context7 power from the Powers panel |
| Ongoing | Pushes to GitHub with GitHub Desktop (the agent only makes local commits, one per task) |
| 2026-11-14 to 15 (planned) | Import the repo into Netlify; counts as the one pre-approved production deploy (15 credits) |

## Specs (`.kiro/specs/`)
Main schedule: (a) kit skeleton + animated ghost + Day 5 vertical slice, (b) keyboard + voice + captions, (c) Morse + PBT, (d) camera tier 1, (e) ghost-interview, (f) ghost-defense. Stretch only: camera tier 2, (g) experimental signs.

| Spec | Folder | Status |
|---|---|---|
| (a) Kit skeleton + animated ghost | `kit-skeleton-ghost/` | Requirements approved (13 requirements, EARS, with a Preview flag and two delivery phases); design drafted with 9 correctness properties and a requirement traceability table, awaiting review |

## Hooks (`.kiro/hooks/`)
| Name | File | Trigger | Matcher | Action | Cost |
|---|---|---|---|---|---|
| Core checks on save | `core-checks-on-save.json` | `PostFileSave` | `packages/core/src/.*\.ts$` | `command`: `pnpm --filter @ghost-examiner/core typecheck && pnpm exec vitest run --project core` (60 s timeout) | No Kiro credits: a `command` action runs a shell command and never calls the model, and `PostFileSave` output is not sent to the agent. Local CPU only (~1 s with no tests yet). |

- Created 2026-11-11 with the `createHook` tool, owner-approved. Active from the next session start.
- Not yet verified: whether agent edits trigger it or only the owner's saves; and the "0 credits" claim in the usage panel (owner to check after a few saves).

## Property-based testing
Planned with fast-check: Morse round trip, timing classifier under jitter, scale invariance, question-engine invariants (no evaluation without confirmation), speech timeline ordering. Properties will be logged here as they are written.

| Property | File | What it checks |
|---|---|---|
| P1 | `packages/core/src/engine/reduce.prop.test.ts` | Every `evaluate` effect comes from a `confirm` whose `candidateId` and text match the stored candidate, or from a `locale-changed` that re-evaluates an answer confirmed earlier in the run |
| P2 | same | `line-done`, `feedback-ready` and `locale-changed` never move a state out of `answering` or `confirming` (no timeouts, no auto-advance) |
| P3 | same | `reduce` never throws; an event the transition table doesn't accept returns the same state object and no effects |

How the generator avoids filtering: events are generated as templates (for example "confirm the current candidate", "confirm a stale one", "confirm id 7") and resolved against the live state, so runs reach deep into the flow without `fc.pre`. Lessons:
- fast-check's default `size` keeps arrays near 10 items, too short to reach the feedback phase. P1's coverage counter caught it (0 re-evaluations). `size: 'max'` fixed it.
- Each property also counts the cases it actually checked and fails if the count is 0, so a generator change can't make it pass vacuously.
- Two mutations of `reduce` were caught, each with a shrunk counterexample: accepting a stale `confirm` (caught by P1 and P3) and letting `feedback-ready` leave `confirming` (P2 and P3).

| Property | File | What it checks |
|---|---|---|
| P4 | `packages/core/src/engine/validate-pack.prop.test.ts` | For random non-empty packs and random adapter sets (distinct ids, random supported kinds), `validatePack` reports exactly the questions that fewer than 2 methods support, with `warning` in Preview and `error` otherwise |

P4 counts reported and unreported questions and fails if either is 0 (both sides of the "iff"). Two mutations were caught: threshold `< 1` instead of `< 2`, and severity always `warning`.

| Property | File | What it checks |
|---|---|---|
| P5 | `packages/core/src/speech/timeline.prop.test.ts` | Word cues match the whitespace-split words in order, are ordered and don't overlap; mouth cues start at 0, are contiguous, and the last is `rest` ending at `duration` |
| P6 | same | Appending words never decreases `duration` |
| (extra) | same | `buildTimeline` is deterministic (same text and locale, same timeline) |

Text generators mix word-like tokens (accents, `ñ`, digits, `¿¡,.?!-`) joined by mixed whitespace with arbitrary Unicode strings and graphemes. Two mutations were caught: dropping the closing rest when the line has no final punctuation (P5), and pauses moving the clock backwards (P5 and P6).

| Property | File | What it checks |
|---|---|---|
| P7 | `packages/core/src/ghost/pose.prop.test.ts` | `ghostPose` is deterministic; under reduced motion `blink` is always false and the pose is otherwise identical (expression and mouth kept) |
| P8 | same | Without reduced motion, consecutive blink starts are 3000 to 6000 ms apart (15 s window scanned at 1 ms steps from a random start) |

Three mutations were caught: ignoring `reducedMotion` (P7 and the reduced-motion example test), widening the blink jitter to 3 s (P8), and off-by-one mouth cue boundaries (the viseme example test).

| Property | File | What it checks |
|---|---|---|
| P9 | `packages/core/src/llm/demo.prop.test.ts` | For random questions (up to 5 key points, random cues including blank ones) and random answers (any Unicode, graphemes, lorem text), the demo provider's output always passes `isFeedback`, and two evaluations with fresh providers give identical feedback in the requested locale |

Mutation checks on the demo heuristic and evaluator (9 changes, all caught): "at least half" made strict, short-answer threshold changed, accent stripping removed, blank cues allowed to match, whitespace not collapsed, strength taken from the last match, evaluator locale check removed, and randomness added to the output (P9 plus 3 example tests). A no-op change was run as a control and passed.
