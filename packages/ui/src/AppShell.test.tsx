import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

afterEach(cleanup);

const shell = (overrides: Partial<Parameters<typeof AppShell>[0]> = {}) =>
  render(
    <AppShell title="Ghost Interview" locale="en" preview={false} onPrivacy={() => {}} {...overrides}>
      <p>Screen content</p>
    </AppShell>,
  );

describe('AppShell', () => {
  it.each([
    ['en', 'Preview', 'Keyboard only for now.'],
    ['es', 'Vista previa', 'Por ahora, solo teclado.'],
  ] as const)('shows the Preview badge and its explanation only when preview is true (%s)', (locale, badge, detail) => {
    shell({ locale, preview: true });
    expect(screen.getByText(badge)).toBeTruthy();
    expect(screen.getByText(detail)).toBeTruthy();
    cleanup();

    shell({ locale, preview: false });
    expect(screen.queryByText(badge)).toBeNull();
    expect(screen.queryByText(detail)).toBeNull();
  });

  it('an app can replace the Preview explanation with its own honest note', () => {
    shell({ preview: true, previewNote: 'Work in progress: nothing to answer here yet.' });
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByText('Work in progress: nothing to answer here yet.')).toBeTruthy();
    expect(screen.queryByText('Keyboard only for now.')).toBeNull();
  });

  it('has a skip link that targets <main>, and main holds the screen content', () => {
    shell();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    const main = screen.getByRole('main');
    expect(skip.getAttribute('href')).toBe(`#${main.id}`);
    expect(main.id).not.toBe('');
    expect(main.getAttribute('tabindex')).toBe('-1'); // so the skip link can move focus there
    expect(main.textContent).toContain('Screen content');
    // The skip link is the first focusable element on the page.
    expect(document.querySelector('a, button')).toBe(skip);
  });

  it('sets <html lang> to the locale prop and updates it on change', () => {
    const { rerender } = shell({ locale: 'es' });
    expect(document.documentElement.lang).toBe('es');
    rerender(
      <AppShell title="Ghost Interview" locale="en" preview={false} onPrivacy={() => {}}>
        <p>Screen content</p>
      </AppShell>,
    );
    expect(document.documentElement.lang).toBe('en');
  });

  it('header: title as the page heading, the language switch slot, and a privacy button that calls onPrivacy', () => {
    const onPrivacy = vi.fn();
    shell({ locale: 'es', onPrivacy, languageSwitch: <button type="button">Language switch</button> });
    const header = screen.getByRole('banner');
    expect(screen.getByRole('heading', { level: 1, name: 'Ghost Interview' }).closest('header')).toBe(header);
    expect(screen.getByRole('button', { name: 'Language switch' }).closest('header')).toBe(header);

    const privacy = screen.getByRole('button', { name: 'Aviso de privacidad' });
    expect(privacy.closest('header')).toBe(header);
    privacy.click();
    expect(onPrivacy).toHaveBeenCalledTimes(1);
  });

  it('the sound control slot comes first in the header actions, before the language switch (spec b Req 2.1)', () => {
    shell({
      soundControl: <button type="button">Ghost voice</button>,
      languageSwitch: <button type="button">Language switch</button>,
    });
    const order = [...screen.getByRole('banner').querySelectorAll('button')].map((b) => b.textContent);
    expect(order).toEqual(['Ghost voice', 'Language switch', 'Privacy notice']);
  });

  it('without a sound control (ghost-defense), the header actions are unchanged', () => {
    shell({ languageSwitch: <button type="button">Language switch</button> });
    const order = [...screen.getByRole('banner').querySelectorAll('button')].map((b) => b.textContent);
    expect(order).toEqual(['Language switch', 'Privacy notice']);
  });
});
