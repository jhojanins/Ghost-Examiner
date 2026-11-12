import { kitMessages, type Availability, type KitMessageKey, type Locale } from '@ghost-examiner/core';
import { useId, useState } from 'react';
import './tokens.css';
import './VoiceInput.css';

/** What the voice answer shows; `VoiceView` from @ghost-examiner/web has this shape (ui does not depend on web). */
export interface VoiceInputState {
  availability: Availability;
  listening: boolean;
  final: string;
  interim: string;
  error?: KitMessageKey;
}

export interface VoiceInputProps {
  locale: Locale;
  voice: VoiceInputState;
  /** Start listening (the voice adapter's `listen`). */
  onListen: () => void;
  /** Stop listening; the answer then goes to confirmation (the voice adapter's `stopListening`). */
  onStop: () => void;
  /** Opens the privacy notice (Req 9.5). */
  onPrivacy: () => void;
}

/** Every message the status can show; hidden copies reserve the room of the longest one (no layout shift). */
const MESSAGES = [
  'voice.listening',
  'voice.stopped',
  'voice.unavailable',
  'voice.empty',
  'voice.error.permission',
  'voice.error.noMic',
  'voice.error.network',
  'voice.error.language',
  'voice.error.service',
] as const satisfies readonly KitMessageKey[];

const isKitKey = (key: string): key is KitMessageKey => key in kitMessages.en;

/**
 * Voice answer (spec b design §4, Req 4.4, 4.5, 5, 9.5): one native button that starts and stops
 * listening (it keeps focus; its label changes), a status line, a privacy note, and "Your words".
 *
 * - One polite live region, always rendered, carries every message: "Listening…", "Stopped
 *   listening.", the reason voice is unavailable, or an error. It changes only when the message
 *   does, so each is announced once; partial text never is (Req 5.3).
 * - Hidden copies of every message share the status's grid cell, so messages coming and going never
 *   move anything (as in task 19b).
 * - Listening is shown by words ("Listening…", "Stop speaking") and by the button's sign changing
 *   from a round "record" dot to a square "stop" sign: never by color alone (Req 4.5). No animation.
 * - Unavailable (no API, or Brave): the button stays, focusable, with `aria-disabled` and a dashed
 *   border, and the reason is the status, so keyboard and screen reader users still reach it.
 * - "Your words" keeps the room of three lines; final text is plain, interim text is italic with a
 *   dotted underline (Req 5.2), in the answer's language (Req 5.4), and is not a live region.
 */
export function VoiceInput({ locale, voice, onListen, onStop, onPrivacy }: VoiceInputProps) {
  const m = kitMessages[locale];
  const headingId = useId();
  const statusId = useId();
  const unavailable = !voice.availability.available;

  // "Stopped listening." only after the user has listened once (derived state, set during render).
  const [listenedOnce, setListenedOnce] = useState(false);
  if (voice.listening && !listenedOnce) setListenedOnce(true);

  let status = '';
  if (!voice.availability.available) {
    status = m[isKitKey(voice.availability.reason) ? voice.availability.reason : 'voice.unavailable'];
  } else if (voice.error) status = m[voice.error];
  else if (voice.listening) status = m['voice.listening'];
  else if (listenedOnce) status = m['voice.stopped'];

  return (
    <section className="ge-voice" aria-labelledby={headingId}>
      <h2 id={headingId} className="ge-voice-heading">
        {m['voice.heading']}
      </h2>
      <button
        type="button"
        className="ge-button ge-voice-button"
        aria-disabled={unavailable || undefined}
        aria-describedby={statusId}
        data-listening={voice.listening || undefined}
        onClick={() => {
          if (unavailable) return;
          if (voice.listening) onStop();
          else onListen();
        }}
      >
        <span className="ge-voice-sign" aria-hidden="true" />
        {voice.listening ? m['voice.stop'] : m['voice.start']}
      </button>
      <div className="ge-voice-messages">
        {MESSAGES.map((key) => (
          <span key={key} className="ge-voice-sizer" aria-hidden="true">
            {m[key]}
          </span>
        ))}
        <p id={statusId} className="ge-voice-status" aria-live="polite">
          {status}
        </p>
      </div>
      <p className="ge-voice-note">
        {m['voice.note']}{' '}
        <button type="button" className="ge-link-button" onClick={onPrivacy}>
          {m['shell.privacy']}
        </button>
      </p>
      <div className="ge-voice-words">
        <p className="ge-voice-words-label">
          {m['voice.yourWords']}
        </p>
        <p className="ge-voice-words-text" lang={locale}>
          <span className="ge-voice-final">{voice.final}</span>
          {voice.final && voice.interim ? ' ' : null}
          <span className="ge-voice-interim">{voice.interim}</span>
        </p>
      </div>
    </section>
  );
}
