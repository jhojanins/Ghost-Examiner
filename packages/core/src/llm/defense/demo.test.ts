import { describe, expect, it } from 'vitest';
import { splitExcerpts } from '../../document/excerpts';
import type { Locale } from '../../i18n/i18n';
import { kitMessages } from '../../i18n/kit-messages';
import { createDemoProvider } from '../demo-provider';
import type { LLMRequest } from '../types';
import { parseDefenseQuestions, parseDefenseReply, parseDefenseSummary } from './guards';

// Fictional fixtures (test data only).
const EN = `# Project: a queue for slow payments

Our student shop took ten seconds to confirm each order. The payment service answered slowly at busy hours.

## Design

We chose a message queue because the payment service could not keep up with the evening peak. The checkout page now answers at once and confirms the payment later by email.

## Results

We measured the checkout time for two weeks with forty volunteers. The page answered in under one second for 95 percent of orders.

## Conclusion

Therefore a queue was enough for our size, and a second server was not needed.`;
const ES = `# Proyecto: una cola para pagos lentos

La tienda del club tardaba diez segundos en confirmar cada pedido. El servicio de pagos respondía lento en las horas de más uso.

## Diseño

Elegimos una cola de mensajes porque el servicio de pagos no aguantaba la hora punta de la tarde. La página de pago ahora responde al instante y confirma el pago después por correo.

## Resultados

Medimos el tiempo de pago durante dos semanas con cuarenta voluntarios. La página respondió en menos de un segundo en el 95 por ciento de los pedidos.

## Conclusión

Por lo tanto, una cola bastaba para nuestro tamaño, y no hizo falta un segundo servidor.`;
const docs: Record<Locale, string> = { en: EN, es: ES };
const demo = createDemoProvider();
const excerptsOf = (locale: Locale) => splitExcerpts(docs[locale], { maxChars: 1500 });
const asInput = (locale: Locale) => excerptsOf(locale).map(({ id, text }) => ({ id, text }));
async function complete(req: LLMRequest): Promise<unknown> {
  const r = await demo.complete(req);
  if (!r.ok) throw new Error(r.error);
  return JSON.parse(r.text);
}
const questionsReq = (locale: Locale, count = 4): LLMRequest => ({
  task: 'defense-questions',
  locale,
  maxOutputTokens: 800,
  input: { excerpts: asInput(locale), count, fileLang: locale },
});

describe('demo provider: defense-questions', () => {
  for (const locale of ['en', 'es'] as const) {
    it(`gives ${locale} questions that all pass the guard, each with a verified quote, the same every time`, async () => {
      const raw = (await complete(questionsReq(locale))) as { questions: unknown[] };
      const parsed = parseDefenseQuestions(raw, { excerpts: excerptsOf(locale), locale, count: 4 });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value).toHaveLength(4);
      expect(parsed.value).toHaveLength(raw.questions.length); // nothing dropped: every quote is verified
      expect(new Set(parsed.value.map((q) => q.excerptId)).size).toBe(4); // spread over the file
      expect(await complete(questionsReq(locale))).toEqual(raw);
    });
  }

  it('asks why for a "because" sentence and about the measurement for a result', async () => {
    const raw = (await complete(questionsReq('en', 4))) as { questions: { quote: string; prompt: string }[] };
    const byQuote = (s: string) => raw.questions.find((q) => q.quote.includes(s))?.prompt;
    expect(byQuote('We chose a message queue')).toBe(kitMessages.en['defense.demo.q.alternative']);
    expect(byQuote('We measured')).toBe(kitMessages.en['defense.demo.q.measure']);
    expect(byQuote('Therefore')).toBe(kitMessages.en['defense.demo.q.conclusion']);
  });

  it('gives fewer questions for a short file instead of repeating parts', async () => {
    const short = splitExcerpts('We chose a queue because the payments were slow at night.', { maxChars: 1500 });
    const req: LLMRequest = { task: 'defense-questions', locale: 'en', maxOutputTokens: 800, input: { excerpts: short.map(({ id, text }) => ({ id, text })), count: 4, fileLang: 'en' } };
    const raw = (await complete(req)) as {
      questions: unknown[];
    };
    expect(raw.questions).toHaveLength(1);
  });
});

describe('demo provider: defense-reply', () => {
  const design = excerptsOf('en').find((e) => e.heading === 'Design')!;
  const quote = 'We chose a message queue because the payment service could not keep up';
  const reply = (answer: string, followUpAllowed = true): LLMRequest => ({
    task: 'defense-reply',
    locale: 'en',
    maxOutputTokens: 400,
    input: { excerpts: asInput('en'), question: 'Why did you make this choice?', quote, answer, followUpAllowed },
  });
  const check = async (answer: string, followUpAllowed = true) => {
    const parsed = parseDefenseReply(await complete(reply(answer, followUpAllowed)), { excerpts: excerptsOf('en'), locale: 'en', followUpAllowed });
    expect(parsed.ok).toBe(true);
    return parsed.ok ? parsed.value : undefined;
  };

  it('acknowledges an answer that uses the key terms of its passage, quoting it', async () => {
    const r = await check('The payment service was too slow at the evening peak, so a message queue lets checkout answer at once.');
    expect(r).toMatchObject({ kind: 'acknowledgment', excerptId: design.id });
    expect(r?.quote).toBeDefined();
  });

  it('asks a follow-up for a vague answer when one is allowed, and otherwise shows what the file says', async () => {
    expect((await check('It seemed like a good idea.'))?.kind).toBe('follow-up');
    expect(await check('It seemed like a good idea.', false)).toMatchObject({ kind: 'correction', excerptId: design.id, quote });
  });
});

describe('demo provider: defense-summary', () => {
  it('names a strength and up to 3 points to review for the weaker turns, all verified', async () => {
    const turns = [
      { question: 'Why did you make this choice?', answer: 'The payment service was slow at the evening peak.', kind: 'acknowledgment' as const },
      { question: 'How did you get this result?', answer: 'Not sure.', kind: 'correction' as const },
      { question: 'How does this conclusion follow?', answer: 'It just does.', kind: 'follow-up' as const },
    ];
    const raw = await complete({ task: 'defense-summary', locale: 'en', maxOutputTokens: 500, input: { turns, excerpts: asInput('en') } });
    const parsed = parseDefenseSummary(raw, { excerpts: excerptsOf('en'), locale: 'en' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.strength).toBe(kitMessages.en['defense.demo.strength.ack']);
    expect(parsed.value.review).toHaveLength(2);
  });
});

describe('defense copy follows the ghost persona', () => {
  const VERDICT = /\b(fail|failed|wrong|incorrect|grade|score|reject|suspend|reprob|incorrect[oa]|nota|calificaci)/i;
  for (const locale of ['en', 'es'] as const) {
    it(`${locale}: no verdict words; demo questions ask one thing in at most 25 words`, () => {
      const entries = Object.entries(kitMessages[locale]).filter(([k]) => k.startsWith('defense.'));
      expect(entries.length).toBeGreaterThan(20);
      // These two name "grade" only to say this isn't one (Req 8.2, 3.1).
      const notAGrade = ['defense.summary.label', 'defense.consent.practice'];
      for (const [key, text] of entries.filter(([k]) => !notAGrade.includes(k))) expect(text, key).not.toMatch(VERDICT);
      for (const [key, text] of entries.filter(([k]) => k.startsWith('defense.demo.q.'))) {
        expect(text.match(/\?/g), key).toHaveLength(1);
        expect(text.split(/\s+/).length, key).toBeLessThanOrEqual(25);
      }
    });
  }
});
