import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

/** Shared by the ghost-defense e2e tests (tasks 10 and 18). WCAG 2.2 AA (testing-strategy skill). */
export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Every request to another origin is blocked before it goes out and recorded (Req 12). */
export async function guardNetwork(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const foreign: string[] = [];
  await page.route(
    (url) => (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== origin,
    (route) => {
      foreign.push(route.request().url());
      return route.abort('blockedbyclient');
    },
  );
  return foreign;
}

/**
 * Console errors and uncaught exceptions. `expectedStatuses` are HTTP errors a test serves on
 * purpose (a 429 from the fake proxy): the browser logs those itself as "Failed to load
 * resource", which is not an app error.
 */
export function watchErrors(page: Page, expectedStatuses: number[] = []) {
  const errors: string[] = [];
  const served = new RegExp(`^Failed to load resource: the server responded with a status of (${expectedStatuses.join('|') || 'none'}) `);
  page.on('console', (m) => m.type() === 'error' && !served.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** axe on the current screen with both motion settings; returns the violations found. */
export async function matrix(page: Page, screen: string) {
  const found: string[] = [];
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    found.push(...violations.map((v) => `${screen} ${reducedMotion}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`));
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return found;
}

/** Keyboard only: presses Tab until `target` has focus. */
export async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

export const h2 = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 2, name });
