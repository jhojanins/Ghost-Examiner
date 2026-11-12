import { describe, expect, it } from 'vitest';
import type { Feedback, Question } from '../engine/types';
import { reduce, initialState } from '../engine/reduce';
import type { Locale } from '../i18n/i18n';
import { createDemoProvider } from './demo-provider';
import { createLlmEvaluator } from './evaluator';

// Fictional question, test data only.
const question: Question = {
  id: 'q1',
  kind: 'free-text',
  prompt: { en: 'Tell me about a time you solved a difficult problem.', es: 'Cuéntame de una vez en que resolviste un problema difícil.' },
  keyPoints: [
    { label: { en: 'the situation', es: 'la situación' }, cues: { en: ['situation', 'context'], es: ['situación', 'contexto'] } },
    { label: { en: 'the action', es: 'la acción' }, cues: { en: ['i decided', 'i built'], es: ['decidí', 'construí'] } },
    { label: { en: 'the result', es: 'el resultado' }, cues: { en: ['result', 'saved'], es: ['resultado', 'ahorramos'] } },
  ],
};

/** Runs the real confirm transition, so the evaluator gets a genuine ConfirmedAnswer. */
function confirmed(text: string) {
  const pack = { id: 'p', greeting: { en: '', es: '' }, closing: { en: '', es: '' }, questions: [question] };
  let state = initialState(pack, 'en');
  for (const event of [{ type: 'start' }, { type: 'privacy-accepted' }, { type: 'candidate', candidate: { text, method: 'keyboard' } }] as const) {
    state = reduce(state, event).state;
  }
  const { effects } = reduce(state, { type: 'confirm', candidateId: state.candidate!.candidateId });
  const effect = effects[0];
  if (effect?.type !== 'evaluate') throw new Error('expected an evaluate effect');
  return effect.answer;
}

const evaluate = (text: string, locale: Locale): Promise<Feedback> =>
  createLlmEvaluator(createDemoProvider()).evaluate(question, confirmed(text), locale);

// 2 of 3 key points (situation and result), 16 words.
const twoOfThree = 'The situation was a slow report, and the result was that we saved two hours.';

describe('demo evaluation', () => {
  it('2 of 3 key points: approving, strength from the first match, improvement from the first miss', async () => {
    expect(await evaluate(twoOfThree, 'en')).toEqual({
      summary: 'Thank you. That answer was clear and on topic.',
      strength: 'You covered the situation.',
      improvement: 'Add the action.',
      reaction: 'approving',
      locale: 'en',
    });
  });

  it('a 5-word answer gets "say a bit more", even when it matches', async () => {
    const feedback = await evaluate('The result saved two hours.', 'en');
    expect(feedback.improvement).toBe('Say a bit more: one example helps.');
    expect(feedback.strength).toBe('You covered the result.');
  });

  it('the same input in es returns Spanish text, with the same judgement (found in the task 27 walk-through)', async () => {
    // Cues from both languages count, so switching the UI language never changes the result,
    // only the language of the text.
    expect(await evaluate(twoOfThree, 'es')).toEqual({
      summary: 'Gracias. Esa respuesta fue clara y se centró en el tema.',
      strength: 'Explicaste la situación.',
      improvement: 'Agrega la acción.',
      reaction: 'approving',
      locale: 'es',
    });
    // A Spanish answer covering 2 of 3, matched without accents ("situacion").
    expect(await evaluate('La situacion era un informe lento y el resultado fue que ahorramos dos horas.', 'es')).toEqual({
      summary: 'Gracias. Esa respuesta fue clara y se centró en el tema.',
      strength: 'Explicaste la situación.',
      improvement: 'Agrega la acción.',
      reaction: 'approving',
      locale: 'es',
    });
  });

  it('all key points covered: asks for a measurable result', async () => {
    const all = await evaluate('The situation was tense, so I decided to rewrite it, and the result was faster.', 'en');
    expect(all).toMatchObject({ reaction: 'approving', strength: 'You covered the situation.', improvement: 'Add one result you can measure.' });
  });

  it('no key points covered: skeptical, with a strength that claims nothing unchecked, and the first point to add', async () => {
    expect(await evaluate('I usually work hard and try my best on every single task.', 'en')).toEqual({
      summary: "Thank you. There's a good start here, and room to build on it.",
      strength: 'You took the time to answer.',
      improvement: 'Add the situation.',
      reaction: 'skeptical',
      locale: 'en',
    });
  });

  it('matches cues case- and accent-insensitively, ignoring extra spaces', async () => {
    const feedback = await evaluate('  THE   SITUATION was odd, and I  DECIDED   to act fast that   day.', 'en');
    expect(feedback).toMatchObject({ reaction: 'approving', strength: 'You covered the situation.', improvement: 'Add the result.' });
  });

  it('exactly half the key points is enough for approving; a blank cue never matches', async () => {
    const twoPoints: Question = {
      ...question,
      keyPoints: [question.keyPoints[0], { ...question.keyPoints[2], cues: { en: ['', '  '], es: [''] } }],
    };
    const feedback = await createLlmEvaluator(createDemoProvider()).evaluate(
      twoPoints,
      confirmed('The situation was a slow report that nobody wanted to touch.'),
      'en',
    );
    expect(feedback).toMatchObject({ reaction: 'approving', improvement: 'Add the result.' });
  });

  it('is a demo provider with no I/O', () => {
    expect(createDemoProvider()).toMatchObject({ id: 'demo', isDemo: true });
  });
});
