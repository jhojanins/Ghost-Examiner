import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// WCAG 2.2 AA (testing-strategy skill).
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const LINES = {
  greeting: "Good evening. I'm your examiner tonight. Please, have a seat.",
  question: 'Tell me about a time you solved a difficult problem.',
  summary: 'Thank you. That answer was clear and on topic.',
  closing: "That's all for tonight. My clipboard is full.",
};
const ANSWER = 'The situation was a report that took two days, so I decided to rewrite it. In the end it takes two minutes.';
const DEMO_LABEL = 'Demo evaluation: based on keywords, not a full reading of your answer.';

/**
 * Req 12.4: in demo mode nothing may leave the site's origin. Every request to another origin
 * is blocked before it goes out and recorded; the test fails if the list is not empty.
 */
async function guardNetwork(page: Page, baseURL: string) {
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

/** Fails the test on any console error or uncaught exception. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function expectNoAxeViolations(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${screen}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
}

/** Keyboard only: presses Tab until `target` has focus (fails after `max` presses). */
async function tabTo(page: Page, target: Locator, max = 20) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

const transcriptItems = (page: Page) => page.getByRole('region', { name: 'Transcript' }).getByRole('listitem');
const captions = (page: Page) => page.locator('.ge-captions');

test('the network guard catches a request to another origin (self-check)', async ({ page, baseURL }) => {
  const foreign = await guardNetwork(page, baseURL!);
  await page.goto('');
  await page.evaluate(() => fetch('https://example.com/ghost.png').catch(() => undefined));
  expect(foreign).toEqual(['https://example.com/ghost.png']);
});

test('slice: keyboard only, confirmation before feedback, captions and transcript per line, no foreign requests, no axe violations', async ({
  page,
  baseURL,
}) => {
  const foreign = await guardNetwork(page, baseURL!);
  const errors = watchErrors(page);
  await page.goto('');

  // Intro, with the Preview label.
  await expect(page.getByRole('heading', { level: 1, name: 'Ghost Interview' })).toBeVisible();
  await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  await expect(page.getByText('Keyboard only for now. Voice and Morse are coming.')).toBeVisible();
  await expectNoAxeViolations(page, 'intro');

  // Start -> privacy dialog; the greeting plays behind it, in the captions.
  const start = page.getByRole('button', { name: 'Start' });
  await tabTo(page, start);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Privacy notice' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Privacy notice' })).toBeFocused();
  await expect(captions(page)).toHaveText(LINES.greeting);
  await expectNoAxeViolations(page, 'privacy dialog');

  // Esc -> back to the intro with Start; Start reopens the dialog.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(start).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();

  // Accept -> the question; focus in the answer field. The greeting goes to the transcript.
  await tabTo(page, dialog.getByRole('button', { name: 'I understand, start' }));
  await page.keyboard.press('Enter');
  const field = page.getByRole('textbox', { name: 'Your answer' });
  await expect(field).toBeFocused();
  await expect(captions(page)).toHaveText(LINES.question);
  await expect(transcriptItems(page)).toHaveText([LINES.greeting]);

  // Answering: wait for the question to finish, so this is the answering screen.
  await expect(transcriptItems(page)).toHaveText([LINES.greeting, LINES.question], { timeout: 10_000 });
  await expectNoAxeViolations(page, 'answering');

  // Type and submit -> the confirmation view shows that exact text. This also proves the
  // keyboard adapter was started: an unstarted adapter would accept the text and emit nothing.
  await page.keyboard.type(ANSWER);
  await page.keyboard.press('Control+Enter');
  const confirm = page.getByRole('region', { name: 'I noted this. Is that what you meant?' });
  await expect(confirm).toBeVisible();
  await expect(confirm.locator('blockquote')).toHaveText(ANSWER);
  await expect(confirm.getByText('How you answered: Typed')).toBeVisible();
  await expect(confirm.getByRole('heading')).toBeFocused();
  // Confirmation comes before any feedback (Req 7).
  await expect(page.getByRole('region', { name: 'Practice feedback' })).toHaveCount(0);
  await expectNoAxeViolations(page, 'confirming');

  // Confirm -> practice feedback, labeled as a keyword-based demo.
  await tabTo(page, confirm.getByRole('button', { name: 'Confirm' }));
  await page.keyboard.press('Enter');
  const feedback = page.getByRole('region', { name: 'Practice feedback' });
  await expect(feedback).toBeVisible();
  await expect(feedback.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(feedback.getByText(DEMO_LABEL)).toBeVisible();
  await expect(feedback.getByText('You covered the situation.')).toBeVisible();
  await expect(feedback.getByText('Add one result you can measure.')).toBeVisible();
  await expect(captions(page)).toHaveText(LINES.summary);
  await expectNoAxeViolations(page, 'feedback');

  // The summary line finishes and goes to the transcript, announced once in the live region.
  await expect(transcriptItems(page)).toHaveText([LINES.greeting, LINES.question, LINES.summary], { timeout: 10_000 });
  await expect(page.locator('.ge-transcript [aria-live="polite"]')).toHaveText(LINES.summary);

  // Continue -> the closing line and the end screen.
  await tabTo(page, feedback.getByRole('button', { name: 'Continue' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'End of the practice' })).toBeFocused();
  await expect(captions(page)).toHaveText(LINES.closing);
  await expect(transcriptItems(page)).toHaveText([LINES.greeting, LINES.question, LINES.summary, LINES.closing], {
    timeout: 10_000,
  });

  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});
