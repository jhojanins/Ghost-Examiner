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
