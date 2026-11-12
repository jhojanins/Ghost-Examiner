import {
  createDemoProvider,
  createKeyboardAdapter,
  createLlmEvaluator,
  kitMessages,
  type Feedback,
  type InputMethodId,
  type KeyboardAdapter,
  type Locale,
} from '@ghost-examiner/core';
import {
  AppShell,
  Captions,
  ConfirmAnswer,
  FeedbackPanel,
  Ghost,
  ghostState,
  KeyboardInput,
  LanguageSwitch,
  PrivacyDialog,
  MotionToggle,
  SoundToggle,
  Transcript,
  useGhostPose,
  useSession,
  useStore,
  VoiceInput,
} from '@ghost-examiner/ui';
import {
  browserLocale,
  createSession,
  createVoiceAdapter,
  createWebSpeechOutput,
  systemClock,
  unavailableInputs,
  type RecognitionCtor,
  type SessionHandle,
} from '@ghost-examiner/web';
import { useEffect, useId, useRef, useState } from 'react';
import { config } from './config';
import { pack } from './content/pack';
import { messages } from './messages';
import './App.css';

type Running = Extract<SessionHandle, { dispatch: unknown }>;
interface AppSession {
  id: number; // a new id per session, so "Practice again" mounts a fresh screen
  handle: SessionHandle;
  keyboard: KeyboardAdapter;
  demo: boolean;
  locale: Locale;
}

const GHOST_SEED = 7; // fixed blink pattern; any number works

/**
 * The ghost's voice: one per page (spec b design §5), so the sound setting survives "Practice
 * again". Feature-detected: without the speech API every line plays muted (Req 1.2).
 */
const LANGUAGES = navigator.languages?.length ? navigator.languages : [navigator.language];
const speech = createWebSpeechOutput({
  synth: globalThis.speechSynthesis,
  Utterance: globalThis.SpeechSynthesisUtterance,
  clock: systemClock,
  languages: LANGUAGES,
});

/**
 * Voice answers: one adapter per page too (spec b design §5), so a browser that turned out unable to
 * recognize speech (Brave) stays "unavailable" for "Practice again". Feature-detected: TypeScript's
 * DOM lib doesn't declare the recognizer, so the globals are read through a narrow type.
 */
const recognizers = globalThis as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
const voice = createVoiceAdapter({
  Recognition: recognizers.SpeechRecognition ?? recognizers.webkitSpeechRecognition,
  clock: systemClock,
  languages: LANGUAGES,
});

/**
 * Demo mode: keyboard and voice input, the demo evaluator, the ghost's voice (muted until consent).
 * `unavailable` comes from `unavailableInputs`, so a browser without speech recognition gets a
 * Preview session (spec b Req 10.4).
 */
function startSession(locale: Locale, id: number, unavailable: readonly InputMethodId[]): AppSession {
  const keyboard = createKeyboardAdapter();
  const provider = createDemoProvider();
  const handle = createSession({
    pack,
    adapters: [keyboard, voice],
    unavailable,
    preview: config.preview,
    evaluator: createLlmEvaluator(provider),
    speech,
    locale,
  });
  return { id, handle, keyboard, demo: provider.isDemo, locale };
}

/** Starts a session once the browser has said which inputs it can use (a microtask: feature detection). */
function whenReady(locale: Locale, id: number, start: (session: AppSession) => void) {
  void unavailableInputs([voice]).then((unavailable) => start(startSession(locale, id, unavailable)));
}

export function App() {
  const [session, setSession] = useState<AppSession>();
  // "Pause motion" (spec a Req 3.7): page-level, so it lasts through "Practice again"; never stored.
  const [motionPaused, setMotionPaused] = useState(false);
  useEffect(() => {
    let current = true;
    whenReady(browserLocale(), 1, (next) => current && setSession(next));
    return () => {
      current = false;
    };
  }, []);
  if (!session) return null;
  const { handle } = session;
  if ('blocked' in handle) return <Blocked locale={session.locale} />;
  return (
    <Session
      key={session.id}
      handle={handle}
      keyboard={session.keyboard}
      demo={session.demo}
      motionPaused={motionPaused}
      onMotionChange={setMotionPaused}
      onRestart={(locale) => whenReady(locale, session.id + 1, setSession)}
    />
  );
}

