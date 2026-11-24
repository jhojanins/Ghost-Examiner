import { expect, test, type Page } from '@playwright/test';
import { installFakeLlmStream } from '@ghost-examiner/web/testing/llm-stream';
import { installFakeRecognition } from '@ghost-examiner/web/testing/speech-recognition';
import { installFakeSpeech } from '@ghost-examiner/web/testing/speech-synthesis';
import { guardNetwork, h2, matrix, tabTo, watchErrors } from './helpers';

/**
 * Streamed replies (ghost-defense-live task 23, Req 5): the reply arrives in chunks through a fake
 * `/api/llm/stream` in the page, questions come whole from a route. By keyboard: nothing shows
 * until the head is checked with the first sentence; then the quote, and each sentence as it
 * arrives, in captions and the transcript; Continue waits for the end. No first sentence within
 * 8 s (page clock) falls back to demo with the fallback line. axe on the streaming reply.
 */
const T = {
  en: {
    start: 'Start',
    accept: 'I understand, start',
    sample: 'Sample in English',
    ai: 'Continue with AI',
    field: 'Your answer',
    send: 'Send',
    reply: "The examiner's reply",
    next: 'Continue',
    question: 'Question 1 of 4',
    quote: 'From your file',
    transcript: 'Transcript',
    prompt: 'What does this part show about your project?',
    say: ['Your file says something a little different.', 'Compare it with your answer.'],
    mixed: 'This reply comes from simple rules, not AI.',
    fallback: "My crystal ball is busy. I'll continue with my own notes.",
  },
  es: {
    start: 'Empezar',
    accept: 'Entendido, empezar',
    sample: 'Ejemplo en español',
    ai: 'Seguir con IA',
    field: 'Tu respuesta',
    send: 'Enviar',
    reply: 'La respuesta del examinador',
    next: 'Continuar',
    question: 'Pregunta 1 de 4',
    quote: 'De tu archivo',
    transcript: 'Transcripción',
    prompt: '¿Qué muestra esta parte sobre tu proyecto?',
    say: ['Tu archivo dice algo un poco distinto.', 'Compáralo con tu respuesta.'],
    mixed: 'Esta respuesta sale de reglas simples, no de IA.',
    fallback: 'Mi bola de cristal está ocupada. Seguiré con mis propias notas.',
  },
} as const;
type Lang = keyof typeof T;
const sentence = (text: string) => text.split('\n').filter((l) => !l.startsWith('#')).join(' ').trim().split(/(?<=\.)\s+/)[0];

/** Questions come whole from the route; the stream path never reaches the network. */
async function serveQuestions(page: Page) {
  await page.route('**/api/llm', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { locale: Lang; input: { excerpts: { id: string; text: string }[] } };
    const questions = body.input.excerpts.slice(1, 5).map((e) => ({ excerptId: e.id, quote: sentence(e.text), prompt: T[body.locale].prompt }));
    return route.fulfill({ status: 200, contentType: 'text/plain', body: JSON.stringify({ questions }) });
  });
}
const stream = {
  bodies: (page: Page) => page.evaluate(() => window.__llmStream!.bodies as { input: { quote: string; excerpts: { id: string; text: string }[] } }[]),
  open: (page: Page) => page.evaluate(() => window.__llmStream!.open()),
  push: (page: Page, text: string) => page.evaluate((t) => window.__llmStream!.push(t), text),
  close: (page: Page) => page.evaluate(() => window.__llmStream!.close()),
  aborted: (page: Page) => page.evaluate(() => window.__llmStream!.aborted),
};
/** Intro → privacy → sample → preview → consent → AI → the first question → a typed, confirmed answer. */
async function toReply(page: Page, lang: Lang) {
  const t = T[lang];
  await page.goto('');
  if (lang === 'es') await page.getByRole('button', { name: 'Español' }).press('Enter');
  await tabTo(page, page.getByRole('button', { name: t.start }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: t.accept }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: t.sample }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: t.start }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: t.ai }));
  await page.keyboard.press('Enter');
  await expect(h2(page, t.question)).toBeFocused({ timeout: 15_000 });
  await tabTo(page, page.getByRole('textbox', { name: t.field }));
  await page.keyboard.type('I think it was mostly about saving time for the group.');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('button', { name: t.send })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await stream.bodies(page)).length).toBe(1);
}

test.beforeEach(async ({ page }, info) => {
  // One test drives the ghost's voice by hand; the rest let lines end on their own.
  await installFakeSpeech(page, { manual: info.title.includes('when it is spoken') });
  await installFakeRecognition(page);
  await installFakeLlmStream(page);
});

