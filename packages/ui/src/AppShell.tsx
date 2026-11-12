import { kitMessages, type Locale } from '@ghost-examiner/core';
import { useEffect, type ReactNode } from 'react';
import './tokens.css';
import './AppShell.css';

export interface AppShellProps {
  /** App title, already localized by the app. */
  title: string;
  locale: Locale;
  /** Preview build (Req 11.5): shows the Preview label and why, on every screen. */
  preview: boolean;
  /** Replaces the kit's Preview explanation when it would not be true for this app. */
  previewNote?: string;
  /** Slot for the SoundToggle (spec b Req 2.1): same place on every screen, before the language switch. */
  soundControl?: ReactNode;
  /** Slot for the LanguageSwitch (task 17). */
  languageSwitch?: ReactNode;
  /** Slot for the MotionToggle (spec a Req 3.7): after the language switch, before privacy. */
  motionControl?: ReactNode;
  /** Opens the privacy notice; same place on every screen (Req 10.4, WCAG 3.2.6). */
  onPrivacy: () => void;
  children: ReactNode;
}

const MAIN_ID = 'main-content';

/** Page frame shared by both apps (design §5.1): skip link, header, and <main>. */
export function AppShell({
  title,
  locale,
  preview,
  previewNote,
  soundControl,
  languageSwitch,
  motionControl,
  onPrivacy,
  children,
}: AppShellProps) {
  const m = kitMessages[locale];

  // Keeps <html lang> in step with the UI language (Req 9.2, WCAG 3.1.1).
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <>
      <a className="ge-skip-link" href={`#${MAIN_ID}`}>
        {m['shell.skipLink']}
      </a>
      <header className="ge-header">
        <h1 className="ge-title">{title}</h1>
        {preview && (
          <p className="ge-preview">
            <strong className="ge-preview-badge">{m['shell.preview.badge']}</strong>
            <span className="ge-preview-detail">{previewNote ?? m['shell.preview.detail']}</span>
          </p>
        )}
        <div className="ge-header-actions">
          {soundControl}
          {languageSwitch}
          {motionControl}
          <button type="button" className="ge-link-button" onClick={onPrivacy}>
            {m['shell.privacy']}
          </button>
        </div>
      </header>
      {/* tabIndex -1 lets the skip link move focus here. */}
      <main id={MAIN_ID} tabIndex={-1} className="ge-main">
        {children}
      </main>
    </>
  );
}
