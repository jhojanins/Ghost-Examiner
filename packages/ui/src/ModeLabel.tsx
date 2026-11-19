import { format, kitMessages, type Locale } from '@ghost-examiner/core';
import './tokens.css';
import './QuoteBlock.css';

export interface ModeLabelProps {
  locale: Locale;
  mode: 'ai' | 'demo';
  /** The AI provider's name, shown in AI mode. */
  provider?: string;
}

/**
 * Who answers right now (ghost-defense-live Req 10.3): the AI provider by name, or, after a
 * fallback, the persistent demo label. One polite region, so a switch to demo is announced once.
 */
export function ModeLabel({ locale, mode, provider = '' }: ModeLabelProps) {
  const m = kitMessages[locale];
  return (
    <p className="ge-mode-label" aria-live="polite">
      {mode === 'demo' ? m['defense.demoLabel'] : format(m['defense.mode.ai'], { provider })}
    </p>
  );
}
