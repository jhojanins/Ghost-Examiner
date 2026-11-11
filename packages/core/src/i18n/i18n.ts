export type Locale = 'en' | 'es';
export type Localized<T> = Record<Locale, T>;
export type Catalog<K extends string> = Localized<Record<K, string>>;

/**
 * Pairs the English and Spanish catalogs. `es` must have exactly `en`'s keys (Req 9.3):
 * a missing key fails as a missing property, an extra key fails the excess-property check
 * on the object literal. `NoInfer` keeps `K` inferred from `en` only.
 */
export function defineCatalog<K extends string>(
  en: Record<K, string>,
  es: Record<NoInfer<K>, string>,
): Catalog<K> {
  return { en, es };
}

/** Replaces `{name}` placeholders; placeholders without a param stay as they are. */
export function format(template: string, params: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? params[name] : match,
  );
}

/** First preferred language whose primary subtag is `es` or `en`; otherwise `en` (Req 9.1). */
export function pickLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const language = tag.toLowerCase().split('-')[0];
    if (language === 'es' || language === 'en') return language;
  }
  return 'en';
}
