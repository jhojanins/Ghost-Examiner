# Tasks: Ghost Defense live
Implements `requirements.md` and `design.md` in this folder: 29 tasks (28 plus 7b). Each task is one logical unit with one checkable **Done when**. The definition of done in `.kiro/steering/workflow.md` applies to every task. Always load `lean-code`, plus the skills listed per task.
Working rules (owner):
- Tests first.
- Mutation checks on new logic: back up each file, mutate it, run the tests, restore it, and diff it against the backup.
- One commit per task, in its own message, after the edits are confirmed with a separate `git diff`.
- No pushes and no production deploys without the owner's approval.
- Stop processes only by the PID recorded when they were started; never `pkill` or `killall` by pattern.
- A log entry in `docs/KIRO_USAGE.md` for each task; new properties also go under PBT there.
Markers:
- **[Browser + axe]**: a full Playwright MCP keyboard walk-through with screenshots at 320 and 1280 px, plus an axe run (WCAG 2.2 AA tags, EN and ES, reduced motion on and off). Other UI tasks use component tests only.
- **[Owner]**: the owner acts (accounts, keys, deploys, real-device checks). The agent prepares the steps and logs the result.
- **[Cuttable, cut first]**, **[Cuttable, cut second]**, **[Cuttable, cut third]**: the cut order of requirements and design §12. Phase 3 (tasks 21 to 24) is cut last. Cut tasks are whole tasks; nothing mandatory depends on them.
Fakes: unit tests use a fake provider, a fake clock and fake timers; the Edge Function tests use a mocked `fetch` and a fake Blobs store; e2e serves `/api/llm` with `page.route` and keeps the speech fakes, so no real model or microphone is used.
## Phase 1: the conversation, offline
- [x] 1. Excerpts, selection and quote verification, with P23 and P24
  - `document/`: `splitExcerpts`, `selectExcerpts`, `normalizeForQuote`, `verifyQuote`.
  - **Done when:** P23 and P24 pass; examples cover Markdown headings, a paragraph longer than the limit, curly quotes, and a quote that exists in another excerpt but not its own (rejected); mutations are caught (overlapping excerpts, case not normalized, quote checked against the whole text).
  - _Design §3.1, §9; Requirements: 1.9, 6.1, 6.2, 9.4_ · Skills: `testing-strategy`
- [x] 2. Defense task types, output guards and the language check, with P28
  - `LLMTask` grows to the three defense tasks; `isDefenseQuestions`, `isDefenseReply`, `isDefenseSummary`; `inLanguage`.
  - **Done when:** P28 passes; examples show every reply kind, a follow-up when not allowed (rejected), markup and links (rejected), an unknown excerpt id (rejected), and the drop rules of design §3.2 (unverified question dropped, unverified correction turned into the local line); `inLanguage` passes short sentences and rejects a clear EN reply in an ES session.
  - _Design §3.2, §9; Requirements: 6.3, 6.4, 9.1 to 9.3, 14.1_ · Skills: `prompt-injection-defense`, `testing-strategy`
- [x] 3. Engine: dynamic questions, replies with one follow-up, skip, end and summary, with P29
  - **Done when:** P29 passes; every existing engine test and property passes unchanged (pack sessions behave as today); examples cover `preparing`, an empty question list, a follow-up asked once, skip, end early, and `summarize`; mutations are caught (two follow-ups allowed, `confirm` skipped).
  - _Design §3.5, §9; Requirements: 4.1, 4.5, 4.6, 4.8, 7.1, 8.1_ · Skills: `testing-strategy`
- [x] 4. Demo provider for the defense tasks, and the kit copy
  - The heuristics of design §3.6 and the catalog keys of §3.7 (EN and ES), without the consent and real-mode texts (task 16).
  - **Done when:** the demo output passes the guards on fixture texts; outputs are deterministic; typecheck shows `es` matching `en`; the ghost-persona rules hold (no verdict words, one question at a time, at most about 25 words per question).
  - _Design §3.6, §3.7; Requirements: 4.2, 4.3, 4.7, 9.7, 10.4_ · Skills: `ghost-persona`
