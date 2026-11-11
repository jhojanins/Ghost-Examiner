# Requirements: (a) Kit skeleton + animated ghost persona

## Introduction
This spec creates the reusable kit (`packages/core`, `packages/web`, `packages/ui`), the two app shells (`apps/ghost-interview`, `apps/ghost-defense`), the animated ghost examiner, and a minimal end-to-end vertical slice: the ghost asks one question, the user answers by keyboard, confirms the interpreted answer, and gets demo-mode feedback. The slice must be on a public branch-deploy URL by **Nov 15 (Day 5)**.

## Delivery phases
- **Phase 1, Day 5 slice**: requirements 1, 2, 5, 6, 7, 8, 10, 11, 13, plus the parts of 3, 4, 9 and 12 that the slice needs:
  - 3: all criteria except 3.7 (motion toggle) and 3.10 (floating), with the phase 1 expression and mouth sets from 3.2.
  - 4: all criteria (ghost speech must always have captions).
  - 9: all criteria (11.1 requires EN and ES).
  - 12: criteria 12.1, 12.2, 12.4, and 12.3 for slice screens in English with default motion only.
- **Phase 2, same spec, after the slice**: the remaining expressions and mouth shapes of 3.2, floating (3.10) together with the motion toggle (3.7), and the full axe matrix of 12.3.
- Known phase 1 gap (owner-accepted): without the toggle, only the operating system's reduced-motion setting stops the ghost's blinking. A strict reading of WCAG 2.2.2 (pause, stop, hide) wants an in-page control; phase 2 adds it.

Out of scope here: voice input and speech synthesis (spec b), Morse (spec c), camera (spec d), real LLM providers and the Netlify proxy (spec e), document upload (spec f), the GitHub Pages mirror (Nov 29–30).

Architecture reference: `docs/ARCHITECTURE.md` (final).

## Glossary
- **Kit**: the three packages in `packages/`.
- **Slice**: the Day 5 end-to-end flow in `apps/ghost-interview`.
- **Ghost line**: one sentence the ghost "says", shown as captions and animated with the mouth.
- **Candidate**: an interpreted answer produced by an input adapter, not yet confirmed.
- **Confirmed answer**: a candidate the user has explicitly confirmed; the only thing an evaluator accepts.
- **Muted mode**: the ghost speaks with captions and mouth animation only, no audio. In this spec, all ghost speech is muted mode.
- **Preview build**: an app build whose configuration sets the Preview flag. It may offer fewer than 2 input methods per question and must say so visibly. `apps/ghost-interview` is a Preview build until spec (b) adds voice input.

## Requirement 1: Monorepo skeleton
**User story:** As the developer, I want one workspace with the kit and both apps, so that every feature is built once and reused by both apps.

Acceptance criteria:
1. THE repository SHALL be a pnpm workspace containing exactly `packages/core`, `packages/web`, `packages/ui`, `apps/ghost-interview` and `apps/ghost-defense`.
2. THE repository root SHALL provide single-shot commands for typecheck, lint, unit tests, end-to-end tests and production build that cover every workspace package.
3. WHEN any of those commands runs, THE command SHALL exit without starting a watcher or a long-running server.
4. THE `.gitignore` SHALL NOT match `.kiro` or any path inside it.

## Requirement 2: Package boundaries
**User story:** As the developer, I want the dependency rules enforced by tools, so that the core stays framework-agnostic without relying on discipline.

Acceptance criteria:
1. IF code in `packages/core` imports React, react-dom or JSX, or references a DOM global such as `window` or `document`, THEN typecheck SHALL fail.
2. IF code in `packages/web` imports React, THEN typecheck or module resolution SHALL fail.
3. THE apps SHALL import kit code only through each package's `exports` entry points.
4. THE `packages/core` unit tests SHALL run in Node without a DOM environment.

## Requirement 3: Ghost avatar
**User story:** As a user, I want an expressive ghost examiner on screen, so that the practice feels like talking to someone face to face.

