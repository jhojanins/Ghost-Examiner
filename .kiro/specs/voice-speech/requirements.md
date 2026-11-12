# Requirements: (b) Voice and speech

## Introduction
This spec gives the ghost a real voice and lets the user answer by voice. The ghost speaks with the browser's `speechSynthesis` and falls back to muted mode (captions plus mouth) whenever speech is missing or fails. The user can answer with `SpeechRecognition`, see live captions of their own words, interrupt the ghost (barge-in), and optionally use a hands-free turn-taking mode. Every voice answer still goes through the confirmation step before evaluation. The privacy notice is updated to say honestly where speech is processed.

The work lives in the kit (`packages/`), so both apps get it. Only `apps/ghost-interview` runs a session in this spec; `apps/ghost-defense` stays a shell until spec (f).

Architecture reference: `docs/ARCHITECTURE.md` D3 (text-driven lip-sync) and D6 (Web Speech API). Spec (a) requirements and design stay in force; this spec only adds to them.

## Delivery phases
- **Phase 1, ghost voice**: requirements 1, 2, 3, plus the matching parts of 11 and 12.
- **Phase 2, voice answers**: requirements 4, 5, 6, 9 and 10, plus the matching parts of 11 and 12. When phase 2 lands, `apps/ghost-interview` stops being a Preview build (10.1).
- **Phase 3, conversation**: requirements 7 and 8, plus the matching parts of 11 and 12.

## Preview-only items
Criteria marked **(Preview only)** apply only to a session that runs as a Preview build. After phase 2, a ghost-interview session runs as Preview only in a browser that offers fewer than 2 input methods, for example Firefox, which has no `SpeechRecognition` by default (requirement 10). After spec (c), Morse (tap) works in every browser, so this case should disappear.

## Out of scope
- **A real-time duplex cloud audio model** (for example a "live" or "realtime" speech-to-speech API). Reasons:
  - It streams the user's raw audio to a third-party model for the whole session. That goes beyond what the browser's own recognition does, and free tiers may use submitted content to improve products and let people review it (the Gemini API free tier does).
  - It answers raw speech directly, so the user could be evaluated on words they never confirmed. That breaks the confirmation rule.
  - It needs an API key, so it can't run in the client, and it needs a long-lived streaming relay that the planned request/response proxy (spec e) doesn't provide.
  - It costs money per audio minute and can't work without a key, while demo mode must work for free with no key.
  - Its generated audio would replace the text-driven timeline that keeps captions and the mouth in sync (D3).
- Asking the browser for on-device recognition (`processLocally`, language packs) and on-device Whisper. These are future work: support is new and uneven, Safari lacks it, and the privacy notice would still have to say "may".
- Voice commands for Confirm, Edit and Retry. The confirmation actions stay keyboard and pointer only.
- Voice answers for the `choice` and `yes-no` answer kinds.
- A voice picker or speech-rate setting for the user.
- Morse (spec c), camera (spec d), real LLM providers and the proxy (spec e), the ghost-defense flow (spec f).

## Glossary
- **Sound on**: the ghost's lines are spoken aloud with `speechSynthesis`, with captions and mouth animation as in spec (a).
- **Muted mode**: as in spec (a): captions and mouth animation only, no audio.
- **Local voice**: a `SpeechSynthesisVoice` with `localService` true, so the line's text is spoken on the device.
- **Listening**: voice input is running and the microphone is in use.
- **Interim result / final result**: partial text that the recognizer may still change, and text it has settled.
- **Barge-in**: the user starts speaking while the ghost is speaking, and the ghost stops.
- **Hands-free mode**: listening starts and ends without a button press; the user still confirms by keyboard or pointer.
- **Silence threshold**: how long the user must stay silent, after saying something, for hands-free mode to end the turn.
- **Available input method**: a registered input adapter whose `checkAvailability()` reports available in the current browser.
- **Preview session**: a session that runs with the Preview flag: the shell shows the Preview label and the pack validator warns instead of failing (spec a 5.5).

## Requirement 1: Ghost speech output
**User story:** As a user, I want to hear the ghost speak in my language, so that the practice feels like a conversation.

Acceptance criteria:
1. THE kit SHALL provide a speech output that implements the existing `SpeechOutput` interface with `speechSynthesis`.
2. IF `speechSynthesis` or `SpeechSynthesisUtterance` is missing, THEN THE ghost SHALL speak in muted mode and the app SHALL show no error.
3. THE kit SHALL choose the ghost's voice for each language with a pure, deterministic function in `packages/core`:
   - only local voices whose language matches the line's language (`en` or `es`);
   - among them, prefer the region of the browser's preferred language, then the browser's default voice, then the first by name.
