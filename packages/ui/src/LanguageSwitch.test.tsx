import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitch } from './LanguageSwitch';

afterEach(cleanup);

describe('LanguageSwitch', () => {
  it.each([
    ['en', 'Language', 'true', 'false'],
    ['es', 'Idioma', 'false', 'true'],
  ] as const)('two buttons in a labeled group; aria-pressed shows the current locale (%s)', (locale, groupName, en, es) => {
    render(<LanguageSwitch locale={locale} onChange={() => {}} />);
    const group = screen.getByRole('group', { name: groupName });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['English', 'Español']);
    expect(within(group).getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe(en);
    expect(within(group).getByRole('button', { name: 'Español' }).getAttribute('aria-pressed')).toBe(es);
  });

  it('each label carries its own lang, whatever the UI language', () => {
    render(<LanguageSwitch locale="es" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'English' }).getAttribute('lang')).toBe('en');
    expect(screen.getByRole('button', { name: 'Español' }).getAttribute('lang')).toBe('es');
  });

  it('clicking "Español" calls onChange("es")', () => {
    const onChange = vi.fn();
    render(<LanguageSwitch locale="en" onChange={onChange} />);
    screen.getByRole('button', { name: 'Español' }).click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith('es');
  });

  it('clicking the current language does nothing (no needless re-evaluation)', () => {
    const onChange = vi.fn();
    render(<LanguageSwitch locale="en" onChange={onChange} />);
    screen.getByRole('button', { name: 'English' }).click();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses native buttons that never submit a form', () => {
    render(<LanguageSwitch locale="en" onChange={() => {}} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
    }
  });
});
