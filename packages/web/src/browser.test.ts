import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserLocale, systemClock } from './browser';

afterEach(() => vi.restoreAllMocks());

describe('browserLocale', () => {
  it("returns es for navigator.languages ['es-CO']", () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-CO']);
    expect(browserLocale()).toBe('es');
  });

  it('returns en for a browser that prefers neither language', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR', 'de']);
    expect(browserLocale()).toBe('en');
  });

  it('falls back to navigator.language when navigator.languages is missing', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(undefined as unknown as readonly string[]);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('es-MX');
    expect(browserLocale()).toBe('es');
  });
});

describe('systemClock', () => {
  it('reads performance.now()', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1234.5);
    expect(systemClock.now()).toBe(1234.5);
  });
});