4. IF no local voice matches the current language, THEN THE ghost SHALL speak that language in muted mode, and the sound control SHALL say that this browser has no voice for that language.
5. WHEN the browser's voice list changes, THE kit SHALL choose the voice again.
6. IF an utterance reports an error, or doesn't start within 2 seconds, THEN THE line SHALL continue in muted mode with captions and mouth, THE rest of the session SHALL be muted, and THE sound control SHALL show that sound was turned off and can be turned on again.
7. WHEN the user switches language while the ghost speaks, THE speech SHALL stop, and the next line SHALL use a voice for the new language.
8. WHEN the runtime cancels a line (entering confirming, barge-in, language switch), THE audio SHALL stop at once.

## Requirement 2: Sound control
**User story:** As a user in a quiet place, or who can't hear, I want to turn the ghost's voice on and off, so that audio never gets in my way.

Acceptance criteria:
1. EVERY session screen SHALL show a visible, keyboard-operable sound control in the same place, which exposes its on/off state to assistive technology.
2. THE sound SHALL be on by default when a local voice is available, and THE ghost SHALL speak aloud only after the user has accepted the privacy notice.
3. WHEN the user turns sound off while the ghost speaks, THE audio SHALL stop at once and the line SHALL continue in muted mode.
4. WHEN the user turns sound on, THE next ghost line SHALL be spoken aloud.

## Requirement 3: Mouth sync and captions with real speech
**User story:** As a user who reads lips or captions, I want the mouth and the caption marker to follow the audio, so that what I see matches what I hear.

Acceptance criteria:
1. WHILE sound is on, THE mouth and the caption marker SHALL keep reading one timeline, built from the line's text (spec a 4.3), with its time origin at the utterance's start event.
2. WHEN the browser fires word boundary events, THE kit SHALL re-sync the timeline to the reported word, and the marker SHALL never move backwards.
3. THE mapping from a boundary event's character index to a word of the timeline SHALL be a pure function in `packages/core`.
4. WHERE the voice fires no boundary events, THE estimated timeline SHALL drive the mouth and the marker, as in muted mode.
5. WHEN the audio ends or is cancelled, THE mouth SHALL go to rest, and only then SHALL the line count as finished.
6. WHILE sound is on, THE transcript SHALL keep each finished ghost line but SHALL NOT announce it through the live region, because the user already heard it. WHILE muted, spec (a) 4.4 applies unchanged.

## Requirement 4: Voice input
**User story:** As a user who finds typing hard, I want to answer by speaking, so that I can practice naturally.

Acceptance criteria:
1. THE kit SHALL provide a voice input adapter that implements `InputAdapter` with the id `voice`, requires the microphone, is not experimental, and supports the `free-text` answer kind.
2. IF neither `SpeechRecognition` nor `webkitSpeechRecognition` exists, THEN `checkAvailability()` SHALL report unavailable with a localized reason, and the voice control SHALL show that reason instead of a working button.
3. THE app SHALL ask for microphone permission only when the user starts voice input, never on page load.
4. THE answer screen SHALL offer a visible, keyboard-operable button to start and stop listening.
5. WHILE listening, THE app SHALL show a visible listening indicator that doesn't rely on color alone, and stopping SHALL take one action.
6. THE recognizer SHALL use the current interface language, with the region of the browser's preferred language when it matches. WHEN the user switches language while listening, listening SHALL continue in the new language and keep the text recognized so far.
7. WHEN the user stops listening, THE adapter SHALL emit a candidate with the final text and the method `voice`.
8. IF the recognized text is empty or only whitespace, THEN THE adapter SHALL NOT emit a candidate, and the app SHALL say what to do next, in the ghost persona's tone.
9. IF the browser ends recognition on its own before the user stops (for example after a pause), THEN THE adapter SHALL keep the text so far and keep listening, so that speaking has no time limit.
10. IF recognition fails (permission denied, no microphone, service unreachable, language not supported), THEN THE app SHALL say what happened and what to do, in the ghost persona's tone, and keyboard input SHALL stay usable. IF some text was already recognized, THEN THE adapter SHALL emit it as a candidate.
11. THE keyboard input SHALL stay available while listening.
12. THE app SHALL receive only text from the recognizer; it SHALL NOT record, store, upload or log audio.

## Requirement 5: Live captions of the user's speech
**User story:** As a user, I want to see my words appear while I speak, so that I know I'm being understood.

Acceptance criteria:
1. WHILE listening, THE app SHALL show the recognized text live in a caption area labeled as the user's words, separate from the ghost's captions.
2. THE interim part SHALL look different from the final part in a way that doesn't rely on color alone, and all caption text SHALL have contrast of at least 4.5:1.
3. THE user's captions SHALL NOT be announced on every update. Assistive technology SHALL get one polite announcement when listening starts and one when it stops; the final text reaches it through the confirmation view (spec a 7.2).
4. THE user's captions SHALL carry a `lang` attribute that matches the recognition language.
5. THE user's captions SHALL NOT cover the focused element.

