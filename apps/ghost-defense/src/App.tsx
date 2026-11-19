import {
  createDemoProvider,
  createKeyboardAdapter,
  createLlmEvaluator,
  format,
  type GhostState,
  kitMessages,
  splitExcerpts,
  type InputMethodId,
  type KeyboardAdapter,
  type KitMessageKey,
  type Locale,
  type QuestionPack,
} from '@ghost-examiner/core';
import {
  AppShell,
  Captions,
  ConsentScreen,
  DefenseSummary,
  FileUpload,
  Ghost,
  ghostState,
  InlineConfirm,
  KeyboardInput,
  LanguageSwitch,
  ModeLabel,
  MotionToggle,
  PrivacyDialog,
  QuoteBlock,
  SoundToggle,
  TextPreview,
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
  createProxyProvider,
  createWebSpeechOutput,
  parsePastedText,
  parseTextFile,
  systemClock,
  unavailableInputs,
  type ParsedText,
  type RecognitionCtor,
  type SessionHandle,
} from '@ghost-examiner/web';
import { useEffect, useId, useRef, useState } from 'react';
import { config } from './config';
import { messages } from './messages';
import { SAMPLES } from './samples';
import './App.css';

type Running = Extract<SessionHandle, { dispatch: unknown }>;
/** The text the ghost works from, with the choices made in the preview (Req 2.4, 4.1). Memory only (Req 12.1). */
interface Doc {
  text: string;
  truncated: boolean;
  sample: boolean;
  fileLang: Locale;
  count: number;
}
interface Run {
  id: number; // a new id per session, so "Start again" mounts a fresh screen
  handle: Running;
  keyboard: KeyboardAdapter;
}
type Step =
  | { name: 'intro' } // until the privacy notice is accepted
  | { name: 'upload'; error?: KitMessageKey }
  | { name: 'preview'; doc: Doc }
  | { name: 'consent'; doc: Doc } // before every session: AI or offline (Req 3.1, 3.2)
  | { name: 'session'; doc: Doc; run: Run };
type Mode = 'ai' | 'demo';

const GHOST_SEED = 11; // fixed blink pattern; any number works
const EXCERPT_CHARS = 1500; // the longest excerpt (Req 1.9)
const DEFAULT_COUNT = 4; // Req 4.1
const IDLE: GhostState = { activity: 'idle', expression: 'neutral', seed: GHOST_SEED }; // before the session

/** The ghost's voice and the voice input: one per page, as in ghost-interview (spec b design §5). */
const LANGUAGES = navigator.languages?.length ? navigator.languages : [navigator.language];
const speech = createWebSpeechOutput({
  synth: globalThis.speechSynthesis,
  Utterance: globalThis.SpeechSynthesisUtterance,
  clock: systemClock,
  languages: LANGUAGES,
});
const recognizers = globalThis as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
const voice = createVoiceAdapter({
  Recognition: recognizers.SpeechRecognition ?? recognizers.webkitSpeechRecognition,
  clock: systemClock,
  languages: LANGUAGES,
});

/** A dynamic pack: no questions of its own; they are prepared from the file (design §3.5). */
function packFor(count: number): QuestionPack {
  const [en, es] = [messages.en, messages.es];
  return {
    id: 'ghost-defense',
    greeting: { en: en['ghost.greeting'], es: es['ghost.greeting'] },
    closing: { en: en['ghost.closing'], es: es['ghost.closing'] },
    questions: [],
    dynamic: { count },
  };
}

/**
 * A session: keyboard and voice, with the site's proxy (AI, after consent) or the demo rules
 * (offline, on the device). With the proxy, the session falls back to the demo rules on the first
 * failure and stays there (Req 10). The privacy notice was accepted before the upload, so the
 * session starts at once: the greeting, then the first question.
 */
