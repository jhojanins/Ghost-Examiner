import { expect, test, type Page } from '@playwright/test';
import { installFakeRecognition } from './fakes/speech-recognition';
import { installFakeSpeech } from './fakes/speech-synthesis';

/**
 * Floating and the motion toggle in the app (spec a task 37, Req 3.6, 3.7, 3.10). Real time: the
 * float moves about 0.4 px every 250 ms at its slowest, so two samples a second apart differ.
 */
test.beforeEach(async ({ page }) => {
  await installFakeSpeech(page);
  await installFakeRecognition(page);
});

const wrapper = (page: Page) => page.locator('.ge-ghost-float');
/** The float offsets seen over about a second. */
async function offsets(page: Page) {
  const seen = new Set<string>();
  for (let i = 0; i < 5; i++) {
    seen.add(await wrapper(page).evaluate((el) => (el as HTMLElement).style.transform));
    await page.waitForTimeout(250);
  }
  return seen;
}

test('the ghost floats; "Pause motion" (keyboard) stops it and pressing again resumes', async ({ page }) => {
  await page.goto('');
  expect((await offsets(page)).size).toBeGreaterThan(1);

  const toggle = page.getByRole('button', { name: 'Pause motion' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  for (let i = 0; i < 10 && !(await toggle.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect([...(await offsets(page))]).toEqual(['translateY(0px)']);
  await expect(page.getByRole('img')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.getByRole('img')).toHaveAttribute('data-blink', 'false');

  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect((await offsets(page)).size).toBeGreaterThan(1);
});

test('with prefers-reduced-motion: reduce, the ghost never floats and the toggle still works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('');
  expect([...(await offsets(page))]).toEqual(['translateY(0px)']);
  await page.getByRole('button', { name: 'Pause motion' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Pause motion' })).toHaveAttribute('aria-pressed', 'true');
});
