# Tasks: (b) Voice and speech

Implements `requirements.md` and `design.md` in this folder. Each task is one logical unit with one checkable **Done when**. The definition of done in `.kiro/steering/workflow.md` applies to every task. Always load `lean-code`, plus the skills listed per task.

Working rules (owner):
- Tests first.
- Mutation checks on new logic: back up each file, mutate it, run the tests, restore it, and diff it against the backup.
- One commit per task, in its own message, after the edits are confirmed.
- No pushes without the owner's approval.
- A log entry in `docs/KIRO_USAGE.md` for each task.

Markers:
- **[Browser + axe]**: a full Playwright MCP keyboard walk-through plus an axe run (WCAG 2.2 AA tags, EN and ES, reduced motion on and off). Other UI tasks use component tests only (owner decision, spec a task 17).
- **[Owner]**: the owner does a manual check in real Chrome and Safari with a microphone and speakers (Req 12.5). The agent prepares the checklist and logs the result.
- **[Cuttable, cut first]** / **[Cuttable, cut last]**: the phase 3 scope-cut rule. If we are behind on Nov 16, hands-free goes first and barge-in stays.

Spec (a) phase 2 tasks 35 to 38 are separate. Task 36 there also changes the timeline (new mouth shapes); either order works, because P5 and P6 guard it.

Fakes: unit tests use fake `SynthLike` and `RecognitionLike` objects and fake timers. End-to-end tests install fake speech APIs with `page.addInitScript`, and drive time with `page.clock`.

## Phase 1: the ghost speaks aloud and the mouth follows the audio

### packages/core
- [x] 1. `tokenize` refactor in the speech timeline
  - Add `tokenize(text)` (`{ text, from }[]`, the same whitespace split as today) and make `buildTimeline` use it. The timeline output doesn't change.
  - **Done when:**
    - P5, P6 and every existing timeline example test pass unchanged;
    - new unit tests show `tokenize('  Hola,  mundo ')` gives `[{ text: 'Hola,', from: 2 }, { text: 'mundo', from: 9 }]`;
    - an off-by-one mutation of `from` is caught.
  - _Design §2.3; Requirements: 3.3_ · Skills: `ghost-svg-animation`, `testing-strategy`

- [x] 2. `wordIndexAt` with property P11
  - **Done when:**
    - P11 passes: a character inside a token maps to that token, the index stays in range and never decreases, and the `tokenize` texts equal the `buildTimeline` word texts;
    - examples cover whitespace positions (next token), positions past the end (last token) and an empty line (`-1`).
  - _Design §2.3; Requirements: 3.3_ · Skills: `testing-strategy`

- [x] 3. `wordAt` and `resync` with property P12
  - **Done when:**
    - P12 passes: `wordAt(resync(t, e, w)) === max(clamp(w), wordAt(t, e))`;
    - one example per case passes: the audio is ahead (jump), in step (unchanged elapsed), and the estimate is ahead (hold on the current word start);
    - an empty timeline returns `elapsed`.
  - _Design §2.3; Requirements: 3.2, 3.3_ · Skills: `ghost-svg-animation`, `testing-strategy`

- [x] 4. `pickVoice` with property P10
  - **Done when:**
    - P10 passes: deterministic and independent of input order; returns a local voice of the requested language, or `undefined` exactly when none exists; the preferred region wins;
    - an example shows `es_MX` (Android style) is normalized and matched;
    - a network voice (`localService: false`) is never chosen.
  - _Design §2.2; Requirements: 1.3_ · Skills: `testing-strategy`

### packages/web: playback interface
- [x] 5. `SpeechOutput.speak` takes the line and returns a `Playback`
  - Change the signature to `speak({ text, locale, timeline })`, returning `{ startedAt, origin(), audible(), done }`. Update `SilentOutput` and the session runtime call. `LineView` gains `origin`.
  - **Done when:**
    - all existing web tests pass with the new call;
    - a new `SilentOutput` test shows `origin() === startedAt` and `audible() === false`;
    - a runtime test shows `view.line.origin` is the playback's function.
  - _Design §3.1; Requirements: 3.1_