function startRun(doc: Doc, locale: Locale, id: number, unavailable: readonly InputMethodId[], mode: Mode): Run {
  const keyboard = createKeyboardAdapter();
  const provider = mode === 'ai' ? createProxyProvider() : createDemoProvider();
  const handle = createSession({
    pack: packFor(doc.count),
    adapters: [keyboard, voice],
    unavailable,
    preview: config.preview,
    evaluator: createLlmEvaluator(createDemoProvider()), // required by SessionDeps; dynamic sessions reply through `defense`
    speech,
    locale,
    defense: { provider, excerpts: splitExcerpts(doc.text, { maxChars: EXCERPT_CHARS }), fileLang: doc.fileLang },
  });
  if ('blocked' in handle) throw new Error('The ghost-defense pack failed validation.');
  handle.dispatch({ type: 'start' });
  handle.dispatch({ type: 'privacy-accepted' });
  return { id, handle, keyboard };
}

export function App() {
  const [locale, setLocale] = useState<Locale>(browserLocale);
  const [step, setStep] = useState<Step>({ name: 'intro' });
  const [unavailable, setUnavailable] = useState<readonly InputMethodId[]>();
  const [consentOpen, setConsentOpen] = useState(false);
  const [readOnlyPrivacy, setReadOnlyPrivacy] = useState(false);
  // "Pause motion" (spec a Req 3.7): page-level, so it lasts through "Start again"; never stored.
  const [motionPaused, setMotionPaused] = useState(false);
  const runs = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const m = messages[locale];
  const introHeadingId = useId();
  const { ref: ghostRef, pose } = useGhostPose(IDLE, undefined, motionPaused);

  useEffect(() => {
    let current = true;
    void unavailableInputs([voice]).then((u) => current && setUnavailable(u));
    return () => {
      current = false;
    };
  }, []);
  // A new screen moves focus to its heading (the control that opened it is gone).
  useEffect(() => {
    if (step.name === 'upload' || step.name === 'preview') heading.current?.focus(); // the consent screen focuses its own
  }, [step.name]);

  const toPreview = (parsed: ParsedText, sample?: Locale) => {
    if (!parsed.ok) return setStep({ name: 'upload', error: parsed.error });
    setStep({ name: 'preview', doc: { text: parsed.text, truncated: parsed.truncated, sample: sample !== undefined, fileLang: sample ?? locale, count: DEFAULT_COUNT } });
  };
  const start = (doc: Doc, mode: Mode) => {
    if (!unavailable) return;
    speech.unlock(); // a click: the user activation browsers need before speaking
    setStep({ name: 'session', doc, run: startRun(doc, locale, ++runs.current, unavailable, mode) });
  };

  if (step.name === 'session') {
    const { doc, run } = step;
    return (
      <Session
        key={run.id}
        run={run}
        fileLang={doc.fileLang}
        motionPaused={motionPaused}
        onMotionChange={setMotionPaused}
        onLocale={setLocale}
        onAgain={(at) => {
          setLocale(at);
          setStep({ name: 'consent', doc }); // a new session asks again (Req 3.1)
        }}
        onNew={(at) => {
          setLocale(at);
          setStep({ name: 'upload' }); // the file and its text are dropped (Req 8.4, 12.3)
        }}
      />
    );
  }

  let panel;
  if (step.name === 'intro') {
    panel = (
      <section className="gd-panel" aria-labelledby={introHeadingId}>
        <h2 id={introHeadingId}>{m['intro.heading']}</h2>
        <p>{m['intro.text']}</p>
        <div className="gd-actions">
          <button type="button" className="ge-button ge-button--primary" onClick={() => setConsentOpen(true)}>
            {m['intro.start']}
          </button>
        </div>
      </section>
    );
  } else if (step.name === 'upload') {
    panel = (
      <FileUpload
        ref={heading}
        locale={locale}
        provider={kitMessages[locale]['defense.provider.choice']}
        error={step.error}
        onFile={(file) => void parseTextFile(file).then((parsed) => toPreview(parsed))}
        onPaste={(text) => toPreview(parsePastedText(text))}
        samples={SAMPLES}
        onSample={(sample) => toPreview(parsePastedText(sample.text), sample.lang)}
      />
    );
  } else if (step.name === 'consent') {
    const { doc } = step;
    panel = <ConsentScreen locale={locale} provider="proxy" onAI={() => start(doc, 'ai')} onOffline={() => start(doc, 'demo')} />;
  } else {
    const { doc } = step;
    const update = (patch: Partial<Doc>) => setStep({ name: 'preview', doc: { ...doc, ...patch } });
    panel = (
      <TextPreview
        ref={heading}
        locale={locale}
        text={doc.text}
        truncated={doc.truncated}
        parts={splitExcerpts(doc.text, { maxChars: EXCERPT_CHARS }).length}
        sample={doc.sample}
        fileLang={doc.fileLang}
        onFileLang={(fileLang) => update({ fileLang })}
        count={doc.count}
        onCount={(count) => update({ count })}
        onRemove={() => setStep({ name: 'upload' })}
        onStart={() => setStep({ name: 'consent', doc })}
      />
    );
  }
  return (
    <AppShell
      title={m.title}
      locale={locale}
      preview={config.preview}
      languageSwitch={<LanguageSwitch locale={locale} onChange={setLocale} />}
      motionControl={<MotionToggle locale={locale} paused={motionPaused} onChange={setMotionPaused} />}
      onPrivacy={() => setReadOnlyPrivacy(true)}
    >
      <div className="gd-ghost">
        <Ghost ref={ghostRef} pose={pose} locale={locale} />
      </div>
      {panel}
      <PrivacyDialog
        open={consentOpen || readOnlyPrivacy}
        locale={locale}
        mode={consentOpen ? 'consent' : 'read-only'}
        onAccept={() => {
          setConsentOpen(false);
          setStep({ name: 'upload' });
        }}
        onDismiss={() => (consentOpen ? setConsentOpen(false) : setReadOnlyPrivacy(false))}
      />
    </AppShell>
  );
}

