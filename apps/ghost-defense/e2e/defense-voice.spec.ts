import { expect, test, type Page } from '@playwright/test';
import { installFakeRecognition, recognitionLog, type FakeRecognitionVariant } from '@ghost-examiner/web/testing/speech-recognition';
import { installFakeSpeech } from '@ghost-examiner/web/testing/speech-synthesis';
import { guardNetwork, h2, matrix, tabTo, watchErrors } from './helpers';

/**
 * Voice conversation in Ghost Defense (owner decision 2026-11-20), offline demo, English, with the
 * speech and recognition fakes driven by hand: the microphone opens by itself only after the
 * question has been spoken, never while the ghost speaks, and only in Voice conversation; there is
 * no auto-send: the user presses "I'm done", then Send. Errors fall back to the typed field.
 */
const endLine = (page: Page) => page.evaluate(() => window.__fakeSpeech!.control.end());
const starts = async (page: Page) => (await recognitionLog(page)).filter((e) => e.type === 'start').length;
const status = (page: Page) => page.locator('.ge-voice-status');

async function setup(page: Page, choice: 'Voice conversation' | 'Type', variant: FakeRecognitionVariant = 'working') {
  await installFakeSpeech(page, { manual: true });
  await installFakeRecognition(page, variant);
  await page.goto('');
  await tabTo(page, page.getByRole('button', { name: choice }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'I understand, start' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Sample in English' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Start' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Continue offline (demo)' }));
  await page.keyboard.press('Enter');
  await expect(h2(page, 'Question 1 of 4')).toBeVisible();
}
/** Ends the greeting, then checks the question is playing with no microphone, then ends it. */
async function speakQuestion(page: Page) {
  await endLine(page); // the greeting
  await expect(page.locator('.ge-captions')).toContainText('?'); // the question is playing
  expect(await starts(page)).toBe(0); // never listen while the ghost speaks
  await endLine(page);
}

test('the intro offers Voice conversation and Type as two equal choices; axe passes', async ({ page }) => {
  await page.goto('');
  const [voice, type] = [page.getByRole('button', { name: 'Voice conversation' }), page.getByRole('button', { name: 'Type' })];
  expect(await voice.getAttribute('class')).toBe(await type.getAttribute('class'));
  expect(await matrix(page, 'intro')).toEqual([]);
});

test('voice: listens by itself after the question, never during it; no auto-send; I\'m done, Keep talking, then Send', async ({ page, baseURL }) => {
  const foreign = await guardNetwork(page, baseURL!);
  const errors = watchErrors(page);
  await setup(page, 'Voice conversation');
  await speakQuestion(page);
  await expect.poll(() => starts(page)).toBe(1);
  await expect(status(page)).toHaveText('Listening…');
  await expect(page.getByRole('button', { name: "I'm done" })).toBeVisible();
  // The browser ends recognition by itself: listening goes on, and nothing is sent.
  await page.evaluate(() => window.__fakeRecognition!.control.result([['I chose a timer in the browser', true]]));
  await page.evaluate(() => window.__fakeRecognition!.control.end());
  await page.waitForTimeout(1500);
  await expect(page.locator('.ge-confirm')).toHaveCount(0);
  await expect(status(page)).toHaveText('Listening…');
  await tabTo(page, page.getByRole('button', { name: "I'm done" }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Send' })).toBeFocused();
  await page.waitForTimeout(1500);
  await expect(h2(page, "The examiner's reply")).toHaveCount(0); // still waiting for Send
  // Keep talking adds to the same words.
  await tabTo(page, page.getByRole('button', { name: 'Keep talking' }));
  await page.keyboard.press('Enter');
  await expect(status(page)).toHaveText('Listening…');
  await page.evaluate(() => window.__fakeRecognition!.control.result([['because everyone had a laptop', true]]));
  await page.getByRole('button', { name: "I'm done" }).press('Enter');
  await expect(page.locator('.ge-confirm blockquote')).toHaveText('I chose a timer in the browser because everyone had a laptop');
  await page.keyboard.press('Enter'); // Send has focus
  await expect(h2(page, "The examiner's reply")).toBeFocused();
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

test('voice: typing stops listening; Mic off stops listening on later questions', async ({ page }) => {
  await setup(page, 'Voice conversation');
  await speakQuestion(page);
  await expect(status(page)).toHaveText('Listening…');
  await tabTo(page, page.getByRole('textbox', { name: 'Your answer' }));
  await page.keyboard.type('I');
  await expect.poll(() => page.evaluate(() => window.__fakeRecognition!.control.active())).toBe(0);
  await tabTo(page, page.getByRole('button', { name: 'Mic off' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Mic on' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Next question' }));
  await page.keyboard.press('Enter');
  await endLine(page);
  await page.waitForTimeout(500);
  expect(await starts(page)).toBe(1); // only the first question's listening
});

test('type: the microphone stays off for the whole session', async ({ page }) => {
  await setup(page, 'Type');
  await speakQuestion(page);
  await page.waitForTimeout(500);
  expect(await recognitionLog(page)).toEqual([]);
  await expect(page.getByRole('button', { name: 'Mic off' })).toHaveCount(0);
});

for (const [variant, line] of [
  ['none', "Voice input isn't available in this browser. You can type your answer."],
  ['brave', "Voice input isn't available in this browser. You can type your answer."],
] as const) {
  test(`voice, no recognition (${variant}): one calm line, the typed field gets focus, no retry`, async ({ page }) => {
    await setup(page, 'Voice conversation', variant);
    if (variant === 'none') {
      await endLine(page);
      await endLine(page);
    } else await speakQuestion(page);
    await expect(status(page)).toHaveText(line);
    await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeFocused();
    await page.waitForTimeout(500);
    expect(await starts(page)).toBeLessThanOrEqual(1);
  });
}

test('voice, permission denied: one calm line, the typed field gets focus, no automatic retry', async ({ page }) => {
  await setup(page, 'Voice conversation');
  await speakQuestion(page);
  await expect.poll(() => starts(page)).toBe(1);
  await page.evaluate(() => window.__fakeRecognition!.control.error('not-allowed'));
  await expect(status(page)).toContainText('Allow the microphone in your browser, or type your answer.');
  await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeFocused();
  await page.waitForTimeout(1000);
  expect(await starts(page)).toBe(1);
});
