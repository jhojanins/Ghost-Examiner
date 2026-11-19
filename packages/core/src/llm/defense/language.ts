import type { Locale } from '../../i18n/i18n';

// Common function words that belong to one language only ("no", "a" and "me" are in both, so they are left out).
const STOPWORDS: Record<Locale, ReadonlySet<string>> = {
  en: new Set('the and is are was were of to in that this you your it for with what why how does did be on as but which would can could there their'.split(' ')),
  es: new Set('el la los las y es son era de del que en un una por para con tu tus qué cómo se su lo al más pero como esto este esta dice archivo'.split(' ')),
};

/**
 * False only when `text` is clearly in the other interface language: at least 3 of its function
 * words and at least twice as many as the requested language's (Req 14.1). Short sentences and a
 * short quoted phrase from a file in the other language pass.
 */
export function inLanguage(text: string, locale: Locale): boolean {
  const other: Locale = locale === 'en' ? 'es' : 'en';
  const tokens = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const count = (l: Locale) => tokens.filter((t) => STOPWORDS[l].has(t)).length;
  const theirs = count(other);
  return !(theirs >= 3 && theirs >= 2 * count(locale));
}
