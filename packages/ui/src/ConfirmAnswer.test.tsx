import type { AnswerCandidate } from '@ghost-examiner/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmAnswer, type ConfirmAnswerProps } from './ConfirmAnswer';

afterEach(cleanup);

const typed: AnswerCandidate = { text: 'I rewrote the slow report.\nIt now takes two minutes.', method: 'keyboard' };

function setup(props: Partial<ConfirmAnswerProps> = {}) {
  const handlers = { onConfirm: vi.fn(), onEdit: vi.fn(), onRetry: vi.fn() };
  const all: ConfirmAnswerProps = { locale: 'en', candidate: typed, ...handlers, ...props };
  const view = render(<ConfirmAnswer {...all} />);
  return { ...view, ...handlers, rerender: (p: Partial<ConfirmAnswerProps>) => view.rerender(<ConfirmAnswer {...all} {...p} />) };
}

describe('ConfirmAnswer', () => {
  it('moves focus to its heading on mount, so the prompt is announced', () => {
    setup();
    const heading = screen.getByRole('heading', { level: 2, name: 'I noted this. Is that what you meant?' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('region', { name: 'I noted this. Is that what you meant?' })).toBeTruthy();
  });

  it('shows the interpreted answer as written, line breaks included', () => {
    setup();
    const quote = document.querySelector('blockquote')!;
    expect(quote.textContent).toBe(typed.text);
  });

  it.each([
    ['en', 'How you answered: Typed'],
    ['es', 'Cómo respondiste: Escrito'],
  ] as const)('shows the input method (%s)', (locale, text) => {
    setup({ locale });
    expect(screen.getByText(text)).toBeTruthy();
  });

  it.each([
    ['Confirm', 'onConfirm'],
    ['Edit', 'onEdit'],
    ['Answer again', 'onRetry'],
  ] as const)('"%s" calls %s and nothing else', (name, handler) => {
    const view = setup();
    fireEvent.click(screen.getByRole('button', { name }));
    for (const h of ['onConfirm', 'onEdit', 'onRetry'] as const) {
      expect(view[h]).toHaveBeenCalledTimes(h === handler ? 1 : 0);
    }
  });

  it('offers the three actions in Spanish, Confirm first', () => {
    setup({ locale: 'es' });
    const region = screen.getByRole('region', { name: 'Anoté esto. ¿Es lo que quisiste decir?' });
    expect(within(region).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Confirmar',
      'Editar',
      'Responder de nuevo',
    ]);
  });

  it('a re-render (for example a language switch) does not pull focus back to the heading', () => {
    const { rerender } = setup();
    const edit = screen.getByRole('button', { name: 'Edit' });
    edit.focus();
    rerender({ locale: 'es' });
    expect(document.activeElement).toBe(edit);
  });

  it('labels every input method, and marks the experimental one as such', () => {
    const labels = (['keyboard', 'voice', 'morse', 'sign'] as const).map((method) => {
      cleanup();
      setup({ candidate: { text: 'x', method } });
      return document.querySelector('.ge-confirm-method')!.textContent;
    });
    expect(labels).toEqual([
      'How you answered: Typed',
      'How you answered: Spoken',
      'How you answered: Morse code',
      'How you answered: Gestures (experimental)',
    ]);
  });
});