/** A strict build whose pack failed validation: say why, keep the shell and the privacy notice. */
function Blocked({ locale: initial }: { locale: Locale }) {
  const [locale, setLocale] = useState(initial);
  const [privacy, setPrivacy] = useState(false);
  return (
    <AppShell
      title={messages[locale].title}
      locale={locale}
      preview={config.preview}
      languageSwitch={<LanguageSwitch locale={locale} onChange={setLocale} />}
      onPrivacy={() => setPrivacy(true)}
    >
      <p>{kitMessages[locale]['session.blocked']}</p>
      <PrivacyDialog open={privacy} locale={locale} mode="read-only" onAccept={() => {}} onDismiss={() => setPrivacy(false)} />
    </AppShell>
  );
}

interface SessionProps {
  handle: Running;
  keyboard: KeyboardAdapter;
  demo: boolean;
  motionPaused: boolean;
  onMotionChange: (paused: boolean) => void;
  onRestart: (locale: Locale) => void;
}

function Session({ handle, keyboard, demo, motionPaused, onMotionChange, onRestart }: SessionProps) {
  const { view, dispatch } = useSession(handle);
  const { state, line, transcript } = view;
  const voiceView = useStore(voice);
  const { phase, locale } = state;
  const m = messages[locale];
  const introHeadingId = useId();
  const summaryHeadingId = useId();

  // Esc or "Not now" on the consent dialog: the engine stays in `privacy`, the intro shows again,
  // and Start reopens the dialog (task 27).
  const [consentDismissed, setConsentDismissed] = useState(false);
  const [readOnlyPrivacy, setReadOnlyPrivacy] = useState(false);
  const consentOpen = phase === 'privacy' && !consentDismissed;

  // A language switch in the feedback phase re-evaluates (feedback → evaluating → feedback).
  // Keeping the last feedback on screen keeps the panel mounted, so focus stays on the language
  // switch instead of jumping to the panel heading (task 27).
  const [lastFeedback, setLastFeedback] = useState<Feedback>();
  if (state.feedback && state.feedback !== lastFeedback) setLastFeedback(state.feedback);
  if (!state.feedback && phase !== 'evaluating' && lastFeedback) setLastFeedback(undefined);
  const shownFeedback = state.feedback ?? (phase === 'evaluating' ? lastFeedback : undefined);

  // The mouth reads the playback origin every frame, so it follows the voice's boundary events.
  const { ref: ghostRef, pose } = useGhostPose(ghostState(view, GHOST_SEED), line?.origin, motionPaused);

  // The sound control's "no voice" reason follows the UI language, even with no line playing.
  const sound = useStore(speech);
  useEffect(() => speech.setLocale(locale), [locale]);

  // Focus on phase change (design §5.1): the answer field when answering starts (after the
  // privacy notice, or back from Edit / Answer again), the heading at the end. ConfirmAnswer and
  // FeedbackPanel move focus to their own headings.
  // Back from confirmation: Edit goes to the text field with the text (Req 7.3); Answer again after a
  // spoken answer goes to the voice button (spec b Req 6.3), after a typed one to the text field.
  const [lastMethod, setLastMethod] = useState<InputMethodId>();
  if (state.candidate && state.candidate.method !== lastMethod) setLastMethod(state.candidate.method);
  const answerArea = useRef<HTMLDivElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(phase);
  useEffect(() => {
    const from = previousPhase.current;
    previousPhase.current = phase;
    if (from === phase) return;
    const retryByVoice = from === 'confirming' && phase === 'answering' && state.draft === undefined && lastMethod === 'voice';
    if (retryByVoice) answerArea.current?.querySelector<HTMLElement>('.ge-voice-button')?.focus();
    else if ((from === 'privacy' && phase === 'asking') || (from === 'confirming' && phase === 'answering')) {
      answerArea.current?.querySelector('textarea')?.focus();
    }
    if (phase === 'summary') summaryHeading.current?.focus();
  }, [phase, lastMethod, state.draft]);

  let panel;
  if (phase === 'intro' || phase === 'privacy') {
    panel = (
      <section className="gi-panel" aria-labelledby={introHeadingId}>
        <h2 id={introHeadingId}>{m['intro.heading']}</h2>
        <p>{m['intro.text']}</p>
        <button
          type="button"
          className="ge-button ge-button--primary"
          onClick={() => (phase === 'intro' ? dispatch({ type: 'start' }) : setConsentDismissed(false))}
        >
          {m['intro.start']}
        </button>
      </section>
    );
  } else if (phase === 'asking' || phase === 'answering') {
    panel = (
      <div ref={answerArea} className="gi-panel">
        <KeyboardInput locale={locale} onSubmit={keyboard.submit} draft={state.draft} />
        <VoiceInput
          locale={locale}
          voice={voiceView}
          onListen={voice.listen}
          onStop={voice.stopListening}
          onPrivacy={() => setReadOnlyPrivacy(true)}
        />
      </div>
    );
  } else if (phase === 'confirming' && state.candidate) {
    const { candidateId } = state.candidate;
    panel = (
      <ConfirmAnswer
        locale={locale}
        candidate={state.candidate}
        onConfirm={() => dispatch({ type: 'confirm', candidateId })}
        onEdit={() => dispatch({ type: 'edit' })}
        onRetry={() => dispatch({ type: 'retry' })}
      />
    );
  } else if (shownFeedback) {
    panel = (
      <FeedbackPanel key="feedback" locale={locale} feedback={shownFeedback} demo={demo} onNext={() => dispatch({ type: 'next' })} />
    );
  } else if (phase === 'summary') {
    panel = (
      <section className="gi-panel" aria-labelledby={summaryHeadingId}>
        <h2 id={summaryHeadingId} ref={summaryHeading} tabIndex={-1}>
          {m['summary.heading']}
        </h2>
        <button type="button" className="ge-button ge-button--primary" onClick={() => onRestart(locale)}>
          {m['summary.again']}
        </button>
      </section>
    );
  }

  return (
    <AppShell
      title={m.title}
      locale={locale}
      // A Preview build, or a Preview session in a browser without speech recognition (spec b Req 10.4, 10.5).
      preview={config.preview || view.preview !== undefined}
      previewNote={view.preview ? kitMessages[locale]['shell.preview.missing.voice'] : undefined}
      soundControl={<SoundToggle locale={locale} sound={sound} onChange={speech.setOn} />}
      languageSwitch={<LanguageSwitch locale={locale} onChange={(next) => dispatch({ type: 'locale-changed', locale: next })} />}
      motionControl={<MotionToggle locale={locale} paused={motionPaused} onChange={onMotionChange} />}
      onPrivacy={() => setReadOnlyPrivacy(true)}
    >
      <div className="gi-stage">
        <div className="gi-ghost">
          <Ghost ref={ghostRef} pose={pose} locale={locale} />
        </div>
        <Captions line={line} />
      </div>
      {panel}
      <Transcript lines={transcript} locale={locale} />
      <PrivacyDialog
        open={consentOpen || readOnlyPrivacy}
        locale={locale}
        mode={consentOpen ? 'consent' : 'read-only'}
        onAccept={() => {
          // Consent first, then the question: it is the first line spoken aloud (Req 2.2), and
          // this click is the user activation browsers require before speaking.
          speech.unlock();
          dispatch({ type: 'privacy-accepted' });
        }}
        onDismiss={() => (consentOpen ? setConsentDismissed(true) : setReadOnlyPrivacy(false))}
      />
    </AppShell>
  );
}
