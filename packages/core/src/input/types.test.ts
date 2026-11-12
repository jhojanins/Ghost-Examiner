import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Locale } from '../i18n/i18n';
import { createKeyboardAdapter } from './keyboard-adapter';
import type { InputAdapter, InputEvent } from './types';

// Type checks run in `pnpm typecheck` (tsc); the `@ts-expect-error` lines fail it if the error goes away.
describe('input types (spec b task 22, design §2.1)', () => {
  it('a partial event is an InputEvent carrying all the text recognized so far', () => {
    const partial: InputEvent = { type: 'partial', text: 'I fixed the' };
    expectTypeOf(partial).toExtend<InputEvent>();
    expect(partial.type).toBe('partial');
    // @ts-expect-error a partial event needs its text
    const missing: InputEvent = { type: 'partial' };
    // @ts-expect-error unknown event types are still rejected
    const unknown: InputEvent = { type: 'status', status: 'listening' };
    void missing;
    void unknown;
  });

  it('setLocale is optional: the keyboard adapter has none and is still an InputAdapter', () => {
    const keyboard: InputAdapter = createKeyboardAdapter();
    expect(keyboard.setLocale).toBeUndefined();
    expectTypeOf<InputAdapter['setLocale']>().toEqualTypeOf<((locale: Locale) => void) | undefined>();
  });
});
