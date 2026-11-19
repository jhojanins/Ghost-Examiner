# Requirements: Ghost Defense live
## Introduction
This spec builds the headline experience: a conversation with the ghost about a file the user made. The user uploads their own work, sees the text the app extracted from it, and agrees to what will be sent. The ghost then asks questions grounded in the file. The user answers by voice when the browser supports it, or by typing. The ghost replies with a correction or a follow-up that quotes the file, in close to real time.
It merges two earlier plans: (e) real LLM providers with the Netlify proxy, and (f) the ghost-defense app (`docs/ARCHITECTURE.md` §6). Video-call visuals come later and are not part of it. Spec (c) Morse is paused and its docs stay as they are.
The work lives in the kit (`packages/`) where it is reusable (document parsing, providers, streaming, the conversation engine, prompt templates) and in `apps/ghost-defense` (content, copy, screens). `apps/ghost-interview` may use the same provider through the same consent, as a cuttable last step (requirement 16).
Architecture references: `docs/ARCHITECTURE.md` D7 (demo always, proxy by default, optional BYOK), D9 (hand-written type guards), D10 (local document parsing). The skills `netlify-proxy-safety` and `prompt-injection-defense` apply. Specs (a) and (b) stay in force; this spec only adds to them.
## Delivery phases and scope-cut rule
- **Phase 1, offline conversation (mandatory)**: requirements 1, 2, 4, 6, 7, 8, 12 and 14, with the demo provider only. The whole flow works with no network and no key.
- **Phase 2, real AI (mandatory)**: requirements 3, 9, 10, 11 and 13, with the proxy and one real provider, without streaming. Replies arrive whole.
- **Phase 3, real-time feel (mandatory, cut last)**: requirement 5, streaming and sentence-by-sentence speech.
- Items marked **[Cuttable]** may be dropped if we are behind, in this order: first bring-your-own-key (11.6 to 11.9), then real AI in ghost-interview (requirement 16), then PDF parsing (1.3 to 1.5, keeping `.txt` and `.md`), then streaming (requirement 5, keeping phase 2). Everything else is mandatory.
- Requirement 15 (tests) applies to every phase. Each phase must leave the app working end to end, so a cut never leaves a broken screen.
## Out of scope
- Video-call visuals (a call layout, a self-view tile, gaze). Camera work stays in spec (d).
- DOCX, ODT, RTF, slides, spreadsheets, HTML and source-code archives. Scanned PDFs and images (no OCR). Password-protected or encrypted PDFs. Files over the limits of 1.6.
- Accounts, server-side storage of any kind of user data, sharing sessions.
- Grading or plagiarism verdicts. Results are practice feedback only (steering `accessibility-ethics.md`).
- Tools, browsing or code execution for the model. Model output is never executed or rendered as HTML or Markdown.
- Real-time duplex audio models (spec b, out of scope for the same reasons).
- Morse (spec c, paused) and signs.
- Saving the summary as a file (owner decision 4). Only copying it to the clipboard is offered (8.5).
## Glossary
- **File**: the one document the user uploads for a session.
- **Extracted text**: the plain text the app gets from the file, in the browser. It is the only form of the file the app uses.
- **Excerpt**: a numbered piece of the extracted text (for example a section or a few paragraphs), with an id. Only excerpts are ever sent to a provider.
- **Provider**: an implementation of the kit's `LLMProvider`: demo (offline rules), proxy (our Netlify Function holding the owner's key), or bring-your-own-key (BYOK, the user's own key, sent only to that provider).
- **Real mode / demo mode**: a session whose questions and replies come from a real model, or from the offline rules.
- **Turn**: one ghost question, the user's confirmed answer, and the ghost's reply.
- **Reply**: the ghost's response to an answer: a correction (something in the answer disagrees with the file), a follow-up (a further question on the same point), or an acknowledgment. A correction always carries a quote.
- **Quote**: an exact passage of the extracted text that a question or reply relies on.
- **Not in the file**: the ghost's statement that the file doesn't cover something, used instead of an invented fact.
- **First sentence latency**: the time from the user's confirmation to the first sentence of the reply appearing in the captions.
- **Kill switch**: an owner-controlled setting that makes the proxy refuse every request, so all sessions use demo mode.
## Requirement 1: Upload and local parsing
**User story:** As a student, I want to give the ghost my own work, so that it can question me about what I actually wrote.
Acceptance criteria:
1. THE upload screen SHALL warn, above the file picker, in EN and ES, not to upload sensitive, confidential or personal documents (steering `accessibility-ethics.md`), and name the active provider.
2. THE app SHALL accept one file per session through a native, keyboard-operable file input; drag and drop MAY be offered as well, never as the only way.
3. THE app SHALL extract text locally in the browser from `.txt` and `.md` files (UTF-8), and **[Cuttable]** from PDF files that have a text layer.
4. **[Cuttable]** THE PDF parser SHALL be loaded only when a PDF is chosen (lazy loading), SHALL read text only, and SHALL never run scripts, open links or fetch resources from the file.
5. **[Cuttable]** IF a PDF has no extractable text (for example a scan), THEN THE app SHALL say so and suggest pasting or uploading the text instead.
6. THE app SHALL reject, with a message that says why and what to do: files over 2 MB, PDFs over 50 pages, files that aren't one of the accepted types, and files whose extracted text is under 300 characters. IF the extracted text is over 60,000 characters, THEN THE app SHALL use the first 60,000 and say that the rest is ignored.
7. THE app SHALL offer a paste-text alternative to upload, with the same limits, for users who can't use the file picker or have another format.
8. Parsing SHALL NOT send the file or its text anywhere. The file and the extracted text SHALL exist only in memory (requirement 12).
9. THE app SHALL split the extracted text locally into excerpts with stable ids, keeping headings and paragraph boundaries where the format has them.
10. THE upload screen SHALL offer "Try with a sample file" with two fictional sample files bundled in the app, one in English and one in Spanish. Choosing one SHALL load it exactly like an upload (the same preview and consent), without the file picker, and the preview SHALL label it as a fictional sample (owner decision 7).
## Requirement 2: Showing what was extracted
**User story:** As a user, I want to see the text the ghost will work from, so that I know what it can and can't see.
Acceptance criteria:
1. AFTER parsing, THE app SHALL show the extracted text in a readable, scrollable view, with its length in characters, the number of excerpts, and any warning (truncated, very short, no headings found).
2. THE app SHALL say plainly that the ghost sees only this text: no images, tables as layout, or hidden content it can't extract, and that PDFs can contain hidden text the app can't detect.
3. THE user SHALL be able to remove the file and choose another, which clears the extracted text from memory.
4. THE user SHALL choose the file's language (English or Spanish, default the interface language), so quotes are marked with the right `lang` for screen readers. The ghost always speaks the interface language.
5. THE view SHALL be keyboard and screen reader accessible: the text is real text (not an image), headings found in the file are exposed as headings, and the view never traps focus.
## Requirement 3: Consent before anything is sent
**User story:** As a user, I want to know exactly what leaves my device before it does, so that I can choose the offline mode instead.
Acceptance criteria:
1. BEFORE the first request to a real provider in a session, THE app SHALL show a consent screen, in EN and ES, that states:
   - the provider and the model family by name (for example "Google Gemini, through this site's server" or "Groq, with your own key");
   - what is sent: excerpts of the extracted text (never the file itself), the ghost's questions, and the user's confirmed answers, with the maximum size per request;
   - what is not sent: the file, the rest of the text, audio, camera data, and anything typed but not confirmed;
   - that this app stores nothing, and that the proxy doesn't log what is sent;
   - the provider's data use in plain words, including, where it applies, that a free tier may use submitted content to improve its products and let human reviewers read it;
   - that answers and replies are practice feedback, not a grade.
2. THE consent screen SHALL offer two equally prominent choices, "Continue with AI" and "Continue offline (demo)", and SHALL NOT preselect either one.
3. NO request with file text or answers SHALL leave the browser before the user picks "Continue with AI". A test SHALL prove it (requirement 14).
4. IF the provider changes during the session (fallback from BYOK to the proxy, requirement 10), THEN THE app SHALL ask for consent again before sending to the new provider. A fallback to demo needs no consent.
5. THE privacy notice of spec (a) SHALL gain the real-mode points in EN and ES, and the current sentence "This app sends your answers to no server" SHALL be reworded so it is true in both modes (Revisit-later note "Privacy text for real mode").
## Requirement 4: The conversation loop
**User story:** As a student, I want the ghost to ask about my work and react to what I say, so that I find out whether I really understand it.
Acceptance criteria:
1. A session SHALL have 4 main questions by default, so a first try takes about 2 minutes. THE user SHALL be able to choose 3 to 8 before the session starts.
2. THE ghost SHALL open with a short spoken introduction and its first question. Every question SHALL be grounded in one excerpt and SHALL show the quote it is about, marked as a quote from the user's file.
3. Questions SHALL check understanding (why, how, what if, what does this mean, how would you defend this), not recall of exact wording. They SHALL be one question at a time, at most about 25 words (ghost persona).
4. THE user SHALL answer by voice where the browser supports it, or by typing, with the input methods and the confirmation step of specs (a) and (b) (requirement 7).
5. AFTER each confirmed answer, THE ghost SHALL reply with one of:
   - a correction, when the answer disagrees with the file: what the file says, with the quote;
   - a follow-up question on the same point, when the answer is partial or vague;
   - an acknowledgment that names one specific strength, when the answer matches the file.
6. Each main question SHALL have at most one follow-up. A follow-up's answer gets a reply that is a correction or an acknowledgment, never another follow-up. Follow-ups don't count toward the number of main questions.
7. THE ghost SHALL be kind and specific (ghost persona); it SHALL never mock the user, comment on their voice, accent or speed, or present a reply as a verdict.
8. THE user SHALL be able to skip a question ("Next question") and to end the session early, which goes to the summary (requirement 8).
9. THE session SHALL have no time limits. While waiting for the model, the ghost SHALL show its thinking pose and MAY say a short scripted local line; no timer is shown.
10. THE engine SHALL keep the turn history in memory only, and send the model only what each request needs (requirement 9.4).
## Requirement 5: Real-time feel **(Phase 3)**
**User story:** As a user, I want the ghost to start answering right away, like a person, so that it feels like a conversation and not a form.
Acceptance criteria:
1. IN real mode, THE proxy and the client SHALL stream the reply, and THE client SHALL show and speak it sentence by sentence as sentences complete, with the existing speech output, captions and mouth of specs (a) and (b).
2. Latency budget, measured from the user's confirmation, with the chosen provider under normal conditions:
   - the thinking pose within 100 ms (local);
   - the first sentence of the reply in the captions within 2 s at the median and 4 s at the 90th percentile;
   - its speech starting within 300 ms after the sentence appears, when sound is on;
   - the opening question within 6 s of "Continue with AI", with a local scripted line spoken while waiting.
3. IF no first sentence arrives within 8 s, THEN THE turn SHALL fall back (requirement 10) and say so.
4. A streamed sentence SHALL be shown or spoken only after it passes the per-sentence checks of 9.6. THE parts that need the whole reply (its kind and its quote) SHALL be checked before the quote is shown (requirement 6).
5. Screen readers SHALL get each finished ghost line once through the transcript (spec a 4.6, spec b 3.6), never word by word or per token.
6. IN demo mode and when streaming is cut, THE reply SHALL arrive whole and be spoken line by line as today; the rest of this spec SHALL work the same.
7. Hands-free and barge-in (spec b requirements 7 and 8) are not used in this spec (7.3).
## Requirement 6: Grounding, quotes and "not in the file"
**User story:** As a student, I want every correction to show me where in my file it comes from, so that I can trust it and check it.
Acceptance criteria:
1. EVERY question and every correction SHALL carry a quote: a passage from the excerpt it relies on.
2. THE app SHALL check every quote locally against the extracted text (after the same normalization of spaces, quotes and case on both sides). A quote that isn't found SHALL NOT be shown as coming from the file.
3. IF a correction's quote isn't found, THEN THE app SHALL drop the correction and the ghost SHALL say, in its own words, that it can't point to that part of the file, without inventing one.
4. IF a question's quote isn't found, THEN THE question SHALL be dropped and replaced by the next valid one, or by a demo question when none is left.
5. WHEN the user's answer refers to something the file doesn't cover, THE ghost SHALL say that it is not in the file, instead of confirming or correcting it from general knowledge.
6. THE ghost MAY add general knowledge only when it is labeled as not from the file, and SHALL never present it as a correction.
7. Quotes SHALL be shown as quotes (a `blockquote` with the file's `lang`), with a short label ("From your file" / "De tu archivo"), and SHALL be part of the transcript.
## Requirement 7: The confirmation step in a conversation
**User story:** As a user, I want to check what the app understood without slowing the conversation down, so that I'm never judged on a mistake and still feel I'm talking.
Acceptance criteria:
1. EVERY answer SHALL be shown and confirmed before it is sent or evaluated (spec a requirement 7, steering `accessibility-ethics.md`). No mode SHALL confirm automatically (spec b 6.4).
2. THE confirmation SHALL be inline (owner decision 3, options B and C of the requirements review):
   - THE interpreted answer (the transcript or the typed text) SHALL stay in the answer area, with its method and any notice, and a "Send" button with focus, so Enter confirms;
   - WHEN the user stops speaking, focus SHALL land on Send once the transcript is final, so stopping and then pressing Enter is the whole action;
   - Edit SHALL edit the text in place, and Answer again SHALL restart the current method;
   - confirmation SHALL always be an explicit user action; nothing is sent when Send isn't pressed.
3. Hands-free and barge-in from spec (b) phase 3 (options D and E) are not part of this spec; the owner re-evaluates them after the Chrome check.
4. THE interpreted answer, its method and any notice (spec b) SHALL be visible, and announced once, before confirmation, and the whole step SHALL work by keyboard alone.
## Requirement 8: Session summary
**User story:** As a student, I want a short summary at the end, so that I know what to review.
Acceptance criteria:
1. AFTER the last turn, or when the user ends early, THE ghost SHALL give a summary: the questions, one strength, and up to three points to review, each with its quote from the file.
2. THE summary SHALL be labeled as practice feedback, never a grade, score or verdict, and SHALL say whether it came from AI or from the offline demo rules.
3. THE summary SHALL be readable as text (headings and lists), spoken by the ghost in short lines, and complete in the transcript.
4. THE user SHALL be able to start again with the same file or a new one, or remove the file.
5. THE summary SHALL offer a "Copy summary" button that copies it as plain text to the clipboard, with a polite confirmation message. The app SHALL NOT save it as a file or anywhere else (owner decision 4).
## Requirement 9: Provider abstraction and output validation
**User story:** As the developer, I want every model call to go through the kit's provider interface with strict checks, so that a bad or hostile reply can never break the app or mislead the user.
Acceptance criteria:
1. ALL model access SHALL go through the kit's `LLMProvider` interface (spec a 8.1). THE task list SHALL grow from `evaluate-answer` to the fixed tasks this spec needs (for example question generation, the turn reply and the summary); the design fixes the list.
2. EACH task SHALL have a fixed input shape with maximum lengths, and a fixed output schema checked by a strict hand-written guard in `packages/core`, in the style of `isFeedback`: exact keys, known values, length caps, and every quote and excerpt id checked against the session's excerpts (D9).
3. Output that fails its guard SHALL count as `bad-output` and go to the fallback of requirement 10. Model text SHALL be rendered as plain text only: no HTML, no Markdown, no links (prompt-injection-defense skill).
4. EACH request SHALL send only the excerpts it needs, at most 6,000 characters of file text, plus the current question and the confirmed answer (summaries: the turn history in short form). THE design SHALL confirm these caps against the chosen provider's limits.
5. THE `LLMProvider` interface SHALL gain an optional streaming method; providers without it (the demo provider) keep working, and the client treats them as non-streaming (5.6).
6. Per-sentence checks for streamed text: plain text only, no markup or URLs, at most 300 characters per sentence and the task's total cap. A failed check ends the stream and counts as `bad-output`.
7. THE demo provider SHALL implement every new task offline and deterministically (heuristic questions from headings and key sentences, keyword overlap with the excerpt for replies, D10), and SHALL always pass the guards.
## Requirement 10: Honest fallback to demo mode
**User story:** As a user, I want the session to keep going when the AI is unavailable, and to be told, so that I'm never misled about who is answering.
Acceptance criteria:
1. THE provider chain SHALL be BYOK (when set) → proxy → demo, with the kit's `withFallback`: one pass, no retry loops.
2. WHEN a request fails (`rate-limited`, `unavailable`, `bad-output`, `too-large`, a timeout, the kill switch, or a limit of requirement 11), THE turn SHALL continue with the next provider, and the ghost SHALL say so in one short line in its voice (for example "My crystal ball is busy. I'll continue with my own notes.").
3. FROM the first fallback to demo, THE rest of the session SHALL stay in demo mode, and THE screen SHALL show a persistent label: "Demo mode: questions and feedback come from simple rules, not AI" / its ES version. The user MAY try AI again from the next session.
4. Demo feedback SHALL keep the existing "keyword-based demo" labeling (spec a) and SHALL never be presented as AI output.
5. A fallback SHALL NOT lose the turn: the confirmed answer is kept and evaluated by the next provider.
## Requirement 11: Netlify proxy, limits and BYOK
**User story:** As the owner, I want judges to try the real AI without an account, while my key stays secret and nobody can run up costs or abuse it.
Acceptance criteria:
1. THE proxy SHALL be a Netlify Function at a fixed same-origin path that accepts only the fixed tasks of 9.1, builds every prompt on the server from `@ghost-examiner/core` templates, and rejects any other shape (netlify-proxy-safety skill).
2. THE provider key SHALL live only in a Netlify environment variable for Functions; it SHALL never be in the repo, the client bundle (no `VITE_` prefix), logs or responses. A build check SHALL fail if a key pattern appears in `dist/`.
3. Limits, all enforced on the server:
   - per visitor: a request rate limit per IP and domain (Netlify rate limiting);
   - global: a daily cap on requests for the whole site, 300 to start, stored with the kill switch so the owner can change it without a deploy; at the cap every request gets `rate-limited` and the ghost continues in labeled demo mode (requirement 10);
   - per request: the input caps of 9.4 and a `maxOutputTokens` cap per task;
   - per session: a maximum number of requests (questions plus replies plus the summary), enforced as far as a stateless function can, and always enforced by the client.
4. A kill switch SHALL make the proxy answer every request with a refusal that the client turns into demo mode (requirement 10). THE design SHALL say how fast it takes effect and whether it needs a deploy (research).
5. THE proxy SHALL check the `Origin` header against the site and its deploy previews, log only the task, status code and latency, and never forward upstream error bodies.
6. **[Cuttable]** THE user MAY enter their own key for a supported provider, in a password-type field with paste allowed, on the consent screen.
7. **[Cuttable]** A BYOK key SHALL be kept only in memory for the page (no `localStorage`, `sessionStorage`, IndexedDB or cookies), SHALL be sent only to that provider's API, never to our proxy, and SHALL be removable with a "Forget key" button.
8. **[Cuttable]** With BYOK, THE consent screen SHALL name that provider and its own data-use terms.
9. **[Cuttable]** THE GitHub Pages mirror (D8) has no proxy, so there THE choices SHALL be BYOK or demo.
## Requirement 12: No storage
**User story:** As a user, I want my file, answers and keys to disappear when I close the page, so that I can try this without worry.
Acceptance criteria:
1. THE file, the extracted text, the excerpts, the answers, the replies, the summary and any key SHALL live only in memory and SHALL be gone when the page closes. THE app SHALL NOT use `localStorage`, `sessionStorage`, IndexedDB, the Cache API or cookies for any of them.
2. THE proxy SHALL NOT store or log request or response bodies. Any counter it keeps for limits (11.3) SHALL hold no user content.
3. "Remove file" and "End session" SHALL clear the corresponding data at once.
4. THE privacy notice SHALL say, in EN and ES, which of these the chosen provider may keep under its own terms (requirement 3.1).
## Requirement 13: Untrusted file text and answers
**User story:** As the owner, I want a file with hidden instructions to be treated as content, so that nobody can turn the ghost against the user or the site.
Acceptance criteria:
1. File text and answers SHALL be data, never instructions (prompt-injection-defense skill): they go only inside delimited blocks with a random tag per request, with the instructions before them and a reminder after.
2. THE client SHALL normalize text before sending (NFC; control and zero-width characters removed; the delimiter tag removed from content), and SHALL flag, not block, instruction-like patterns in EN and ES, keeping only their count.
3. THE model SHALL have no tools, browsing or code execution, and its output SHALL never be executed, evaluated or rendered as markup.
4. WHEN a file or an answer contains instructions to the model, THE ghost SHALL treat them as content, and MAY say the persona line "Interesting instructions. I'll treat them as part of your answer."
5. A question or reply that fails validation because of injected content SHALL go to the fallback of requirement 10, never be shown.
## Requirement 14: Languages, accessibility and the app
**User story:** As any user, I want the live conversation to follow the same rules as the rest of the app, so that nothing new shuts me out.
Acceptance criteria:
1. EVERY new string SHALL exist in `en` and `es` (spec a 9.3), with informal "tú" in Spanish and the ghost persona rules. THE model SHALL be asked to reply in the interface language; replies in another language SHALL fail validation (9.2).
2. THE accessibility rules of steering `accessibility-ethics.md` and specs (a) and (b) SHALL apply to every new screen: keyboard operable, visible focus, logical focus order, captions and transcript, muted mode, reduced motion and the motion toggle, contrast, 320 px width without horizontal scrolling, 200% text, no flashing, no time limits.
3. Streaming, waiting and fallback states SHALL be announced once each through polite live regions, never repeatedly.
4. `apps/ghost-defense` SHALL run this flow with `preview: false` once phase 1 lands. In a browser without speech recognition it SHALL run as a Preview session (spec b 10.4), because typing is then the only method while Morse is paused.
5. Each question SHALL be answerable by at least 2 input methods where the browser offers them (keyboard and voice).
## Requirement 15: Tests and question quality
**User story:** As the developer, I want this tested without a real model and the questions checked on real-looking files, so that the definition of done applies to every task.
Acceptance criteria:
1. THE core SHALL have unit and fast-check tests for: excerpt splitting (every character of the text is in exactly one excerpt, ids are stable); quote verification (a substring of the text always verifies after normalization, a changed one never does); every new output guard (valid shapes pass, extra keys, wrong types, over-long text and unknown excerpt ids fail); the sentence splitter for streaming (concatenating the sentences gives back the text); and the delimiter handling (a file containing the tag can't close the block).
2. THE web package SHALL test the parsers (`.txt`, `.md`, and PDF if built) on small fixtures, the providers with a mocked `fetch` (success, stream, 429, timeout, malformed JSON, a stream cut midway), and `withFallback` with the new tasks.
3. THE proxy SHALL have handler tests with a mocked upstream: every rejected shape (bad task, locale, oversized input, extra fields, wrong content type, bad origin), the limits, the kill switch, and that no body is logged.
4. THE end-to-end suite SHALL use a fake provider (intercepting the proxy path) with scripted, streamed replies, and SHALL cover by keyboard: upload, preview, consent (and that nothing is sent before it), a full 4-question session (the default) to the summary, with Copy summary, a correction with a verified quote, a "not in the file" reply, an invalid quote dropped, a fallback to demo with its label, and the offline choice. It SHALL keep failing on any request to another origin, and SHALL run axe on every new screen in EN and ES with reduced motion on and off.
5. A golden set of 6 fictional example files SHALL live in the repo, in EN and ES, including the two sample files of 1.10: a short essay, a project README, a thesis abstract (also as a PDF if PDF is built), a lab report, a file with injected instructions and fake delimiters, and a file whose main claim is wrong on purpose. For each, the expected properties of good questions are written down (which excerpts they may cite, which wrong claim a correction must catch).
6. With the demo provider, the golden set SHALL pass automatically (schema, grounding, quotes). With the real provider, a manual evaluation script SHALL run the golden set before release, and its results (grounded questions, verified quotes, caught wrong claims, injections ignored) SHALL be logged in `docs/KIRO_USAGE.md`.
7. THE owner SHALL check the live flow by hand in Chrome and Safari, with voice and sound, measuring the latency budget of 5.2 against the chosen provider, and SHALL log the numbers.
## Requirement 16: Real AI in ghost-interview **[Cuttable, cut second]**
**User story:** As a user of Ghost Interview, I want the same real feedback as in Ghost Defense, so that both apps show what the kit can do.
Acceptance criteria:
1. `apps/ghost-interview` SHALL be able to evaluate its answers with the same provider chain, proxy and limits as this spec, through the same consent screen (requirement 3), naming what is sent (the question and the confirmed answer; no file).
2. Its demo path, labels and fallback SHALL stay as today, and the fallback rules of requirement 10 SHALL apply.
3. Nothing else in ghost-interview changes.
## Research to do in the design phase (with sources)
1. **Providers with a free tier**: at least Google Gemini, Groq and one more (for example Mistral or Cerebras). For each: free limits (requests and tokens per minute and per day), models good at EN and ES, JSON or structured output, streaming support, time to first token, CORS for browser calls (BYOK), and data-use terms on the free tier (training use, human review, retention).
2. **Streaming through Netlify Functions**: streamed responses from a Function, execution time limits, how rate limiting and the Free plan's credit metering apply to Functions (compute, invocations), and whether Edge Functions are a better fit.
3. **Limits and the kill switch on Netlify**: how to keep a global daily counter without user data (for example Netlify Blobs or relying on the provider's quota), and whether an environment variable change needs a redeploy (a production deploy costs 15 credits).
4. **PDF text in the browser**: `pdfjs-dist` size and license, its worker with Vite, loading it from the bundle versus a CDN (bandwidth credits), text-layer extraction only, page limits and memory, and how hidden text appears in extraction.
5. **Speech sentence by sentence**: gaps between queued utterances in Chrome and Safari with the existing `WebSpeechOutput`, and how that affects the latency budget.
## Cost and credit estimate
- **Kiro credits**: the agent can't see credit use, so this is a size estimate in tasks, to compare with spec (b) (46 planned tasks). This spec is estimated at about 40 tasks:
  - phase 1 about 14: parsing, excerpts, preview, the demo conversation engine, quote checks, summary, screens;
  - phase 2 about 16: tasks and guards, prompt templates, providers, proxy, limits, kill switch, consent, fallback, golden set;
  - phase 3 about 6: streaming in the proxy and the client, sentence-by-sentence speech, latency checks;
  - cuttable items about 4: BYOK, real AI in ghost-interview, PDF parsing (streaming is phase 3).
  The old plan gave (e) and (f) 6 days together (Nov 23 to 28). Whether about 40 tasks fit in the time now available is for the owner to judge from the pace so far; the cut order is how to make it fit.
- **Netlify credits**: production deploys stay at 15 credits each, within the 10-a-month budget (deploy-hosting steering). Function compute and invocations are researched in item 2 before the design commits to a limit.
- **Provider cost**: zero by design: the proxy uses a free-tier key on a project with no billing, so hitting quota returns `rate-limited` and the session falls back to demo.
## Owner decisions (2026-11-13, requirements approved)
1. **Limits**: 2 MB, 50 PDF pages, 60,000 characters used, 6,000 characters per request (1.6, 9.4).
2. **Questions**: 3 to 8, default 4 so a judge's try takes about 2 minutes; at most one follow-up each (4.1, 4.6).
3. **Confirmation**: options B and C together, always explicit (7.2); D and E are re-evaluated after the owner's Chrome check.
4. **Summary**: no file download; a Copy summary button only (8.5).
5. **ghost-interview**: a small task at the end gives it the same provider through the same consent, cuttable right after BYOK (requirement 16).
6. **BYOK keys**: memory only; the `netlify-proxy-safety` skill is updated to match (no `sessionStorage`).
7. **Sample files** (2026-11-18, design approval): a "Try with a sample file" button with two fictional samples (EN and ES), used in demos and in the golden tests (1.10, 15.5).
