import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { edgeContrast } from './edge-contrast';
import { installFakeRecognition, recognitionLog, type FakeRecognitionVariant } from './fakes/speech-recognition';
import { installFakeSpeech } from './fakes/speech-synthesis';

/**
 * Voice answers in the app (spec b task 33). Fake speech recognition and a manual fake voice, with
 * the page clock installed: no microphone, no network, no timing. Task 34 fills the gaps (Edit,
 * empty answer, the axe matrix); task 33b adds the panel edge check.
 */
const QUESTION = 'Tell me about a time you solved a difficult problem.';

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
test.afterEach(() => expect(foreign).toEqual([]));

const recognition = (page: Page) => ({
  result: (results: [string, boolean][]) => page.evaluate((r) => window.__fakeRecognition!.control.result(r), results),
  error: (code: string) => page.evaluate((c) => window.__fakeRecognition!.control.error(c), code),
});
const status = (page: Page) => page.locator('.ge-voice-status');
const voiceButton = (page: Page) => page.locator('.ge-voice-button');
const confirmation = (page: Page) => page.getByRole('region', { name: 'I noted this. Is that what you meant?' });

/** Accept the notice and let the question end, by keyboard: the answering screen. */
async function answering(page: Page, variant: FakeRecognitionVariant = 'working') {
  await installFakeSpeech(page, { manual: true });
  await installFakeRecognition(page, variant);
  await page.goto('');
  await page.getByRole('button', { name: 'Start' }).press('Enter');
  await page.getByRole('button', { name: 'I understand, start' }).press('Enter');
  await page.evaluate(() => {
    window.__fakeSpeech!.control.start();
    window.__fakeSpeech!.control.end();
  });
  await expect(page.getByRole('region', { name: 'Transcript' }).getByRole('listitem')).toHaveText([/Good evening/, QUESTION]);
}

test('a spoken answer: live words, stop, confirmation as "Spoken", then feedback', async ({ page }) => {
  await answering(page);
  await expect(page.getByText('Preview', { exact: true })).toHaveCount(0); // voice works here: not a Preview session
  expect(await recognitionLog(page)).toEqual([]); // no microphone before the voice button

  await voiceButton(page).press('Enter');
  await expect(voiceButton(page)).toHaveText('Stop speaking');
  await expect(voiceButton(page)).toBeFocused();
  await expect(status(page)).toHaveText('Listening…');
  expect(await recognitionLog(page)).toEqual([{ type: 'new' }, { type: 'start', lang: 'en-US' }]);

  await recognition(page).result([['I fixed the build', true], [' on Friday', false]]);
  await expect(page.locator('.ge-voice-final')).toHaveText('I fixed the build');
  await expect(page.locator('.ge-voice-interim')).toHaveText('on Friday');

  await voiceButton(page).press('Enter'); // stop: the last results arrive, then the answer goes to confirmation
  await expect(confirmation(page)).toBeVisible();
  await expect(confirmation(page).locator('blockquote')).toHaveText('I fixed the build on Friday');
  await expect(confirmation(page).getByText('How you answered: Spoken')).toBeVisible();
  await expect(confirmation(page).getByRole('heading')).toBeFocused();

  await confirmation(page).getByRole('button', { name: 'Confirm' }).press('Enter');
  await expect(page.getByRole('region', { name: 'Practice feedback' })).toBeVisible();
});

test('an error after some words: the words go to confirmation with the message beside them, until the user acts', async ({ page }) => {
  await answering(page);
  await voiceButton(page).press('Enter');
  await recognition(page).result([['I fixed the build', true]]);
  await recognition(page).error('audio-capture');

  await expect(confirmation(page).locator('blockquote')).toHaveText('I fixed the build');
  const notice = confirmation(page).locator('.ge-confirm-notice');
  await expect(notice).toHaveText("I can't find a microphone. Connect one and try again, or type your answer.");
  await expect(confirmation(page).getByRole('heading')).toHaveAttribute('aria-describedby', (await notice.getAttribute('id'))!);

  await page.clock.runFor(5000); // still there: it waits for the user
  await expect(notice).toBeVisible();

  await confirmation(page).getByRole('button', { name: 'Answer again' }).press('Enter');
  await expect(voiceButton(page)).toBeFocused(); // Retry after a voice answer: back to the voice button (Req 6.3)
  await expect(page.locator('.ge-confirm-notice')).toHaveCount(0);
  await expect(voiceButton(page)).toHaveText('Start speaking');
});

