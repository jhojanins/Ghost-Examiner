import { pickLocale, type Clock, type Locale } from '@ghost-examiner/core';

/** Page clock in ms, monotonic (not affected by system clock changes). */
export const systemClock: Clock = { now: () => performance.now() };

/** Spanish or English from the browser's preferred languages, else English (Req 9.1). */
export function browserLocale(): Locale {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return pickLocale(preferred.filter(Boolean));
}
