import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installFakeRecognition } from './fakes/speech-recognition';
import { installFakeSpeech } from './fakes/speech-synthesis';

/**
 * The full axe matrix (spec a task 38, Req 12.3): every slice screen and the ghost-defense shell,
 * in EN and ES, each with reduced motion `no-preference` and `reduce`. WCAG 2.2 AA tags.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** Served by the second web server in playwright.config.ts. */
const DEFENSE_URL = 'http://localhost:4174/defense/';

const T = {
  en: {
    start: 'Start',
    privacy: 'Privacy notice',
    accept: 'I understand, start',
    close: 'Close',
    field: 'Your answer',
    confirm: 'I noted this. Is that what you meant?',
    confirmButton: 'Confirm',
    feedback: 'Practice feedback',
    next: 'Continue',
    end: 'End of the practice',
    answer: 'The situation was a report that took two days, so I decided to rewrite it.',
    defenseTitle: 'Ghost Defense',
  },
  es: {
    start: 'Empezar',
    privacy: 'Aviso de privacidad',
    accept: 'Entendido, empezar',
    close: 'Cerrar',
    field: 'Tu respuesta',
    confirm: 'Anoté esto. ¿Es lo que quisiste decir?',
    confirmButton: 'Confirmar',
    feedback: 'Comentarios de práctica',
    next: 'Continuar',
    end: 'Fin de la práctica',
    answer: 'La situación era un informe que tardaba dos días, así que decidí reescribirlo.',
    defenseTitle: 'Defensa fantasma',
  },
} as const;

test.beforeEach(async ({ page }) => {
  await installFakeSpeech(page);
  await installFakeRecognition(page);
});

/** Runs axe on the current screen with both motion settings; returns the violations found. */
async function matrix(page: Page, screen: string) {
  const found: string[] = [];
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    found.push(...violations.map((v) => `${screen} ${reducedMotion}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`));
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return found;
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

for (const lang of ['en', 'es'] as const) {
  const t = T[lang];

  test(`ghost-interview in ${lang}: intro, privacy notice, answering, confirming, feedback, end`, async ({ page }) => {
    const errors = watchErrors(page);
    const found: string[] = [];
    await page.goto('');
    if (lang === 'es') await page.getByRole('button', { name: 'Español' }).press('Enter');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    found.push(...(await matrix(page, 'intro')));

    await page.getByRole('button', { name: t.start }).press('Enter');
    await expect(page.getByRole('dialog', { name: t.privacy })).toBeVisible();
    found.push(...(await matrix(page, 'privacy notice')));

    await page.getByRole('button', { name: t.accept }).press('Enter');
    await expect(page.locator('.ge-transcript-list li')).toHaveCount(2, { timeout: 10_000 }); // the question has played
    found.push(...(await matrix(page, 'answering')));

    const field = page.getByRole('textbox', { name: t.field });
    await field.fill(t.answer);
    await field.press('Control+Enter');
    await expect(page.getByRole('region', { name: t.confirm })).toBeVisible();
    found.push(...(await matrix(page, 'confirming')));

    await page.getByRole('button', { name: t.confirmButton }).press('Enter');
    await expect(page.getByRole('region', { name: t.feedback })).toBeVisible();
    found.push(...(await matrix(page, 'feedback')));

    await page.getByRole('button', { name: t.next }).press('Enter');
    await expect(page.getByRole('heading', { level: 2, name: t.end })).toBeVisible();
    found.push(...(await matrix(page, 'end')));

    expect(found).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`ghost-defense shell in ${lang}: the shell and its privacy notice`, async ({ page }) => {
    const errors = watchErrors(page);
    const found: string[] = [];
    await page.goto(DEFENSE_URL);
    if (lang === 'es') await page.getByRole('button', { name: 'Español' }).press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: t.defenseTitle })).toBeVisible();
    found.push(...(await matrix(page, 'defense shell')));

    await page.getByRole('button', { name: t.privacy }).press('Enter');
    const dialog = page.getByRole('dialog', { name: t.privacy });
    await expect(dialog).toBeVisible();
    found.push(...(await matrix(page, 'defense privacy notice')));
    await dialog.getByRole('button', { name: t.close }).press('Enter');
    await expect(dialog).toBeHidden();

    expect(found).toEqual([]);
    expect(errors).toEqual([]);
  });
}