test('Brave-like (the API exists, its service fails): unavailable with the reason, no error, typing works', async ({ page }) => {
  await answering(page, 'brave');
  await voiceButton(page).press('Enter');
  await expect(status(page)).toHaveText("Voice input isn't available in this browser. You can type your answer.");
  await expect(voiceButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(voiceButton(page)).toHaveText('Start speaking');

  await voiceButton(page).press('Enter'); // does nothing now
  expect((await recognitionLog(page)).filter((e) => e.type === 'new')).toHaveLength(1);

  await page.getByRole('textbox', { name: 'Your answer' }).fill('I fixed the build.');
  await page.getByRole('textbox', { name: 'Your answer' }).press('Control+Enter');
  await expect(confirmation(page).getByText('How you answered: Typed')).toBeVisible();
});

test('no speech recognition at all (Firefox-like): a Preview session that says what is missing; typing works', async ({ page }) => {
  await answering(page, 'none');
  await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  await expect(page.getByText('No voice input in this browser. You can type your answers.')).toBeVisible();
  await expect(voiceButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(status(page)).toHaveText("Voice input isn't available in this browser. You can type your answer.");

  await page.getByRole('textbox', { name: 'Your answer' }).fill('I fixed the build.');
  await page.getByRole('textbox', { name: 'Your answer' }).press('Control+Enter');
  await expect(confirmation(page)).toBeVisible();
});

// Task 34: the gaps between the tests above and the task's Done-when.

test('Edit after a spoken answer: the words prefill the text field, focused, and the edit goes to confirmation', async ({ page }) => {
  await answering(page);
  await voiceButton(page).press('Enter');
  await recognition(page).result([['I fixed the build on Friday', true]]);
  await voiceButton(page).press('Enter');
  await confirmation(page).getByRole('button', { name: 'Edit' }).press('Enter');

  const field = page.getByRole('textbox', { name: 'Your answer' });
  await expect(field).toHaveValue('I fixed the build on Friday');
  await expect(field).toBeFocused();
  // Replace the words (select all works the same on every platform; the caret itself starts at 0).
  await field.press('ControlOrMeta+a');
  await field.pressSequentially('I fixed the build in one hour.');
  await field.press('Control+Enter');
  await expect(confirmation(page).locator('blockquote')).toHaveText('I fixed the build in one hour.');
  await expect(confirmation(page).getByText('How you answered: Typed')).toBeVisible();
});

test('an empty voice answer: the message, no confirmation, and voice ready again', async ({ page }) => {
  await answering(page);
  await voiceButton(page).press('Enter');
  await expect(status(page)).toHaveText('Listening…');
  await voiceButton(page).press('Enter'); // stop with no words
  await expect(status(page)).toHaveText("I didn't catch any words. Try again, or type your answer.");
  await expect(confirmation(page)).toHaveCount(0);
  await expect(voiceButton(page)).toHaveText('Start speaking');
  await expect(voiceButton(page)).toBeFocused();
  await expect(voiceButton(page)).not.toHaveAttribute('aria-disabled', 'true');
});

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ES = { start: 'Empezar', accept: 'Entendido, empezar', confirm: 'Confirmar', heading: 'Anoté esto. ¿Es lo que quisiste decir?' };

for (const lang of ['en', 'es'] as const) {
  test(`axe in ${lang}, reduced motion on and off: answering, listening, empty, confirmation, feedback, Preview session`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    const found: string[] = [];
    const check = async (screen: string) => {
      for (const reducedMotion of ['no-preference', 'reduce'] as const) {
        await page.emulateMedia({ reducedMotion });
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        found.push(...violations.map((v) => `${screen} ${reducedMotion}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`));
      }
    };
    const open = async (variant: FakeRecognitionVariant) => {
      await installFakeSpeech(page, { manual: true });
      await installFakeRecognition(page, variant);
      await page.goto('');
      if (lang === 'es') await page.getByRole('button', { name: 'Español' }).press('Enter');
      await page.getByRole('button', { name: lang === 'es' ? ES.start : 'Start' }).press('Enter');
      await page.getByRole('button', { name: lang === 'es' ? ES.accept : 'I understand, start' }).press('Enter');
      await page.evaluate(() => {
        window.__fakeSpeech!.control.start();
        window.__fakeSpeech!.control.end();
      });
      await expect(page.locator('.ge-transcript-list li')).toHaveCount(2);
    };
    const region = (en: string, es: string) => page.getByRole('region', { name: lang === 'es' ? es : en });

    await open('working');
    await page.clock.resume(); // axe needs real timers
    await check('answering');
    await voiceButton(page).press('Enter');
    await recognition(page).result([[lang === 'es' ? 'Arreglé la compilación' : 'I fixed the build', true], [lang === 'es' ? ' el viernes' : ' on Friday', false]]);
    await expect(page.locator('.ge-voice-interim')).not.toBeEmpty();
    await check('listening with words');
    await voiceButton(page).press('Enter');
    const confirm = region('I noted this. Is that what you meant?', ES.heading);
    await expect(confirm).toBeVisible();
    await check('confirmation');
    await confirm.getByRole('button', { name: lang === 'es' ? ES.confirm : 'Confirm' }).press('Enter');
    await expect(region('Practice feedback', 'Comentarios de práctica')).toBeVisible();
    await check('feedback');

    await open('working');
    await voiceButton(page).press('Enter');
    await voiceButton(page).press('Enter'); // nothing said
    await expect(status(page)).toHaveText(lang === 'es' ? 'No escuché ninguna palabra. Inténtalo de nuevo o escribe tu respuesta.' : "I didn't catch any words. Try again, or type your answer.");
    await check('empty answer');

    await open('none');
    await expect(page.getByText(lang === 'es' ? 'Vista previa' : 'Preview', { exact: true })).toBeVisible();
    await check('Preview session');

    expect(found).toEqual([]);
    expect(errors).toEqual([]);
  });
}

// Task 33b: the panel's fill is close to the fixed page gradient, so where the panel sits decided
// whether its edge showed; the Preview header pushes it down to where they match. 3:1 as in WCAG 1.4.11.
for (const variant of ['working', 'none'] as const) {
  test(`at 1280 px the question panel has a visible edge (${variant === 'none' ? 'Preview session' : 'voice session'})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await answering(page, variant);
    await expect(page.getByText('Preview', { exact: true })).toHaveCount(variant === 'none' ? 1 : 0);
    expect(await edgeContrast(page.locator('.ge-captions'))).toBeGreaterThanOrEqual(3);
  });
}

// Task 35b: the same edge on the transcript, confirmation and feedback panels, wherever they sit.
for (const width of [320, 1280]) {
  test(`at ${width} px the transcript, confirmation and feedback panels have a visible edge`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await answering(page);
    const contrasts: Record<string, number> = { transcript: await edgeContrast(page.locator('.ge-transcript')) };
    await voiceButton(page).press('Enter');
    await recognition(page).result([['I fixed the build', true]]);
    await voiceButton(page).press('Enter');
    contrasts.confirmation = await edgeContrast(confirmation(page));
    await confirmation(page).getByRole('button', { name: 'Confirm' }).press('Enter');
    contrasts.feedback = await edgeContrast(page.getByRole('region', { name: 'Practice feedback' }));
    for (const [panel, ratio] of Object.entries(contrasts)) expect.soft(ratio, panel).toBeGreaterThanOrEqual(3);
  });
}

/** Page-coordinate boxes of everything that must stay put when a voice message comes or goes. */
const layout = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      // The ghost's container, not its <svg>: the float (spec a task 37) moves the svg by transform, which is not layout.
      ['.gi-ghost', '.ge-captions', '.ge-keyboard-field', '.ge-voice-button', '.ge-voice-messages', '.ge-voice-words', '.ge-transcript'].map(
        (selector) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return [selector, [Math.round(r.top + window.scrollY), Math.round(r.height)]];
        },
      ),
    ),
  );

for (const width of [320, 1280]) {
  test(`at ${width} px, voice messages never move the page: listening, stopped, an error, unavailable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await answering(page);
    const before = await layout(page);

    await voiceButton(page).press('Enter');
    await expect(status(page)).toHaveText('Listening…');
    expect(await layout(page)).toEqual(before);

    await recognition(page).error('language-not-supported'); // the longest message, with no words
    await expect(status(page)).toHaveText("This browser can't recognize speech in this language. Switch language, or type your answer.");
    expect(await layout(page)).toEqual(before);

    await voiceButton(page).press('Enter');
    await recognition(page).error('service-not-allowed'); // now unavailable
    await expect(status(page)).toHaveText("Voice input isn't available in this browser. You can type your answer.");
    expect(await layout(page)).toEqual(before);
  });
}
