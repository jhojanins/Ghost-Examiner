import { kitMessages, type Locale } from '@ghost-examiner/core';
import './LanguageSwitch.css';

export interface LanguageSwitchProps {
  locale: Locale;
  /** Called only with a language different from the current one. */
  onChange: (locale: Locale) => void;
}

const LOCALES: readonly Locale[] = ['en', 'es'];

/**
 * Two native toggle buttons (Req 9.2, design §5.1). `aria-pressed` gives the state to
 * assistive tech; each label carries its own `lang` so it is read in its own language
 * (WCAG 3.1.2). Goes in AppShell's `languageSwitch` slot.
 */
export function LanguageSwitch({ locale, onChange }: LanguageSwitchProps) {
  const m = kitMessages[locale];
  return (
    <div role="group" aria-label={m['language.label']} className="ge-language-switch">
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={option === locale}
          className="ge-language-button"
          onClick={() => option !== locale && onChange(option)}
        >
          {m[`language.${option}`]}
        </button>
      ))}
    </div>
  );
}