- [x] 6. Transcript entries record whether a line was heard
  - `TranscriptEntry.heard`, read from `playback.audible()` in `stopLine` before any cancel.
  - **Done when:** runtime tests with a fake output show:
    - a line that ends while audible → `heard: true`;
    - a line that ends while silent → `heard: false`;
    - a cancel while audible → `heard: true`, which proves `audible()` is read before `cancel()`.
  - _Design §3.5; Requirements: 3.6_

### packages/ui: read the moving origin
- [x] 7. `Captions` reads `line.origin()`
  - **Done when:** a component test with a mocked rAF moves `origin` forward between frames and the marked word changes without a re-render or a remount (same element; `key` still from `startedAt`).
  - _Design §4; Requirements: 3.1, 3.2_ · Skills: `ghost-svg-animation`, `a11y-review`

- [x] 8. `useGhostPose(state, origin?)`
  - **Done when:**
    - a test with a mocked rAF shows the visible mouth path follows `origin()` when it moves;
    - without `origin`, behavior is unchanged (the existing tests pass).
  - _Design §4; Requirements: 3.1, 3.2_ · Skills: `ghost-svg-animation`

- [x] 9. `Transcript` announces only lines not heard
  - **Done when:**
    - component tests show a `heard: true` line is listed but not placed in the live region, and a `heard: false` line is announced once;
    - the existing "announced once" tests still pass.
  - _Design §4; Requirements: 3.6_ · Skills: `a11y-review`

### packages/web: WebSpeechOutput
- [x] 10. WebSpeechOutput: store, feature detection, unlock
  - `createWebSpeechOutput` with `SoundView`, `subscribe`, `setOn`, `unlock`. No API → every line plays on the clock with `reason: 'no-api'`. Before `unlock`, lines play on the clock.
  - **Done when:** unit tests show:
    - with no `synth`, `speak` behaves like `SilentOutput` and the view has `reason: 'no-api'`;
    - with a fake synth, no utterance is created before `unlock()`, and one is created after it.
  - _Design §3.2; Requirements: 1.1, 1.2, 2.2_

- [x] 11. WebSpeechOutput: voice choice and audio playback
  - Utterance with `lang`, `voice` and `rate = 1`; `origin()` is `Infinity` until `start`, then the start time; `done` resolves on `end`; voice list from `getVoices()` and `voiceschanged`.
  - **Done when:** unit tests with a fake synth show:
    - the chosen voice is the `pickVoice` result;
    - `origin()` is set on `start`, and `done` resolves on `end` with `audible()` true;
    - a list with voices but no match gives `reason: 'no-voice'` and a clock playback;
    - an empty list 2 s after creation gives `reason: 'no-voice'`.
  - _Design §3.2; Requirements: 1.3, 1.4, 1.5_

- [x] 12. WebSpeechOutput: mouth resync on boundary events
  - **Done when:** unit tests show:
    - a `word` boundary at the third word moves `origin()` so that `wordAt(now - origin())` is 2;
    - a boundary behind the estimate holds on the current word;
    - a `sentence` boundary changes nothing;
    - a boundary from an older utterance changes nothing.
  - _Design §3.2; Requirements: 3.2, 3.4_ · Skills: `ghost-svg-animation`

- [x] 13. WebSpeechOutput: failure and mute paths
  - **Done when:** unit tests with fake timers show:
    - no `start` within 2 s → `synth.cancel()`, a clock playback from now, and `reason: 'failed'` with `on: false`;
    - an utterance `error` → the same result;
    - the `interrupted` and `canceled` errors are ignored;
    - `setOn(false)` in the middle of a line → audio cancelled, `audible()` false, and `done` at `anchor + duration`;
    - `setOn(true)` after a failure → the next line is spoken;
    - `cancel()` resolves `done` at once.
  - _Design §3.2, §6; Requirements: 1.6, 1.8, 2.3, 2.4_
  - Deviations from this Done-when, approved with task 13: an `interrupted` or `canceled` error the app did not cause mutes that line but keeps sound on; a line with no words never becomes an utterance.

