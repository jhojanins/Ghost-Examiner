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
const REASONS = {
  en: {
    'no-voice': 'No voice for this language.',
    failed: 'The voice failed. Turn it on again.',
    'no-api': "This browser can't speak aloud.",
  },
  es: {
    'no-voice': 'No hay voz para este idioma.',
    failed: 'La voz falló. Vuelve a encenderla.',
    'no-api': 'Este navegador no puede hablar.',
  },
} as const;

describe('SoundToggle', () => {
  it('is a native toggle button whose aria-pressed reflects on, named in full in EN and ES', () => {
    const { rerender } = setup();
    const button = screen.getByRole('button', { name: 'Ghost voice', pressed: true });
    // A native <button type="button">: Enter and Space were checked in the task 19 browser walk-through.
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button.getAttribute('type')).toBe('button');

    rerender({ sound: { on: false } });
    expect(screen.getByRole('button', { name: 'Ghost voice', pressed: false })).toBe(button);
    rerender({ locale: 'es' });
    expect(screen.getByRole('button', { name: 'Voz del fantasma' })).toBe(button);
  });

  it('shows a full and a short visible label; the short one is part of the accessible name (WCAG 2.5.3)', () => {
    const { rerender } = setup();
    const button = screen.getByRole('button');
    expect(button.querySelector('.ge-sound-full')?.textContent).toBe('Ghost voice');
    expect(button.querySelector('.ge-sound-short')?.textContent).toBe('Voice');
    expect(button.getAttribute('aria-label')!.toLowerCase()).toContain('voice');
    rerender({ locale: 'es' });
    expect(button.querySelector('.ge-sound-short')?.textContent).toBe('Voz');
    expect(button.getAttribute('aria-label')).toMatch(/^Voz/);
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
    ['no-voice', 'en'],
    ['failed', 'en'],
    ['no-api', 'en'],
    ['no-voice', 'es'],
    ['failed', 'es'],
    ['no-api', 'es'],
  ] as const)('shows the %s reason in %s, describing the button', (reason, locale) => {
    setup({ locale, sound: { on: reason === 'no-voice', reason } });
    expect(status().textContent).toBe(REASONS[locale][reason]);
    const button = screen.getByRole('button');
    expect(document.getElementById(button.getAttribute('aria-describedby')!)).toBe(status());
  });

  it('marks the button as unavailable in every reason state, while aria-pressed keeps the user choice (task 19b)', () => {
    const { rerender } = setup();
    const button = screen.getByRole('button');
    expect(button.hasAttribute('data-reason')).toBe(false); // on: filled
    rerender({ sound: { on: false } });
    expect(button.hasAttribute('data-reason')).toBe(false); // off: outlined
    for (const [reason, on] of [['no-voice', true], ['failed', false], ['no-api', false]] as const) {
      rerender({ sound: { on, reason } });
      expect(button.getAttribute('data-reason')).toBe(reason);
      expect(button.getAttribute('aria-pressed')).toBe(String(on));
    }
  });

  it('reserves room for the longest reason: one hidden copy of each, outside the accessibility tree (task 19b)', () => {
    const { rerender } = setup();
    const sizers = [...document.querySelectorAll('.ge-sound-sizer')];
    expect(sizers.map((s) => s.textContent)).toEqual(Object.values(REASONS.en));
    for (const sizer of sizers) {
      expect(sizer.getAttribute('aria-hidden')).toBe('true');
      expect(sizer.closest('[aria-live]')).toBeNull();
    }
    expect(status().parentElement).toBe(sizers[0].parentElement); // same box, stacked in one grid cell
    rerender({ locale: 'es' });
    expect([...document.querySelectorAll('.ge-sound-sizer')].map((s) => s.textContent)).toEqual(Object.values(REASONS.es));
  });

  it('announces a reason once: one polite status, always rendered, whose text changes only with the reason', () => {
    const { rerender } = setup();
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(status().textContent).toBe('');
    const node = status();

    rerender({ sound: { on: false, reason: 'failed' } });
    expect(status()).toBe(node);
    expect(status().textContent).toBe(REASONS.en.failed);
    const text = status().firstChild;
    rerender({ sound: { on: false, reason: 'failed' } }); // a re-render with the same reason
    expect(status().firstChild).toBe(text); // the same text node: nothing new to announce

    rerender({ sound: { on: true } });
    expect(status().textContent).toBe('');
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
  });

  it('without a speech API it stays focusable but unavailable, and says why', () => {
    const { onChange } = setup({ sound: { on: false, reason: 'no-api' } });
    const button = screen.getByRole('button', { name: 'Ghost voice' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false); // still reachable by Tab, so the reason is heard
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
    expect(status().textContent).toBe(REASONS.en['no-api']);
  });
});
