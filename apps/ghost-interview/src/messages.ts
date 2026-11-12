import { defineCatalog } from '@ghost-examiner/core';

/** App strings (design §6), written with the ghost-persona skill. Spanish uses "tú". */
export const messages = defineCatalog(
  {
    title: 'Ghost Interview',
    'intro.heading': 'A short practice interview',
    'intro.text':
      'The examiner asks one question. You type your answer, check how it was understood, and get practice feedback. There is no time limit.',
    'intro.start': 'Start',
    'summary.heading': 'End of the practice',
    'summary.again': 'Practice again',
  },
  {
    title: 'Entrevista fantasma',
    'intro.heading': 'Una entrevista corta de práctica',
    'intro.text':
      'El examinador te hace una pregunta. Escribes tu respuesta, revisas cómo se entendió y recibes comentarios de práctica. No hay límite de tiempo.',
    'intro.start': 'Empezar',
    'summary.heading': 'Fin de la práctica',
    'summary.again': 'Practicar otra vez',
  },
);
