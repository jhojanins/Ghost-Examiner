---
name: netlify-proxy-safety
description: "Security rules for the Ghost Examiner LLM proxy, a Netlify Edge Function (netlify/edge-functions/llm.ts over the pure handler netlify/llm/handler.ts), and the client code that calls it or uses a bring-your-own-key provider: fixed task types, per-IP rate limiting, a daily cap and kill switch in Netlify Blobs, server-side prompts, input validation and size caps, no API keys in client code, automatic fallback to demo mode. Use when creating or editing the proxy, LLM providers, environment variables, netlify.toml, or BYOK settings."
metadata:
  project: ghost-examiner
---
# Netlify proxy safety
## Where the proxy lives
- `netlify/edge-functions/llm.ts` is the Edge Function at `/api/llm`. It only wires in the real environment (`Netlify.env`, `context.site`, `fetch`, `crypto.getRandomValues`, the Blobs store, `console.log`).
- `netlify/llm/handler.ts` holds all the logic as a pure handler with injected dependencies, so tests run it with a fake request, fake upstream, fake clock and fake Blobs store. No Netlify CLI.
- Edge Functions are billed per request, not as compute (ghost-defense-live design §2.2). Deno needs `.ts` extensions on relative imports.
## Keys
- Keys live only in Netlify environment variables (`GEMINI_API_KEY`, and `GEMINI_MODEL` for the model name). Their scope must include Functions, the scope Edge Functions read. Set them before the first deploy, for Production and Branch deploys (docs/DEPLOY.md).
- Never prefix a secret with `VITE_`: Vite inlines every `VITE_*` variable into the client bundle.
- `pnpm build` runs `scripts/scan-keys.mjs dist`, which fails on a Google (`AIza…`) or Groq (`gsk_…`) key in the built files.
- The Google project behind the key has no billing account, so quota exhaustion returns 429 and costs nothing.
## Request contract
- `POST /api/llm`, `Content-Type: application/json`, body ≤ 24 KB (by header and by bytes read), otherwise 405, 415 or 413.
- Body: exactly `{ task, locale, input }`. `task` is one of `defense-questions | defense-reply | defense-summary` (`evaluate-answer` is refused until ghost-defense-live Req 16 is built); `locale` is `en | es`. `parseDefenseRequest` in core checks exact keys, types, excerpt ids and caps (6,000 excerpt characters, answer 2,000, question 300, 16 turns): 400, or 413 when over a cap.
- The client never sends prompts, system text or an output cap. The function builds prompts from the `@ghost-examiner/core` templates (`buildDefensePrompt`, see `prompt-injection-defense`) and sets the output cap per task (800, 400, 500 tokens).
- Same-origin only: the `Origin` header must equal the request's origin, over HTTPS, and the host must be the site, `<site>.netlify.app` or a `*--<site>.netlify.app` deploy. Otherwise 403. No `Access-Control-Allow-Origin`.
## Limits
```ts
import type { Config } from '@netlify/edge-functions';
export const config: Config = {
  path: '/api/llm',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
```
- Free plan: code-based rules only, per IP + domain, max 2 rules per project. An invalid rule does not fail the deploy: check the deploy log for the rule after every deploy. Enforcement can lag up to ~10 s.
- Blobs store `llm-control`: `kill` = `on` returns 503 `{ error: 'disabled' }`; `cap` holds the daily cap (300 when missing or invalid); `count-YYYY-MM-DD` (UTC) is incremented with a conditional write, one retry on an ETag conflict. At the cap: 429. A store error fails closed (503). The store never holds user content.
- The owner changes `kill` and `cap` with `netlify blobs:set llm-control <key> <value>`, no deploy needed.
## Upstream calls
- Gemini `generateContent` with `fetch` and the `x-goog-api-key` header; no vendor SDK, no tools. JSON output with `responseJsonSchema` from core `defenseSchema`.
- Timeout 18 s (below the client's 20 s), and the client's abort is passed on. Response bytes and text length are capped.
- Model names come from `GEMINI_MODEL` (a plain id), never from code or the client.
- Map failures without forwarding upstream bodies: upstream 429 → 429; other upstream errors → 502; timeout → 504; a cut, blocked, empty or oversized answer → 502 `bad-output`; missing key or model → 503.
- Log one line per request: task, status and latency. Never a body, a key or a header.
## Providers
- Gemini (and Groq for BYOK) are called with `fetch` against their REST APIs; no vendor SDKs. Groq uses its OpenAI-compatible endpoint.
- The same prompt templates serve BYOK in the browser and the proxy on the server.
## Client side
- `createProxyProvider` (packages/web): `POST /api/llm` with `{ task, locale, input }`, 20 s timeout; 429 → `rate-limited`, 413 → `too-large`, anything else (503 `disabled` included) → `unavailable`; a 200 that isn't JSON → `bad-output`.
- The session runtime asks the real provider and, on its first failure, lets the demo rules answer the same turn and pins demo for the rest of the session, with the ghost's fallback line and the demo label. `withFallback` does not wrap demo into the AI chain (a demo answer must never look like AI).
- BYOK field: `type="password"`, `autocomplete="off"`, paste allowed. The key lives in memory only, for the page: never `localStorage`, `sessionStorage`, IndexedDB or cookies (owner decision, spec ghost-defense-live). It is sent only to that provider's API, never to our proxy. A "Forget key" button clears it.
- Show the consent screen (provider name, what is sent, free-tier data use) before the first real-mode request of each session.
## Tests before done
- Request checks: method, origin, content type, size, each bad shape and cap.
- Handler with a mocked `fetch`: success, 429, other errors, timeout, client abort, bad output; logs; `config.rateLimit` present.
- Kill switch and cap with a fake Blobs store, including the ETag conflict.
- The key scan on a planted key.
- The real Edge Function is checked on a branch deploy (ghost-defense-live task 19), never with production deploys.
