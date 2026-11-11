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

## Steering (`.kiro/steering/`)
All files use `inclusion: always` and are kept short (about 1,600 words total) because they load on every turn. Deep guidance lives in skills, which load on demand.

| File | Purpose |
|---|---|
| `product.md` | What the kit and the two apps are, priorities, out of scope, hackathon constraints |
| `tech.md` | TypeScript, free hosting, `LLMProvider` interface, no keys in the client, Kiro credit-efficiency rules |
| `structure.md` | Repo layout, `/.kiro` tracked, kit in `packages/` (core, web, ui), exactly two apps in `apps/`, framework-agnostic core (no React, no DOM in `packages/core`), dependency direction |
| `accessibility-ethics.md` | Non-negotiables: 2+ input methods, confirmation before evaluation, captions, muted mode, optional local camera, signs labeled experimental, contrast, reduced motion, privacy notice |
| `workflow.md` | Definition of done: use relevant skills, run tests, verify in the browser through Playwright MCP, run axe, report, log here |

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
| Playwright MCP (`npx @playwright/mcp@latest --browser chromium`) | Open the running app, drive it by keyboard, read the accessibility tree, check captions and console errors before a task is marked done | To be created by the owner (agent writes to `.kiro/settings/` are blocked by a permission rule); as of 2026-11-10 the file was not found in the workspace |

## Powers
| Power | Status | Notes |
|---|---|---|
| Context7 | Installed by the owner | Steering (`tech.md`) limits it to MediaPipe, Netlify Functions, fast-check, pdf.js and React 19, at most 2 lookups per question |
| Netlify | Planned around Nov 24 | Site setup, env vars, deploy status. Production deploys always need owner approval |
| ScoutQA | Not used | Overlaps Playwright MCP + axe; its instructions trigger proactive parallel runs (credit cost); external account and quota |

## Specs (`.kiro/specs/`)
Main schedule: (a) kit skeleton + animated ghost + Day 5 vertical slice, (b) keyboard + voice + captions, (c) Morse + PBT, (d) camera tier 1, (e) ghost-interview, (f) ghost-defense. Stretch only: camera tier 2, (g) experimental signs.

| Spec | Folder | Status |
|---|---|---|
| (a) Kit skeleton + animated ghost | `kit-skeleton-ghost/` | Requirements drafted (13 requirements, EARS acceptance criteria), awaiting review |

## Hooks
None yet. Proposed in step 4, with low-cost triggers only.

## Property-based testing
Planned with fast-check: Morse round trip, timing classifier under jitter, scale invariance, question-engine invariants (no evaluation without confirmation), speech timeline ordering. Properties will be logged here as they are written.
