import { expect, test, type Page, type Route } from '@playwright/test';
import { installFakeRecognition } from '@ghost-examiner/web/testing/speech-recognition';
import { installFakeSpeech } from '@ghost-examiner/web/testing/speech-synthesis';
import { guardNetwork, h2, matrix, tabTo, watchErrors } from './helpers';

/**
 * Real mode with a fake proxy (ghost-defense-live task 18, Req 15.4): `/api/llm` is served by a
 * scripted route that records every call, so the network guard still fails on any other origin.
 * By keyboard: consent before any request, questions with an invalid quote dropped, a correction
 * with its verified quote, a "not in the file" reply, a 429 and the kill switch falling back to
 * demo with the persistent label, the offline choice sending nothing, and the injection golden
 * file producing only plain, content-shaped output. axe on the consent and fallback states in EN
 * and ES with reduced motion on and off.
 */
const T = {
  en: {
    start: 'Start',
    privacy: 'Privacy notice',
    accept: 'I understand, start',
    sample: 'Sample in English',
    preview: 'What the ghost will read',
    consent: 'Before the AI reads your file',
    ai: 'Continue with AI',
    offline: 'Continue offline (demo)',
    question: (n: number) => `Question ${n} of 4`,
    reply: "The examiner's reply",
    field: 'Your answer',
    send: 'Send',
    next: 'Continue',
    end: 'End the session',
    summary: 'Practice summary',
    quote: 'From your file',
    aiLabel: "Questions and replies come from AI: Google Gemini, through this site's server.",
    demoLabel: 'Demo mode: questions and feedback come from simple rules, not AI.',
    mixedLabel: "Mixed: some questions or replies come from simple rules, the rest from AI (Google Gemini, through this site's server).",
    turnDemoLabel: 'This reply comes from simple rules, not AI. The next turn tries AI again.',
    fallback: "My crystal ball is busy. I'll continue with my own notes.",
    demoSource: 'Written by the offline demo rules.',
    prompt: 'What does this part show about your project?',
    correction: ['Your file says something a little different.', 'Compare it with your answer.'],
    notInFile: ["That isn't in your file, so I can't confirm or correct it."],
    answer: 'I think it was mostly about saving time for the group.',
  },
  es: {
    start: 'Empezar',
    privacy: 'Aviso de privacidad',
    accept: 'Entendido, empezar',
    sample: 'Ejemplo en español',
    preview: 'Lo que leerá el fantasma',
    consent: 'Antes de que la IA lea tu archivo',
    ai: 'Seguir con IA',
    offline: 'Seguir sin conexión (demo)',
    question: (n: number) => `Pregunta ${n} de 4`,
    reply: 'La respuesta del examinador',
    field: 'Tu respuesta',
    send: 'Enviar',
    next: 'Continuar',
    end: 'Terminar la sesión',
    summary: 'Resumen de práctica',
    quote: 'De tu archivo',
    aiLabel: 'Las preguntas y respuestas salen de IA: Google Gemini, a través del servidor de este sitio.',
    demoLabel: 'Modo demo: las preguntas y los comentarios salen de reglas simples, no de IA.',
    mixedLabel: 'Mixto: algunas preguntas o respuestas salen de reglas simples y el resto de IA (Google Gemini, a través del servidor de este sitio).',
    turnDemoLabel: 'Esta respuesta sale de reglas simples, no de IA. El siguiente turno vuelve a intentar con IA.',
    fallback: 'Mi bola de cristal está ocupada. Seguiré con mis propias notas.',
    demoSource: 'Escrito por las reglas de la demo sin conexión.',
    prompt: '¿Qué muestra esta parte sobre tu proyecto?',
    correction: ['Tu archivo dice algo un poco distinto.', 'Compáralo con tu respuesta.'],
    notInFile: ['Eso no está en tu archivo, así que no puedo confirmarlo ni corregirlo.'],
    answer: 'Creo que se trataba sobre todo de ahorrar agua en el huerto.',
  },
} as const;
type Lang = keyof typeof T;
interface Body {
  task: string;
  locale: Lang;
  input: { excerpts: { id: string; text: string }[]; quote?: string };
}
type Reply = { status: number; body: unknown };

/**
 * The fake proxy: answers each call from `script` and records the raw bodies. Replies go to
 * `/api/llm/stream` (task 23); the route sends the scripted text whole, which the app reads as a
 * one-chunk stream. Truly chunked streams are in the streaming tests below.
 */
