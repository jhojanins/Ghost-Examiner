import { format, kitMessages, type KitMessageKey, type Locale } from '@ghost-examiner/core';
import { useEffect, useId, useRef } from 'react';
import './tokens.css';
import './ConsentScreen.css';

export interface ConsentScreenProps {
  locale: Locale;
  /** The real provider this session would use. Only the site's proxy (Gemini) for now. */
  provider: 'proxy';
  onAI: () => void;
  onOffline: () => void;
}

const PROVIDER: Record<ConsentScreenProps['provider'], { name: KitMessageKey; dataUse: KitMessageKey }> = {
  proxy: { name: 'defense.provider.gemini', dataUse: 'defense.consent.dataUse.gemini' },
};

/**
 * Consent before anything leaves the device (ghost-defense-live Req 3.1, 3.2, design §6.1): who
 * answers, what is and is not sent, storage, the provider's data use and the practice label, as a
 * list; then two equal choices, neither preselected. Focus starts on the heading, so a screen
 * reader reads the points before the choices.
 */
export function ConsentScreen({ locale, provider, onAI, onOffline }: ConsentScreenProps) {
  const m = kitMessages[locale];
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const p = PROVIDER[provider];
  const points = [
    format(m['defense.consent.provider'], { provider: m[p.name] }),
    m['defense.consent.sent'],
    m['defense.consent.notSent'],
    m['defense.consent.storage'],
    m[p.dataUse],
    m['defense.consent.practice'],
  ];
  return (
    <section className="ge-consent" aria-labelledby={id}>
      <h2 id={id} ref={heading} tabIndex={-1} className="ge-consent-heading">
        {m['defense.consent.heading']}
      </h2>
      <ul className="ge-consent-points">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="ge-consent-actions">
        <button type="button" className="ge-button" onClick={onAI}>
          {m['defense.consent.ai']}
        </button>
        <button type="button" className="ge-button" onClick={onOffline}>
          {m['defense.consent.offline']}
        </button>
      </div>
    </section>
  );
}