- [x] 5. Parsing `.txt`, `.md` and pasted text
  - **Done when:** tests on fixtures show: accepted types; 2 MB, 300-character and 60,000-character limits with their messages and the truncation flag; invalid UTF-8 gives a message; nothing is sent anywhere (no `fetch` in the module).
  - _Design §4.1; Requirements: 1.2, 1.6 to 1.8_ · Skills: `testing-strategy`
- [x] 6. Session runtime: the defense effects, line by line
  - `prepare-questions`, dynamic `evaluate` and `summarize` through the provider; each reply sentence spoken as its own line; the local waiting line after 1.5 s; the client request budget.
  - **Done when:** runtime tests with the demo provider and the fake speech output show a 4-question session with one follow-up reaching the summary, each sentence as one transcript line, quotes not spoken, and the waiting line only when the provider is slow.
  - _Design §4.3; Requirements: 4.4, 4.9, 4.10, 5.6, 8.3_ · Skills: `testing-strategy`
- [x] 7. `FileUpload` and `TextPreview`
  - **Done when:** component tests show the warning above the file input, a labeled native input, paste as an alternative, errors in one polite region, the preview's counts and warnings, headings exposed as headings, the file-language radios, the number-of-questions select (default 4), and Remove file clearing the text.
  - _Design §6.1; Requirements: 1.1, 1.2, 1.7, 2.1 to 2.5, 4.1_ · Skills: `a11y-review`, `ghost-persona`
- [x] 7b. Sample files and "Try with a sample file" (owner decision 6)
  - Two fictional samples in `apps/ghost-defense/content/samples/` (`sample-en.md`, `sample-es.md`), each long enough for 4 grounded questions; a `samples` prop on `FileUpload` with one button per sample.
  - **Done when:** component tests show the two buttons with their languages, and that choosing one calls the same handler as an upload with the sample's text and language; a core test shows each sample splits into at least 4 excerpts and passes the 300 to 60,000 character limits.
  - _Design §6.1, §7; Requirements: 1.10, 15.5_ · Skills: `a11y-review`, `ghost-persona`
- [x] 8. `InlineConfirm`, `QuoteBlock`, `ModeLabel` and `DefenseSummary`
  - **Done when:** component tests show Send focused on mount with the text and method in its description; Enter confirms; Edit and Answer again call their handlers; quotes carry the file's `lang`; the summary's headings, labels and Copy summary (clipboard feature-detected, polite confirmation); the demo label text.
  - _Design §6.2, §6.3; Requirements: 6.7, 7.2, 7.4, 8.2, 8.5, 10.3_ · Skills: `a11y-review`
- [x] 9. ghost-defense: the offline flow **[Browser + axe]**
  - Privacy notice, upload, preview, the offline choice (consent arrives in task 16), questions with quotes, voice and typed answers with inline confirmation, replies, summary; `preview: false`; `ghostState` mapping for reply kinds.
  - **Done when:** the walk-through by keyboard with the speech fakes, in EN and ES at 320 and 1280 px, completes a 4-question session; stop then Enter confirms a spoken answer; axe passes on every screen; no console errors.
  - _Design §6, §7; Requirements: 2, 4, 7, 8, 14_ · Skills: `a11y-review`, `ghost-persona`, `testing-strategy`
- [x] 10. Golden files and the offline end-to-end test
  - The 6 fictional files of Req 15.5 (EN and ES) with their expectations files; `apps/ghost-defense/e2e/defense-offline.spec.ts`.
  - **Done when:** `pnpm e2e` passes and covers, by keyboard: upload, preview, a full 4-question offline session to the summary with Copy summary, skip and end early, a file that is too short or too large; the demo provider passes the golden expectations; axe on the new screens in EN and ES × reduced motion; the network guard stays.
  - _Design §10; Requirements: 15.4 to 15.6_ · Skills: `testing-strategy`, `prompt-injection-defense`
