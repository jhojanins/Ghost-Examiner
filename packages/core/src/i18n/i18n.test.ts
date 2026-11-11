import { describe, expect, it } from 'vitest';
import { defineCatalog, format, pickLocale } from './i18n';

describe('pickLocale', () => {
  it.each([
    [['es-MX'], 'es'],
    [['en-GB'], 'en'],
    [['fr'], 'en'],
    [[], 'en'],
    [['fr-FR', 'es-CO', 'en-US'], 'es'],
  ] as const)('%j -> %s', (preferred, expected) => {
    expect(pickLocale(preferred)).toBe(expected);
  });
});

describe('format', () => {
  it('replaces every {name} placeholder with its param', () => {
    expect(format('You covered {point}. {point}!', { point: 'the result' })).toBe(
      'You covered the result. the result!',
    );
  });

  it('leaves placeholders without a param untouched', () => {
    expect(format('Add {point}.')).toBe('Add {point}.');
    expect(format('{constructor}', {})).toBe('{constructor}');
  });
});

describe('defineCatalog', () => {
  it('returns both locales', () => {
    expect(defineCatalog({ hi: 'Hi' }, { hi: 'Hola' })).toEqual({ en: { hi: 'Hi' }, es: { hi: 'Hola' } });
  });

  // These are checked by `pnpm typecheck`: an unused @ts-expect-error is itself an error (Req 9.3).
  it('rejects a key missing from es at compile time', () => {
    // @ts-expect-error: es lacks "bye"
    defineCatalog({ hi: 'Hi', bye: 'Bye' }, { hi: 'Hola' });
  });

  it('rejects an extra key in es at compile time', () => {
    // @ts-expect-error: es has "extra", which en lacks
    defineCatalog({ hi: 'Hi' }, { hi: 'Hola', extra: 'Extra' });
  });
});
