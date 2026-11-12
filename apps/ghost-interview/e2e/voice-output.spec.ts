import AxeBuilder from '@axe-core/playwright';
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

// Req 12.4 (spec a), task 20: in demo mode nothing leaves the site's origin, voice or not.
let foreign: string[] = [];
test.beforeEach(async ({ page, baseURL }) => {
  foreign = [];
  const origin = new URL(baseURL!).origin;
  await page.route(
    (url) => (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== origin,
    (route) => {
      foreign.push(route.request().url());
      return route.abort('blockedbyclient');
    },
  );
  await page.clock.install();
});
test.afterEach(() => {
  expect(foreign).toEqual([]);
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
  await expect(status).toHaveText('No hay voz para este idioma.');
  expect(await spoken(page)).toHaveLength(1); // nothing new was spoken to find that out

  await page.getByRole('button', { name: 'English' }).press('Enter');
  await expect(status).toHaveText('');
});

// ---- Task 19b: the sound control's layout -------------------------------------------------------

/** Page-coordinate boxes (top, height, left) of what must never move when a reason comes or goes. */
const layout = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      // The ghost's container, not its <svg>: the float (spec a task 37) moves the svg by transform, which is not layout.
      ['header', '.gi-ghost', '.ge-captions', '.ge-keyboard-field'].map((selector) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return [selector, [Math.round(r.top + window.scrollY), Math.round(r.height), Math.round(r.left)]];
      }),
    ),
  );

/** How the sound button looks (border shape and fill), and whether the reason copies stay invisible. */
const look = (page: Page) =>
  page.evaluate(() => {
    const button = getComputedStyle(document.querySelector('.ge-sound-button')!);
    const copies = [...document.querySelectorAll('.ge-sound-sizer')].map((s) => getComputedStyle(s).visibility);
    return {
      border: button.borderTopStyle,
      filled: button.backgroundColor !== 'rgba(0, 0, 0, 0)',
      hiddenCopies: copies.length === 3 && copies.every((v) => v === 'hidden'),
    };
  });

for (const width of [320, 1280]) {
  test(`at ${width} px, nothing moves when a sound reason appears or goes away`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installFakeSpeech(page, { manual: true });
    await page.goto('');
    await acceptPrivacy(page);
    await page.clock.runFor(500); // the question waits for the voice to start
    const status = page.locator('.ge-sound-status');
    await expect(status).toHaveText('');
    const before = await layout(page);
    expect(await look(page)).toEqual({ border: 'solid', filled: true, hiddenCopies: true }); // on

    await page.clock.runFor(1600); // no start within 2 s: the voice failed
    await expect(status).toHaveText('The voice failed. Turn it on again.');
    expect(await layout(page)).toEqual(before);
    expect(await look(page)).toEqual({ border: 'dashed', filled: false, hiddenCopies: true }); // unavailable

    await page.getByRole('button', { name: 'Ghost voice' }).press('Enter'); // sound on again: the reason goes
    await expect(status).toHaveText('');
    expect(await layout(page)).toEqual(before);
    expect(await look(page)).toEqual({ border: 'solid', filled: true, hiddenCopies: true });
  });
}

for (const lang of ['en', 'es'] as const) {
  test(`at 320x700 in ${lang}, with a reason showing, the header is compact and the answer field fits`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await installFakeSpeech(page, { manual: true });
    await page.goto('');
    if (lang === 'es') await page.getByRole('button', { name: 'Español' }).press('Enter');
    await page.getByRole('button', { name: lang === 'es' ? 'Empezar' : 'Start' }).press('Enter');
    await page.getByRole('button', { name: lang === 'es' ? 'Entendido, empezar' : 'I understand, start' }).press('Enter');
    await page.clock.runFor(2100); // the voice never starts: failed
    await expect(page.locator('.ge-sound-status')).toHaveText(
      lang === 'es' ? 'La voz falló. Vuelve a encenderla.' : 'The voice failed. Turn it on again.',
    );
    await expect(page.locator('.ge-keyboard-field')).toBeFocused();

    const seen = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      return {
        scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollY: window.scrollY,
        field: { top: box('.ge-keyboard-field').top, bottom: box('.ge-keyboard-field').bottom },
        soundTop: box('.ge-sound-button').top,
        languageTops: [...document.querySelectorAll('.ge-language-button')].map((b) => b.getBoundingClientRect().top),
      };
    });
    expect(seen.scrollX).toBe(false);
    expect(seen.scrollY).toBe(0); // focusing the field did not need to scroll
    expect(seen.field.top).toBeGreaterThanOrEqual(0);
    expect(seen.field.bottom).toBeLessThanOrEqual(700);
    expect(seen.languageTops).toEqual([seen.soundTop, seen.soundTop]); // sound and language buttons in one row
  });
}

// ---- Task 20 coverage: the voice per language, no voices, no API, and axe on those states --------

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const STATES = [
  { variant: 'two-voices', lang: 'es', voice: 'es-MX:Fake Español', reason: '' },
  { variant: 'no-voices', lang: 'en', voice: undefined, reason: 'No voice for this language.' },
  { variant: 'no-api', lang: 'en', voice: undefined, reason: "This browser can't speak aloud." },
] as const;

for (const { variant, lang, voice, reason } of STATES) {
  test(`${variant} in ${lang}: the right voice or a muted line with its reason, no errors, no axe violations`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await installFakeSpeech(page, { variant, manual: true });
    await page.goto('');
    if (lang === 'es') await page.getByRole('button', { name: 'Español' }).press('Enter');
    await page.getByRole('button', { name: lang === 'es' ? 'Empezar' : 'Start' }).press('Enter');
    await page.getByRole('button', { name: lang === 'es' ? 'Entendido, empezar' : 'I understand, start' }).press('Enter');

    if (voice) {
      expect((await spoken(page)).map((e) => `${e.lang}:${e.voice}`)).toEqual([voice]);
      await fake(page).start();
      await fake(page).end();
    } else {
      expect(await speechLog(page).catch(() => [])).toEqual([]); // nothing reaches a speech API
      await page.clock.runFor(8000); // the muted question plays to its end on the clock
    }
    await expect(page.locator('.ge-transcript-list li')).toHaveCount(2); // the answering screen, in either language
    await expect(page.locator('.ge-sound-status')).toHaveText(reason);

    await page.clock.resume(); // axe needs real timers
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion });
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${reducedMotion}: ${v.id}`)).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}
