---
name: netlify-proxy-safety
description: "Security rules for the Ghost Examiner Netlify Function LLM proxy (netlify/functions/llm.mts) and the client code that calls it or uses a bring-your-own-key provider: fixed task types, per-IP rate limiting, server-side prompts, input validation and size caps, no API keys in client code, automatic fallback to demo mode. Use when creating or editing the proxy, LLM providers, environment variables, netlify.toml, or BYOK settings."
metadata:
  project: ghost-examiner
---

# Netlify proxy safety

## Keys
- Keys live only in Netlify environment variables (`GEMINI_API_KEY`, `GROQ_API_KEY`) scoped to Functions.
- Never prefix a secret with `VITE_`: Vite inlines every `VITE_*` variable into the client bundle.
- After each build, scan `dist/` for key patterns (`AIza`, `gsk_`) and fail if found.
- The Google project behind the key has no billing account, so quota exhaustion returns 429 and costs nothing.

## Request contract
- `POST /api/llm`, `Content-Type: application/json`, body <= 16 KB, otherwise 413 or 415.
- Body: `{ task, locale, input }` where `task` is one of `generate-questions | evaluate-answer | follow-up`, `locale` is `en | es`, and `input` matches the per-task shape with max lengths. Unknown fields → 400.
- The client never sends prompts or system messages. The function builds prompts from `@ghost-examiner/core` templates (see `prompt-injection-defense`).
- Same-origin only: no `Access-Control-Allow-Origin: *`. Check the `Origin` header against the site URL and the deploy-preview pattern.

## Rate limiting
```ts
import type { Config } from '@netlify/functions';
export const config: Config = {
  path: '/api/llm',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
```
- Free plan: code-based rules only, per IP + domain, max 2 rules per project. Rules can't go in `netlify.toml` for functions.
- An invalid rule does not fail the deploy. Check the deploy log for the rule after every deploy. Enforcement can lag up to ~10 s.

## Upstream calls
- `fetch` with an `AbortController` timeout (~20 s) and a `maxOutputTokens` cap.
- Model names come from env/config, not code.
- Map failures to `{ ok: false, error: 'rate-limited' | 'unavailable' | 'bad-output' | 'too-large' }`. Never forward upstream error bodies.
- Validate model output with the core type guards; invalid output → `bad-output`.
- Log only task, status code and latency. Never log request or response bodies.

## Providers
- Gemini and Groq are called with `fetch` against their REST APIs; no vendor SDKs. Groq uses its OpenAI-compatible endpoint.
- The same provider code serves BYOK in the browser and the proxy on the server.

## Client side
- `withFallback(byok?, proxy, demo)`: on any error, move to the next provider and show the ghost's fallback notice. At most one retry with backoff; never loop.
- BYOK field: `type="password"`, `autocomplete="off"`, paste allowed. Key kept in memory; `sessionStorage` only if the user opts in; never `localStorage`; never sent to our proxy; a "Clear key" button.
- Show the privacy notice (provider name, free-tier data use) before the first real-mode request.

## Tests before done
- Validator: bad task, wrong locale, oversized input, extra fields, wrong content type.
- Handler with mocked `fetch`: success, 429, timeout, malformed JSON from the model.
- Build scan for keys; `config.rateLimit` present.
- Manual: `netlify dev` + `curl` for 400/413/429 paths.
