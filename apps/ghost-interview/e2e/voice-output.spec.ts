import { expect, test, type Page } from '@playwright/test';
import { installFakeSpeech, speechLog } from './fakes/speech-synthesis';

/**
 * The ghost's voice in the app (spec b task 19). The fake runs in manual mode and the page clock
 * is installed, so every assertion is about events and time the test controls, never about how
 * fast a machine happens to run. Task 20 adds the rest of the voice e2e (es-MX, no voices,
 * no API, the axe matrix).
 */
const QUESTION = 'Tell me about a time you solved a difficult problem.';
const SOLVED = QUESTION.indexOf('solved'); // 25: a word boundary far ahead of the estimate's start

const fake = (page: Page) => ({
  start: () => page.evaluate(() => window.__fakeSpeech!.control.start()),
  boundary: (charIndex: number) => page.evaluate((c) => window.__fakeSpeech!.control.boundary(c), charIndex),
  end: () => page.evaluate(() => window.__fakeSpeech!.control.end()),
});
const spoken = async (page: Page) => (await speechLog(page)).filter((e) => e.type === 'speak');
/** What the captions mark and which mouth shape the ghost shows, right now. */
const marked = (page: Page) =>
  page.evaluate(() => ({
    word: document.querySelector('.ge-caption-word--current')?.textContent ?? '',
    mouth: document.querySelector('svg[role="img"] [data-part="mouth"] path[visibility="visible"]')?.getAttribute('data-viseme'),
  }));
const transcriptItems = (page: Page) => page.getByRole('region', { name: 'Transcript' }).getByRole('listitem');
const liveRegion = (page: Page) => page.locator('.ge-transcript [aria-live="polite"]');

/** Intro → Start → privacy notice → Accept, by keyboard. Returns once the question is speaking. */
async function acceptPrivacy(page: Page) {
  await page.getByRole('button', { name: 'Start' }).press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Privacy notice' });
  await expect(dialog).toBeVisible();
  expect(await spoken(page)).toEqual([]); // the first-visit greeting plays muted, before consent (Req 2.2)
  await dialog.getByRole('button', { name: 'I understand, start' }).press('Enter');
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test('the mouth and captions follow the voice events, not the text estimate', async ({ page }) => {
  await installFakeSpeech(page, { manual: true });
  await page.goto('');
  await acceptPrivacy(page);
  expect(await spoken(page)).toEqual([{ type: 'speak', text: QUESTION, lang: 'en-US', voice: 'Fake English' }]);

  // No start event yet: nothing is marked and the mouth rests, although the estimate would
  // already be several words in (a muted line marks "Tell" on its first frame).
  for (let i = 0; i < 6; i++) {
    await page.clock.runFor(100);
    expect(await marked(page)).toEqual({ word: '', mouth: 'rest' });
  }

  // The audio starts and at once reports "solved": the marker jumps there; the estimate says "Tell".
  await fake(page).start();
  await fake(page).boundary(SOLVED);
  await page.clock.runFor(32);
  const atSolved = await marked(page);
  expect(atSolved.word).toBe('solved');
  expect(atSolved.mouth).not.toBe('rest');

  // Long past the end of the estimate, the line is still the voice's: not finished, not in the transcript.
  await page.clock.runFor(4000);
  expect(await marked(page)).toEqual({ word: '', mouth: 'rest' });
  await expect(transcriptItems(page)).toHaveCount(1); // the greeting only

  // Only the end event ends it. It was heard aloud, so the live region does not repeat it (Req 3.6).
  await fake(page).end();
  await expect(transcriptItems(page)).toHaveText([/Good evening/, QUESTION]);
  await expect(liveRegion(page)).toHaveText('');
});

test('sound off mid-line stops the audio, and captions and mouth carry the line to its end', async ({ page }) => {
  await installFakeSpeech(page, { manual: true });
  await page.goto('');
  await acceptPrivacy(page);
  await fake(page).start();
  await page.clock.runFor(300);

  await page.getByRole('button', { name: 'Ghost voice', pressed: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Ghost voice', pressed: false })).toBeVisible();
  expect((await speechLog(page)).map((e) => e.type)).toEqual(['speak', 'start', 'cancel', 'error']); // "interrupted"

  // The line goes on, muted, on the clock: marked words and mouth shapes until it ends.
  const words = new Set<string>();
  const mouths = new Set<string | null | undefined>();
  for (let i = 0; i < 20; i++) {
    await page.clock.runFor(100);
    const now = await marked(page);
    if (now.word) words.add(now.word);
    mouths.add(now.mouth);
  }
  expect(words.size).toBeGreaterThan(3);
  expect([...mouths].some((m) => m !== 'rest')).toBe(true);

  await page.clock.runFor(3000);
  await expect(transcriptItems(page)).toHaveText([/Good evening/, QUESTION]);
  await expect(liveRegion(page)).toHaveText(QUESTION); // not heard to the end, so it is announced
});

test('after a language switch with no line playing, the sound control says Spanish has no voice', async ({ page }) => {
  await installFakeSpeech(page, { variant: 'en-only', manual: true });
  await page.goto('');
  await acceptPrivacy(page);
  await fake(page).start();
  await fake(page).end(); // the question is over: no line plays now
  await expect(transcriptItems(page)).toHaveCount(2);
  const status = page.locator('.ge-sound-status');
  await expect(status).toHaveText('');

  await page.getByRole('button', { name: 'Español' }).press('Enter');
  await expect(status).toHaveText('Este navegador no tiene voz para este idioma, así que el fantasma habla solo con subtítulos.');
  expect(await spoken(page)).toHaveLength(1); // nothing new was spoken to find that out

  await page.getByRole('button', { name: 'English' }).press('Enter');
  await expect(status).toHaveText('');
});
