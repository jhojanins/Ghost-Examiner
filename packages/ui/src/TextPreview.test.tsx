import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextPreview, type TextPreviewProps } from './TextPreview';

afterEach(cleanup);
const TEXT = '# Design\n\nWe chose a queue.\nIt was simple.\n\n## Results\n\nIt worked well.';
function setup(props: Partial<TextPreviewProps> = {}) {
  const handlers = { onFileLang: vi.fn(), onCount: vi.fn(), onRemove: vi.fn(), onStart: vi.fn() };
  const all: TextPreviewProps = { locale: 'en', text: TEXT, truncated: false, parts: 2, fileLang: 'en', count: 4, ...handlers, ...props };
  return { ...render(<TextPreview {...all} />), ...handlers };
}

describe('TextPreview', () => {
  it('shows the extracted text as real text, with the file\'s headings as headings, in a focusable region', () => {
    setup();
    const region = screen.getByRole('region', { name: 'The text of your file' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getByRole('heading', { level: 3, name: 'Design' })).toBeTruthy();
    expect(within(region).getByRole('heading', { level: 4, name: 'Results' })).toBeTruthy();
    expect(within(region).getByText(/We chose a queue\.\s*It was simple\./)).toBeTruthy();
    expect(region.getAttribute('lang')).toBe('en');
  });

  it('shows the counts and says the ghost sees only this text', () => {
    setup({ text: 'x'.repeat(12345) });
    expect(screen.getByText('12,345 characters in 2 parts')).toBeTruthy();
    expect(screen.getByText(/The ghost sees only this text/)).toBeTruthy();
    cleanup();
    setup({ locale: 'es', text: 'x'.repeat(12345) });
    expect(screen.getByText('12.345 caracteres en 2 partes')).toBeTruthy();
  });

  it('shows the warnings that apply: truncated, no headings, fictional sample', () => {
    setup({ truncated: true, text: 'Plain text without headings.', sample: true });
    expect(screen.getByText('Your text is long, so only the first 60,000 characters are used.')).toBeTruthy();
    expect(screen.getByText(/No headings found/)).toBeTruthy();
    expect(screen.getByText('This is a fictional sample file.')).toBeTruthy();
    cleanup();
    setup();
    expect(screen.queryByText(/No headings found/)).toBeNull();
    expect(screen.queryByText(/only the first 60,000/)).toBeNull();
  });

  it('lets the user pick the file language and the number of questions (3 to 8, default 4)', () => {
    const { onFileLang, onCount } = setup();
    const group = screen.getByRole('group', { name: 'Language of your file' });
    expect(within(group).getByRole('radio', { name: 'English' })).toHaveProperty('checked', true);
    fireEvent.click(within(group).getByRole('radio', { name: 'Español' }));
    expect(onFileLang).toHaveBeenCalledWith('es');
    const select = screen.getByRole('combobox', { name: 'Number of questions' }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['3', '4', '5', '6', '7', '8']);
    expect(select.value).toBe('4');
    fireEvent.change(select, { target: { value: '6' } });
    expect(onCount).toHaveBeenCalledWith(6);
  });

  it('removes the file or starts the session', () => {
    const { onRemove, onStart } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove file' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledOnce();
  });
  it('passes its heading on as a focus target, for the app to move focus to when the screen opens', () => {
    const ref = createRef<HTMLHeadingElement>();
    setup({ ref });
    expect(ref.current).toBe(screen.getByRole('heading', { level: 2, name: 'What the ghost will read' }));
    expect(ref.current?.getAttribute('tabindex')).toBe('-1');
  });
});
