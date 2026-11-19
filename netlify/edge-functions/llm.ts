import type { Config, Context } from '@netlify/edge-functions';
import { handleLlm } from '../llm/handler.ts';

/**
 * `/api/llm`, the LLM proxy (ghost-defense-live design §5). An Edge Function, billed per request,
 * not as compute (design §2.2). The logic lives in `../llm/handler.ts` as a pure handler; this
 * file only passes in the real environment, clock, randomness and fetch.
 */
export default (req: Request, context: Context) =>
  handleLlm(req, {
    env: (name) => Netlify.env.get(name),
    site: context.site,
    fetch,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    now: () => Date.now(),
    log: (line) => console.log(line),
  });

export const config: Config = {
  path: '/api/llm',
  // Code-based rate limit, per IP and domain (Free plan). Check the deploy log for the rule.
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
