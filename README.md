# Ghost Examiner

A reusable kit for "face to face" practice conversations with an animated ghost examiner, plus two apps built from it. Built for Kiroween 2026, category **Skeleton Crew**.

## The skeleton and the two apps

| Part | Folder | What it is |
|---|---|---|
| **The skeleton (the kit)** | [`packages/`](packages/) | Reusable code. Both apps are built only from it. |
| ↳ core | [`packages/core`](packages/core) | Pure TypeScript, no React, no DOM: question engine, input adapters, speech timeline, ghost pose, i18n, LLM provider interface with a demo provider. |
| ↳ web | [`packages/web`](packages/web) | Browser runtime, no React: session runtime, muted speech output, clock, browser language. |
| ↳ ui | [`packages/ui`](packages/ui) | React components: app shell, ghost SVG and animation, captions, transcript, privacy notice, answer input, confirmation, feedback panel. |
| **App 1** | [`apps/ghost-interview`](apps/ghost-interview) | Job-interview practice. The ghost asks a question, you answer, confirm how it was understood, and get practice feedback. |
| **App 2** | [`apps/ghost-defense`](apps/ghost-defense) | Defense of a document you upload. **Work in progress: only the shell exists today.** |

The apps differ only in configuration, content and screens. Dependency direction: `apps → ui → web → core`, enforced by each package's TypeScript settings.

**Live site:** _coming with the Day 5 checkpoint (task 34)._

## Status: Preview

What works today, in English and Spanish:

- Ghost Interview runs one practice question end to end: greeting, privacy notice, the question, a typed answer, a confirmation step, demo feedback, and a closing line.
- The ghost is a hand-drawn SVG with 4 expressions and 4 mouth shapes, lip-synced to live captions. All ghost speech is **muted** for now: captions and mouth only.
- Input is **keyboard only** for now. Voice and Morse code are planned, and each question will then be answerable in at least two ways.
- Ghost Defense shows its shell and a link to Ghost Interview. The document defense is not built yet.

## Run it locally

You need Node.js 24 or newer and pnpm 12 (the version is pinned in `package.json`). If you do not have pnpm, `npm install -g pnpm` installs it. With Node.js 24 you can also run `corepack enable`.

```sh
pnpm install                          # install everything
pnpm --filter ghost-interview dev     # Ghost Interview at http://localhost:5173/interview/
pnpm --filter ghost-defense dev       # Ghost Defense at http://localhost:5173/defense/
pnpm build                            # build the whole site into dist/
```

Run one dev server at a time, or the second one moves to port 5174.

Checks (all single-shot, no watch mode):

```sh
pnpm typecheck                        # TypeScript in every package and app
pnpm lint                             # ESLint
pnpm test                             # unit and property-based tests (Vitest + fast-check)
pnpm exec playwright install chromium # once, before the first e2e run
pnpm e2e                              # end-to-end test of the slice, with axe and a network guard
```

## Demo mode

Everything runs in demo mode, with no API key and no account:

- The feedback comes from a **keyword-based demo evaluator** that runs in your browser. It checks whether your answer mentions the question's key points. It does not read or understand your answer like a person or an AI model would, and the app says so next to the feedback.
- The question and the sample answers are fictional.
- Real AI providers come later. They will be optional, named before use, and fall back to demo mode.

## Accessibility and privacy

- Target: WCAG 2.2 AA. Every screen works by keyboard alone, with a visible focus ring.
- Every ghost line has live captions, and finished lines stay in a transcript that screen readers hear once.
- The ghost respects `prefers-reduced-motion` (no blinking), and nothing flashes.
- Before any answer is evaluated, you see how it was understood and can confirm, edit or answer again. There is no time limit.
- The app follows your browser language (English or Spanish) and can switch at any time without losing progress.
- **Privacy:** demo mode processes everything in your browser. Answers are not sent to any server and are gone when you close the page. Do not enter personal or sensitive data. The end-to-end test fails if the app makes any request to another origin.
- Automated checks: axe (WCAG 2.2 AA tags) runs in the end-to-end test.

## How it was built with Kiro

The project is built with Kiro using spec-driven development:

- **Steering** in [`.kiro/steering/`](.kiro/steering/): product, structure, tech, workflow and accessibility rules.
- **Spec** in [`.kiro/specs/kit-skeleton-ghost/`](.kiro/specs/kit-skeleton-ghost/): requirements, design and tasks for the kit and the slice.
- **Skills** in [`.kiro/skills/`](.kiro/skills/): accessibility review, ghost persona, ghost animation, testing, prompt-injection defense and more.
- **Hooks** in [`.kiro/hooks/`](.kiro/hooks/), **MCP** (Playwright, for keyboard-only browser checks) and **property-based tests** with fast-check.

The full log, with what worked and what we learned, is in [`docs/KIRO_USAGE.md`](docs/KIRO_USAGE.md). Architecture decisions are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Deployment steps are in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## License

[MIT](LICENSE) © 2026 Jhojan Daniel Rivera Fuentes. The ghost is original artwork made for this project.
