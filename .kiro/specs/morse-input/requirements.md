# Requirements: (c) Morse input
## Introduction
This spec adds Morse code as the kit's third answer input, next to keyboard text (spec a) and voice (spec b). The user taps dots and dashes with a key, a pointer or a finger; the kit decodes them into text as they go; and the finished text goes through the existing confirmation step before evaluation, like every other answer.
Morse needs no microphone, camera or special API, so it works in every browser. That makes it the second input method in browsers without speech recognition (Firefox), so those sessions stop being Preview sessions (requirement 10).
The work lives in the kit (`packages/`), so both apps can use it. Only `apps/ghost-interview` runs a session in this spec; `apps/ghost-defense` stays a shell until spec (f).
Architecture reference: `docs/ARCHITECTURE.md` §3.1 (`InputAdapter`, the `morse` method id and the `trace` field) and the note that Morse timing uses an injected `Clock` with a pure classifier. The codec and classifier contract is in the `morse-input-pbt` skill. Spec (a) and (b) requirements stay in force; this spec only adds to them.
## Delivery and scope-cut rule
- Spec (c) is scheduled for Nov 19 (afternoon) to Nov 20 (`docs/ARCHITECTURE.md` §6).
- Criteria marked **[Cuttable]** may be dropped if we are behind on Nov 20, in this order: first the adaptive threshold (requirement 4.5 to 4.7), then practice mode (requirement 7.3 and 7.4). Everything else is mandatory.
- Cutting 4.5 to 4.7 leaves the speed setting (4.1 to 4.4), so timing stays adjustable. Cutting practice mode leaves the reference chart (7.1, 7.2).
## Out of scope
- Signs and the camera (spec d and the stretch goal).
- Sound or vibration feedback while tapping (a sidetone). The pad gives visual feedback only.
- Morse output: the ghost never speaks or flashes Morse.
- Prosigns (for example SOS as one sign, or end-of-message), and Morse alphabets other than the Latin one in requirement 3.
- Saving Morse settings between visits. Settings last for the page only, like the motion toggle (spec a design §5.4).
- Morse taps interrupting the ghost while it speaks (barge-in stays voice-only, spec b requirement 7).
- Real LLM providers (spec e) and the ghost-defense flow (spec f).
## Glossary
- **Symbol**: a dot or a dash.
- **Unit (u)**: the basic Morse time unit in ms. Ideal timing: dot 1u, dash 3u, gap inside a letter 1u, gap between letters 3u, gap between words 7u.
- **Speed**: the unit length the user chooses, shown as words per minute (WPM, unit = 1200 / WPM ms).
- **Thresholds**: the boundaries the classifier uses: a press shorter than the dot/dash boundary is a dot; a gap shorter than the letter boundary stays in the letter, shorter than the word boundary starts a new letter, otherwise starts a new word. Defaults: 2u, 2u and 5u.
- **One-key mode**: one key or one target; how long it is held decides dot or dash.
- **Two-key mode**: one key or target for dot and another for dash; press length doesn't matter.
- **Automatic gaps / manual gaps**: letters and words end by pause length (automatic), or only when the user presses "end letter" or "space" (manual).
- **Morse pad**: the tap target plus the decoding line and controls.
- **Decoding line**: the live view of the symbols of the current letter and the text decoded so far.
- **Trace**: the Morse code of the whole answer as typed (for example `.-- . ...`), the `trace` field of `AnswerCandidate`.
- **Available input method**: as in spec (b): a registered adapter whose `checkAvailability()` reports available.
## Requirement 1: Morse as a kit input method
**User story:** As a user who can't or doesn't want to type or speak, I want to answer in Morse code, so that I have another way to answer every question.
Acceptance criteria:
1. THE kit SHALL provide a Morse input adapter that implements the existing `InputAdapter` interface with the id `morse`, and that needs no camera and no microphone.
2. THE Morse adapter SHALL support every answer kind (`free-text`, `choice`, `yes-no`).
3. THE Morse adapter SHALL report itself available in every browser that runs the app, since it needs only keyboard, pointer or touch events.
4. Adding Morse SHALL NOT require changes to the question engine (steering `structure.md`).
5. THE Morse codec and timing classifier SHALL be pure TypeScript in `packages/core`, with no DOM and no clock of their own: the classifier takes press and release timestamps and thresholds, never `Date.now()` (`docs/ARCHITECTURE.md` §3.1).
6. WHILE the user is entering Morse, THE adapter SHALL emit `partial` events with the decoded text so far, so the ghost can look attentive (spec a 3.4).
## Requirement 2: Tapping
**User story:** As a user, I want to tap Morse with a key, a mouse or a finger, in the way that suits my hands, so that I can enter answers comfortably.
Acceptance criteria:
1. WHILE the Morse pad has keyboard focus, in one-key mode, THE user SHALL tap by holding a key: a press shorter than the dot/dash threshold is a dot, otherwise a dash. The key SHALL be shown on screen.
2. THE user SHALL be able to switch to two-key mode, where one key enters a dot and another a dash at any press length. Both keys SHALL be shown on screen and SHALL work on US English and Spanish keyboard layouts.
3. THE Morse keys SHALL work only while the Morse pad has focus, so they never act as page-wide shortcuts (WCAG 2.1.4), and SHALL NOT scroll the page.
4. THE kit SHALL ignore key auto-repeat while a key is held, so one long press is one symbol.
5. THE pad SHALL offer a pointer and touch target at least 120 × 120 CSS px in one-key mode, and two targets of at least that size in two-key mode, without horizontal scrolling at 320 px wide.
6. A pointer or touch press SHALL produce its symbol on release. IF the pointer leaves the target before release, or the pad loses focus while a key is held, THEN THE press SHALL be cancelled and produce nothing (WCAG 2.5.2).
7. WHILE a press is held, THE pad SHALL show a pressed state that does not rely on color alone.
8. THE pad SHALL NOT block other input: the typed answer field and voice input stay available on the same screen.
## Requirement 3: Decoding
**User story:** As a user, I want my taps turned into the right letters, so that the ghost reads what I meant.
Acceptance criteria:
1. THE decoder SHALL support the letters A to Z, Ñ (`--.--`), the digits 0 to 9, and this punctuation: period, comma, question mark, apostrophe, exclamation mark, hyphen, slash, opening and closing parenthesis, colon, quotation mark and @. Codes follow ITU-R M.1677-1, with Ñ and the exclamation mark as common extensions.
2. THE encoder SHALL normalize text before encoding: case is ignored, accents are removed (É → E, Ü → U) while Ñ is kept, and runs of whitespace become one word gap.
3. THE decoder SHALL be a total function: any sequence of symbols, letter gaps and word gaps decodes without an error. A code that matches no character SHALL decode to `?`, and THE decoder SHALL also report that an unknown code occurred, so a real question mark (`..--..`) is never taken for one.
4. THE decoded answer text SHALL be lowercase (Morse has no case, and all-caps text is read badly by some screen readers and breaks the "no all caps" tone rule).
5. Decoding SHALL depend only on the symbols and gaps; the same input SHALL always give the same text.
## Requirement 4: Speed and thresholds
**User story:** As a beginner or a fast operator, I want the timing to fit my speed, so that the decoder doesn't fight me.
Acceptance criteria:
1. THE user SHALL be able to set the speed from 3 to 20 WPM (unit 400 to 60 ms), with a native, keyboard-operable control that shows the current value in WPM.
2. THE default speed SHALL be 6 WPM (unit 200 ms), slow enough for a first try.
3. THE dot/dash, letter and word thresholds SHALL follow the speed (2u, 2u and 5u by default).
4. A speed change SHALL apply to the next press; text already decoded SHALL NOT change.
5. **[Cuttable]** THE kit SHALL offer an adaptive threshold, on by default in one-key mode: after each finished letter it re-estimates the unit from the user's recent presses, so a user who taps slower or faster than the setting still gets the right symbols.
6. **[Cuttable]** THE adaptive estimate SHALL stay inside the speed range of 4.1, SHALL change by at most 25% per letter, SHALL be a pure function of the earlier presses, and SHALL be shown on screen as the current WPM.
7. **[Cuttable]** THE user SHALL be able to turn the adaptive threshold off, which returns to the speed setting.
## Requirement 5: Letter and word gaps
**User story:** As a user, I want letters and words to end where I mean them to, with or without relying on pauses, so that I'm never rushed.
Acceptance criteria:
1. WHILE automatic gaps are on (the default), THE kit SHALL end a letter when the gap after a symbol reaches the letter threshold, and SHALL add a word space when it reaches the word threshold.
2. THE pad SHALL always offer an "end letter" control and a "space" control, by key and by button, which end the current letter or add a word space at once, whatever the timing.
3. THE user SHALL be able to switch to manual gaps, where letters and words end only through the controls of 5.2. Together with two-key mode (2.2) and Done (6.1), this makes Morse usable with no timing at all.
4. A pause of any length SHALL NOT submit, clear or discard the answer. Gap timing only ends letters and words.
## Requirement 6: Live decoding line and editing
**User story:** As a user, I want to see what the kit has understood while I tap, and fix it, so that I don't have to start over after a mistake.
Acceptance criteria:
1. THE pad SHALL show a decoding line with the symbols of the current letter and the text decoded so far, updated after each symbol and each finished letter.
2. THE decoding line SHALL be readable by screen readers. Finished letters and word spaces SHALL be announced through one polite live region, one letter at a time; dots and dashes SHALL NOT be announced one by one.
3. THE pad SHALL offer Backspace, by key and by button: it removes the last symbol of the current letter, or, when no letter is in progress, the last decoded character.
4. THE pad SHALL offer Clear as a button only (no single key), which empties the current Morse answer.
5. THE pad SHALL offer Done, by key and by button, which ends any letter in progress and sends the decoded text as a candidate. Nothing else sends a Morse answer.
6. IF Done is pressed with no decoded text, THEN THE pad SHALL show a message and send no candidate.
## Requirement 7: Reference chart and practice mode
**User story:** As a user who doesn't know Morse by heart, I want a chart and a safe place to practice, so that I can learn without affecting my answer.
Acceptance criteria:
1. THE pad SHALL offer a reference chart of every supported character and its code, open from the pad by keyboard and pointer, as an accessible table in EN and ES.
2. THE chart SHALL be readable by screen readers: each code is given in words (for example "dot dash") as well as symbols, and opening it SHALL NOT clear the answer in progress.
3. **[Cuttable]** THE pad SHALL offer a practice mode in which taps are decoded on the decoding line as usual but never become an answer candidate.
4. **[Cuttable]** Practice mode SHALL be clearly labeled as practice, and leaving it SHALL return to the answer with the answer in progress unchanged.
## Requirement 8: Confirmation
**User story:** As a user, I want to check what the decoder understood before the ghost evaluates it, so that a decoding slip doesn't count against me.
Acceptance criteria:
1. WHEN Done sends a Morse candidate, THE confirmation step (spec a requirement 7) SHALL show the decoded text, the method "Morse code" / "Código Morse", and the trace after the text, labeled so screen reader users can skip it.
2. IF the answer contains an unknown code (3.3), THEN THE confirmation step SHALL show a notice next to the text, through the existing `AnswerCandidate.notice`, saying some letters weren't recognized.
3. Edit SHALL prefill the typed answer field with the decoded text (spec a 7.3). Answer again after a Morse answer SHALL move focus to the Morse pad, with an empty answer.
4. THE evaluator SHALL read only the confirmed text. Press timing, the trace and the settings SHALL NOT be used in evaluation or feedback.
## Requirement 9: Accessibility
**User story:** As a keyboard, switch or screen reader user, I want Morse to work like the rest of the app, so that it opens a door instead of closing one.
Acceptance criteria:
1. EVERY Morse control (pad, mode, gaps, speed, adaptive, end letter, space, Backspace, Clear, Done, chart, practice) SHALL be keyboard operable, with a visible label and focus indicator and a logical focus order.
2. THE pad SHALL have an accessible name and instructions that say which keys do what in the current mode, in EN and ES.
3. THE pad SHALL NOT trap focus: Tab and Shift+Tab always leave it, and they are never Morse keys.
4. Morse input SHALL have no hard time limit; every timing value is adjustable (4.1) or avoidable (5.3), as steering `accessibility-ethics.md` requires.
5. THE pressed state and decoding updates SHALL NOT flash. WHILE reduced motion is on (media query or the motion toggle of spec a 3.7), THE pad SHALL use no animation for feedback.
6. Text and controls SHALL meet the contrast rules of steering `accessibility-ethics.md` (text at least 4.5:1, control edges and the pressed state at least 3:1).
7. THE pad, chart and controls SHALL fit a 320 px wide viewport without horizontal scrolling, and SHALL work at 200% text size.
## Requirement 10: Input-method coverage and the Preview rule
**User story:** As a user of a browser without speech recognition, I want two real ways to answer, so that I get the full practice instead of a Preview.
Acceptance criteria:
1. `apps/ghost-interview` SHALL register the keyboard, voice and Morse adapters. `apps/ghost-defense` keeps `preview: true` until spec (f).
2. THE pack validator and the runtime check of spec (b) 10.3 SHALL count Morse like any other method: each question needs at least 2 available methods.
3. WHERE Morse is registered, a browser without `SpeechRecognition` SHALL have 2 available methods (keyboard and Morse), so the session SHALL NOT run as a Preview session there.
4. THE texts that offer typing as the only alternative SHALL also name Morse, in EN and ES: the voice messages (`voice.unavailable`, `voice.empty` and the `voice.error.*` keys), the ghost-interview intro, and the landing page (`site/index.html`), which also still calls Ghost Interview a Preview. The method label `method.morse` ("Morse code" / "Código Morse") already exists.
## Requirement 11: Copy and privacy
**User story:** As a user, I want clear Morse instructions in my language and an honest statement of what happens to my taps, so that I can trust the input.
Acceptance criteria:
1. EVERY new string SHALL exist in both the `en` and `es` catalogs (spec a 9.3), with informal "tú" in Spanish and the ghost persona rules for ghost-voiced messages.
2. THE privacy notice SHALL say, in EN and ES, that Morse taps are decoded in the browser, that no timing data or Morse code is sent anywhere or stored, and that only the confirmed text is used, like a typed answer.
3. THE kit SHALL NOT log, store or send press timestamps, traces or settings, and SHALL keep the decoded text only in memory, like other answers (steering `accessibility-ethics.md`).
4. THE README SHALL list Morse among the input methods with an honest status.
## Requirement 12: Tests
**User story:** As the developer, I want the Morse logic proved by properties and the pad tested by keyboard, so that the definition of done can be applied to every task.
Acceptance criteria:
1. THE core SHALL have fast-check property tests (continuing the numbering after P14):
   - round trip: for any text over the supported characters, decoding the encoding equals the normalized text;
   - the encoder's output uses only dots, dashes, letter gaps and word gaps;
   - totality: decoding any symbol sequence never throws, and unknown codes give `?`;
   - recovery: presses built from a symbol sequence at any unit from 60 to 400 ms, with up to ±30% jitter, classify back to the same symbols;
   - classifier monotonicity: making a press longer never turns a dash into a dot, and making a gap longer never merges two letters or two words;
   - scale invariance: multiplying all timestamps and thresholds by the same factor gives the same symbols;
   - determinism of the codec and the classifier;
   - **[Cuttable, with 4.5]** the adaptive estimate stays in range, changes by at most 25% per letter, and for ideal presses at a unit u ends within 10% of u.