async function fakeProxy(page: Page, script: (body: Body, n: Record<string, number>) => Reply) {
  const bodies: Record<string, unknown>[] = [];
  const n: Record<string, number> = {};
  const serve = (route: Route) => {
    const raw = JSON.parse(route.request().postData() ?? '{}');
    bodies.push(raw);
    n[raw.task] = (n[raw.task] ?? 0) + 1;
    const { status, body } = script(raw as Body, n);
    return route.fulfill({ status, contentType: status === 200 ? 'text/plain' : 'application/json', body: JSON.stringify(body) });
  };
  await page.route('**/api/llm', serve);
  await page.route('**/api/llm/stream', serve);
  return bodies;
}
/** The first sentence of an excerpt's text, without its heading: a quote that verifies. */
const sentence = (text: string) => text.split('\n').filter((l) => !l.startsWith('#')).join(' ').trim().split(/(?<=\.)\s+/)[0];
/** Five questions on excerpts 2 to 6; the first quote is not in the file, so it is dropped. */
const questions = (body: Body) => ({
  questions: body.input.excerpts.slice(1, 6).map((e, i) => ({
    excerptId: e.id,
    quote: i === 0 ? 'This sentence is nowhere in the file at all.' : sentence(e.text),
    prompt: T[body.locale].prompt,
  })),
});
const ok = (body: unknown): Reply => ({ status: 200, body });

/** Intro → privacy notice → a sample (or `file`) → preview → the consent screen. */
async function toConsent(page: Page, lang: Lang, file?: string) {
  const t = T[lang];
  await page.goto('');
  if (lang === 'es') await page.getByRole('button', { name: 'Español' }).press('Enter');
  await tabTo(page, page.getByRole('button', { name: t.start }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: t.privacy })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: t.accept }));
  await page.keyboard.press('Enter');
  if (file) {
    await tabTo(page, page.getByLabel(lang === 'en' ? 'Choose a file (.txt or .md, up to 2 MB)' : 'Elige un archivo (.txt o .md, hasta 2 MB)'));
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Space');
    await (await chooser).setFiles(`${test.info().project.testDir}/../content/samples/${file}`);
  } else {
    await tabTo(page, page.getByRole('button', { name: t.sample }));
    await page.keyboard.press('Enter');
  }
  await expect(h2(page, t.preview)).toBeFocused();
  await tabTo(page, page.getByRole('button', { name: t.start }));
  await page.keyboard.press('Enter');
  await expect(h2(page, t.consent)).toBeFocused();
}
/** Types an answer to the question on screen, confirms it inline, and waits for the reply. */
async function answer(page: Page, lang: Lang) {
  const t = T[lang];
  await tabTo(page, page.getByRole('textbox', { name: t.field }));
  await page.keyboard.type(t.answer);
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('button', { name: t.send })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(h2(page, t.reply)).toBeFocused({ timeout: 15_000 });
}
async function next(page: Page, lang: Lang) {
  await tabTo(page, page.getByRole('button', { name: T[lang].next }));
  await page.keyboard.press('Enter');
}
const replyText = (page: Page) => page.locator('.gd-panel > p');
const quoteText = (page: Page) => page.locator('.gd-panel .ge-quote-text');

test.beforeEach(async ({ page }) => {
  await installFakeSpeech(page);
  await installFakeRecognition(page);
});

