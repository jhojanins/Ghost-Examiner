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

## Revisit later
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