2. THE core SHALL keep example tests for readability: "SOS", the empty string, "Ñ", digits and punctuation.
3. THE web or ui package SHALL have component tests of the pad: one-key and two-key mode, auto-repeat ignored, cancelled presses, manual gaps, Backspace, Clear, Done, the empty-answer message, and the single live region.
4. THE end-to-end suite SHALL cover, by keyboard only with the page clock: a Morse answer through confirmation (with the trace) to feedback; Edit and Answer again; a pointer answer in two-key mode; and a browser without `SpeechRecognition` that is no longer a Preview session.
5. THE end-to-end suite SHALL run axe with WCAG 2.2 AA tags on the pad, the chart and practice mode in EN and ES, with reduced motion on and off, and SHALL keep failing on any request to another origin.
## Questions for the owner
1. **Default speed (4.2)**: 6 WPM (unit 200 ms) is proposed for first-time users. Faster?
2. **Keys (2.1, 2.2, 5.2, 6.3, 6.5)**: proposed Space for one-key taps; `.` and `-` for two-key mode; Enter for Done; Backspace for Backspace. The keys for "end letter" and "space" would be fixed in the design. Any keys you want instead?
3. **Adaptive threshold on by default (4.5)**: proposed on in one-key mode, off in two-key mode (where press length doesn't matter). Agree?
4. **Announcing letters (6.2)**: proposed always on for screen readers, one letter at a time. Should there be a switch to silence it?
