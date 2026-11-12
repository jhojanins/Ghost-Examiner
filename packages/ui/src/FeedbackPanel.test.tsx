import type { Feedback } from '@ghost-examiner/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackPanel, type FeedbackPanelProps } from './FeedbackPanel';

afterEach(cleanup);

const en: Feedback = {
  summary: 'Thank you. That answer was clear and on topic.',
  strength: 'You covered the situation.',
  improvement: 'Add the action.',
  reaction: 'approving',
  locale: 'en',
};
const es: Feedback = {
  summary: 'Gracias. Esa respuesta fue clara y se centró en el tema.',
  strength: 'Explicaste la situación.',
  improvement: 'Agrega la acción.',
  reaction: 'approving',
  locale: 'es',
};
const DEMO_EN = 'Demo evaluation: based on keywords, not a full reading of your answer.';
const DEMO_ES = 'Evaluación de demostración: se basa en palabras clave, no en una lectura completa de tu respuesta.';

function setup(props: Partial<FeedbackPanelProps> = {}) {
  const onNext = vi.fn();
  const all: FeedbackPanelProps = { locale: 'en', feedback: en, demo: true, onNext, ...props };
  const view = render(<FeedbackPanel {...all} />);
  return { ...view, onNext, rerender: (p: Partial<FeedbackPanelProps>) => view.rerender(<FeedbackPanel {...all} {...p} />) };
}

describe('FeedbackPanel', () => {
  it.each([
    ['en', en, 'Practice feedback', 'What went well', 'One thing to improve'],
    ['es', es, 'Comentarios de práctica', 'Lo que salió bien', 'Algo para mejorar'],
  ] as const)('shows the practice-feedback heading, strength and improvement (%s)', (locale, feedback, title, well, improve) => {
    setup({ locale, feedback });
    const region = screen.getByRole('region', { name: title });
    expect(within(region).getByRole('heading', { level: 2, name: title })).toBeTruthy();
    expect(within(region).getByRole('heading', { level: 3, name: well })).toBeTruthy();
    expect(within(region).getByRole('heading', { level: 3, name: improve })).toBeTruthy();
    expect(within(region).getByText(feedback.strength)).toBeTruthy();
    expect(within(region).getByText(feedback.improvement)).toBeTruthy();
  });

  it("marks the feedback text with the feedback's own lang, even if the UI language differs", () => {
    setup({ locale: 'en', feedback: es });
    expect(screen.getByText(es.strength).closest('[lang]')?.getAttribute('lang')).toBe('es');
    expect(screen.getByText(es.improvement).closest('[lang]')?.getAttribute('lang')).toBe('es');
    // The panel's own labels stay in the UI language.
    expect(screen.getByRole('heading', { level: 2 }).closest('[lang]')?.getAttribute('lang') ?? 'en').toBe('en');
  });

  it('moves focus to its heading once, on mount', () => {
    const { rerender } = setup();
    const heading = screen.getByRole('heading', { level: 2, name: 'Practice feedback' });
    expect(document.activeElement).toBe(heading);
    const next = screen.getByRole('button', { name: 'Continue' });
    next.focus();
    rerender({ locale: 'es' });
    expect(document.activeElement).toBe(next);
  });

  it('Continue calls onNext', () => {
    const { onNext } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['en', en, DEMO_EN],
    ['es', es, DEMO_ES],
  ] as const)('labels demo feedback as a keyword-based demo evaluation (%s)', (locale, feedback, label) => {
    setup({ locale, feedback, demo: true });
    const note = screen.getByText(label);
    expect(note).toBeTruthy();
    // Visible text right under the heading, not a tooltip or hidden text.
    expect(note.tagName).toBe('P');
    expect(note.closest('[aria-hidden="true"], [hidden]')).toBeNull();
    expect(note.previousElementSibling).toBe(screen.getByRole('heading', { level: 2 }));
  });

  it('does not show the demo label for a non-demo provider', () => {
    setup({ demo: false });
    expect(screen.queryByText(DEMO_EN)).toBeNull();
    cleanup();
    setup({ locale: 'es', feedback: es, demo: false });
    expect(screen.queryByText(DEMO_ES)).toBeNull();
  });

  it('never calls the result a verdict, grade or score', () => {
    for (const [locale, feedback] of [['en', en], ['es', es]] as const) {
      cleanup();
      setup({ locale, feedback });
      expect(document.body.textContent).not.toMatch(/verdict|grade|score|pass|fail|veredicto|nota|calificaci|aprob|reprob/i);
    }
  });
});
