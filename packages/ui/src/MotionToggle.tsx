import { kitMessages, type Locale } from '@ghost-examiner/core';
import './MotionToggle.css';
export interface MotionToggleProps {
  locale: Locale;
  /** True while the user has paused the ghost's motion. */
  paused: boolean;
  /** Called with the state the user asked for. */
  onChange: (paused: boolean) => void;
}
/**
 * "Pause motion" (design §5.4, Req 3.7, WCAG 2.2.2): a native toggle button with `aria-pressed`,
 * styled like the sound button. Pressed, `useGhostPose` stops floating and blinking whatever the
 * media query says. The choice lasts for the page only (no storage). On narrow screens the visible
 * label is short; the accessible name stays the full one.
 */
export function MotionToggle({ locale, paused, onChange }: MotionToggleProps) {
  const m = kitMessages[locale];
  return (
    <button
      type="button"
      className="ge-motion-button"
      aria-label={m['motion.label']}
      aria-pressed={paused}
      onClick={() => onChange(!paused)}
    >
      <span className="ge-motion-full">{m['motion.label']}</span>
      <span className="ge-motion-short">{m['motion.short']}</span>
    </button>
  );
}
