---
inclusion: always
---

# Tech

Decisions and trade-offs: `docs/ARCHITECTURE.md` (final).

## Stack
- **TypeScript** everywhere (`strict: true`). No `any` in kit public APIs.
- pnpm workspaces monorepo; Vite + React 19 for `packages/ui` and the apps.
- Vitest + fast-check (unit and property tests); Testing Library for components; Playwright Test + `@axe-core/playwright` for e2e and automated accessibility checks.
- Web Speech API for speech synthesis and recognition, feature-detected, with fallback to text.
- Camera: `getUserMedia` self-view (tier 1). MediaPipe Tasks only for stretch goals, lazy-loaded, models from a CDN.
- Ghost: hand-authored SVG, CSS transforms, one `requestAnimationFrame` loop, text-driven lip-sync timeline.
- State machines: hand-written reducers with effects as data. No XState.
- i18n via typed message catalogs (`en`, `es`); the `es` catalog must have the same keys as `en` (checked by the compiler).
- Documents (ghost-defense): `pdfjs-dist`, `mammoth`, plain text and Markdown, lazy-loaded, parsed locally.

## LLM
- All access goes through the `LLMProvider` interface. Chain: `BYOK (optional) → Netlify proxy → DemoProvider`, with automatic fallback to demo mode.
- `DemoProvider` is the default, needs no key, and is deterministic.
- Gemini and Groq are called with `fetch` (no SDKs). Model names live in config.
- The proxy accepts only the fixed tasks `generate-questions`, `evaluate-answer`, `follow-up`; prompts are built server-side. Details: `netlify-proxy-safety` skill.
- API keys never live in source code, logs or the client bundle. Never prefix a secret with `VITE_`.

## Hosting and deploys
- One Netlify site (Free plan) serves `/`, `/interview/` and `/defense/`, plus `netlify/functions/llm.mts`.
- Free plan: 300 credits/month with a hard limit, 15 credits per production deploy. A pause at the limit is possible, so we plan for it.
- **Production branch is `release`.** Iterate on `main` with branch deploys and deploy previews (not metered). **Every production deploy needs the owner's explicit approval.** Budget: at most 10 per month.
- Large assets and camera models come from CDNs, not Netlify bandwidth.
- A GitHub Pages mirror (demo + BYOK, no proxy) is published by GitHub Actions as a backup.

## Coding rules
- Small, pure, testable modules. Side effects (mic, camera, network, timers) sit behind interfaces so tests can fake them.
- Feature-detect browser APIs; never assume Chrome. A missing API disables that input method; it never breaks the app.
- Lazy-load heavy modules (camera, ML models, PDF parsing).
- Keep dependencies few and well known. Ask before adding a new runtime dependency.

## Kiro usage (credit efficiency)
- Keep steering short; put deep guidance in skills that load on demand.
- Hooks: few, narrow matchers; prefer manual or `PostTaskExec` triggers over per-save or per-tool triggers.
- **Context7**: use it only for fast-changing libraries: MediaPipe, Netlify Functions, fast-check, pdf.js (`pdfjs-dist`), React 19. At most 2 lookups per question. For everything else, rely on the codebase and existing knowledge.
- Install powers or MCP servers only after the owner approves them. ScoutQA: not used. Netlify power: planned around Nov 24.
- Log notable Kiro usage in `docs/KIRO_USAGE.md`.
