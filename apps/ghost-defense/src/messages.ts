import { defineCatalog } from '@ghost-examiner/core';

/**
 * App strings (design §6). This app is a shell: the copy says plainly that nothing works here
 * yet and never describes the document defense as available.
 */
export const messages = defineCatalog(
  {
    title: 'Ghost Defense',
    previewNote: 'Work in progress: there is nothing to answer here yet.',
    'wip.heading': 'Still in development',
    'wip.text': 'The document defense is not ready yet. Try Ghost Interview meanwhile.',
    'wip.link': 'Go to Ghost Interview',
  },
  {
    title: 'Defensa fantasma',
    previewNote: 'En desarrollo: aquí todavía no hay nada que responder.',
    'wip.heading': 'Todavía en desarrollo',
    'wip.text': 'La defensa de documentos todavía no está lista. Mientras tanto, prueba la Entrevista fantasma.',
    'wip.link': 'Ir a la Entrevista fantasma',
  },
);