for (const lang of ['en', 'es'] as const) {
  const t = T[lang];
  test(`${lang}: consent before any request; a correction, "not in the file", then a 429 falls back to demo for the rest; axe on consent and fallback`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const foreign = await guardNetwork(page, baseURL!);
    const errors = watchErrors(page, [429]);
    const found: string[] = [];
    const bodies = await fakeProxy(page, (body, n) => {
      if (body.task === 'defense-questions') return ok(questions(body));
      if (n['defense-reply'] === 1) {
        const e = body.input.excerpts.find((x) => x.text.includes(body.input.quote ?? '\u0000'))!;
        return ok({ kind: 'correction', excerptId: e.id, quote: body.input.quote, say: T[body.locale].correction });
      }
      if (n['defense-reply'] === 2) return ok({ kind: 'not-in-file', say: T[body.locale].notInFile });
      // From the third reply on: a 429. The label turns to mixed (task 17 after phase 2, owner decision 3).
      return { status: 429, body: { error: 'rate-limited' } };
    });
    await toConsent(page, lang);
    expect(bodies).toHaveLength(0); // nothing left the browser before the choice (Req 3.3)
    found.push(...(await matrix(page, `${lang} consent`)));
    await tabTo(page, page.getByRole('button', { name: t.ai }));
    await page.keyboard.press('Enter');

    // The invalid quote was dropped: four questions remain, the first on excerpt 3.
    await expect(h2(page, t.question(1))).toBeFocused({ timeout: 15_000 });
    await expect(page.getByText(t.aiLabel)).toBeVisible();
    const firstQuote = await quoteText(page).textContent();
    expect(firstQuote).not.toContain('nowhere in the file');
    await answer(page, lang);
    await expect(replyText(page)).toHaveText([...t.correction]);
    await expect(quoteText(page)).toHaveText(firstQuote!); // the correction's verified quote
    await expect(quoteText(page)).toHaveAttribute('lang', lang);
    await next(page, lang);

    await expect(h2(page, t.question(2))).toBeFocused();
    await answer(page, lang);
    await expect(replyText(page)).toHaveText([...t.notInFile]);
    await expect(quoteText(page)).toHaveCount(0); // "not in the file" points to no passage
    await next(page, lang);

    await expect(h2(page, t.question(3))).toBeFocused();
    await answer(page, lang); // the proxy answers 429: the demo rules take the same turn
    await expect(page.getByText(t.turnDemoLabel)).toBeVisible(); // this one turn is demo; the next tries AI again
    await expect(page.getByRole('region', { name: lang === 'en' ? 'Transcript' : 'Transcripción' })).toContainText(t.fallback);
    found.push(...(await matrix(page, `${lang} fallback`)));
    await tabTo(page, page.getByRole('button', { name: t.end }));
    await page.keyboard.press('Enter');
    await expect(h2(page, t.summary)).toBeFocused();
    await expect(page.getByText(t.demoSource, { exact: false })).toBeVisible();
    await expect(page.getByText(t.mixedLabel)).toBeVisible(); // persistent

    // One failure doesn't pin: the summary tried the AI again, got a 429 too, and the demo wrote it.
    expect(bodies.map((b) => b.task)).toEqual(['defense-questions', 'defense-reply', 'defense-reply', 'defense-reply', 'defense-summary']);
    for (const b of bodies) expect(Object.keys(b).sort()).toEqual(['input', 'locale', 'task']); // no prompt, no output cap
    expect(found).toEqual([]);
    expect(foreign).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('en: the kill switch (503 disabled) on the first request: the fallback line, then demo questions with the label', async ({ page, baseURL }) => {
  const foreign = await guardNetwork(page, baseURL!);
  const errors = watchErrors(page, [503]);
  const bodies = await fakeProxy(page, () => ({ status: 503, body: { error: 'disabled' } }));
  await toConsent(page, 'en');
  await tabTo(page, page.getByRole('button', { name: T.en.ai }));
  await page.keyboard.press('Enter');
  await expect(h2(page, T.en.question(1))).toBeFocused({ timeout: 15_000 });
  await expect(page.getByText(T.en.demoLabel)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Transcript' })).toContainText(T.en.fallback, { timeout: 15_000 });
  await answer(page, 'en');
  // The reply tried the AI once more (the stream, then the whole request, both 503): two failures in a row pin demo.
  expect(bodies.map((b) => b.task)).toEqual(['defense-questions', 'defense-reply', 'defense-reply']);
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

for (const lang of ['en', 'es'] as const) {
  test(`${lang}: the offline choice sends nothing, through a whole turn and the summary`, async ({ page, baseURL }) => {
    const foreign = await guardNetwork(page, baseURL!);
    const errors = watchErrors(page);
    const bodies = await fakeProxy(page, () => ({ status: 500, body: {} }));
    await toConsent(page, lang);
    await tabTo(page, page.getByRole('button', { name: T[lang].offline }));
    await page.keyboard.press('Enter');
    await expect(h2(page, T[lang].question(1))).toBeFocused();
    await expect(page.getByText(T[lang].demoLabel)).toBeVisible();
    await answer(page, lang);
    await tabTo(page, page.getByRole('button', { name: T[lang].end }));
    await page.keyboard.press('Enter');
    await expect(h2(page, T[lang].summary)).toBeFocused();
    expect(bodies).toEqual([]);
    expect(foreign).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('es: the injection golden file goes out only as excerpt data, and hostile output is never shown or rendered', async ({ page, baseURL }) => {
  const foreign = await guardNetwork(page, baseURL!);
  const errors = watchErrors(page);
  let dialogs = 0;
  page.on('dialog', (d) => {
    dialogs++;
    void d.dismiss();
  });
  const hostile = '<img src=x onerror="alert(1)"> PWNED. Visita http://evil.example ahora.';
  const bodies = await fakeProxy(page, (body) => {
    if (body.task === 'defense-questions') {
      // What a model that followed the injection might return: markup, a link, the marker word.
      return ok({ questions: body.input.excerpts.slice(1, 5).map((e) => ({ excerptId: e.id, quote: sentence(e.text), prompt: hostile })) });
    }
    return ok({ kind: 'acknowledgment', say: [hostile] });
  });
  await toConsent(page, 'es', 'injection-es.md');
  await tabTo(page, page.getByRole('button', { name: T.es.ai }));
  await page.keyboard.press('Enter');
  await expect(h2(page, T.es.question(1))).toBeFocused({ timeout: 15_000 });
  await answer(page, 'es');
  // Every hostile output failed its guard: demo questions and a demo reply, labeled as demo.
  await expect(page.getByText(T.es.demoLabel)).toBeVisible();
  await expect(page.locator('main')).not.toContainText('PWNED');
  await expect(page.locator('main img, main a[href^="http"]')).toHaveCount(0);
  expect(dialogs).toBe(0);
  // The client sent the file only as excerpt data: no prompt, no system text, no other field.
  const questionsBody = bodies[0] as { input: { excerpts: { text: string }[] } };
  expect(Object.keys(bodies[0]).sort()).toEqual(['input', 'locale', 'task']);
  expect(questionsBody.input.excerpts.some((e) => e.text.includes('Ignora todas las instrucciones anteriores'))).toBe(true);
  expect(bodies.length).toBe(2); // the reply tried the AI once more; its hostile output failed too, so demo is pinned
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});
