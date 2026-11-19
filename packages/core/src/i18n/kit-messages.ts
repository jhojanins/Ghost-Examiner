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
    'motion.label': 'Pause motion',
    'motion.short': 'Pause', // visible on narrow screens; the accessible name stays motion.label
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
      'Demo mode runs in your browser and sends your answers to no server. Ghost Defense also has an AI mode, which you choose before anything is sent; it is described below. This app stores nothing: your file, answers and feedback are gone when you close the page. If you answer by voice, read the next point.',
    // Spec b Req 9.1, 9.4 and the owner's wording (task 31): never claims recognition stays on the device.
    'privacy.voice':
      'Answering by voice is optional; typing always works. The microphone is asked for only when you press the voice button. To turn your speech into text, your browser may send your voice to the company that makes it, for example Google for Chrome or Apple for Safari. This app only receives the text. It never records or stores audio.',
    // Spec b Req 9.2: true because the kit only ever picks local voices (pickVoice, Req 1.3).
    'privacy.ghostVoice':
      'The ghost speaks with voices installed on your device, so its lines are not sent anywhere to be spoken.',
    'privacy.noPersonalData':
      'Please do not enter personal or sensitive data, such as your full name, address, health or money details. Made-up examples work just as well.',
    'privacy.freeTier':
      "AI mode (Ghost Defense only): parts of your file's text and the answers you confirm are sent to Google Gemini through this site's server, which logs none of it. Gemini's free tier may use what it receives to improve Google's products, and human reviewers may read it; Google may keep it under its own terms. The app names the service and asks you first, and you can always continue offline.",
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
    // ghost-defense-live (task 4). Consent and real-mode texts come with task 16.
    'defense.upload.heading': 'Your file',
    'defense.upload.warning':
      'Please do not upload sensitive, confidential or personal documents. Your own coursework or a sample works best.',
    'defense.upload.provider': 'Questions and replies now come from: {provider}.',
    'defense.provider.demo': 'simple rules that run on your device (offline demo)',
    'defense.upload.label': 'Choose a file (.txt or .md, up to 2 MB)',
    'defense.upload.paste': 'Paste text instead',
    'defense.upload.pasteLabel': 'Your text',
    'defense.upload.pasteUse': 'Use this text',
    'defense.upload.samples': 'Or try a sample file',
    'defense.upload.sample.en': 'Sample in English',
    'defense.upload.sample.es': 'Sample in Spanish',
    'defense.error.type': "This file type isn't supported here. Use a .txt or .md file, or paste the text.",
    'defense.error.size': 'This file is over 2 MB. Use a shorter file, or paste the part you want to discuss.',
    'defense.error.short': 'This text is too short to ask about. Use at least 300 characters.',
    'defense.error.encoding': "I can't read the text in this file. Save it as UTF-8 text, or paste it.",
    'defense.preview.heading': 'What the ghost will read',
    'defense.preview.textLabel': 'The text of your file',
    'defense.preview.counts': '{chars} characters in {parts} parts',
    'defense.preview.onlyText':
      'The ghost sees only this text: no images, no layout, and nothing the app could not extract.',
    'defense.preview.truncated': 'Your text is long, so only the first 60,000 characters are used.',
    'defense.preview.noHeadings': 'No headings found. That is fine: questions will cover the whole text.',
    'defense.preview.sample': 'This is a fictional sample file.',
    'defense.preview.fileLang': 'Language of your file',
    'defense.preview.count': 'Number of questions',
    'defense.preview.remove': 'Remove file',
    'defense.preview.start': 'Start',
    'defense.quote.label': 'From your file',
    'defense.waiting': 'Let me read your file. Ghosts read slowly, but carefully.',
    'defense.noQuestions': "I couldn't find enough in this text to ask about. Try a longer file.",
    'defense.cantPoint': "I can't point to that part of your file, so I won't correct you on it.",
    'defense.confirm.heading': 'Your answer',
    'defense.confirm.send': 'Send',
    'defense.skip': 'Next question',
    'defense.end': 'End the session',
    'defense.demoLabel': 'Demo mode: questions and feedback come from simple rules, not AI.',
    'defense.mode.ai': 'Questions and replies come from AI: {provider}.',
    'defense.summary.heading': 'Practice summary',
    'defense.summary.questions': 'Questions',
    'defense.summary.strength': 'What went well',
    'defense.summary.review': 'Worth a second look',
    'defense.summary.label': 'Practice feedback, not a grade.',
    'defense.summary.source.demo': 'Written by the offline demo rules.',
    'defense.summary.source.ai': 'Written by AI ({provider}).',
    'defense.summary.copy': 'Copy summary',
    'defense.summary.copied': 'Summary copied.',
    'defense.summary.again': 'Start again with this file',
    'defense.summary.new': 'Use another file',
    // Consent before real mode (design §6.1, Req 3.1). Plain and exact; no jokes.
    'defense.provider.gemini': "Google Gemini, through this site's server",
    'defense.consent.heading': 'Before the AI reads your file',
    'defense.consent.provider': 'Who answers: {provider}.',
    'defense.consent.sent':
      "What is sent: parts of the text of your file, at most 6,000 characters per request (never the file itself), the examiner's questions, and the answers you confirm.",
    'defense.consent.notSent': 'What is not sent: the file, the rest of its text, audio, camera images, and anything you typed but did not confirm.',
    'defense.consent.storage': "This app stores nothing, and this site's server does not log what is sent.",
    'defense.consent.dataUse.gemini':
      "Google's free tier may use what it receives to improve its products, and human reviewers may read it. Do not include sensitive, confidential or personal information.",
    'defense.consent.practice': 'Replies are practice feedback, not a grade.',
    'defense.consent.ai': 'Continue with AI',
    'defense.consent.offline': 'Continue offline (demo)',
    // The demo provider's lines (design §3.6). Questions never embed the quote: it is shown beside them.
    'defense.demo.q.why': 'Why did you make this choice?',
    'defense.demo.q.alternative': 'What other option did you consider, and why did you set it aside?',
    'defense.demo.q.conclusion': 'How does this conclusion follow from what you did?',
    'defense.demo.q.measure': 'How did you get this result, and what does it show?',
    'defense.demo.q.explain': 'Explain this part in your own words. What is its main point?',
    'defense.demo.q.defend': 'If someone disagreed with this part, how would you defend it?',
    'defense.demo.ack': 'That matches this part of your file. You used its key ideas in your own words.',
    'defense.demo.partly': 'That is a start.',
    'defense.demo.followUp': 'Can you say more, with one concrete detail from your work?',
    'defense.demo.correction': "My simple rules couldn't match your answer to this part. Here is what your file says; compare it with yours.",
    'defense.demo.strength.ack': 'You explained parts of your work using its own key ideas.',
    'defense.demo.strength.effort': 'You stayed with every question to the end. Ghosts respect patience.',
    'defense.demo.review': 'Look again at this part: {question}',
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
    'motion.label': 'Pausar movimiento',
    'motion.short': 'Pausar',
    'sound.label': 'Voz del fantasma',
    'sound.short': 'Voz',
    'sound.noVoice': 'No hay voz para este idioma.',
    'sound.failed': 'La voz falló. Vuelve a encenderla.',
    'sound.noApi': 'Este navegador no puede hablar.',

    'privacy.title': 'Aviso de privacidad',
    'privacy.intro': 'Antes de empezar, esto es lo que pasa con lo que escribes o dices.',
    'privacy.local':
      'El modo demo funciona en tu navegador y no envía tus respuestas a ningún servidor. La Defensa fantasma también tiene un modo con IA, que eliges antes de que se envíe nada; se explica más abajo. Esta app no guarda nada: tu archivo, tus respuestas y los comentarios desaparecen al cerrar la página. Si respondes por voz, lee el punto siguiente.',
    'privacy.voice':
      'Responder por voz es opcional; escribir siempre funciona. El micrófono se pide solo cuando presionas el botón de voz. Para convertir tu voz en texto, tu navegador puede enviar tu voz a la empresa que lo creó, por ejemplo Google en Chrome o Apple en Safari. Esta app solo recibe el texto y nunca graba ni guarda audio.',
    'privacy.ghostVoice':
      'El fantasma habla con voces instaladas en tu dispositivo, así que sus frases no se envían a ningún sitio para ser leídas.',
    'privacy.noPersonalData':
      'Por favor, no escribas datos personales ni sensibles, como tu nombre completo, tu dirección o datos de salud o de dinero. Los ejemplos inventados funcionan igual de bien.',
    'privacy.freeTier':
      'Modo con IA (solo en la Defensa fantasma): partes del texto de tu archivo y las respuestas que confirmas se envían a Google Gemini a través del servidor de este sitio, que no registra nada de eso. El nivel gratuito de Gemini puede usar lo que recibe para mejorar los productos de Google, y personas que lo revisan pueden leerlo; Google puede guardarlo según sus propias condiciones. La app te dice qué servicio es y te pregunta antes, y siempre puedes seguir sin conexión.',
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
    'defense.upload.heading': 'Tu archivo',
    'defense.upload.warning':
      'Por favor, no subas documentos sensibles, confidenciales o personales. Tu propio trabajo de clase o un ejemplo funcionan mejor.',
    'defense.upload.provider': 'Las preguntas y respuestas ahora salen de: {provider}.',
    'defense.provider.demo': 'reglas simples que funcionan en tu dispositivo (demo sin conexión)',
    'defense.upload.label': 'Elige un archivo (.txt o .md, hasta 2 MB)',
    'defense.upload.paste': 'Mejor pegar el texto',
    'defense.upload.pasteLabel': 'Tu texto',
    'defense.upload.pasteUse': 'Usar este texto',
    'defense.upload.samples': 'O prueba con un archivo de ejemplo',
    'defense.upload.sample.en': 'Ejemplo en inglés',
    'defense.upload.sample.es': 'Ejemplo en español',
    'defense.error.type': 'Este tipo de archivo no se admite aquí. Usa un archivo .txt o .md, o pega el texto.',
    'defense.error.size': 'Este archivo pesa más de 2 MB. Usa uno más corto o pega la parte que quieres comentar.',
    'defense.error.short': 'Este texto es muy corto para hacer preguntas. Usa al menos 300 caracteres.',
    'defense.error.encoding': 'No puedo leer el texto de este archivo. Guárdalo como texto UTF-8 o pégalo.',
    'defense.preview.heading': 'Lo que leerá el fantasma',
    'defense.preview.textLabel': 'El texto de tu archivo',
    'defense.preview.counts': '{chars} caracteres en {parts} partes',
    'defense.preview.onlyText':
      'El fantasma ve solo este texto: ni imágenes, ni diseño, ni nada que la app no pudo extraer.',
    'defense.preview.truncated': 'Tu texto es largo, así que solo se usan los primeros 60.000 caracteres.',
    'defense.preview.noHeadings': 'No hay títulos. No pasa nada: las preguntas cubrirán todo el texto.',
    'defense.preview.sample': 'Este es un archivo de ejemplo ficticio.',
    'defense.preview.fileLang': 'Idioma de tu archivo',
    'defense.preview.count': 'Número de preguntas',
    'defense.preview.remove': 'Quitar archivo',
    'defense.preview.start': 'Empezar',
    'defense.quote.label': 'De tu archivo',
    'defense.waiting': 'Déjame leer tu archivo. Los fantasmas leemos despacio, pero con cuidado.',
    'defense.noQuestions': 'No encontré lo suficiente en este texto para preguntar. Prueba con un archivo más largo.',
    'defense.cantPoint': 'No puedo señalar esa parte de tu archivo, así que no te corregiré en eso.',
    'defense.confirm.heading': 'Tu respuesta',
    'defense.confirm.send': 'Enviar',
    'defense.skip': 'Siguiente pregunta',
    'defense.end': 'Terminar la sesión',
    'defense.demoLabel': 'Modo demo: las preguntas y los comentarios salen de reglas simples, no de IA.',
    'defense.mode.ai': 'Las preguntas y respuestas salen de IA: {provider}.',
    'defense.summary.heading': 'Resumen de práctica',
    'defense.summary.questions': 'Preguntas',
    'defense.summary.strength': 'Lo que salió bien',
    'defense.summary.review': 'Vale la pena revisar',
    'defense.summary.label': 'Comentarios de práctica, no una calificación.',
    'defense.summary.source.demo': 'Escrito por las reglas de la demo sin conexión.',
    'defense.summary.source.ai': 'Escrito por IA ({provider}).',
    'defense.summary.copy': 'Copiar resumen',
    'defense.summary.copied': 'Resumen copiado.',
    'defense.summary.again': 'Empezar de nuevo con este archivo',
    'defense.summary.new': 'Usar otro archivo',
    'defense.provider.gemini': 'Google Gemini, a través del servidor de este sitio',
    'defense.consent.heading': 'Antes de que la IA lea tu archivo',
    'defense.consent.provider': 'Quién responde: {provider}.',
    'defense.consent.sent':
      'Qué se envía: partes del texto de tu archivo, como máximo 6.000 caracteres por solicitud (nunca el archivo en sí), las preguntas del examinador y las respuestas que confirmas.',
    'defense.consent.notSent': 'Qué no se envía: el archivo, el resto de su texto, audio, imágenes de cámara y nada de lo que escribiste sin confirmar.',
    'defense.consent.storage': 'Esta app no guarda nada, y el servidor de este sitio no registra lo que se envía.',
    'defense.consent.dataUse.gemini':
      'El nivel gratuito de Google puede usar lo que recibe para mejorar sus productos, y personas que lo revisan pueden leerlo. No incluyas información sensible, confidencial ni personal.',
    'defense.consent.practice': 'Las respuestas son comentarios de práctica, no una calificación.',
    'defense.consent.ai': 'Seguir con IA',
    'defense.consent.offline': 'Seguir sin conexión (demo)',
    'defense.demo.q.why': '¿Por qué tomaste esta decisión?',
    'defense.demo.q.alternative': '¿Qué otra opción consideraste y por qué la dejaste de lado?',
    'defense.demo.q.conclusion': '¿Cómo se sigue esta conclusión de lo que hiciste?',
    'defense.demo.q.measure': '¿Cómo obtuviste este resultado y qué muestra?',
    'defense.demo.q.explain': 'Explica esta parte con tus palabras. ¿Cuál es su idea principal?',
    'defense.demo.q.defend': 'Si alguien no estuviera de acuerdo con esta parte, ¿cómo la defenderías?',
    'defense.demo.ack': 'Eso coincide con esta parte de tu archivo. Usaste sus ideas clave con tus palabras.',
    'defense.demo.partly': 'Es un comienzo.',
    'defense.demo.followUp': '¿Puedes contar más, con un detalle concreto de tu trabajo?',
    'defense.demo.correction': 'Mis reglas simples no pudieron relacionar tu respuesta con esta parte. Esto dice tu archivo; compáralo con lo tuyo.',
    'defense.demo.strength.ack': 'Explicaste partes de tu trabajo con sus propias ideas clave.',
    'defense.demo.strength.effort': 'Seguiste cada pregunta hasta el final. Los fantasmas respetamos la paciencia.',
    'defense.demo.review': 'Vuelve a mirar esta parte: {question}',
  },
);

/** A key of the kit catalog: code that names a message by key gets it checked by the compiler. */
export type KitMessageKey = keyof (typeof kitMessages)['en'];
