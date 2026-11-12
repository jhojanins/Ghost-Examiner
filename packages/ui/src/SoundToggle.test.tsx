import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundToggle, type SoundToggleProps } from './SoundToggle';

afterEach(cleanup);

function setup(props: Partial<SoundToggleProps> = {}) {
  const onChange = vi.fn();
  const all: SoundToggleProps = { locale: 'en', sound: { on: true }, onChange, ...props };
  const view = render(<SoundToggle {...all} />);
  const rerender = (next: Partial<SoundToggleProps>) => view.rerender(<SoundToggle {...all} {...next} />);
  return { ...view, rerender, onChange };
}
const status = () => document.querySelector('[aria-live="polite"]') as HTMLElement;

describe('SoundToggle', () => {
  it('is a native toggle button whose aria-pressed reflects on, labeled in EN and ES', () => {
    const { rerender } = setup();
    const button = screen.getByRole('button', { name: 'Ghost voice', pressed: true });
    // A native <button type="button">: browsers activate it with Enter and Space. jsdom does not
    // turn key presses into clicks, so the real keys are checked in the task 19 browser walk-through.
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button.getAttribute('type')).toBe('button');

    rerender({ sound: { on: false } });
    expect(screen.getByRole('button', { name: 'Ghost voice', pressed: false })).toBe(button);
    rerender({ locale: 'es' });
    expect(screen.getByRole('button', { name: 'Voz del fantasma' })).toBe(button);
  });

  it('activating it asks for the opposite state', () => {
    const { onChange, rerender } = setup();
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenLastCalledWith(false);
    rerender({ sound: { on: false, reason: 'failed' } });
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenLastCalledWith(true); // turning sound on again after a failure (Req 1.6)
  });

  it.each([
    ['no-voice', 'en', 'This browser has no voice for this language, so the ghost speaks with captions only.'],
    ['failed', 'en', 'The voice stopped working, so it is off. Captions continue. You can turn it on again.'],
    ['no-voice', 'es', 'Este navegador no tiene voz para este idioma, así que el fantasma habla solo con subtítulos.'],
    ['failed', 'es', 'La voz dejó de funcionar, así que está apagada. Los subtítulos siguen. Puedes volver a encenderla.'],
  ] as const)('shows the %s reason in %s, describing the button', (reason, locale, text) => {
    setup({ locale, sound: { on: reason !== 'failed', reason } });
    expect(status().textContent).toBe(text);
    const button = screen.getByRole('button');
    expect(document.getElementById(button.getAttribute('aria-describedby')!)).toBe(status());
  });

  it('a reason that appears later is announced once through the polite status, which is always there', () => {
    const { rerender } = setup();
    expect(status().textContent).toBe('');
    rerender({ sound: { on: false, reason: 'failed' } });
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(status().textContent).toContain('The voice stopped working');
    rerender({ sound: { on: true } });
    expect(status().textContent).toBe('');
  });

  it('without a speech API it stays focusable but unavailable, and says why', () => {
    const { onChange } = setup({ sound: { on: false, reason: 'no-api' } });
    const button = screen.getByRole('button', { name: 'Ghost voice' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false); // still reachable by Tab, so the reason is heard
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
    expect(status().textContent).toBe("This browser can't speak aloud, so the ghost speaks with captions only.");
  });
});
