import { defineCatalog } from '@ghost-examiner/core';
/** App strings (ghost-defense-live design §7), written with the ghost-persona skill. Spanish uses "tú". */
export const messages = defineCatalog(
  {
    title: 'Ghost Defense',
    'intro.heading': 'Defend your own work',
    'intro.text':
      'Choose a text file about your thesis or project. The examiner reads it and asks you a few questions about it, so you can check that you really understand it. There is no time limit.',
    'intro.voice': 'Voice conversation',
    'intro.type': 'Type',
    'mic.off': 'Mic off',
    'mic.on': 'Mic on',
    'status.sending': 'Sending your answer…',
    'ghost.greeting': "Good evening. I'll ask you about your file, one question at a time.",
    'ghost.closing': "That's all for tonight. My clipboard is full.",
    'preparing.heading': 'Reading your file',
    'question.heading': 'Question {n} of {total}',
    'question.followUp': 'Follow-up question',
    'reply.heading': "The examiner's reply",
  },
  {
    title: 'Defensa fantasma',
    'intro.heading': 'Defiende tu propio trabajo',
    'intro.text':
      'Elige un archivo de texto sobre tu tesis o proyecto. El examinador lo lee y te hace algunas preguntas sobre él, para que compruebes que de verdad lo entiendes. No hay límite de tiempo.',
    'intro.voice': 'Conversación por voz',
    'intro.type': 'Escribir',
    'mic.off': 'Apagar micrófono',
    'mic.on': 'Encender micrófono',
    'status.sending': 'Enviando tu respuesta…',
    'ghost.greeting': 'Buenas noches. Te haré preguntas sobre tu archivo, una a la vez.',
    'ghost.closing': 'Eso es todo por esta noche. Mi portapapeles está lleno.',
    'preparing.heading': 'Leyendo tu archivo',
    'question.heading': 'Pregunta {n} de {total}',
    'question.followUp': 'Pregunta de seguimiento',
    'reply.heading': 'La respuesta del examinador',
  },
);
