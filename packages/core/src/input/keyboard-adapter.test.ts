import { describe, expect, it, vi } from 'vitest';
import { createKeyboardAdapter } from './keyboard-adapter';
import type { InputContext } from './types';

const ctx: InputContext = { question: { id: 'q1', kind: 'free-text' }, locale: 'en' };

function started() {
  const adapter = createKeyboardAdapter();
  const emit = vi.fn();
  adapter.start(ctx, emit);
  return { adapter, emit };
}

describe('createKeyboardAdapter', () => {
  it('rejects whitespace-only text without emitting', () => {
    const { adapter, emit } = started();
    expect(adapter.submit('  ')).toEqual({ ok: false, reason: 'empty' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits one trimmed keyboard candidate', () => {
    const { adapter, emit } = started();
    expect(adapter.submit(' Hi ')).toEqual({ ok: true });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ type: 'candidate', candidate: { text: 'Hi', method: 'keyboard' } });
  });

  it('supports every answer kind and needs no hardware', async () => {
    const adapter = createKeyboardAdapter();
    expect(adapter.supports).toEqual(['free-text', 'choice', 'yes-no']);
    expect(adapter.requires).toEqual({ camera: false, microphone: false });
    await expect(adapter.checkAvailability()).resolves.toEqual({ available: true });
  });

  it('stops emitting after stop()', () => {
    const { adapter, emit } = started();
    adapter.stop();
    adapter.submit('Hi');
    expect(emit).not.toHaveBeenCalled();
  });
});