## Requirement 6: Confirmation of voice answers
**User story:** As a user, I want to check what the recognizer heard before it counts, so that I'm never judged on a mistake.

Acceptance criteria:
1. A voice candidate SHALL go through the confirmation step of spec (a) requirement 7, labeled with the method Voice, before any evaluation.
2. WHEN the user chooses Edit, THE keyboard input SHALL open with the recognized text prefilled.
3. WHEN the user chooses Retry after a voice answer, THE focus SHALL move to the voice button; in hands-free mode, listening SHALL start again.
4. NO mode, including hands-free, SHALL confirm an answer automatically.

## Requirement 7: Barge-in
**User story:** As a user, I want the ghost to stop talking when I start, so that I don't have to wait for it.

Acceptance criteria:
1. WHILE the ghost speaks and voice input is listening, WHEN the recognizer reports the first non-empty result, THE ghost SHALL stop speaking.
2. WHEN barge-in happens, THE full ghost line SHALL stay readable in the captions and SHALL be added to the transcript.
3. WHEN barge-in happens in muted mode, THE mouth SHALL go to rest and the full line SHALL stay readable.
4. Barge-in SHALL NOT change the session phase on its own; the user's speech continues as a normal voice answer.

Known risk for the design: through loudspeakers, the recognizer may hear the ghost's own voice and trigger a false barge-in. The design must state a mitigation and how it is tested.

## Requirement 8: Hands-free turn-taking (optional)
**User story:** As a user who can't easily press buttons, I want listening to start and stop by itself, so that I can answer with my voice alone.

Acceptance criteria:
1. Hands-free mode SHALL be off by default and SHALL be turned on with a keyboard-operable switch that explains in plain text what it does.
2. IF voice input is unavailable, THEN THE switch SHALL be disabled and SHALL show the reason.
3. WHILE hands-free is on, WHEN the ghost finishes asking a question (audio end, or timeline end in muted mode), listening SHALL start automatically, with the indicator and one-action stop of 4.5.
4. WHILE hands-free is on, WHEN text has been recognized and the user stays silent for the silence threshold, listening SHALL stop and the candidate SHALL go to confirmation.
5. Silence before any text is recognized SHALL NOT end the turn.
6. THE user SHALL be able to set the silence threshold from 1 to 10 seconds in 0.5-second steps, with a default of 2 seconds, through a labeled, keyboard-operable control that shows the current value.
7. THE rule that decides when a hands-free turn ends SHALL be a pure function in `packages/core`.

## Requirement 9: Honest privacy notice for speech
**User story:** As a user, I want to know where my voice goes before I use it, so that I can choose to type instead.

Acceptance criteria:
1. THE privacy notice SHALL add a paragraph in EN and ES saying that:
   - when you answer by voice, your browser turns speech into text, and depending on the browser this can happen on the servers of the company that makes it (for example Google for Chrome, Apple for Safari), so your voice may leave your device;
   - the app itself receives only the text and never records or stores audio;
   - voice is optional and typing always works.
2. THE notice SHALL say that the ghost's voice uses voices installed on the device.
3. NO sentence in the notice SHALL contradict 9.1. The current texts "here is what happens with what you type" and "Demo mode runs entirely in your browser. Your answers are not sent to any server" SHALL be reworded so they stay true for spoken answers.
4. THE notice SHALL NOT claim that recognition happens on the device, even where a browser may do so.
5. THE voice button SHALL carry a short visible note with the same point as 9.1 and a link to the privacy notice.
6. THE new texts SHALL be plain and without jokes, like the rest of the notice.

## Requirement 10: Input-method coverage and the Preview flag
**User story:** As a user of a browser without speech recognition, I want the app to keep working and tell me why voice is missing, so that I'm never blocked or misled.

Acceptance criteria:
1. WHEN phase 2 lands, `apps/ghost-interview` SHALL register the keyboard and voice adapters and set its Preview flag to `false`. `apps/ghost-defense` keeps `preview: true` until spec (f).
2. THE pack validator SHALL keep checking each question against the registered input methods (spec a 5.5); with keyboard and voice registered, the ghost-interview pack passes.
3. WHEN a session starts, THE kit SHALL also count, for each question, the available input methods. An unavailable method SHALL never count toward the 2-method rule.
4. **(Preview only)** IF fewer than 2 methods are available for a question because the browser lacks an API, THEN THE session SHALL run as a Preview session: the validator reports warnings, the session starts, and the shell shows the Preview label.
5. **(Preview only)** In a Preview session, THE Preview detail text SHALL name the missing method and the method the user can use now, in EN and ES, without blaming the user (for example: "Voice input isn't available in this browser. You can type your answers; Morse is coming."). The current text "Keyboard only for now. Voice and Morse are coming." SHALL NOT appear in a browser where voice works.
6. Microphone permission being denied, or a missing microphone, SHALL NOT make the session a Preview session; the voice control explains the problem as in 4.10.

