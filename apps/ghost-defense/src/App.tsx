import type { GhostState, Locale } from '@ghost-examiner/core';
import { AppShell, Ghost, LanguageSwitch, PrivacyDialog, useGhostPose } from '@ghost-examiner/ui';
import { browserLocale } from '@ghost-examiner/web';
import { useId, useState } from 'react';
import { config } from './config';
import { messages } from './messages';
import './App.css';

const IDLE: GhostState = { activity: 'idle', expression: 'neutral', seed: 11 };

/** The ghost-defense shell (Req 11.2): same kit shell and ghost, own title and accent, no session. */
export function App() {
  const [locale, setLocale] = useState<Locale>(browserLocale);
  const [privacy, setPrivacy] = useState(false);
  const m = messages[locale];
  const headingId = useId();
  const { ref, pose } = useGhostPose(IDLE);

  return (
    <AppShell
      title={m.title}
      locale={locale}
      preview={config.preview}
      previewNote={m.previewNote}
      languageSwitch={<LanguageSwitch locale={locale} onChange={setLocale} />}
      onPrivacy={() => setPrivacy(true)}
    >
      <div className="gd-ghost">
        <Ghost ref={ref} pose={pose} locale={locale} />
      </div>
      <section className="gd-panel" aria-labelledby={headingId}>
        <h2 id={headingId}>{m['wip.heading']}</h2>
        <p>{m['wip.text']}</p>
        {/* Relative, so it also works when the site is served from a sub-path (GitHub Pages mirror). */}
        <a className="gd-link" href="../interview/">
          {m['wip.link']}
        </a>
      </section>
      <PrivacyDialog open={privacy} locale={locale} mode="read-only" onAccept={() => {}} onDismiss={() => setPrivacy(false)} />
    </AppShell>
  );
}
