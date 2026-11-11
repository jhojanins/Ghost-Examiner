import { cleanup, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrivacyDialog, type PrivacyDialogProps } from './PrivacyDialog';

// jsdom 31 has no showModal()/close() (checked before writing this test). This stand-in
// does only what the component relies on: the open state and the close event. The real modal
// behavior (inert page, focus trap, Esc, focus return) is checked in Chromium with Playwright MCP.
const proto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
const original = { showModal: proto.showModal, close: proto.close };
beforeAll(() => {
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
    this.dataset.modal = 'true';
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    delete this.dataset.modal;
    this.dispatchEvent(new Event('close'));
  };
});
afterAll(() => Object.assign(proto, original));
afterEach(cleanup);

/** What a browser does on Esc: fire "cancel", then close the dialog. */
function pressEscape(dialog: HTMLDialogElement) {
  if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
}

function setup(props: Partial<PrivacyDialogProps> = {}) {
  const onAccept = vi.fn();
  const onDismiss = vi.fn();
  const all: PrivacyDialogProps = { open: true, locale: 'en', mode: 'consent', onAccept, onDismiss, ...props };
  const view = render(
    <>
      <button type="button">Start</button>
      <PrivacyDialog {...all} />
    </>,
  );
  const rerender = (next: Partial<PrivacyDialogProps>) =>
    view.rerender(
      <>
        <button type="button">Start</button>
        <PrivacyDialog {...all} {...next} />
      </>,
    );
  return { ...view, rerender, onAccept, onDismiss, dialog: () => document.querySelector('dialog')! };
}

describe('PrivacyDialog', () => {
  it('opens as a modal dialog with focus inside, labeled by its heading', () => {
    const { dialog } = setup();
    expect(dialog().open).toBe(true);
    expect(dialog().dataset.modal).toBe('true'); // opened with showModal(), not show()
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Privacy notice' })).toBe(dialog());
  });

  it('Accept calls onAccept only', () => {
    const { onAccept, onDismiss } = setup();
    screen.getByRole('button', { name: 'I understand, start' }).click();
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('Esc calls onDismiss without onAccept, and leaves closing to the parent', () => {
    const { onAccept, onDismiss, dialog } = setup();
    pressEscape(dialog());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
    // The browser's own close is cancelled, so the DOM never runs ahead of the parent's state.
    expect(dialog().open).toBe(true);
  });

  it('if the browser closes it anyway (cancel not cancelable), onDismiss still fires once', () => {
    const { onDismiss, dialog } = setup();
    dialog().dispatchEvent(new Event('cancel', { cancelable: false }));
    dialog().close();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('"Not now" dismisses without accepting, like Esc', () => {
    const { onAccept, onDismiss } = setup();
    screen.getByRole('button', { name: 'Not now' }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('read-only mode has only a Close button, which dismisses', () => {
    const { onDismiss, dialog } = setup({ mode: 'read-only' });
    const buttons = within(dialog()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Close']);
    buttons[0].click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('closing because the parent set open=false is not a dismissal', () => {
    const { onAccept, onDismiss, dialog, rerender } = setup();
    screen.getByRole('button', { name: 'I understand, start' }).click();
    rerender({ open: false });
    expect(dialog().open).toBe(false);
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('returns focus to the element that opened it', () => {
    const { dialog, rerender } = setup({ open: false });
    const opener = screen.getByRole('button', { name: 'Start' });
    opener.focus();
    rerender({ open: true });
    expect(dialog().contains(document.activeElement)).toBe(true);
    pressEscape(dialog());
    rerender({ open: false }); // the parent's answer to onDismiss
    expect(document.activeElement).toBe(opener);
  });

  it('never pulls focus back from an element the user already moved to (browser check, task 21)', () => {
    // In Chromium the close event fires after the browser has already restored focus; a fast
    // Tab can move focus on before it arrives. The late handler must not take it back.
    const { dialog, rerender } = setup({ open: false });
    const opener = screen.getByRole('button', { name: 'Start' });
    opener.focus();
    rerender({ open: true });
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    dialog().removeAttribute('open'); // the browser closed it and restored focus...
    elsewhere.focus(); // ...then the user tabbed on, before the close event arrived
    dialog().dispatchEvent(new Event('close'));
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it('when the parent closes it, focus is back on the opener right away', () => {
    const { dialog, rerender } = setup({ open: false });
    const opener = screen.getByRole('button', { name: 'Start' });
    opener.focus();
    rerender({ open: true });
    expect(dialog().contains(document.activeElement)).toBe(true);
    rerender({ open: false });
    expect(document.activeElement).toBe(opener);
  });

  it('says honestly what happens with the data, in EN and ES', () => {
    const { rerender } = setup();
    const en = document.querySelector('dialog')!.textContent!;
    expect(en).toContain('Demo mode runs entirely in your browser.');
    expect(en).toContain('not sent to any server');
    expect(en).toContain('personal or sensitive');
    expect(en).toContain('free AI service');
    expect(en).toContain('may use the text you send');

    rerender({ locale: 'es' });
    const es = document.querySelector('dialog')!;
    expect(es.getAttribute('lang')).toBe('es');
    expect(screen.getByRole('dialog', { name: 'Aviso de privacidad' })).toBe(es);
    expect(es.textContent).toContain('El modo demo funciona por completo en tu navegador.');
    expect(es.textContent).toContain('datos personales ni sensibles');
    expect(es.textContent).toContain('pueden usar el texto que les envíes');
    expect(within(es).getAllByRole('button').map((b) => b.textContent)).toEqual(['Entendido, empezar', 'Ahora no']);
  });
});