- [x] 13b. WebSpeechOutput: end watchdog and utterance reference (owner decision after task 13)
  - Watchdog: a spoken line that started but gets no `end` by `origin + max(2 × duration, duration + 5 s)` calls `fail(line)`, so the session is muted with reason `failed`. The deadline follows the origin when boundary events move it.
  - Each `Line` keeps a reference to its utterance, with a comment: some Chrome versions have been reported to garbage-collect an utterance mid-speech and never fire its `end` event.
  - **Done when:** unit tests with fake timers show:
    - a started line with no `end` fails exactly at the deadline (`duration + 5 s` for a short line, `2 × duration` for a long one);
    - a boundary that moves the origin later moves the deadline with it;
    - an `end` before the deadline, sound off, and `cancel()` each stop the watchdog;
    - mutations of the deadline formula and of the origin-following are caught.

    The utterance reference has no behavioral test, because garbage collection can't be forced in the test environment; the watchdog is the backstop for that case.
  - _Design §3.2, §6; Requirements: 1.6_

### Copy and controls
- [x] 14. Sound copy and the ghost-voice privacy paragraph
  - `sound.*` keys and `privacy.ghostVoice` in `en` and `es` (design §2.6); `PrivacyDialog` shows the new paragraph.
  - **Done when:**
    - typecheck passes (same keys in both catalogs);
    - a `PrivacyDialog` component test finds the paragraph in EN and ES.
  - _Design §2.6; Requirements: 9.2, 11.1_ · Skills: `ghost-persona`, `a11y-review`

- [x] 15. `useStore` hook
  - **Done when:** a component test with a fake store re-renders on `subscribe` notifications only, and returns the new snapshot.
  - _Design §4; Requirements: 2.1_

- [x] 16. `SoundToggle` component
  - **Done when:** component tests show:
    - a native button with `aria-pressed` that reflects `on`, with its label in EN and ES;
    - the `reason` status text for `no-voice` and `failed`;
    - Enter and Space call `onChange`.
  - _Design §4; Requirements: 1.4, 1.6, 2.1_ · Skills: `a11y-review`, `ghost-persona`

- [x] 17. `AppShell` `soundControl` slot
  - **Done when:** component tests show the slot renders before the language switch in the header actions, and nothing renders when it is omitted (ghost-defense).
  - _Design §4; Requirements: 2.1_ · Skills: `a11y-review`

### Wiring and end-to-end
- [x] 18. End-to-end fake for `speechSynthesis`
  - `apps/ghost-interview/e2e/fakes/speech-synthesis.ts`, an init script:
    - two local voices, en-US and es-MX;
    - `start`, `word` `boundary` and `end` fired on the estimated schedule;
    - a log the test can read;
    - variants with no voices and with no API.
  - `slice.spec.ts` installs it, so its results don't depend on the host's voices.
  - **Done when:** `pnpm e2e` passes unchanged with the fake installed, and a temporary assertion shows the fake is the `speechSynthesis` the page sees (removed before the commit).
  - _Design §8; Requirements: 12.3_ · Skills: `testing-strategy`