## Phase 2: real AI through the proxy
- [x] 11. Prompt templates and untrusted-text preparation, with P27
  - **Done when:** P27 passes; examples show a document containing the tag, an EN and an ES injection attempt (flag count only), control and zero-width characters removed, and instructions before and a reminder after the blocks; mutations are caught (a fixed tag, the tag not stripped).
  - _Design §3.3, §9; Requirements: 13.1, 13.2_ · Skills: `prompt-injection-defense`, `ghost-persona`
- [ ] 12. Accounts, key and dependencies **[Owner]**
  - Dependencies (approved): `@netlify/edge-functions` (types, dev) and `@netlify/blobs`, at exact versions, with install scripts not allowed, and checked in `pnpm-lock.yaml`.
  - The owner: creates a Gemini API key in AI Studio on a project with **no billing**, and notes the free-tier limits shown there; imports the repo into Netlify if not done yet (docs/DEPLOY.md; this import is the one pre-approved production deploy, 15 credits); sets `GEMINI_API_KEY` and `GEMINI_MODEL` as Netlify environment variables (never with a `VITE_` prefix) and turns on branch deploys for `main`.
  - **Done when:** the owner confirms each step; the agent logs the model name, the limits seen in AI Studio and the date in `docs/KIRO_USAGE.md` (never the key).
  - _Design §2.1, §2.2, §5; Requirements: 11.2, 11.3_
- [x] 13. Edge Function: validation, limits and the upstream call
  - `netlify/edge-functions/llm.ts`, non-streaming; the `dist/` key scan in the build.
  - The bundler spike runs against the first branch deploy in task 19: no Netlify CLI here (owner decision 2026-11-19).
  - **Done when:** handler tests with a mocked upstream show each status of design §5 (403, 415, 413, 400 per bad shape, 200), the per-task output cap, upstream 429 and timeout mapped without forwarding bodies, and only task, status and latency logged; `config.rateLimit` is present; the key scan fails on a planted `AIza` string; a spike confirms the Edge bundler resolves the core templates.
  - _Design §2.2, §5; Requirements: 11.1 to 11.3, 11.5_ · Skills: `netlify-proxy-safety`, `prompt-injection-defense`
- [x] 14. Edge Function: daily cap and kill switch
  - The Blobs usage check in the dashboard runs after the first branch deploy, in task 19 (owner decision 2026-11-19).
  - **Done when:** tests with a fake Blobs store show the kill switch returning 503 `disabled`, the cap read from the `cap` key (300 when missing or invalid), the daily counter incrementing with a conditional write, one retry on an ETag conflict, the cap returning 429, and no user content in any stored value; after the first branch deploy, the Blobs usage is checked in the dashboard and logged.
  - _Design §2.3, §5; Requirements: 11.3, 11.4, 12.2_ · Skills: `netlify-proxy-safety`
- [x] 15. `ProxyProvider` and the provider chain
  - **Done when:** tests with a mocked `fetch` show success, 429, 503 `disabled`, 413, timeout and malformed JSON, each mapped as in design §4.2; `withFallback(proxy, demo)` keeps the turn; demo stays pinned after the first fallback.
  - _Design §4.2; Requirements: 9.1, 10.1 to 10.5_ · Skills: `netlify-proxy-safety`
- [x] 16. `ConsentScreen` and the real-mode privacy texts
  - **Done when:** component tests show every point of Req 3.1 in EN and ES with Gemini's free-tier data use (including human review), two equal buttons with no preselection, focus on the heading; the reworded `privacy.local` and the new real-mode point in the privacy dialog.
  - _Design §6.1; Requirements: 3.1, 3.2, 3.5, 12.4_ · Skills: `a11y-review`, `ghost-persona`, `netlify-proxy-safety`
