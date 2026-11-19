import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { installFakeRecognition } from '../../ghost-interview/e2e/fakes/speech-recognition';
import { installFakeSpeech } from '../../ghost-interview/e2e/fakes/speech-synthesis';

/**
 * The offline ghost-defense flow (ghost-defense-live task 10, Req 15.4 for phase 1): by keyboard,
 * upload, preview, a full 4-question demo session to the summary with Copy summary, skip and end
 * early, files that are too short or too large. axe (WCAG 2.2 AA) on every screen in EN and ES
 * with reduced motion on and off. Nothing may leave the site's origin (Req 12, the network guard).
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const T = {
  en: {
    file: 'thesis-abstract-en.md',
    start: 'Start',
    privacy: 'Privacy notice',
    accept: 'I understand, start',
    upload: 'Your file',
    chooseFile: 'Choose a file (.txt or .md, up to 2 MB)',
    sample: 'Sample in English',
    preview: 'What the ghost will read',
    question: (n: number) => `Question ${n} of 4`,
    followUp: 'Follow-up question',
    quote: 'From your file',
    field: 'Your answer',
    speak: 'Start speaking',
    send: 'Send',
    reply: "The examiner's reply",
    next: 'Continue',
    skip: 'Next question',
    end: 'End the session',
    summary: 'Practice summary',
    copy: 'Copy summary',
    copied: 'Summary copied.',
    again: 'Start again with this file',
    consent: 'Before the AI reads your file',
    offline: 'Continue offline (demo)',
    another: 'Use another file',
    demoLabel: 'Demo mode: questions and feedback come from simple rules, not AI.',
    tooShort: 'This text is too short to ask about. Use at least 300 characters.',
    tooLarge: 'This file is over 2 MB. Use a shorter file, or paste the part you want to discuss.',
    spoken: 'Within-subject designs control for differences in reading skill.',
    typed: 'Reading on paper took 14 minutes and on a screen 15 minutes, so the difference is small.',
  },
  es: {
    file: 'essay-es.md',
    start: 'Empezar',
    privacy: 'Aviso de privacidad',
    accept: 'Entendido, empezar',
    upload: 'Tu archivo',
    chooseFile: 'Elige un archivo (.txt o .md, hasta 2 MB)',
    sample: 'Ejemplo en español',
    preview: 'Lo que leerá el fantasma',
    question: (n: number) => `Pregunta ${n} de 4`,
    followUp: 'Pregunta de seguimiento',
    quote: 'De tu archivo',
    field: 'Tu respuesta',
    speak: 'Empezar a hablar',
    send: 'Enviar',
    reply: 'La respuesta del examinador',
    next: 'Continuar',
    skip: 'Siguiente pregunta',
    end: 'Terminar la sesión',
    summary: 'Resumen de práctica',
    copy: 'Copiar resumen',
    copied: 'Resumen copiado.',
    again: 'Empezar de nuevo con este archivo',
    consent: 'Antes de que la IA lea tu archivo',
    offline: 'Seguir sin conexión (demo)',
    another: 'Usar otro archivo',
    demoLabel: 'Modo demo: las preguntas y los comentarios salen de reglas simples, no de IA.',
    tooShort: 'Este texto es muy corto para hacer preguntas. Usa al menos 300 caracteres.',
    tooLarge: 'Este archivo pesa más de 2 MB. Usa uno más corto o pega la parte que quieres comentar.',
    spoken: 'Los adolescentes se duermen más tarde y una hora más de sueño ayuda a prestar atención.',
    typed: 'Una hora más de sueño ayuda a prestar atención en la primera clase.',
  },
} as const;
type Lang = keyof typeof T;

/** Every request to another origin is blocked before it goes out and recorded. */
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
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
/** axe on the current screen with both motion settings; returns the violations found. */
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
/** Keyboard only: presses Tab until `target` has focus. */
async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab never reached ${target}`);
}
const h2 = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 2, name });
/** A golden file of this app, by name (Req 15.5). */
const goldenFile = (name: string) => `${test.info().project.testDir}/../content/samples/${name}`;
/** A text file made in memory, for the size and length limits. Playwright accepts any byte buffer. */
const memoryFile = (name: string, size: number) => ({
  name,
  mimeType: 'text/plain',
  buffer: (globalThis as unknown as { Buffer: { alloc(n: number, fill: string): never } }).Buffer.alloc(size, 'a'),
});

/** Intro → (language) → Start → privacy notice → accept: the upload screen. */
async function toUpload(page: Page, lang: Lang, found?: string[]) {
  const t = T[lang];
  await page.goto('');
  if (lang === 'es') await page.getByRole('button', { name: 'Español' }).press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  if (found) found.push(...(await matrix(page, `${lang} intro`)));
  await tabTo(page, page.getByRole('button', { name: t.start }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: t.privacy })).toBeVisible();
  if (found) found.push(...(await matrix(page, `${lang} privacy notice`)));
  await tabTo(page, page.getByRole('button', { name: t.accept }));
  await page.keyboard.press('Enter');
  await expect(h2(page, t.upload)).toBeFocused();
}
/** Opens the file picker from the keyboard and chooses `files`. */
async function chooseFile(page: Page, lang: Lang, files: Parameters<import('@playwright/test').FileChooser['setFiles']>[0]) {
  await tabTo(page, page.getByLabel(T[lang].chooseFile));
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Space');
  await (await chooser).setFiles(files);
}
/** The consent screen (ghost-defense-live task 17): focus on its heading, then the offline choice. */
async function chooseOffline(page: Page, lang: Lang) {
  await expect(h2(page, T[lang].consent)).toBeFocused();
  await tabTo(page, page.getByRole('button', { name: T[lang].offline }));
  await page.keyboard.press('Enter');
}
/** Answers the question on screen: by voice (speak, stop, then Enter on Send) or typed. */
async function answer(page: Page, lang: Lang, how: 'voice' | 'typed', text: string) {
  const t = T[lang];
  if (how === 'voice') {
    await tabTo(page, page.getByRole('button', { name: t.speak }));
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__fakeRecognition?.control.active())).toBe(1);
    await page.evaluate((words) => window.__fakeRecognition?.control.result([[words, true]]), text);
    await page.keyboard.press('Enter'); // focus stayed on the voice button: stop
  } else {
    await tabTo(page, page.getByRole('textbox', { name: t.field }));
    await page.keyboard.type(text);
    await page.keyboard.press('Control+Enter');
  }
  // Inline confirmation: the interpreted answer stays, Send has focus, Enter confirms (Req 7.2).
  await expect(page.getByRole('button', { name: t.send })).toBeFocused();
  await expect(page.locator('.ge-confirm blockquote')).toHaveText(text);
}

test.beforeEach(async ({ page }) => {
  await installFakeSpeech(page);
  await installFakeRecognition(page);
});

for (const lang of ['en', 'es'] as const) {
  const t = T[lang];
  test(`${lang}: upload, preview, a full 4-question session to the summary and Copy summary, by keyboard; axe on every screen`, async ({
    page,
    baseURL,
    context,
  }) => {
    test.setTimeout(90_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const foreign = await guardNetwork(page, baseURL!);
    const errors = watchErrors(page);
    const found: string[] = [];
    await toUpload(page, lang, found);
    found.push(...(await matrix(page, `${lang} upload`)));
    await chooseFile(page, lang, goldenFile(t.file));
    await expect(h2(page, t.preview)).toBeFocused();
    await expect(page.getByRole('region', { name: lang === 'en' ? 'The text of your file' : 'El texto de tu archivo' })).toContainText(
      lang === 'en' ? 'within-subject design' : 'empezar a las nueve',
    );
    found.push(...(await matrix(page, `${lang} preview`)));
    await tabTo(page, page.getByRole('button', { name: t.start }));
    await page.keyboard.press('Enter');
    await chooseOffline(page, lang);

    await expect(page.getByText(t.demoLabel)).toBeVisible();
    const asked: number[] = [];
    for (let guard = 0; guard < 40 && !(await h2(page, t.summary).isVisible()); guard++) {
      const main = page.getByRole('heading', { level: 2, name: /^(Question \d of 4|Pregunta \d de 4)$/ });
      if (await page.getByRole('heading', { level: 2, name: t.reply }).isVisible()) {
        if (asked.length === 1) found.push(...(await matrix(page, `${lang} reply`)));
        await tabTo(page, page.getByRole('button', { name: t.next }));
        await page.keyboard.press('Enter');
      } else if ((await main.isVisible()) || (await h2(page, t.followUp).isVisible())) {
        await expect(page.getByRole('textbox', { name: t.field })).toBeVisible();
        const heading = await page.locator('.gd-panel h2').first().textContent();
        await expect(h2(page, heading!)).toBeFocused();
        const n = Number(/\d/.exec(heading!)?.[0] ?? 0);
        if (n) asked.push(n);
        // Every question shows its quote, in the file's language, and the ghost never speaks it.
        await expect(page.getByRole('figure', { name: t.quote }).locator('blockquote')).toHaveAttribute('lang', lang);
        if (asked.length === 1 && n === 1) found.push(...(await matrix(page, `${lang} question`)));
        await answer(page, lang, asked.length === 1 && n === 1 ? 'voice' : 'typed', n === 1 ? t.spoken : t.typed);
        if (n === 1) found.push(...(await matrix(page, `${lang} inline confirmation`)));
        await page.keyboard.press('Enter');
        await expect(h2(page, t.reply)).toBeFocused();
      }
      await page.waitForTimeout(50);
    }
    expect(asked).toEqual([1, 2, 3, 4]);
    await expect(h2(page, t.summary)).toBeFocused();
    expect(await page.locator('.ge-feedback ol li').count()).toBeGreaterThanOrEqual(4);
    found.push(...(await matrix(page, `${lang} summary`)));
    await tabTo(page, page.getByRole('button', { name: t.copy }));
    await page.keyboard.press('Enter');
    await expect(page.getByText(t.copied)).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.startsWith(`${t.summary}\n`)).toBe(true);
    expect(copied).not.toContain('<');

    // Quotes are shown, never spoken (owner decision 5).
    const quotes = await page.getByRole('figure', { name: t.quote }).locator('blockquote').allTextContents();
    const said = await page.evaluate(() => (window.__fakeSpeech?.log ?? []).filter((e) => e.type === 'speak').map((e) => e.text ?? ''));
    for (const q of quotes) expect(said.some((s) => s.includes(q))).toBe(false);

    expect(found).toEqual([]);
    expect(foreign).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${lang}: skip a question and end early; then start again or use another file`, async ({ page, baseURL }) => {
    const foreign = await guardNetwork(page, baseURL!);
    const errors = watchErrors(page);
    await toUpload(page, lang);
    await tabTo(page, page.getByRole('button', { name: t.sample }));
    await page.keyboard.press('Enter');
    await expect(h2(page, t.preview)).toBeFocused();
    await tabTo(page, page.getByRole('button', { name: t.start }));
    await page.keyboard.press('Enter');
    await chooseOffline(page, lang);
    await expect(h2(page, t.question(1))).toBeFocused();
    await tabTo(page, page.getByRole('button', { name: t.skip }));
    await page.keyboard.press('Enter');
    await expect(h2(page, t.question(2))).toBeFocused();
    await answer(page, lang, 'typed', t.typed);
    await page.keyboard.press('Enter');
    await expect(h2(page, t.reply)).toBeFocused();
    await tabTo(page, page.getByRole('button', { name: t.end }));
    await page.keyboard.press('Enter');
    await expect(h2(page, t.summary)).toBeFocused();
    await expect(page.locator('.ge-feedback ol li')).toHaveCount(1); // only the answered question
    await tabTo(page, page.getByRole('button', { name: t.again }));
    await page.keyboard.press('Enter');
    await chooseOffline(page, lang); // a new session asks again (Req 3.1)
    await expect(h2(page, t.question(1))).toBeFocused(); // a new session with the same file
    await tabTo(page, page.getByRole('button', { name: t.end }));
    await page.keyboard.press('Enter');
    await expect(h2(page, t.summary)).toBeFocused();
    await tabTo(page, page.getByRole('button', { name: t.another }));
    await page.keyboard.press('Enter');
    await expect(h2(page, t.upload)).toBeFocused();
    expect(foreign).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${lang}: a file that is too short or too large gets a message and no preview; axe on the error`, async ({ page, baseURL }) => {
    const foreign = await guardNetwork(page, baseURL!);
    const errors = watchErrors(page);
    await toUpload(page, lang);
    await chooseFile(page, lang, memoryFile('short.txt', 120));
    await expect(page.getByText(t.tooShort)).toBeVisible();
    const found = await matrix(page, `${lang} upload error`);
    await chooseFile(page, lang, memoryFile('big.txt', 2 * 1024 * 1024 + 1));
    await expect(page.getByText(t.tooLarge)).toBeVisible();
    await expect(h2(page, t.preview)).toHaveCount(0);
    expect(found).toEqual([]);
    expect(foreign).toEqual([]);
    expect(errors).toEqual([]);
  });
}