interface SessionProps {
  run: Run;
  fileLang: Locale;
  motionPaused: boolean;
  onMotionChange: (paused: boolean) => void;
  onLocale: (locale: Locale) => void;
  onAgain: (locale: Locale) => void;
  onNew: (locale: Locale) => void;
}

/** One defense session: questions with their quotes, inline confirmation, replies, the summary (design §6). */
function Session({ run, fileLang, motionPaused, onMotionChange, onLocale, onAgain, onNew }: SessionProps) {
  const { handle, keyboard } = run;
  const { view, dispatch } = useSession(handle);
  const { state, line, transcript } = view;
  const voiceView = useStore(voice);
  const sound = useStore(speech);
  const { phase, locale } = state;
  const m = messages[locale];
  const k = kitMessages[locale];
  const panelId = useId();
  const [readOnlyPrivacy, setReadOnlyPrivacy] = useState(false);
  const { ref: ghostRef, pose } = useGhostPose(ghostState(view, GHOST_SEED), line?.origin, motionPaused);
  useEffect(() => speech.setLocale(locale), [locale]);

  const question = state.followUp ?? state.pack.questions[state.questionIndex];
  // Which question is on screen: a follow-up is a new question at the same index.
  const questionKey = `${state.questionIndex}${state.followUp ? ':follow-up' : ''}`;

  // Focus (design §6): each new screen or question moves focus to its heading; InlineConfirm
  // focuses Send itself. Back from confirmation: Edit goes to the text field with the text,
  // Answer again after a spoken answer goes to the voice button (spec b Req 6.3).
  const heading = useRef<HTMLHeadingElement>(null);
  const answerArea = useRef<HTMLDivElement>(null);
  const [lastMethod, setLastMethod] = useState<InputMethodId>();
  if (state.candidate && state.candidate.method !== lastMethod) setLastMethod(state.candidate.method);
  const previous = useRef<{ phase: string; key: string }>(undefined);
  useEffect(() => {
    const from = previous.current;
    previous.current = { phase, key: questionKey };
    if (from?.phase === phase && from.key === questionKey) return;
    if (phase === 'confirming') return;
    if (from?.phase === 'confirming' && phase === 'answering') {
      const retryByVoice = state.draft === undefined && lastMethod === 'voice';
      const target = retryByVoice ? '.ge-voice-button' : 'textarea';
      answerArea.current?.querySelector<HTMLElement>(target)?.focus();
      return;
    }
    if (from?.phase === 'asking' && phase === 'answering' && from.key === questionKey) return; // the question finished playing
    heading.current?.focus();
  }, [phase, questionKey, lastMethod, state.draft]);

  const endButton = (
    <button type="button" className="ge-button" onClick={() => dispatch({ type: 'end' })}>
      {k['defense.end']}
    </button>
  );
  let panel;
  if (phase === 'summary') {
    panel = (
      <DefenseSummary
        ref={heading}
        locale={locale}
        fileLang={fileLang}
        source={view.defense?.summaryFrom ?? 'demo'}
        provider={k['defense.provider.gemini']}
        questions={(state.turns ?? []).map((t) => t.question)}
        summary={state.summary}
        onAgain={() => onAgain(locale)}
        onNew={() => onNew(locale)}
      />
    );
  } else if (phase === 'feedback' && state.reply) {
    const { reply } = state;
    panel = (
      <section className="gd-panel" aria-labelledby={panelId}>
        <h2 id={panelId} ref={heading} tabIndex={-1}>
          {m['reply.heading']}
        </h2>
        {reply.say.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        {reply.quote && <QuoteBlock locale={locale} quote={reply.quote} lang={fileLang} />}
        <div className="gd-actions">
          <button type="button" className="ge-button ge-button--primary" onClick={() => dispatch({ type: 'next' })}>
            {k['feedback.next']}
          </button>
          {endButton}
        </div>
      </section>
    );
  } else if (question && phase !== 'preparing') {
    const answerable = phase === 'asking' || phase === 'answering';
    const title = state.followUp
      ? m['question.followUp']
      : format(m['question.heading'], { n: String(state.questionIndex + 1), total: String(state.pack.questions.length) });
    panel = (
      <section className="gd-panel" aria-labelledby={panelId}>
        <h2 id={panelId} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <p>{question.prompt[locale]}</p>
        {question.source && <QuoteBlock locale={locale} quote={question.source.quote} lang={fileLang} />}
        <div ref={answerArea}>
          {phase === 'confirming' && state.candidate ? (
            <InlineConfirm
              locale={locale}
              candidate={state.candidate}
              onSend={(candidateId) => dispatch({ type: 'confirm', candidateId })}
              onEdit={() => dispatch({ type: 'edit' })}
              onRetry={() => dispatch({ type: 'retry' })}
            />
          ) : (
            answerable && (
              <>
                <KeyboardInput key={questionKey} locale={locale} onSubmit={keyboard.submit} draft={state.draft} />
                <VoiceInput
                  locale={locale}
                  voice={voiceView}
                  onListen={voice.listen}
                  onStop={voice.stopListening}
                  onPrivacy={() => setReadOnlyPrivacy(true)}
                />
              </>
            )
          )}
        </div>
        <div className="gd-actions">
          {answerable && (
            <button type="button" className="ge-button" onClick={() => dispatch({ type: 'skip' })}>
              {k['defense.skip']}
            </button>
          )}
          {endButton}
        </div>
      </section>
    );
  } else {
    panel = (
      <section className="gd-panel" aria-labelledby={panelId}>
        <h2 id={panelId} ref={heading} tabIndex={-1}>
          {m['preparing.heading']}
        </h2>
        <div className="gd-actions">{endButton}</div>
      </section>
    );
  }
  return (
    <AppShell
      title={m.title}
      locale={locale}
      // A browser without speech recognition gets a Preview session (Req 14.4, spec b Req 10.4).
      preview={config.preview || view.preview !== undefined}
      previewNote={view.preview ? k['shell.preview.missing.voice'] : undefined}
      soundControl={<SoundToggle locale={locale} sound={sound} onChange={speech.setOn} />}
      languageSwitch={
        <LanguageSwitch
          locale={locale}
          onChange={(next) => {
            dispatch({ type: 'locale-changed', locale: next });
            onLocale(next);
          }}
        />
      }
      motionControl={<MotionToggle locale={locale} paused={motionPaused} onChange={onMotionChange} />}
      onPrivacy={() => setReadOnlyPrivacy(true)}
    >
      <div className="gd-stage">
        <div className="gd-ghost">
          <Ghost ref={ghostRef} pose={pose} locale={locale} />
        </div>
        <Captions line={line} />
      </div>
      <ModeLabel locale={locale} mode={view.defense?.mode ?? 'demo'} provider={k['defense.provider.gemini']} />
      {panel}
      <Transcript lines={transcript} locale={locale} />
      <PrivacyDialog open={readOnlyPrivacy} locale={locale} mode="read-only" onAccept={() => {}} onDismiss={() => setReadOnlyPrivacy(false)} />
    </AppShell>
  );
}