Note: before phase 2 is marked done, the owner updates the steering line "Preview ends when voice input lands in spec (b)" (`accessibility-ethics.md`) to match 10.4.

## Requirement 11: New controls and copy
**User story:** As a keyboard or screen reader user, I want the new voice controls to work like the rest of the app, so that nothing new shuts me out.

Acceptance criteria:
1. EVERY new string SHALL exist in both the `en` and `es` catalogs (the compiler check of spec a 9.3), with informal "tú" in Spanish and the ghost persona rules for ghost-voiced messages.
2. EVERY new control SHALL be keyboard operable, have a visible label and focus indicator, and fit a 320 px wide viewport without horizontal scrolling.
3. THE focus order SHALL stay logical when the voice, sound and hands-free controls are added.
4. NO new visual effect SHALL flash; the listening indicator SHALL respect reduced motion.

## Requirement 12: Tests
**User story:** As the developer, I want speech features tested without a real microphone, so that the definition of done can be applied to every task.

Acceptance criteria:
1. THE core SHALL have fast-check property tests for:
   - voice selection (deterministic; only local voices of the requested language; the preference order of 1.3);
   - the boundary mapping of 3.3 (the result is a valid word index; it is the word that contains the character; it never decreases for increasing character indexes);
   - the hands-free turn rule of 8.7 (a turn ends if and only if text exists and silence reached the threshold).
2. THE web package SHALL have unit tests of the speech output and the voice adapter against fake `speechSynthesis` and `SpeechRecognition` objects: missing API, errors, start timeout, early end and restart, empty text, language switch, cancel.
3. THE end-to-end suite SHALL replace both speech APIs with fakes before the page loads, and SHALL cover, by keyboard only: a voice answer with live captions, confirmation and feedback; barge-in; hands-free with the silence threshold; a browser without `SpeechRecognition` (Preview label with the reason, keyboard answer works); and muted fallback when no voice exists.
4. THE end-to-end suite SHALL run axe with WCAG 2.2 AA tags on the new screens and states in EN and ES, with reduced motion on and off, and SHALL keep failing on any request to another origin.
5. THE owner SHALL check voice input and the ghost's voice once by hand in Chrome and in Safari with a real microphone, because automated runs can't use the vendors' recognition services, and the result SHALL be logged in `docs/KIRO_USAGE.md`.

## Decisions for the owner
1. **Browsers without speech recognition (requirement 10)**: recommended: `preview: false` plus a Preview session decided at runtime (10.4). Alternative: keep `preview: true` until Morse lands in spec (c). Either way, the steering line in `accessibility-ethics.md` needs your wording (note after 10.6).
2. **Local voices only (1.3)**: recommended, because the ghost's lines will later quote the user's document (spec f) and a network voice sends that text to the vendor. Cost: browsers with only network voices (for example Chrome on Linux) get muted mode.
3. **Defaults**: sound on after the privacy notice (2.2); hands-free silence threshold 2 s, range 1 to 10 s (8.6); speech start timeout 2 s (1.6).
4. **"Keyboard hardening"**: `docs/ARCHITECTURE.md` §6 lists it under spec (b), but it isn't in your scope for this spec. Should it be dropped from the schedule, or did you mean something specific?

## Sources
Content was rephrased for compliance with licensing restrictions.
- [MDN: Using the Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API): by default recognition uses a server-based engine, so audio is sent to a web service and it doesn't work offline; on-device recognition is opt-in.
- [MDN: SpeechRecognition.processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally): defaults to `false`, in which case the browser may process locally or remotely.
- [Chromium blink-dev: Intent to ship on-device Web Speech API](https://groups.google.com/a/chromium.org/g/blink-dev/c/VNOok2dbmHM): in on-device mode neither audio nor transcript goes to a third party.
- [Chromium issue 521896368](https://issues.chromium.org/issues/521896368): with `processLocally=false`, Chrome may still run on the device when a language pack is installed.
- [AssemblyAI: Speech recognition in JavaScript with the Web Speech API](https://www.assemblyai.com/blog/speech-recognition-javascript-web-speech-api): Chrome sends audio to Google's servers and Safari to Apple's.
- [MDN: SpeechSynthesisVoice.localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService): `false` means a remote synthesis service.
- [Chromium issue 40064827](https://issues.chromium.org/issues/40064827): a report that Chrome's network voices fire word boundary events only for en-US.
- [Chromium issue 572750556](https://issues.chromium.org/issues/572750556): on macOS, `speechSynthesis` can stop working until Chrome restarts (reason for the start timeout in 1.6).
