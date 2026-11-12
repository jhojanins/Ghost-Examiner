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
    // Preview session (spec b Req 10.5): names what is missing and what works now; never blames the user.
    'shell.preview.missing.voice': 'No voice input in this browser. You can type your answers.',
    // Language switch: each language is named in itself, so both catalogs share these two.
    'language.label': 'Language',
    'language.en': 'English',
    'language.es': 'Español',

    // Ghost accessible name per expression (Req 3.5). Describes the expression, never the user.
    'ghost.label.neutral': 'The ghost examiner, looking calm.',
    'ghost.label.attentive': 'The ghost examiner, listening closely.',
    'ghost.label.thinking': 'The ghost examiner, thinking.',
    'ghost.label.approving': 'The ghost examiner, looking satisfied.',
    'ghost.label.skeptical': 'The ghost examiner, looking skeptical.',
    'ghost.label.amused': 'The ghost examiner, looking quietly amused.',
    'ghost.label.surprised': 'The ghost examiner, looking surprised.',
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
    'privacy.intro': 'Before we start, here is what happens with what you type or say.',
    // Spec b Req 9.3: true for spoken answers too, because this app itself sends nothing anywhere.
    'privacy.local':
      'Demo mode runs in your browser. This app sends your answers to no server, and they are gone when you close the page. If you answer by voice, read the next point.',
    // Spec b Req 9.1, 9.4 and the owner's wording (task 31): never claims recognition stays on the device.
    'privacy.voice':
      'Answering by voice is optional; typing always works. The microphone is asked for only when you press the voice button. To turn your speech into text, your browser may send your voice to the company that makes it, for example Google for Chrome or Apple for Safari. This app only receives the text. It never records or stores audio.',
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
    // Voice answer (spec b Req 4, 5, 9.5). Messages say what happened and what to do next.
    'voice.heading': 'Answer by voice',
    'voice.start': 'Start speaking',
    'voice.stop': 'Stop speaking',
    'voice.listening': 'Listening…',
    'voice.stopped': 'Stopped listening.',
    'voice.yourWords': 'Your words',
    'voice.note': 'Your browser may send your voice to its maker to turn it into text.',
    'voice.unavailable': "Voice input isn't available in this browser. You can type your answer.",
    'voice.empty': "I didn't catch any words. Try again, or type your answer.",
    'voice.error.permission': "I can't hear you, which is usually my line. Allow the microphone in your browser, or type your answer.",
    'voice.error.noMic': "I can't find a microphone. Connect one and try again, or type your answer.",
    'voice.error.network': 'The connection to the speech service dropped. Try again, or type your answer.',
    'voice.error.language': "This browser can't recognize speech in this language. Switch language, or type your answer.",
    'voice.error.service': 'Speech recognition stopped working. Try again, or type your answer.',

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
    'shell.preview.missing.voice': 'Este navegador no tiene entrada por voz. Puedes escribir tus respuestas.',
    'language.label': 'Idioma',
    'language.en': 'English',
    'language.es': 'Español',

    'ghost.label.neutral': 'El examinador fantasma, tranquilo.',
    'ghost.label.attentive': 'El examinador fantasma, escuchando con atención.',
    'ghost.label.thinking': 'El examinador fantasma, pensando.',
    'ghost.label.approving': 'El examinador fantasma, satisfecho.',
    'ghost.label.skeptical': 'El examinador fantasma, con cara de duda.',
    'ghost.label.amused': 'El examinador fantasma, con un gesto divertido.',
    'ghost.label.surprised': 'El examinador fantasma, sorprendido.',
    'transcript.heading': 'Transcripción',
    'sound.label': 'Voz del fantasma',
    'sound.short': 'Voz',
    'sound.noVoice': 'No hay voz para este idioma.',
    'sound.failed': 'La voz falló. Vuelve a encenderla.',
    'sound.noApi': 'Este navegador no puede hablar.',

    'privacy.title': 'Aviso de privacidad',
    'privacy.intro': 'Antes de empezar, esto es lo que pasa con lo que escribes o dices.',
    'privacy.local':
      'El modo demo funciona en tu navegador. Esta app no envía tus respuestas a ningún servidor y desaparecen al cerrar la página. Si respondes por voz, lee el punto siguiente.',
    'privacy.voice':
      'Responder por voz es opcional; escribir siempre funciona. El micrófono se pide solo cuando presionas el botón de voz. Para convertir tu voz en texto, tu navegador puede enviar tu voz a la empresa que lo creó, por ejemplo Google en Chrome o Apple en Safari. Esta app solo recibe el texto y nunca graba ni guarda audio.',
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
    'voice.heading': 'Responder por voz',
    'voice.start': 'Empezar a hablar',
    'voice.stop': 'Dejar de hablar',
    'voice.listening': 'Escuchando…',
    'voice.stopped': 'Dejé de escuchar.',
    'voice.yourWords': 'Tus palabras',
    'voice.note': 'Tu navegador puede enviar tu voz a la empresa que lo creó para convertirla en texto.',
    'voice.unavailable': 'La entrada por voz no está disponible en este navegador. Puedes escribir tu respuesta.',
    'voice.empty': 'No escuché ninguna palabra. Inténtalo de nuevo o escribe tu respuesta.',
    'voice.error.permission': 'No puedo oírte, y eso suele decirlo yo. Permite el micrófono en tu navegador o escribe tu respuesta.',
    'voice.error.noMic': 'No encuentro un micrófono. Conecta uno e inténtalo de nuevo, o escribe tu respuesta.',
    'voice.error.network': 'Se cortó la conexión con el servicio de voz. Inténtalo de nuevo o escribe tu respuesta.',
    'voice.error.language': 'Este navegador no reconoce la voz en este idioma. Cambia de idioma o escribe tu respuesta.',
    'voice.error.service': 'El reconocimiento de voz dejó de funcionar. Inténtalo de nuevo o escribe tu respuesta.',

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

/** A key of the kit catalog: code that names a message by key gets it checked by the compiler. */
export type KitMessageKey = keyof (typeof kitMessages)['en'];
