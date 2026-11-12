import type { QuestionPack } from '@ghost-examiner/core';

/**
 * The Day 5 slice pack (design §6): one fictional interview question with three key points.
 * Greeting and closing come from the ghost-persona phrase bank.
 *
 * Cues are lowercase keywords for the demo evaluator; it strips accents on both sides, so the
 * Spanish cues are written without them. Labels read naturally after "You covered" / "Add" and
 * "Explicaste" / "Agrega" (no preposition before them, see kit-messages.ts).
 */
export const pack: QuestionPack = {
  id: 'ghost-interview-slice',
  greeting: {
    en: "Good evening. I'm your examiner tonight. Please, have a seat.",
    es: 'Buenas noches. Esta noche seré tu examinador. Toma asiento, por favor.',
  },
  closing: {
    en: "That's all for tonight. My clipboard is full.",
    es: 'Eso es todo por esta noche. Mi portapapeles está lleno.',
  },
  questions: [
    {
      id: 'difficult-problem',
      kind: 'free-text',
      prompt: {
        en: 'Tell me about a time you solved a difficult problem.',
        es: 'Cuéntame de una vez en que resolviste un problema difícil.',
      },
      keyPoints: [
        {
          label: { en: 'the situation', es: 'la situación' },
          cues: {
            en: ['situation', 'context', 'the problem was', 'challenge', 'deadline'],
            es: ['situacion', 'contexto', 'el problema era', 'reto', 'desafio', 'plazo'],
          },
        },
        {
          label: { en: 'the action you took', es: 'la acción que tomaste' },
          cues: {
            en: ['i decided', 'i built', 'i wrote', 'i fixed', 'i changed', 'i organized', 'i asked', 'i suggested'],
            es: ['decidi', 'construi', 'escribi', 'arregle', 'cambie', 'organice', 'pregunte', 'propuse'],
          },
        },
        {
          label: { en: 'the result', es: 'el resultado' },
          cues: {
            en: ['result', 'saved', 'improved', 'reduced', 'increased', 'in the end', 'percent'],
            es: ['resultado', 'ahorramos', 'ahorre', 'mejoro', 'mejore', 'redujimos', 'aumento', 'al final', 'por ciento'],
          },
        },
      ],
    },
  ],
};