Acceptance criteria:
1. THE ghost SHALL be an original hand-authored SVG with glasses, a bow tie and a clipboard, visibly distinct from Kiro's mascot.
2. THE ghost SHALL support the expressions `neutral`, `attentive`, `skeptical`, `approving`, `amused`, `thinking`, `surprised`, and the mouth shapes `rest`, `A`, `E`, `O`, `U`, `MBP`, `FV`. Phase 1 delivers the expressions `neutral`, `thinking`, `approving`, `skeptical` and the mouth shapes `rest`, `A`, `O`, `MBP`; phase 2 adds the others.
3. WHILE the ghost is idle, THE ghost SHALL blink at irregular intervals of roughly 3 to 6 seconds.
4. WHEN the session phase changes, THE ghost SHALL change activity and expression accordingly (asking → speaking, answering → listening, evaluating → thinking, feedback → a reaction chosen by the evaluator).
5. THE ghost SHALL expose `role="img"` with a localized accessible name that describes its current expression.
6. WHERE the user prefers reduced motion (media query or in-app toggle), THE ghost SHALL stop floating, idle drift and blinking, and SHALL keep only expression and mouth changes.
7. (Phase 2) THE interface SHALL provide a visible, keyboard-operable motion toggle that pauses non-essential ghost motion.
8. THE ghost SHALL NOT flash; any glow or fade SHALL take at least 1 second.
9. THE pose computation SHALL be a pure function of state, time and the reduced-motion flag, located in `packages/core`.
10. (Phase 2) WHILE the ghost is idle and reduced motion is off, THE ghost SHALL float gently.
11. THE ghost SHALL use the project palette: a mint-white body gradient (`#ffffff` → `#e3fbf4` → `#a9e8d6`), orange glasses (`#e8a13a`) and bow tie (`#e8892f`), on a dark navy scene (`#0b1020` → `#14264d`), with no purple.

## Requirement 4: Muted ghost speech and live captions
**User story:** As a user who is deaf, hard of hearing or in a quiet place, I want every ghost line captioned and synced with its mouth, so that I never miss what the ghost says.

Acceptance criteria:
1. WHEN the ghost says a line, THE captions area SHALL show the full line immediately and mark the current word while the mouth animates.
2. THE current-word marker SHALL NOT rely on color alone, and caption text SHALL have contrast of at least 4.5:1 in every state.
3. THE mouth animation and the caption marker SHALL be driven by the same speech timeline built from the line's text.
4. WHEN a ghost line finishes, THE transcript panel SHALL keep it and announce it once to assistive technology through a polite live region.
5. THE captions SHALL NOT cover the focused element.
6. THE user SHALL be able to answer while the ghost line is still animating; no ghost line SHALL block input.

## Requirement 5: Question engine
**User story:** As the developer, I want a pure, tested session engine, so that both apps share the same flow and its rules hold for every sequence of events.

Acceptance criteria:
1. THE engine SHALL move through the phases intro, privacy, asking, answering, confirming, evaluating, feedback and summary, as a pure reducer that returns the next state and a list of effects.
2. THE engine SHALL emit an evaluate effect only after a confirm event for the same candidate.
3. THE evaluator interface SHALL accept only a confirmed answer type that only the engine's confirm transition can create.
4. THE engine SHALL NOT impose a time limit in any phase.
5. WHEN a question pack is loaded, THE validator SHALL report every question that fewer than 2 registered input methods can answer.
   - WHERE the build is a Preview build, each such report SHALL be a warning and the session SHALL start.
   - WHERE the build is not a Preview build, each such report SHALL be an error and the session SHALL NOT start; the app SHALL show a message that explains why.
6. THE engine SHALL get time only from an injected clock.

## Requirement 6: Keyboard input (minimal)
**User story:** As a user, I want to type my answer, so that I can respond without a microphone or camera.

Acceptance criteria:
1. THE keyboard input SHALL implement the `InputAdapter` interface and support the answer kinds `free-text`, `choice` and `yes-no`.
2. THE text field SHALL have a visible label, allow paste, and keep a visible focus indicator.
3. WHEN the user activates the submit button or presses Ctrl+Enter or Cmd+Enter, THE adapter SHALL emit a candidate with the typed text.
4. IF the typed text is empty or only whitespace, THEN THE adapter SHALL NOT emit a candidate and SHALL show an inline message that explains what to do.

## Requirement 7: Confirmation step
**User story:** As a user, I want to see how my answer was understood and confirm it, so that I am never evaluated on something I didn't mean.

Acceptance criteria:
1. WHEN a candidate arrives, THE interface SHALL show the interpreted answer and the input method used, with the actions Confirm, Edit and Retry.
2. WHEN the confirmation view opens, THE focus SHALL move to it, and its prompt SHALL be announced.
3. WHEN the user chooses Edit, THE keyboard input SHALL open with the candidate text prefilled.
4. WHEN the user chooses Retry, THE session SHALL return to answering with the same question.
5. WHEN the user chooses Confirm, THE session SHALL proceed to evaluation.

