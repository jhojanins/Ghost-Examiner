import { describe, expect, it } from 'vitest';
import { pickVoice, type VoiceInfo } from './voices';

const voice = (name: string, lang: string, extra: Partial<VoiceInfo> = {}): VoiceInfo => ({
  name,
  lang,
  localService: true,
  isDefault: false,
  ...extra,
});

describe('pickVoice', () => {
  it('never chooses a network voice, even the default one', () => {
    const network = voice('Google español', 'es-ES', { localService: false, isDefault: true });
    const local = voice('Mónica', 'es-ES');
    expect(pickVoice([network, local], 'es', [])).toBe(local);
    expect(pickVoice([network], 'es', ['es-ES'])).toBeUndefined();
  });

  it('normalizes "es_MX" (Android style) and matches the preferred region', () => {
    const spain = voice('Mónica', 'es-ES', { isDefault: true });
    const mexico = voice('Paulina', 'es_MX');
    expect(pickVoice([spain, mexico], 'es', ['es-MX', 'en-US'])).toBe(mexico);
    expect(pickVoice([spain, mexico], 'es', ['ES-mx'])).toBe(mexico); // tags compare case-insensitively
  });

  it('uses the first preferred tag of the requested language only', () => {
    // "Alma" would win on name, so only the region rule can pick Argentina.
    const argentina = voice('Diego', 'es-AR');
    const mexico = voice('Alma', 'es-MX');
    expect(pickVoice([mexico, argentina], 'es', ['en-GB', 'es-AR', 'es-MX'])).toBe(argentina);
  });

  it('prefers the default voice when no region matches', () => {
    const us = voice('Alex', 'en-US');
    const uk = voice('Daniel', 'en-GB', { isDefault: true });
    expect(pickVoice([us, uk], 'en', ['es-MX'])).toBe(uk);
  });

  it('breaks the remaining ties by name, then by lang', () => {
    const zoe = voice('Zoe', 'en-US');
    const alexUs = voice('Alex', 'en-US');
    const alexAu = voice('Alex', 'en-AU');
    expect(pickVoice([zoe, alexUs, alexAu], 'en', [])).toBe(alexAu);
  });

  it('gives the same voice in any input order when only the tag spelling differs', () => {
    const underscore = voice('Paulina', 'es_MX');
    const dash = voice('Paulina', 'es-mx');
    expect(pickVoice([underscore, dash], 'es', [])).toBe(pickVoice([dash, underscore], 'es', []));
  });

  it('matches the primary language subtag exactly', () => {
    const french = voice('Thomas', 'fr-FR');
    const english = voice('Alex', 'en');
    expect(pickVoice([french, english], 'es', ['es-MX'])).toBeUndefined();
    expect(pickVoice([french, english], 'en', [])).toBe(english);
  });

  it('returns undefined for an empty voice list', () => {
    expect(pickVoice([], 'en', ['en-US'])).toBeUndefined();
  });
});
