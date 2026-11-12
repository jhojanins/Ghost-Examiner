import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n/i18n';
import { pickVoice, type VoiceInfo } from './voices';

// Small pools so names, tags and flags collide often (ties are where ranking bugs hide).
const voice: fc.Arbitrary<VoiceInfo> = fc.record({
  name: fc.constantFrom('Alex', 'Daniel', 'Mónica', 'Paulina', 'Zoe', 'Google español'),
  lang: fc.constantFrom('en-US', 'en_GB', 'EN-au', 'en', 'es-ES', 'es_MX', 'es-mx', 'es-419', 'es', 'fr-FR', 'de-DE'),
  localService: fc.boolean(),
  isDefault: fc.boolean(),
});
const voices = fc.array(voice, { maxLength: 12 });
const locale = fc.constantFrom<Locale>('en', 'es');
const preferred = fc.array(fc.constantFrom('es-MX', 'es-AR', 'ES-mx', 'en-GB', 'en-US', 'es', 'fr-CA', 'de'), {
  maxLength: 4,
});

const norm = (tag: string) => tag.toLowerCase().replace(/_/g, '-');
const primary = (tag: string) => norm(tag).split('-')[0];
const candidates = (vs: VoiceInfo[], loc: Locale) => vs.filter((v) => v.localService && primary(v.lang) === loc);

/** A random permutation of `xs`, from one random sort key per element. */
const shuffled = <T>(xs: T[], keys: number[]) =>
  xs
    .map((x, i) => ({ x, k: keys[i] ?? 0, i }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((e) => e.x);

describe('pickVoice properties', () => {
  it('P10: deterministic and order-independent; a local voice of the language or undefined exactly when none exists; the preferred region wins', () => {
    let regionHits = 0;
    fc.assert(
      fc.property(voices, locale, preferred, fc.array(fc.integer(), { maxLength: 12 }), (vs, loc, pref, keys) => {
        const chosen = pickVoice(vs, loc, pref);

        expect(pickVoice(vs, loc, pref)).toBe(chosen);
        expect(pickVoice(shuffled(vs, keys), loc, pref)).toEqual(chosen);

        const pool = candidates(vs, loc);
        if (pool.length === 0) {
          expect(chosen).toBeUndefined();
          return;
        }
        expect(chosen).toBeDefined();
        expect(vs).toContain(chosen);
        expect(chosen!.localService).toBe(true);
        expect(primary(chosen!.lang)).toBe(loc);

        const wanted = pref.map(norm).find((tag) => primary(tag) === loc);
        if (wanted && pool.some((v) => norm(v.lang) === wanted)) {
          expect(norm(chosen!.lang)).toBe(wanted);
          regionHits++;
        }
      }),
      { numRuns: 300 },
    );
    expect(regionHits).toBeGreaterThan(0); // the preferred-region rule was exercised
  });
});