## Requirement 8: Demo-mode evaluation
**User story:** As a judge or user without an API key, I want meaningful feedback offline, so that the app works fully in demo mode.

Acceptance criteria:
1. THE kit SHALL define the `LLMProvider` interface, a `withFallback` combinator and a deterministic `DemoProvider`; no network request SHALL be made in demo mode.
2. THE demo evaluator SHALL compare the confirmed answer with the question's key points and produce a summary, one strength, one improvement and a ghost reaction.
3. GIVEN the same question, answer and locale, THE demo evaluator SHALL return the same feedback.
4. THE feedback text SHALL follow the ghost persona rules and be available in EN and ES.
5. THE feedback SHALL be labeled as practice feedback, never as a verdict.

## Requirement 9: Bilingual interface
**User story:** As a Spanish or English speaker, I want the whole experience in my language, so that I can practice comfortably.

Acceptance criteria:
1. WHEN the app starts, THE language SHALL default to Spanish or English based on the browser's preferred languages, falling back to English.
2. THE interface SHALL provide a keyboard-operable language switch that updates all text, ghost lines and the `<html lang>` attribute without losing session progress.
3. IF the Spanish catalog lacks a key that the English catalog has, or the reverse, THEN typecheck SHALL fail.
4. THE Spanish text SHALL use the informal "tú" form.

## Requirement 10: Privacy notice
**User story:** As a user, I want to know what happens with my data before I start, so that I can decide to continue.

Acceptance criteria:
1. WHEN a user starts a session for the first time, THE privacy notice SHALL appear before any question, in the current language.
2. THE notice SHALL state that demo mode processes everything in the browser and sends nothing to any server, and SHALL warn users not to enter sensitive or personal data.
3. THE notice SHALL be an accessible dialog: focus moves into it, focus stays inside it while open, and it can be accepted by keyboard.
4. THE privacy link SHALL be available in the same place on every screen.

## Requirement 11: App shells
**User story:** As a judge, I want two distinct apps built from the same kit, so that the Skeleton Crew reuse is visible.

Acceptance criteria:
1. `apps/ghost-interview` SHALL run the slice: greeting, privacy notice, one interview question in EN and ES, keyboard answer, confirmation, demo feedback and a closing line.
2. `apps/ghost-defense` SHALL render the same kit shell and ghost with its own title, copy and theme accent, and SHALL state that the document defense flow is in development.
3. BOTH apps SHALL contain only configuration, content and screens; shared behavior SHALL live in `packages/`.
4. EACH app's configuration SHALL declare whether it is a Preview build.
5. WHERE an app is a Preview build, THE shell SHALL show a visible "Preview" label, in EN and ES, on every screen, with text explaining that more input methods are coming.

## Requirement 12: Tests and automated accessibility checks
**User story:** As the developer, I want automated checks from the first day, so that the definition of done can be applied to every task.

Acceptance criteria:
1. THE core SHALL have unit tests and fast-check property tests for the engine (confirmation invariant, no time limits) and the speech timeline (cues ordered, non-overlapping, covering every word, ending at rest).
2. THE apps SHALL have Playwright end-to-end tests of the slice driven by keyboard only.
3. THE end-to-end suite SHALL run axe with WCAG 2.2 AA tags on every slice screen in EN and ES, with reduced motion on and off, and SHALL fail on any violation.
4. WHILE running in demo mode, THE end-to-end suite SHALL fail if the app makes any request to an origin other than its own.

## Requirement 13: Build and deployment
**User story:** As the owner, I want a cheap, controlled deployment, so that the URL stays live without spending Netlify credits carelessly.

Acceptance criteria:
1. THE production build SHALL produce one site with the landing page at `/`, ghost-interview at `/interview/` and ghost-defense at `/defense/`.
2. THE repository SHALL contain a `netlify.toml` that builds the site, and `docs/DEPLOY.md` SHALL give the owner step-by-step Netlify setup instructions: connect the repo, set `release` as the production branch, and enable branch deploys for `main`.
3. WHEN the slice is complete, THE slice SHALL be reachable on the public branch-deploy URL of `main`; a production deploy SHALL happen only after the owner's explicit approval.
4. THE repository SHALL run typecheck, lint and unit tests in GitHub Actions on every push and pull request.
