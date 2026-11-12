import { createDemoProvider, createKeyboardAdapter, createLlmEvaluator, validatePack, type ConfirmedAnswer } from '@ghost-examiner/core';
import { describe, expect, it } from 'vitest';
import { config } from '../config';
import { pack } from './pack';

const evaluate = (text: string, locale: 'en' | 'es') =>
  createLlmEvaluator(createDemoProvider()).evaluate(
    pack.questions[0],
    { text, method: 'keyboard', candidateId: 1 } as ConfirmedAnswer, // the brand is type-level only
    locale,
  );

describe('ghost-interview pack', () => {
  it('is valid for this Preview build: one question, keyboard only, a warning and no error', () => {
    expect(config.preview).toBe(true);
    expect(pack.questions).toHaveLength(1);
    expect(pack.questions[0].keyPoints).toHaveLength(3);
    const issues = validatePack(pack, [createKeyboardAdapter()], { preview: config.preview });
    expect(issues.map((i) => i.severity)).toEqual(['warning']);
  });

  it.each([
    ['en', 'The situation was a report that took two days, so I decided to rewrite it, and the result was two minutes.'],
    ['es', 'La situación era un informe que tardaba dos días, así que decidí reescribirlo, y el resultado fue dos minutos.'],
  ] as const)('a full answer meets all three key points (%s)', async (locale, answer) => {
    const feedback = await evaluate(answer, locale);
    expect(feedback.reaction).toBe('approving');
    expect(feedback.improvement).toBe(locale === 'en' ? 'Add one result you can measure.' : 'Agrega un resultado que se pueda medir.');
  });

  it('labels read naturally in the feedback sentences', async () => {
    const en = await evaluate('The situation was a slow report and I did not know where to start at all.', 'en');
    expect([en.strength, en.improvement]).toEqual(['You covered the situation.', 'Add the action you took.']);
    const es = await evaluate('La situación era un informe lento y no sabía por dónde empezar para nada.', 'es');
    expect([es.strength, es.improvement]).toEqual(['Explicaste la situación.', 'Agrega la acción que tomaste.']);
  });

  it('has text in both languages for every line, with no empty cue', () => {
    for (const text of [pack.greeting, pack.closing, pack.questions[0].prompt]) {
      expect(text.en.trim()).not.toBe('');
      expect(text.es.trim()).not.toBe('');
    }
    for (const point of pack.questions[0].keyPoints) {
      for (const cue of [...point.cues.en, ...point.cues.es]) {
        expect(cue).toBe(cue.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim());
        expect(cue).not.toBe('');
      }
    }
  });
});
