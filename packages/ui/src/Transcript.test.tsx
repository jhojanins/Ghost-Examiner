import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Transcript, type TranscriptLine } from './Transcript';

afterEach(cleanup);

const greeting: TranscriptLine = { id: 1, text: 'Good evening. Please, have a seat.', locale: 'en', heard: false };
const question: TranscriptLine = { id: 2, text: 'Tell me about a problem you solved.', locale: 'en', heard: false };

const liveRegion = () => document.querySelector('[aria-live]') as HTMLElement;

describe('Transcript', () => {
  it('a finished line appears once in the list and once in the polite live region', () => {
    const { rerender } = render(<Transcript lines={[]} locale="en" />);
    rerender(<Transcript lines={[greeting]} locale="en" />);

    const list = screen.getByRole('list');
    expect(within(list).getAllByText(greeting.text)).toHaveLength(1);
    expect(liveRegion().getAttribute('aria-live')).toBe('polite');
    expect(within(liveRegion()).getAllByText(greeting.text)).toHaveLength(1);
    expect(screen.getAllByText(greeting.text)).toHaveLength(2); // nowhere else
  });

  it('the live region holds only the newest line; the list keeps them all, in order', () => {
    const { rerender } = render(<Transcript lines={[]} locale="en" />);
    rerender(<Transcript lines={[greeting]} locale="en" />);
    rerender(<Transcript lines={[greeting, question]} locale="en" />);

    expect(within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      greeting.text,
      question.text,
    ]);
    expect(liveRegion().textContent).toBe(question.text);
  });

  it('only the live region is live: the list and the region around it are not', () => {
    render(<Transcript lines={[greeting]} locale="en" />);
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(screen.getByRole('list').closest('[aria-live]')).toBeNull();
    expect(document.querySelectorAll('[role="alert"], [role="status"], [role="log"]')).toHaveLength(0);
  });

  it('re-rendering with the same lines, or switching the UI language, does not touch the live region', () => {
    const { rerender } = render(<Transcript lines={[]} locale="en" />);
    rerender(<Transcript lines={[greeting]} locale="en" />);
    const announced = liveRegion().firstElementChild;

    rerender(<Transcript lines={[greeting]} locale="en" />);
    expect(liveRegion().firstElementChild).toBe(announced);
    rerender(<Transcript lines={[greeting]} locale="es" />);
    expect(liveRegion().firstElementChild).toBe(announced);
    expect(liveRegion().textContent).toBe(greeting.text);
  });

  it('a new line with the same words is still announced (new node), once', () => {
    const again: TranscriptLine = { ...greeting, id: 3 };
    const { rerender } = render(<Transcript lines={[]} locale="en" />);
    rerender(<Transcript lines={[greeting]} locale="en" />);
    const first = liveRegion().firstElementChild;
    rerender(<Transcript lines={[greeting, again]} locale="en" />);
    expect(liveRegion().firstElementChild).not.toBe(first);
    expect(liveRegion().children).toHaveLength(1);
  });

  it('a line the user heard spoken aloud is listed but not announced (Req 3.6)', () => {
    const spoken: TranscriptLine = { ...question, heard: true };
    const { rerender } = render(<Transcript lines={[]} locale="en" />);
    rerender(<Transcript lines={[spoken]} locale="en" />);
    expect(within(screen.getByRole('list')).getAllByText(spoken.text)).toHaveLength(1);
    expect(liveRegion().textContent).toBe('');
  });

  it('after a heard line, the next muted line is announced, once', () => {
    const spoken: TranscriptLine = { ...greeting, heard: true };
    const { rerender } = render(<Transcript lines={[]} locale="en" />);
    rerender(<Transcript lines={[spoken]} locale="en" />);
    rerender(<Transcript lines={[spoken, question]} locale="en" />);
    expect(liveRegion().textContent).toBe(question.text);
    expect(liveRegion().children).toHaveLength(1);
  });

  it('lines that were already there when it mounted are listed but not announced', () => {
    render(<Transcript lines={[greeting, question]} locale="en" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(liveRegion().textContent).toBe('');
  });

  it('is a labeled region, each line marked with its own language', () => {
    render(<Transcript lines={[greeting, { id: 2, text: 'Cuéntame más.', locale: 'es', heard: false }]} locale="es" />);
    const region = screen.getByRole('region', { name: 'Transcripción' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Transcripción' })).toBeTruthy();
    expect(within(region).getAllByRole('listitem').map((li) => li.getAttribute('lang'))).toEqual(['en', 'es']);
  });

  it('announces a line in its own language', () => {
    const spanish: TranscriptLine = { id: 2, text: 'Cuéntame más.', locale: 'es', heard: false };
    const { rerender } = render(<Transcript lines={[greeting]} locale="en" />);
    rerender(<Transcript lines={[greeting, spanish]} locale="en" />);
    expect(within(liveRegion()).getByText('Cuéntame más.').getAttribute('lang')).toBe('es');
  });
});
