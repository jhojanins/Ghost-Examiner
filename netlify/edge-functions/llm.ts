import { getStore } from '@netlify/blobs';
import type { Config, Context } from '@netlify/edge-functions';
import { handleLlm, type ControlStore } from '../llm/handler.ts';

/**
 * `/api/llm`, the LLM proxy (ghost-defense-live design §5). An Edge Function, billed per request,
 * not as compute (design §2.2). The logic lives in `../llm/handler.ts` as a pure handler; this
 * file only passes in the real environment, clock, randomness, fetch and Blobs store.
 *
 * The owner turns the proxy off with `netlify blobs:set llm-control kill on` and changes the daily
 * cap with `netlify blobs:set llm-control cap 300`, with no deploy (design §2.3).
 */
function controlStore(): ControlStore {
  const store = getStore('llm-control');
  return {
    get: (key) => store.get(key, { type: 'text' }),
    // Strong reads for the counter, so a conditional write starts from the latest ETag.
    getWithMetadata: (key) => store.getWithMetadata(key, { type: 'text', consistency: 'strong' }),
    set: (key, value, options) => store.set(key, value, options),
  };
}

export default (req: Request, context: Context) =>
  handleLlm(req, {
    env: (name) => Netlify.env.get(name),
    site: context.site,
    fetch,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    now: () => Date.now(),
    log: (line) => console.log(line),
    control: controlStore(),
  });

export const config: Config = {
  path: '/api/llm',
  // Code-based rate limit, per IP and domain (Free plan). Check the deploy log for the rule.
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