- [x] 17. ghost-defense: real mode, consent and fallback **[Browser + axe]**
  - The consent gate before the first request, the proxy chain, the mode label, the fallback lines.
  - The transcript announces the waiting line to screen readers; today its negative line id is skipped (found in task 9; owner decision 2026-11-19). Test first.
  - **Done when:** the walk-through with `/api/llm` served by a scripted route shows consent before any request, a correction with a verified quote, a "not in the file" reply, a dropped invalid quote, and a fallback to demo with its persistent label, in EN and ES at 320 and 1280 px; axe passes; no console errors.
  - _Design §1, §6, §8; Requirements: 3.3, 3.4, 6, 10_ · Skills: `a11y-review`, `ghost-persona`, `testing-strategy`
- [x] 18. End-to-end test of real mode with a fake proxy
  - `apps/ghost-defense/e2e/defense-live.spec.ts`.
  - The speech and recognition fakes move from `apps/ghost-interview/e2e/fakes` to a common place both apps' tests import (owner decision 2026-11-19).
  - **Done when:** `pnpm e2e` passes and covers the cases of task 17 plus: no request before consent (the route records calls), the kill switch response, a 429, the offline choice, and the injection golden file producing only content-shaped output; axe on the consent and fallback states in EN and ES × reduced motion.
  - _Design §10; Requirements: 15.4_ · Skills: `testing-strategy`, `prompt-injection-defense`
- [ ] 19. Golden-set evaluation against the real provider **[Owner]**
  - `scripts/eval-defense.mjs`. The owner pushes `main` so a branch deploy (free) has the Edge Function; the agent runs the script against that URL.
  - The Edge bundler check (task 13 spike) runs here. If the bundler can't load core's TypeScript (imports without extensions), a small build step that bundles the Edge Function first may be needed (owner note 2026-11-19).
  - **Done when:** the script runs the 6 golden files and the log records grounded questions, verified quotes, caught wrong claims and ignored injections, with any failure turned into a test or a prompt fix.
  - _Design §10; Requirements: 15.6_ · Skills: `prompt-injection-defense`, `testing-strategy`
- [ ] 20. Owner check, phase 2 **[Owner]**
  - **Done when:** the owner confirms, in Chrome and Safari on the branch deploy: a 4-question session with a real file in EN and in ES, by voice and by typing; corrections quote the file; the consent text reads correctly; turning on the kill switch moves new turns to demo within a minute. The result is logged.
  - _Requirements: 3, 6, 11.4, 15.7_
## Phase 3: real-time feel (cut last)
- [x] 21. Reply reader and sentence splitter, with P25 and P26
  - **Done when:** P25 and P26 pass; examples cover abbreviations in EN and ES, a sentence over 300 characters (ends the stream as `bad-output`), and a head that arrives across chunks; mutations are caught (a sentence emitted before the head).
  - _Design §3.4, §9; Requirements: 5.1, 5.4, 9.6_ · Skills: `testing-strategy`
- [ ] 22. Streaming in the Edge Function and `ProxyProvider`
  - **Done when:** tests show the Edge Function piping upstream text deltas (mocked SSE) with the byte cap and abort on client disconnect, and `ProxyProvider.stream` delivering chunks, the 8 s first-byte timeout, and a stream cut midway mapped to a fallback that keeps the turn.
  - _Design §4.2, §5; Requirements: 5.1, 5.3, 10.5_ · Skills: `netlify-proxy-safety`
