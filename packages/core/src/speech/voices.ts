import type { Locale } from '../i18n/i18n';

/** The parts of a `SpeechSynthesisVoice` the choice needs; the web package maps real voices to this. */
export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  isDefault: boolean;
}

/** "es_MX" (Android) and "ES-mx" both become "es-mx". */
const normalize = (tag: string) => tag.toLowerCase().replace(/_/g, '-');
const primary = (tag: string) => normalize(tag).split('-')[0];

/** Speech recognition language when the browser prefers no region (neutral Latin American Spanish, ghost-persona). */
const DEFAULT_SPEECH_LANG: Record<Locale, string> = { en: 'en-US', es: 'es-MX' };

/** "ES_mx" → "es-MX": lowercase language, uppercase two-letter region, other subtags as they are. */
const bcp47 = (tag: string) =>
  normalize(tag)
    .split('-')
    .map((part, i) => (i > 0 && part.length === 2 ? part.toUpperCase() : part))
    .join('-');

/**
 * The language tag to listen in (spec b design §2.2, Req 4.6): the first preferred browser tag of
 * `locale`'s language, so a user in Argentina is heard as es-AR, else en-US or es-MX.
 */
export function speechLang(locale: Locale, preferred: readonly string[]): string {
  const tag = preferred.find((t) => primary(t) === locale);
  return tag ? bcp47(tag) : DEFAULT_SPEECH_LANG[locale];
}

/** Plain code-unit order, so the result never depends on the runtime's locale. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The ghost's voice for `locale` (spec b design §2.2, Req 1.3), or undefined when there is none.
 * Only local voices (`localService`) of that language qualify, so the line's text is spoken on the
 * device. Ranking: the voice whose tag equals the first preferred tag of that language, then the
 * browser's default voice, then name, then tag. That is a total order, so the input order never
 * changes the result (P10).
 */
export function pickVoice(voices: readonly VoiceInfo[], locale: Locale, preferred: readonly string[]): VoiceInfo | undefined {
  const wanted = preferred.map(normalize).find((tag) => primary(tag) === locale);
  const rank = (v: VoiceInfo) => (wanted !== undefined && normalize(v.lang) === wanted ? 0 : 1);
  return voices
    .filter((v) => v.localService && primary(v.lang) === locale)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(b.isDefault) - Number(a.isDefault) ||
        compare(a.name, b.name) ||
        compare(normalize(a.lang), normalize(b.lang)) ||
        compare(a.lang, b.lang),
    )[0];
}