- [x] 19. ghost-interview: the ghost speaks **[Browser + axe]**
  - Done with additions the owner asked for: `VoiceOutput.setLocale` (the "no-voice" reason follows a language switch with no line playing, the open point from task 11), `e2e/voice-output.spec.ts` (3 tests: the page follows the fake's events, not its estimate; sound off mid-line; the language-switch reason), and an `en-only` variant plus a manual mode in the e2e fake. Task 20 extends `voice-output.spec.ts` with the rest.

- [x] 19b. Sound control polish **[Browser + axe]** (owner request after task 19)
  - No layout shift: hidden copies of every reason share the status's grid cell, so the reason row is always as tall as the longest reason; it is the header's last row.
  - Any reason makes the button look unavailable (dashed border, no fill); `aria-pressed` keeps the user's choice and the status text is unchanged for screen readers.
  - Compact header below 30rem: sound (short visible label "Voice" / "Voz", full accessible name) and language buttons in one row, a shorter Preview text, smaller paddings, and a 120 px ghost.
  - Reasons shortened to one line at 320 px.
  - **Done when:** e2e shows the header, ghost, captions and answer field don't move when a reason appears or goes, at 320 and 1280 px; the button is dashed and unfilled with a reason; at 320x700 with a reason the answer field is fully visible with sound and language in one row, EN and ES; component tests show one polite status announced once; the Browser + axe walk-through passes.
  - _Requirements: 1.4, 1.6, 2.1, 11.2; spec a 11.5_ · Skills: `a11y-review`, `ghost-persona`, `testing-strategy`
  - Create one `WebSpeechOutput` for the page, call `unlock()` in the privacy `onAccept` before dispatching, put `SoundToggle` in the shell, and pass `line.origin` to `useGhostPose`.
  - **Done when:** a Playwright MCP keyboard walk-through, with the task 18 fake, shows:
    - no utterance before Accept, and the question spoken after it;
    - the mouth and the caption marker move with the boundary events;
    - sound off in the middle of a line keeps the captions and mouth to the end;
    - with no voices, the sound control shows the reason and the line plays muted;
    - no console errors, and axe reports zero violations on the answering screen with the sound control on, off and with a reason, in EN and ES × reduced motion on and off.
  - _Design §5; Requirements: 1, 2, 3_ · Skills: `a11y-review`, `ghost-svg-animation`, `testing-strategy`

- [x] 20. End-to-end test of the ghost's voice
  - Delivered inside tasks 19 and 19b (`e2e/voice-output.spec.ts`, owner decision): en-US after Accept and es-MX in Spanish, the marker following boundary events, no voices and no API muted with their reasons, sound off mid-line, axe with reduced motion on and off on the es-MX, no-voices and no-API states, and the network guard in every test. The full axe matrix (every state × EN/ES × 320/1280 px × reduced motion) ran in the task 19 and 19b Playwright MCP walk-throughs, not in `pnpm e2e`.
  - `e2e/voice-output.spec.ts`.
  - **Done when:** `pnpm e2e` passes and covers:
    - an utterance in en-US after Accept, and in es-MX after switching to ES;
    - the marked caption word follows the boundary events;
    - no voices → muted with the reason; no API → muted with no error;
    - sound off in the middle of a line;
    - axe with zero violations on those states in EN and ES × reduced motion on and off;
    - the network guard stays on.
  - _Design §8; Requirements: 12.3, 12.4_ · Skills: `testing-strategy`, `a11y-review`

- [x] 21. Owner check, phase 1 **[Owner]** (done for Brave only; Chrome and Safari still pending)
  - **Done when:** the owner confirms, in Chrome and in Safari, that:
    - the ghost speaks the question aloud in EN and in ES;
    - the mouth and caption marker follow the audio;
    - the sound toggle stops the audio and the captions continue;
    - nothing is spoken before Accept.
  - The result, with the browser versions, is logged in `docs/KIRO_USAGE.md`.
  - _Requirements: 12.5_

## Phase 2: voice answers

### packages/core
- [x] 22. `partial` input event and `setLocale` hook
  - **Done when:**
    - typecheck passes, and the keyboard adapter is unchanged;
    - a type test shows `{ type: 'partial', text }` is an `InputEvent` and `setLocale` is optional on `InputAdapter`.
  - _Design §2.1; Requirements: 4.6, 7.1_

- [ ] 23. `speechLang`
  - **Done when:** examples pass: `es-AR` preferred → `es-AR`; nothing preferred → `es-MX` and `en-US`; `en_GB` → `en-GB`.
  - _Design §2.2; Requirements: 4.6_

### packages/web: VoiceAdapter
- [ ] 24. VoiceAdapter: availability, store, listen
  - **Done when:** unit tests with a fake `RecognitionLike` show:
    - with no constructor, `checkAvailability()` gives unavailable with `voice.unavailable`;
    - `checkAvailability()` creates no recognizer;
    - `listen()` creates one with `continuous`, `interimResults`, `maxAlternatives = 1` and `lang` from `speechLang`;
    - the view shows `listening: true`.
  - _Design §3.3; Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ] 25. VoiceAdapter: results and the candidate
  - **Done when:** unit tests show:
    - `result` events split the text into `final` and `interim`, and emit `partial` with the full text;
    - `stopListening()` → `recognizer.stop()` → on `end`, one candidate with the trimmed text and method `voice`;
    - blank text → no candidate and `error: 'voice.empty'`;
    - `stop()` aborts listening and clears the text.
  - _Design §3.3; Requirements: 4.7, 4.8, 5.1_

