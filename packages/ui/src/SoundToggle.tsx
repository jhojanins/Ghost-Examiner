import { kitMessages, type Locale } from '@ghost-examiner/core';
import { useId } from 'react';
import './SoundToggle.css';

/** Sound state; `SoundView` from @ghost-examiner/web has this shape (ui does not depend on web). */
export interface SoundState {
  on: boolean;
  reason?: 'no-api' | 'no-voice' | 'failed';
}

export interface SoundToggleProps {
  locale: Locale;
  sound: SoundState;
  /** Called with the state the user asked for. */
  onChange: (on: boolean) => void;
}

const REASON = { 'no-api': 'sound.noApi', 'no-voice': 'sound.noVoice', failed: 'sound.failed' } as const;

/**
 * The ghost's voice on or off (spec b design §4, Req 1.4, 1.6, 2.1): a native toggle button with
 * `aria-pressed`, styled like the language switch. The reason sound can't play sits in a polite
 * status that is always rendered, so a reason that appears later (a failure mid-session) is
 * announced once; it also describes the button. Without a speech API the button stays focusable
 * with `aria-disabled`, so keyboard and screen reader users still reach the reason.
 */
export function SoundToggle({ locale, sound, onChange }: SoundToggleProps) {
  const m = kitMessages[locale];
  const statusId = useId();
  const unavailable = sound.reason === 'no-api';
  return (
    <div className="ge-sound">
      <button
        type="button"
        className="ge-sound-button"
        aria-pressed={sound.on}
        aria-disabled={unavailable || undefined}
        aria-describedby={statusId}
        onClick={() => !unavailable && onChange(!sound.on)}
      >
        {m['sound.label']}
      </button>
      <p id={statusId} className="ge-sound-status" aria-live="polite">
        {sound.reason && m[REASON[sound.reason]]}
      </p>
    </div>
  );
}