- [ ] 23. Sentence-by-sentence speech in the app **[Browser + axe]**
  - The runtime speaks each sentence as it arrives; latency marks.
  - The non-streaming path stays and is the fallback: a provider without `stream`, a stream that fails before its head, or a missing streaming endpoint uses `complete` as today (owner note 2026-11-19, Req 5.6).
  - **Done when:** the walk-through with a chunked scripted route shows the quote appearing only after the head is verified, captions and mouth following each sentence, the transcript announcing each line once, and the timeout falling back after 8 s (page clock); axe passes; e2e covers the streamed reply.
  - _Design §4.3; Requirements: 5.1 to 5.5_ · Skills: `a11y-review`, `ghost-svg-animation`, `testing-strategy`
- [ ] 24. Latency check **[Owner]**
  - **Done when:** the owner runs 5 turns in Chrome and in Safari on the branch deploy, reads the latency marks from the console, and the log records the median and worst values against the budget of Req 5.2, plus the gap between spoken sentences.
  - _Design §2.5; Requirements: 5.2, 15.7_
## Cuttable, in cut order
- [ ] 25. Bring your own key **[Cuttable, cut first]**
  - A spike first: a browser call to the Gemini REST endpoint with a test key (CORS). Then `GeminiProvider`, the key field on the consent screen (memory only, Forget key), the chain `withFallback(byok, proxy, demo)`, and consent again when the provider changes.
  - **Done when:** the spike result is logged; tests show the key never leaves memory (no storage API is called) and is never sent to `/api/llm`; e2e covers entering, using and forgetting a key with a fake endpoint.
  - _Design §4.2; Requirements: 3.4, 11.6 to 11.9_ · Skills: `netlify-proxy-safety`, `a11y-review`
- [ ] 26. ghost-interview: real AI through the same consent **[Cuttable, cut second]** **[Browser + axe]**
  - **Done when:** the walk-through shows the consent screen naming only the question and the answer, a real-mode evaluation through the scripted route, and the demo fallback with today's labels, in EN and ES; existing ghost-interview e2e tests pass.
  - _Design §7; Requirements: 16_ · Skills: `a11y-review`, `netlify-proxy-safety`
- [ ] 27. PDF text **[Cuttable, cut third]**
  - `parsePdf` with lazy `pdfjs-dist`, and the golden thesis abstract as a PDF.
  - **Done when:** tests on fixture PDFs show text extracted, the 50-page limit, a PDF with no text layer giving its message, and `isEvalSupported: false`; the build shows the parser in a separate chunk not loaded for `.txt`; its size is logged with the bandwidth estimate of design §2.4.
  - _Design §2.4, §4.1; Requirements: 1.3 to 1.5_ · Skills: `prompt-injection-defense`, `testing-strategy`
## Release
- [ ] 28. README, architecture notes and the proxy skill
  - **Done when:** the README describes Ghost Defense live honestly (what is AI, what is demo, what was cut, the privacy and consent points), `docs/ARCHITECTURE.md` D7 and D10 match the Edge Function and the parsing that shipped, the `netlify-proxy-safety` skill describes the Edge Function, and every command in the README still runs.
  - _Requirements: 3.5, 12, 14_ · Skills: `kiroween-checklist`, `netlify-proxy-safety`
## Credit estimate
Owner figure (2026-11-18): about **22 Kiro credits per task**. For 28 tasks that is about **620 credits**; with task 7b added, 29 tasks, about **640**.
| Part | Tasks | Credits (≈ 22 each) |
|---|---|---|
| Phase 1: offline conversation | 1–10 and 7b (11 tasks) | ≈ 240 |
| Phase 2: real AI | 11–20 (10 tasks) | ≈ 220 |
| Phase 3: real-time feel | 21–24 (4 tasks) | ≈ 90 |
| Cuttable | 25–27 (3 tasks) | ≈ 65 |
| Release | 28 | ≈ 20 |
| **Total** | 29 | **≈ 640** |
The agent can't read the Kiro usage page, so the owner checks the real figure after phase 1 and the rest is scaled from it. Netlify credits are separate: the import (15) plus 15 per production deploy; the Edge Function costs about 2 credits per 10,000 requests (design §2.2).