- [ ] 26. VoiceAdapter: early end and the loop guard
  - **Done when:** unit tests show:
    - an `end` the user didn't ask for keeps the text and starts a new recognizer;
    - `no-speech` is ignored;
    - three ends in a row under 500 ms with no result stop listening with `voice.error.service`.
  - _Design §3.3; Requirements: 4.9_

- [ ] 27. VoiceAdapter: errors
  - **Done when:** one unit test per error code shows the right key (`permission`, `noMic`, `network`, `language`, `service`), that `aborted` is ignored, and that text recognized before the error becomes a candidate.
  - _Design §3.3, §6; Requirements: 4.10_

- [ ] 28. VoiceAdapter: `setLocale` while listening
  - **Done when:** a unit test shows a switch from `en` to `es` in the middle of a turn starts a recognizer with `lang` `es-MX` and keeps the text recognized so far.
  - _Design §3.3; Requirements: 4.6_

### packages/web: runtime
- [ ] 29. Runtime: input routing and language switch without a restart
  - `onInput`: a `candidate` is dispatched and a `partial` is accepted (barge-in arrives in task 37). `syncInputs` keys on the question only, and calls `setLocale?.()` on a language switch.
  - **Done when:**
    - runtime tests show a language switch calls `setLocale` and doesn't call `stop`/`start`;
    - a `partial` changes no state;
    - all existing session tests pass.
  - _Design §3.5; Requirements: 4.6_

- [ ] 30. `unavailableInputs` and the Preview session
  - **Done when:** tests show:
    - `unavailableInputs` returns the ids of unavailable adapters;
    - with keyboard + voice registered and voice unavailable, `createSession` starts, sets `view.preview = { missing: ['voice'] }`, warns once per issue, and never starts the voice adapter;
    - with both available, `view.preview` is undefined;
    - an authoring error (one registered method, `preview: false`) still blocks.
  - _Design §3.4; Requirements: 10.2, 10.3, 10.4_

### Copy and UI
- [ ] 31. Voice copy and privacy texts
  - `voice.*` keys, the changed `privacy.intro` and `privacy.local`, the new `privacy.voice`, `voice.note` and `shell.preview.missing.voice`, in EN and ES as in design §2.6. `PrivacyDialog` shows `privacy.voice`.
  - **Done when:**
    - typecheck passes;
    - a `PrivacyDialog` test finds the voice paragraph in EN and ES;
    - a test asserts the old "Your answers are not sent to any server" sentence is gone from both catalogs.
  - _Design §2.6; Requirements: 9.1, 9.3, 9.4, 9.6, 10.5, 11.1_ · Skills: `ghost-persona`, `a11y-review`

- [ ] 32. `VoiceInput` component
  - **Done when:** component tests show:
    - the start/stop button keeps focus and its label changes;
    - a "Listening" indicator with text (not color alone);
    - "Your words" with final and interim text styled differently, with `lang`, and not a live region;
    - one polite status announcement each for start, stop and an error;
    - `voice.note` with a privacy link button;
    - when voice is unavailable, the reason replaces the button.
  - _Design §4; Requirements: 4.4, 4.5, 5.1 to 5.5, 9.5, 11.2_ · Skills: `a11y-review`, `ghost-persona`

### Wiring and end-to-end
- [ ] 33. ghost-interview: voice answers **[Browser + axe]**
  - Register the page's `VoiceAdapter`, set `preview: false`, await `unavailableInputs` before the first session, take `previewNote` from `view.preview`, and move focus to the voice button after Retry on a voice answer.
  - **Done when:** a Playwright MCP keyboard walk-through, with fake recognition, shows:
    - a spoken answer appears live, then the confirmation view shows it with method "Voice", then feedback;
    - Retry after a voice answer focuses the voice button;
    - with `SpeechRecognition` deleted, the Preview label shows the missing-voice reason and a typed answer works;
    - in a browser with voice, the old "Keyboard only for now…" text is gone;
    - no console errors, and axe reports zero violations on idle, listening, error, confirmation and the Preview session, in EN and ES × reduced motion on and off.
  - _Design §5; Requirements: 4, 5, 6.1 to 6.3, 10.1, 10.5_ · Skills: `a11y-review`, `testing-strategy`

