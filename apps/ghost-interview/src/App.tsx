import {
  createDemoProvider,
  createKeyboardAdapter,
  createLlmEvaluator,
  kitMessages,
  type Feedback,
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
  Transcript,
  useGhostPose,
  useSession,
} from '@ghost-examiner/ui';
import { browserLocale, createSession, createSilentOutput, systemClock, type SessionHandle } from '@ghost-examiner/web';
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

/** Demo mode only in phase 1: keyboard input, the demo evaluator, muted speech. */
function startSession(locale: Locale, id = 1): AppSession {
  const keyboard = createKeyboardAdapter();
  const provider = createDemoProvider();
  const handle = createSession({
    pack,
    adapters: [keyboard],
    preview: config.preview,
    evaluator: createLlmEvaluator(provider),
    speech: createSilentOutput(systemClock),
    locale,
  });
  return { id, handle, keyboard, demo: provider.isDemo, locale };
}

export function App() {
  const [session, setSession] = useState(() => startSession(browserLocale()));
  const { handle } = session;
  if ('blocked' in handle) return <Blocked locale={session.locale} />;
  return (
    <Session
      key={session.id}
      handle={handle}
      keyboard={session.keyboard}
      demo={session.demo}
      onRestart={(locale) => setSession(startSession(locale, session.id + 1))}
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
  onRestart: (locale: Locale) => void;
}

function Session({ handle, keyboard, demo, onRestart }: SessionProps) {
  const { view, dispatch } = useSession(handle);
  const { state, line, transcript } = view;
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

  const { ref: ghostRef, pose } = useGhostPose(ghostState(view, GHOST_SEED));

  // Focus on phase change (design §5.1): the answer field when answering starts (after the
  // privacy notice, or back from Edit / Answer again), the heading at the end. ConfirmAnswer and
  // FeedbackPanel move focus to their own headings.
  const answerArea = useRef<HTMLDivElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(phase);
  useEffect(() => {
    const from = previousPhase.current;
    previousPhase.current = phase;
    if (from === phase) return;
    if ((from === 'privacy' && phase === 'asking') || (from === 'confirming' && phase === 'answering')) {
      answerArea.current?.querySelector('textarea')?.focus();
    }
    if (phase === 'summary') summaryHeading.current?.focus();
  }, [phase]);

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
      preview={config.preview}
      languageSwitch={<LanguageSwitch locale={locale} onChange={(next) => dispatch({ type: 'locale-changed', locale: next })} />}
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
        onAccept={() => dispatch({ type: 'privacy-accepted' })}
        onDismiss={() => (consentOpen ? setConsentDismissed(true) : setReadOnlyPrivacy(false))}
      />
    </AppShell>
  );
}
