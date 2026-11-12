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
    // Short, so the Preview line fits next to its badge at 320 px (task 19b). "For now" says more is coming.
    'shell.preview.detail': 'Keyboard only for now.',
    // Language switch: each language is named in itself, so both catalogs share these two.
    'language.label': 'Language',
    'language.en': 'English',
    'language.es': 'Español',

    // Ghost accessible name per expression (Req 3.5). Describes the expression, never the user.
    'ghost.label.neutral': 'The ghost examiner, looking calm.',
    'ghost.label.thinking': 'The ghost examiner, thinking.',
    'ghost.label.approving': 'The ghost examiner, looking satisfied.',
    'ghost.label.skeptical': 'The ghost examiner, looking skeptical.',
    'transcript.heading': 'Transcript',
    // Sound control (spec b Req 1.4, 1.6, 2.1). Each reason fits one line at 320 px (task 19b): what
    // happened, and what to do when there is something to do. The captions on screen show the rest.
    'sound.label': 'Ghost voice',
    'sound.short': 'Voice', // visible on narrow screens; the accessible name stays sound.label
    'sound.noVoice': 'No voice for this language.',
    'sound.failed': 'The voice failed. Turn it on again.',
    'sound.noApi': "This browser can't speak aloud.",

    // Privacy notice (Req 10.2, steering accessibility-ethics.md). Plain and honest; no jokes.
    'privacy.title': 'Privacy notice',
    'privacy.intro': 'Before we start, here is what happens with what you type.',
    'privacy.local':
      'Demo mode runs entirely in your browser. Your answers are not sent to any server, and they are gone when you close the page.',
    // Spec b Req 9.2: true because the kit only ever picks local voices (pickVoice, Req 1.3).
    'privacy.ghostVoice':
      'The ghost speaks with voices installed on your device, so its lines are not sent anywhere to be spoken.',
    'privacy.noPersonalData':
      'Please do not enter personal or sensitive data, such as your full name, address, health or money details. Made-up examples work just as well.',
    'privacy.freeTier':
      'A later version may offer a free AI service instead of demo mode. Free AI services may use the text you send to improve their products, and people at those companies may read it. The app will name the service and ask you before sending anything.',
    'privacy.accept': 'I understand, start',
    'privacy.notNow': 'Not now',
    'privacy.close': 'Close',

    // Strict build whose question pack fails validation (Req 5.5, design §3.4).
    'session.blocked':
      "This practice can't start yet: each question needs at least two ways to answer. Please try again later.",

    // Keyboard answer (Req 6). The error says what happened and what to do.
    'keyboard.label': 'Your answer',
    'keyboard.hint': 'Press Ctrl+Enter (⌘+Enter on Mac) to submit.',
    'keyboard.submit': 'Submit answer',
    'keyboard.empty': 'The answer is empty. Type a few words, then submit.',

    // Confirmation step (Req 7). Wording from the ghost-persona phrase bank.
    'confirm.heading': 'I noted this. Is that what you meant?',
    'confirm.method': 'How you answered: {method}',
    'confirm.confirm': 'Confirm',
    'confirm.edit': 'Edit',
    'confirm.retry': 'Answer again',
    // One label per input method. Gestures are experimental and never called sign language.
    'method.keyboard': 'Typed',
    'method.voice': 'Spoken',
    'method.morse': 'Morse code',
    'method.sign': 'Gestures (experimental)',

    // Feedback panel (Req 8.5): practice feedback, never a verdict. Demo label from task 27.
    'feedback.heading': 'Practice feedback',
    'feedback.demoLabel': 'Demo evaluation: based on keywords, not a full reading of your answer.',
    'feedback.strengthLabel': 'What went well',
    'feedback.improvementLabel': 'One thing to improve',
    'feedback.next': 'Continue',

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
    'shell.preview.detail': 'Por ahora, solo teclado.',
    'language.label': 'Idioma',
    'language.en': 'English',
    'language.es': 'Español',

    'ghost.label.neutral': 'El examinador fantasma, tranquilo.',
    'ghost.label.thinking': 'El examinador fantasma, pensando.',
    'ghost.label.approving': 'El examinador fantasma, satisfecho.',
    'ghost.label.skeptical': 'El examinador fantasma, con cara de duda.',
    'transcript.heading': 'Transcripción',
    'sound.label': 'Voz del fantasma',
    'sound.short': 'Voz',
    'sound.noVoice': 'No hay voz para este idioma.',
    'sound.failed': 'La voz falló. Vuelve a encenderla.',
    'sound.noApi': 'Este navegador no puede hablar.',

    'privacy.title': 'Aviso de privacidad',
    'privacy.intro': 'Antes de empezar, esto es lo que pasa con lo que escribes.',
    'privacy.local':
      'El modo demo funciona por completo en tu navegador. Tus respuestas no se envían a ningún servidor y desaparecen al cerrar la página.',
    'privacy.ghostVoice':
      'El fantasma habla con voces instaladas en tu dispositivo, así que sus frases no se envían a ningún sitio para ser leídas.',
    'privacy.noPersonalData':
      'Por favor, no escribas datos personales ni sensibles, como tu nombre completo, tu dirección o datos de salud o de dinero. Los ejemplos inventados funcionan igual de bien.',
    'privacy.freeTier':
      'Una versión futura podría ofrecer un servicio de IA gratuito en lugar del modo demo. Los servicios de IA gratuitos pueden usar el texto que les envíes para mejorar sus productos, y personas de esas empresas pueden leerlo. La app te dirá qué servicio es y te preguntará antes de enviar nada.',
    'privacy.accept': 'Entendido, empezar',
    'privacy.notNow': 'Ahora no',
    'privacy.close': 'Cerrar',

    'session.blocked':
      'Esta práctica todavía no puede empezar: cada pregunta necesita al menos dos formas de responder. Inténtalo más tarde.',

    'keyboard.label': 'Tu respuesta',
    'keyboard.hint': 'Presiona Ctrl+Enter (⌘+Enter en Mac) para enviar.',
    'keyboard.submit': 'Enviar respuesta',
    'keyboard.empty': 'La respuesta está vacía. Escribe unas palabras y luego envíala.',

    'confirm.heading': 'Anoté esto. ¿Es lo que quisiste decir?',
    'confirm.method': 'Cómo respondiste: {method}',
    'confirm.confirm': 'Confirmar',
    'confirm.edit': 'Editar',
    'confirm.retry': 'Responder de nuevo',
    'method.keyboard': 'Escrito',
    'method.voice': 'Hablado',
    'method.morse': 'Código Morse',
    'method.sign': 'Gestos (experimental)',

    'feedback.heading': 'Comentarios de práctica',
    'feedback.demoLabel':
      'Evaluación de demostración: se basa en palabras clave, no en una lectura completa de tu respuesta.',
    'feedback.strengthLabel': 'Lo que salió bien',
    'feedback.improvementLabel': 'Algo para mejorar',
    'feedback.next': 'Continuar',

    'feedback.summary.approving': 'Gracias. Esa respuesta fue clara y se centró en el tema.',
    'feedback.summary.skeptical': 'Gracias. Es un buen comienzo, y todavía puedes desarrollarlo más.',
    'feedback.strength.covered': 'Explicaste {point}.',
    'feedback.strength.direct': 'Te tomaste el tiempo de responder.',
    'feedback.improvement.add': 'Agrega {point}.',
    'feedback.improvement.measurable': 'Agrega un resultado que se pueda medir.',
    'feedback.improvement.more': 'Cuéntame un poco más: un ejemplo ayuda.',
  },
);