- [ ] 34. End-to-end test of voice answers
  - An e2e fake for `SpeechRecognition` (an init script the test drives through `page.evaluate`), and `e2e/voice-input.spec.ts`.
  - **Done when:** `pnpm e2e` passes and covers:
    - a voice answer with live captions, then confirm, then feedback;
    - Edit prefills the text field;
    - an empty voice answer gives the message;
    - no `SpeechRecognition` → the Preview label with the reason, then a keyboard answer;
    - axe with zero violations on those states in EN and ES × reduced motion on and off;
    - the network guard stays on.
  - _Design §8; Requirements: 12.3, 12.4_ · Skills: `testing-strategy`, `a11y-review`

- [ ] 35. README: voice status and privacy
  - **Done when:**
    - the README no longer says "keyboard only";
    - it names voice input and the ghost's voice with their browser support (no `SpeechRecognition` in Firefox → Preview session);
    - it repeats the privacy point of 9.1;
    - every command in it still runs as written.
  - _Steering `structure.md`; Requirements: 9.1, 10.4_ · Skills: `kiroween-checklist`

- [ ] 36. Owner check, phase 2 **[Owner]**
  - **Done when:** the owner confirms, in Chrome and in Safari, that:
    - a spoken answer in EN and in ES appears live, reaches confirmation, and gives feedback;
    - denying the microphone gives the permission message and typing still works;
    - the privacy notice reads correctly in both languages.
  - Optional: Firefox shows the Preview label with the reason.
  - The result is logged in `docs/KIRO_USAGE.md`.
  - _Requirements: 12.5_

## Phase 3: conversation (cuttable)

### Barge-in
- [ ] 37. `isBargeIn` with property P13 **[Cuttable, cut last]**
  - **Done when:**
    - P13 passes: fewer than 2 words → false; any contiguous run of the line's words, with any case, accents or punctuation → false; 2 or more words that are not such a run → true;
    - two mutations are caught: a minimum of 1 word, and an echo check without normalization.
  - _Design §2.4; Requirements: 7.1_ · Skills: `testing-strategy`

- [ ] 38. Runtime barge-in **[Cuttable, cut last]**
  - On `partial`: if `line?.playing && isBargeIn(text, line.text)`, call `cancelLine()`.
  - **Done when:** runtime tests with fake output and input show:
    - the ghost's own line arriving word by word as `partial`s → no cancel;
    - "I fixed the build" → cancel at once, the line goes into the transcript, and `asking` → `answering` through `line-done`;
    - one word → no cancel;
    - in muted mode, the same rules apply and the mouth rests.
  - _Design §2.4, §3.5; Requirements: 7.1 to 7.4_

- [ ] 39. End-to-end barge-in versus echo **[Cuttable, cut last]**
  - **Done when:** `pnpm e2e` passes with two cases:
    - while the fake ghost speaks, the fake recognizer "hears" the question's own words → the utterance keeps playing;
    - it hears "I fixed it" → the fake synth logs `cancel` and the full line stays in the captions and the transcript.
  - _Design §2.4, §8; Requirements: 7, 12.3_ · Skills: `testing-strategy`

### Hands-free
- [ ] 40. `turnEnded` and `SILENCE_MS` with property P14 **[Cuttable, cut first]**
  - **Done when:** P14 passes (blank text never ends a turn, monotonic in `now`, and true exactly at the threshold for non-blank text), and a `>` instead of `>=` mutation is caught.
  - _Design §2.5; Requirements: 8.4, 8.5, 8.7_ · Skills: `testing-strategy`

- [ ] 41. `onTurn` hook and runtime calls **[Cuttable, cut first]**
  - **Done when:** runtime tests show `onTurn` is called after `line-done` moves `asking` → `answering` and after `retry`, and is not called after `edit` or a language switch.
  - _Design §2.1, §3.5; Requirements: 6.3, 8.3_

- [ ] 42. VoiceAdapter hands-free **[Cuttable, cut first]**
  - **Done when:** unit tests with fake timers show:
    - `onTurn()` listens only when hands-free is on;
    - after text and 2 s of silence, `stopListening()` emits the candidate;
    - silence before any text never ends the turn;
    - `setSilenceMs` clamps to 1 000 to 10 000 ms;
    - the settings survive `stop()`/`start()` for a new session.
  - _Design §3.3; Requirements: 8.3 to 8.6_

