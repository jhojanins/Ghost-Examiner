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

const REASON = { 'no-voice': 'sound.noVoice', failed: 'sound.failed', 'no-api': 'sound.noApi' } as const;

/**
 * The ghost's voice on or off (spec b design §4, Req 1.4, 1.6, 2.1): a native toggle button with
 * `aria-pressed`, styled like the language switch.
 *
 * - The reason sound can't play sits in a polite status that is always rendered, so a reason that
 *   appears later (a failure mid-session) is announced once; it also describes the button.
 * - No layout shift (task 19b): hidden copies of every reason share the status's grid cell, so its
 *   box is always as tall as the longest reason, whatever the width or text size.
 * - Any reason makes the button look unavailable (dashed border, no fill), while `aria-pressed`
 *   keeps the user's choice. Without a speech API it also has `aria-disabled` but stays focusable.
 * - On narrow screens the visible label is short ("Voice"); the accessible name stays the full one.
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
        aria-label={m['sound.label']}
        aria-pressed={sound.on}
        aria-disabled={unavailable || undefined}
        aria-describedby={statusId}
        data-reason={sound.reason}
        onClick={() => !unavailable && onChange(!sound.on)}
      >
        <span className="ge-sound-full">{m['sound.label']}</span>
        <span className="ge-sound-short">{m['sound.short']}</span>
      </button>
      <div className="ge-sound-reason">
        {Object.values(REASON).map((key) => (
          <span key={key} className="ge-sound-sizer" aria-hidden="true">
            {m[key]}
          </span>
        ))}
        <p id={statusId} className="ge-sound-status" aria-live="polite">
          {sound.reason && m[REASON[sound.reason]]}
        </p>
      </div>
    </div>
  );
}
