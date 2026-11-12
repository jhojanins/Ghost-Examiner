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

describe('kitMessages: honest voice and privacy copy (spec b task 31, Req 9)', () => {
  const all = (locale: Locale) => Object.values(kitMessages[locale]).join('\n');

  it('the old "not sent to any server" sentences are gone from both catalogs (they would contradict voice input)', () => {
    expect(all('en')).not.toContain('Your answers are not sent to any server');
    expect(all('es')).not.toContain('Tus respuestas no se envían a ningún servidor');
    expect(all('en')).not.toContain('runs entirely in your browser');
    expect(all('es')).not.toContain('funciona por completo en tu navegador');
  });

  it.each<[Locale, string[]]>([
    ['en', ['may send your voice', 'Google for Chrome', 'Apple for Safari', 'only receives the text', 'never records or stores audio', 'only when you press the voice button', 'typing always works']],
    ['es', ['puede enviar tu voz', 'Google en Chrome', 'Apple en Safari', 'solo recibe el texto', 'nunca graba ni guarda audio', 'solo cuando presionas el botón de voz', 'escribir siempre funciona']],
  ])('the voice privacy point (%s) names who may hear the voice, what the app gets, and when the microphone is asked for', (locale, parts) => {
    for (const part of parts) expect(kitMessages[locale]['privacy.voice']).toContain(part);
  });

  it.each<Locale>(['en', 'es'])('the short note next to the voice button (%s) makes the same point', (locale) => {
    expect(kitMessages[locale]['voice.note']).toMatch(locale === 'en' ? /may send your voice/ : /puede enviar tu voz/);
  });

  it.each<Locale>(['en', 'es'])('no voice copy claims recognition happens on the device (%s, Req 9.4)', (locale) => {
    const voiceCopy = Object.entries(kitMessages[locale])
      .filter(([key]) => key.startsWith('voice.') || key === 'privacy.voice')
      .map(([, text]) => text.toLowerCase());
    for (const text of voiceCopy) expect(text).not.toMatch(/on (your|the) device|en tu dispositivo|offline|sin conexión/);
  });
});