- [ ] 43. Hands-free copy and `HandsFreeSettings` **[Cuttable, cut first]**
  - **Done when:** component tests show:
    - a labeled checkbox with a description;
    - a labeled range from 1 to 10 with step 0.5, whose `<output>` reads "2.5 s" in EN and "2,5 s" in ES for 2500 ms;
    - when voice is unavailable, the controls are disabled and show the reason;
    - typecheck passes with the `handsFree.*` keys in both catalogs.
  - _Design §2.6, §4; Requirements: 8.1, 8.2, 8.6, 11.1, 11.2_ · Skills: `a11y-review`, `ghost-persona`

- [ ] 44. ghost-interview: hands-free **[Cuttable, cut first]** **[Browser + axe]**
  - **Done when:** a Playwright MCP keyboard walk-through, with fakes, shows:
    - turning hands-free on, then the question ends and listening starts by itself;
    - after an answer and the silence threshold, the confirmation view opens and nothing is confirmed automatically;
    - Retry starts listening again;
    - the threshold control works by keyboard;
    - axe reports zero violations with hands-free on, in EN and ES × reduced motion on and off.
  - _Design §5; Requirements: 6.3, 6.4, 8_ · Skills: `a11y-review`, `testing-strategy`

- [ ] 45. End-to-end hands-free **[Cuttable, cut first]**
  - **Done when:** `pnpm e2e` passes a hands-free case that uses `page.clock` to pass the silence threshold (no fixed sleeps), plus a case that shows silence before any text never ends the turn.
  - _Design §8; Requirements: 8, 12.3_ · Skills: `testing-strategy`

- [ ] 46. Owner check, phase 3 **[Owner]** **[Cuttable]**
  - **Done when:** the owner confirms in Chrome and in Safari:
    - **Loudspeaker echo** (design §2.4): with speakers (no headphones), press the voice button during a question and stay silent; the ghost keeps talking. Then say two words; the ghost stops.
    - **Hands-free** (if not cut): one full answer without pressing a button until Confirm.
  - The result is logged in `docs/KIRO_USAGE.md`.
  - _Requirements: 12.5_

## Credit estimate

**What it is based on:** I have no measured credit number. The only planned data point is the owner's credit count after spec (a) task 27, in `docs/KIRO_USAGE.md` "Credit check", and it is still empty. The agent can't read the Kiro usage page. So the estimate is relative: when that number (call it **C**) is filled in, each phase costs about the share of C shown below.

**Method:** each task gets weight units by type. The ratios are my assumption, from how much tool work each type took in spec (a). Browser walk-throughs with snapshots and 4 to 8 axe runs took several times the calls of a test-only task.

| Type | Units | Spec (a) examples |
|---|---|---|
| Logic or component task (tests and mutation checks) | 1 | tasks 5 to 15, 17, 22, 23 |
| End-to-end test task | 2 | task 28 |
| Full browser check + axe | 3 | tasks 16, 18, 21, 24, 27 |
| Owner check (agent writes the checklist and the log) | 1 | — |

**Baseline:** spec (a) tasks 1 to 27 = 15 non-UI tasks (15) + 7 component-test UI tasks (7) + 5 browser-check tasks (15) = **37 units ≈ C**. C also includes the steering, skills and spec (a) documents written before task 1, so the shares below are on the high side.

| Phase | Tasks | Units | Share of C |
|---|---|---|---|
| 1: ghost voice | 1–21 (17 at 1, 2 e2e, 1 browser, 1 owner) | 25 | ≈ 0.68 × C |
| 2: voice answers | 22–36 (12 at 1, 1 e2e, 1 browser, 1 owner) | 18 | ≈ 0.49 × C |
| 3a: barge-in (cut last) | 37–39 (2 at 1, 1 e2e) | 4 | ≈ 0.11 × C |
| 3b: hands-free (cut first) | 40–45 (4 at 1, 1 e2e, 1 browser) | 9 | ≈ 0.24 × C |
| 3: owner check | 46 | 1 | ≈ 0.03 × C |
| **Total** | 46 | 57 | **≈ 1.5 × C** |

Cutting hands-free saves about a quarter of C. Re-check after phase 1: if phase 1 cost much more than 0.68 × C, scale the rest by the same factor.
