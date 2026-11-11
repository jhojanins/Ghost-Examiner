import { describe, expect, it } from 'vitest';
import type { Locale } from './i18n';
import { kitMessages } from './kit-messages';

describe('kitMessages', () => {
  // The feedback panel shows one summary, one strength and one improvement together.
  it.each<Locale>(['en', 'es'])('no two feedback lines shown together start with the same word (%s)', (locale) => {
    const m = kitMessages[locale];
    const pick = (group: string) =>
      (Object.keys(m) as (keyof typeof m)[]).filter((k) => k.startsWith(`feedback.${group}.`)).map((k) => m[k]);
    const firstWord = (line: string) => line.split(/[\s.,:!?]/)[0].toLowerCase();

    for (const summary of pick('summary')) {
      for (const strength of pick('strength')) {
        for (const improvement of pick('improvement')) {
          const starts = [summary, strength, improvement].map(firstWord);
          expect(new Set(starts).size, `${summary} | ${strength} | ${improvement}`).toBe(3);
        }
      }
    }
  });
});
