import type { InputAdapter, InputEvent } from './types';

export interface KeyboardAdapter extends InputAdapter {
  submit(text: string): { ok: true } | { ok: false; reason: 'empty' };
}

/** Keyboard text input (Req 6). The text field itself is `KeyboardInput` in packages/ui. */
export function createKeyboardAdapter(): KeyboardAdapter {
  let emit: ((e: InputEvent) => void) | undefined;
  return {
    id: 'keyboard',
    requires: { camera: false, microphone: false },
    experimental: false,
    supports: ['free-text', 'choice', 'yes-no'],
    checkAvailability: async () => ({ available: true }),
    start(_ctx, onEvent) {
      emit = onEvent;
    },
    stop() {
      emit = undefined;
    },
    submit(text) {
      const trimmed = text.trim();
      if (trimmed === '') return { ok: false, reason: 'empty' };
      emit?.({ type: 'candidate', candidate: { text: trimmed, method: 'keyboard' } });
      return { ok: true };
    },
  };
}