for (const lang of ['en', 'es'] as const) {
  const t = T[lang];
  test(`${lang}: a streamed reply shows its quote only with the first checked sentence, then each sentence as it arrives; axe while streaming`, async ({
    page,
    baseURL,
  }) => {
    const foreign = await guardNetwork(page, baseURL!);
    const errors = watchErrors(page);
    await serveQuestions(page);
    await toReply(page, lang);
    const [body] = await stream.bodies(page);
    const excerptId = body.input.excerpts.find((e) => e.text.includes(body.input.quote))!.id;
    await stream.open(page);
    await stream.push(page, `{"kind":"correction","excerptId":"${excerptId}","quote":${JSON.stringify(body.input.quote)},"say":[`);
    await page.waitForTimeout(300);
    await expect(h2(page, t.reply)).toHaveCount(0); // the head alone shows nothing
    await stream.push(page, `${JSON.stringify(t.say[0])},`);
    await expect(h2(page, t.reply)).toBeFocused();
    await expect(page.getByRole('figure', { name: t.quote }).locator('blockquote')).toHaveText(body.input.quote);
    await expect(page.locator('.gd-panel > p')).toHaveText([t.say[0]]);
    await expect(page.getByRole('button', { name: t.next })).toHaveCount(0); // Continue waits for the end
    const found = await matrix(page, `${lang} streaming reply`);
    await stream.push(page, JSON.stringify(t.say[1]));
    await expect(page.locator('.gd-panel > p')).toHaveText([...t.say]);
    await stream.push(page, ']}');
    await stream.close(page);
    await expect(page.getByRole('button', { name: t.next })).toBeVisible();
    // Each sentence was its own line: in the transcript once each, after the speech fake ended them.
    const transcript = page.getByRole('region', { name: t.transcript }).getByRole('listitem');
    await expect(transcript.filter({ hasText: t.say[0] })).toHaveCount(1);
    await expect(transcript.filter({ hasText: t.say[1] })).toHaveCount(1);
    expect(found).toEqual([]);
    expect(foreign).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('en: no first sentence within 8 s (page clock): the fallback line, the demo reply labeled as one demo turn; the stream is stopped', async ({ page, baseURL }) => {
  await page.clock.install();
  const foreign = await guardNetwork(page, baseURL!);
  const errors = watchErrors(page);
  await serveQuestions(page);
  await toReply(page, 'en');
  await stream.open(page);
  await stream.push(page, '{"kind":"acknowledgment","say":['); // bytes arrive (the provider's first-byte timer is met), but no sentence
  // The installed clock keeps running during setup, so leave a margin below 8 s.
  await page.clock.fastForward(6_500);
  await expect(h2(page, T.en.reply)).toHaveCount(0);
  await page.clock.fastForward(1_600);
  await expect(h2(page, T.en.reply)).toBeFocused();
  await expect(page.getByText(T.en.mixed)).toBeVisible();
  await expect.poll(() => stream.aborted(page)).toBe(1);
  // The speech fake runs on the page clock too: let the lines play out.
  await expect(async () => {
    await page.clock.fastForward(5_000);
    await expect(page.getByRole('region', { name: 'Transcript' })).toContainText(T.en.fallback, { timeout: 200 });
  }).toPass({ timeout: 10_000 });
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

test('en: with the voice on, each streamed sentence shows when it is spoken, not when it arrives', async ({ page, baseURL }) => {
  const foreign = await guardNetwork(page, baseURL!);
  const errors = watchErrors(page);
  await serveQuestions(page);
  const end = () => page.evaluate(() => window.__fakeSpeech!.control.end());
  // Manual voice: end the greeting and the question as they play.
  const answered = toReply(page, 'en');
  await expect(async () => {
    await end();
    expect(await stream.bodies(page).catch(() => [])).toHaveLength(1);
  }).toPass({ timeout: 15_000 });
  await answered;
  await stream.open(page);
  await stream.push(page, '{"kind":"acknowledgment","say":["First sentence here.","Second sentence here."');
  const panel = page.locator('.gd-panel > p');
  await expect(panel).toHaveText(['First sentence here.']); // the second has arrived, but waits
  await page.waitForTimeout(300);
  await expect(panel).toHaveText(['First sentence here.']);
  await end();
  await expect(panel).toHaveText(['First sentence here.', 'Second sentence here.']);
  await expect(page.locator('.ge-captions')).toHaveText('Second sentence here.');
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});
