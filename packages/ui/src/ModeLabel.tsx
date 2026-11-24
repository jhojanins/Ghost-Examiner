import { format, kitMessages, type Locale } from '@ghost-examiner/core';
import './tokens.css';
import './QuoteBlock.css';

export interface ModeLabelProps {
  locale: Locale;
  /** `mixed`: some questions or replies came from the demo rules and the rest from AI. */
  mode: 'ai' | 'demo' | 'mixed' | 'turn-demo';
  /** The AI provider's name, shown in AI mode. */
  provider?: string;
}

/**
 * Who answers (ghost-defense-live Req 10.3): the AI provider by name, the demo label, or a mixed
 * label when some questions or replies came from the demo rules (after a fallback, or demo
 * questions filling in for dropped ones) and the rest from AI. It stays for the session. One
 * polite region, so a change is announced once.
 */
export function ModeLabel({ locale, mode, provider = '' }: ModeLabelProps) {
  const m = kitMessages[locale];
  return (
    <p className="ge-mode-label" aria-live="polite">
      {mode === 'demo'
        ? m['defense.demoLabel']
        : mode === 'turn-demo'
          ? m['defense.mode.turnDemo']
          : format(m[mode === 'mixed' ? 'defense.mode.mixed' : 'defense.mode.ai'], { provider })}
    </p>
  );
}
