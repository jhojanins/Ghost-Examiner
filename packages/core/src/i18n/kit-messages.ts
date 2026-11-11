import { defineCatalog } from './i18n';

/**
 * Kit strings shared by both apps (design §3.1), written with the `ghost-persona` skill.
 * Spanish uses informal "tú" (Req 9.4).
 *
 * `{point}` is a key point label from the question pack ("the situation", "la situación").
 * In Spanish it follows a verb directly, with no preposition, so a label starting with "el"
 * never needs the "del" / "al" contraction.
 */
export const kitMessages = defineCatalog(
  {
    // App shell (design §5.1): the same header on every screen.
    'shell.skipLink': 'Skip to main content',
    'shell.privacy': 'Privacy notice',
    'shell.preview.badge': 'Preview',
    'shell.preview.detail': 'Keyboard only for now. Voice and Morse are coming.',

    // Demo feedback (design §3.7). No jokes here: humor never comes right after a weak answer.
    'feedback.summary.approving': 'Thank you. That answer was clear and on topic.',
    'feedback.summary.skeptical': "Thank you. There's a good start here, and room to build on it.",
    'feedback.strength.covered': 'You covered {point}.',
    // Used when no key point matched: it claims nothing the keyword check can't verify.
    'feedback.strength.direct': 'You took the time to answer.',
    'feedback.improvement.add': 'Add {point}.',
    'feedback.improvement.measurable': 'Add one result you can measure.',
    'feedback.improvement.more': 'Say a bit more: one example helps.',
  },
  {
    'shell.skipLink': 'Saltar al contenido principal',
    'shell.privacy': 'Aviso de privacidad',
    'shell.preview.badge': 'Vista previa',
    'shell.preview.detail': 'Por ahora, solo teclado. Pronto llegan la voz y el Morse.',

    'feedback.summary.approving': 'Gracias. Esa respuesta fue clara y se centró en el tema.',
    'feedback.summary.skeptical': 'Gracias. Es un buen comienzo, y todavía puedes desarrollarlo más.',
    'feedback.strength.covered': 'Explicaste {point}.',
    'feedback.strength.direct': 'Te tomaste el tiempo de responder.',
    'feedback.improvement.add': 'Agrega {point}.',
    'feedback.improvement.measurable': 'Agrega un resultado que se pueda medir.',
    'feedback.improvement.more': 'Cuéntame un poco más: un ejemplo ayuda.',
  },
);
