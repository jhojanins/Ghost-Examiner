---
inclusion: always
---

# Accessibility, privacy and ethics (non-negotiable)

Target: WCAG 2.2 AA. For detailed audits use the `a11y-review` skill.

## Inputs
- Every question must be answerable by at least 2 input methods. Keyboard text input is always one of them.
  - Owner-approved exception: a build marked **Preview** (shown in the UI) may ship with keyboard only; the validator then warns instead of failing. Preview ends when voice input lands in spec (b).
- Before any answer is evaluated, show the interpreted answer (transcript, decoded Morse, recognized signs) and ask the user to confirm, edit or retry.
- No hard time limits on answering. Any timing (Morse dot/dash thresholds, silence detection) is adjustable by the user.
- Everything is operable by keyboard, with a logical focus order and a visible focus indicator.

## Ghost speech
- The ghost's speech always has live captions, synced to what it says.
- The ghost works fully muted: captions plus mouth animation carry the conversation.
- The transcript is available to screen readers without duplicating the ghost's audio.

## Camera
- Camera is off by default and always optional. Every feature except sign input works with the camera off.
- Frames are processed locally in the browser only. Never upload, store or log video, images or landmarks.
- When the camera is on, show a visible indicator and a one-click way to turn it off.
- Never infer emotions from the camera. Never use camera data in evaluation or feedback. Camera signals may only drive the ghost's gaze and presence reactions.

## Signs
- Sign input is EXPERIMENTAL and labeled so wherever it appears.
- It is a personalized, small-vocabulary gesture input trained by the user. Never claim, in UI, docs or the demo, that it translates or understands sign language.

## Visual and motion
- Humor never hurts readability. Text contrast >= 4.5:1, including captions over the ghost scene.
- Respect `prefers-reduced-motion`: drop non-essential ghost motion (floating, bobbing, effects), keep only subtle mouth and expression changes, and offer an in-app toggle.
- No flashing content at all. Spooky effects use slow fades, never strobes.

## Privacy and data
- Show a clear privacy notice before first use, in ES and EN. It states honestly what stays local and what leaves the device (for example: browser speech recognition may be processed by the browser vendor; in non-demo mode, answer text and document excerpts are sent to the chosen LLM provider).
- Never send real sensitive data. Demo content is fictional.
- Before any upload and before real (non-demo) mode starts, warn users in ES and EN: do not upload sensitive, confidential or personal documents, and do not include personal data in answers, because free-tier LLM providers may use submitted content to improve their products and may let human reviewers read it (this is the case for the Gemini API free tier). Name the active provider in the notice.
- No accounts, no server-side storage of answers or documents, no analytics that track individuals.
- The privacy notice says answers are gone when the page closes, so never store answers (or drafts, transcripts, feedback) in `localStorage`, `sessionStorage`, IndexedDB, cookies or similar without first changing that text in both languages.

## Ethics
- Feedback is constructive and kind. The ghost can be dry and funny but never humiliates the user.
- Results are practice feedback only, never presented as a hiring, grading or plagiarism verdict.
