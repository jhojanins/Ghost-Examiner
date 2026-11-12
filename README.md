# Ghost Examiner

A reusable kit for "face to face" practice conversations with an animated ghost examiner, plus two apps built from it. Built for Kiroween 2026, category **Skeleton Crew**.

## The skeleton and the two apps

| Part | Folder | What it is |
|---|---|---|
| **The skeleton (the kit)** | [`packages/`](packages/) | Reusable code. Both apps are built only from it. |
| ↳ core | [`packages/core`](packages/core) | Pure TypeScript, no React, no DOM: question engine, input adapters, speech timeline, ghost pose, i18n, LLM provider interface with a demo provider. |
| ↳ web | [`packages/web`](packages/web) | Browser runtime, no React: session runtime, the ghost's voice (speech synthesis, voices installed on the device only), voice input (speech recognition), clock, browser language. |
| ↳ ui | [`packages/ui`](packages/ui) | React components: app shell, ghost SVG and animation, captions, transcript, privacy notice, typed and voice answer input, ghost voice toggle, confirmation, feedback panel. |
| **App 1** | [`apps/ghost-interview`](apps/ghost-interview) | Job-interview practice. The ghost asks a question, you answer by typing or speaking, confirm how it was understood, and get practice feedback. |
| **App 2** | [`apps/ghost-defense`](apps/ghost-defense) | Defense of a document you upload. **Work in progress: only the shell exists today.** |

The apps differ only in configuration, content and screens. Dependency direction: `apps → ui → web → core`, enforced by each package's TypeScript settings.

**Live site:** _coming with the Day 5 checkpoint (task 34)._

## Status

What works today, in English and Spanish:

- Ghost Interview runs one practice question end to end: greeting, privacy notice, the question, a typed or spoken answer, a confirmation step, demo feedback, and a closing line.
- The ghost is a hand-drawn SVG with 4 expressions and 4 mouth shapes, lip-synced to live captions.
- **The ghost's voice:** after you accept the privacy notice, the ghost reads its lines aloud with a voice installed on your device. The "Ghost voice" button turns it off. Captions and the mouth always run, so the ghost also works fully muted. If the browser has no speech synthesis, or no installed voice for the current language, the ghost stays muted and the button says why.
- **Voice answers:** in browsers that support the Web Speech API's `SpeechRecognition` (for example Chrome and Safari), "Start speaking" listens and shows your words as you speak. When you stop, the words go to the confirmation step like a typed answer. Typing always works too.
  - Brave, and some other browsers, have the API but block it. The voice button then says voice input isn't available and you type instead.
  - Firefox has no `SpeechRecognition`. The session runs as a **Preview** with typing only, and the header says why.
- Ghost Defense shows its shell and a link to Ghost Interview. The document defense is not built yet.

Still pending:

- Voice input is tested only with a simulated speech recognizer in the automated tests. It has not been checked with a real microphone yet; that check, in Chrome and Safari, comes next.
- Morse code input, Ghost Defense, and optional real AI providers.
- Hands-free answering and interrupting the ghost by speaking are planned, and may be cut for time.

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
pnpm e2e                              # end-to-end tests (fake speech APIs), with axe and a network guard
```

## Demo mode

Everything runs in demo mode, with no API key and no account:

- The feedback comes from a **keyword-based demo evaluator** that runs in your browser. It checks whether your answer mentions the question's key points. It does not read or understand your answer like a person or an AI model would, and the app says so next to the feedback.
- The question and the sample answers are fictional.
- Real AI providers come later. They will be optional, named before use, and fall back to demo mode.

## Accessibility and privacy

- Target: WCAG 2.2 AA. Every screen works by keyboard alone, with a visible focus ring.
- Every ghost line has live captions, and finished lines stay in a transcript that screen readers hear once (lines spoken aloud are not repeated).
- The ghost respects `prefers-reduced-motion` (no blinking), and nothing flashes.
- Before any answer is evaluated, you see how it was understood and can confirm, edit or answer again. There is no time limit.
- The app follows your browser language (English or Spanish) and can switch at any time without losing progress.
- **Privacy:** demo mode runs in your browser. This app sends your answers to no server, and they are gone when you close the page. Do not enter personal or sensitive data. The end-to-end tests fail if the app makes any request to another origin.
- **Voice privacy:** answering by voice is optional. The microphone is asked for only when you press the voice button. To turn your speech into text, your browser may send your voice to the company that makes it, for example Google for Chrome or Apple for Safari, so your voice may leave your device. This app only receives the text. It never records or stores audio.
- The ghost speaks with voices installed on your device, so its lines are not sent anywhere to be spoken.
- Automated checks: axe (WCAG 2.2 AA tags) runs in the end-to-end tests, in English and Spanish, with reduced motion on and off.

## How it was built with Kiro

The project is built with Kiro using spec-driven development:

- **Steering** in [`.kiro/steering/`](.kiro/steering/): product, structure, tech, workflow and accessibility rules.
- **Specs** in [`.kiro/specs/`](.kiro/specs/): requirements, design and tasks for the kit and the slice (`kit-skeleton-ghost`) and for voice and speech (`voice-speech`).
- **Skills** in [`.kiro/skills/`](.kiro/skills/): accessibility review, ghost persona, ghost animation, testing, prompt-injection defense and more.
- **Hooks** in [`.kiro/hooks/`](.kiro/hooks/), **MCP** (Playwright, for keyboard-only browser checks) and **property-based tests** with fast-check.

The full log, with what worked and what we learned, is in [`docs/KIRO_USAGE.md`](docs/KIRO_USAGE.md). Architecture decisions are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Deployment steps are in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## License

[MIT](LICENSE) © 2026 Jhojan Daniel Rivera Fuentes. The ghost is original artwork made for this project.
