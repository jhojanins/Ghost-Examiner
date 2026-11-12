import { createKeyboardAdapter } from '@ghost-examiner/core';
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardInput, type KeyboardInputProps } from './KeyboardInput';

afterEach(cleanup);

/** The real adapter's submit, started, so a candidate shows up in `emitted`. */
function setup(props: Partial<KeyboardInputProps> = {}) {
  const adapter = createKeyboardAdapter();
  const emitted: string[] = [];
  adapter.start({ question: { id: 'q1', kind: 'free-text' }, locale: 'en' }, (e) => e.type === 'candidate' && emitted.push(e.candidate.text));
  const onSubmit = vi.fn(adapter.submit);
  render(<KeyboardInput locale="en" onSubmit={onSubmit} {...props} />);
  return { onSubmit, emitted, field: screen.getByRole('textbox') as HTMLTextAreaElement };
}
const type = (field: HTMLTextAreaElement, value: string) => fireEvent.change(field, { target: { value } });

describe('KeyboardInput', () => {
  it('has a visible label tied to the textarea', () => {
    const { field } = setup();
    expect(field.tagName).toBe('TEXTAREA');
    const label = document.querySelector(`label[for="${field.id}"]`);
    expect(label?.textContent).toBe('Your answer');
    expect(screen.getByLabelText('Your answer')).toBe(field);
  });

  it('allows paste (never cancels the paste event)', () => {
    const { field } = setup();
    const paste = createEvent.paste(field);
    fireEvent(field, paste);
    expect(paste.defaultPrevented).toBe(false);
    type(field, 'Pasted from my notes.');
    expect(field.value).toBe('Pasted from my notes.');
  });

  it.each([
    ['Ctrl+Enter', { ctrlKey: true }],
    ['Cmd+Enter', { metaKey: true }],
  ])('%s submits the typed text', (_, modifier) => {
    const { field, onSubmit, emitted } = setup();
    type(field, '  I fixed the slow report.  ');
    const enter = createEvent.keyDown(field, { key: 'Enter', ...modifier });
    fireEvent(field, enter);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('  I fixed the slow report.  ');
    expect(emitted).toEqual(['I fixed the slow report.']); // the adapter trims
    expect(enter.defaultPrevented).toBe(true); // no stray newline
  });

  it('plain Enter adds a new line and does not submit', () => {
    const { field, onSubmit } = setup();
    type(field, 'Line one');
    const enter = createEvent.keyDown(field, { key: 'Enter' });
    fireEvent(field, enter);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);
  });

  it('the submit button submits too', () => {
    const { field, emitted } = setup();
    type(field, 'Through the button.');
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(emitted).toEqual(['Through the button.']);
  });

  it('an empty submit shows the inline error, linked by aria-describedby, and keeps focus in the field', () => {
    const { field, emitted } = setup();
    type(field, '   ');
    const button = screen.getByRole('button', { name: 'Submit answer' });
    button.focus();
    fireEvent.click(button); // wrapped in act(), so the error state renders before we look

    expect(emitted).toEqual([]);
    const error = screen.getByText('The answer is empty. Type a few words, then submit.');
    expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);
    expect(error.closest('[aria-live="polite"]')).not.toBeNull(); // announced when it appears
  });

  it('the error clears as soon as the user types again', () => {
    const { field } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(field.getAttribute('aria-invalid')).toBe('true');
    type(field, 'H');
    expect(field.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText('The answer is empty. Type a few words, then submit.')).toBeNull();
  });

  it('the draft prop prefills the text (Edit)', () => {
    const { field, emitted } = setup({ draft: 'My earlier answer' });
    expect(field.value).toBe('My earlier answer');
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });
    expect(emitted).toEqual(['My earlier answer']);
  });

  it('describes the keyboard shortcut to everyone, and speaks Spanish', () => {
    cleanup();
    const adapter = createKeyboardAdapter();
    render(<KeyboardInput locale="es" onSubmit={adapter.submit} />);
    const field = screen.getByLabelText('Tu respuesta');
    const hint = screen.getByText('Presiona Ctrl+Enter (⌘+Enter en Mac) para enviar.');
    expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(hint.id);
    expect(screen.getByRole('button', { name: 'Enviar respuesta' })).toBeTruthy();
  });
});
