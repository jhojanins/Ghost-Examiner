import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileUpload, type FileUploadProps } from './FileUpload';

afterEach(cleanup);
function setup(props: Partial<FileUploadProps> = {}) {
  const onFile = vi.fn();
  const onPaste = vi.fn();
  const all: FileUploadProps = { locale: 'en', provider: 'simple rules on your device', onFile, onPaste, ...props };
  const view = render(<FileUpload {...all} />);
  return { ...view, onFile, onPaste, rerender: (p: Partial<FileUploadProps>) => view.rerender(<FileUpload {...all} {...p} />) };
}

describe('FileUpload', () => {
  it('shows the warning and the active provider above a labeled native file input', () => {
    setup();
    const warning = screen.getByText(/do not upload sensitive, confidential or personal documents/i);
    const provider = screen.getByText('Questions and replies now come from: simple rules on your device.');
    const input = screen.getByLabelText('Choose a file (.txt or .md, up to 2 MB)');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.getAttribute('type')).toBe('file');
    expect(input.getAttribute('accept')).toBe('.txt,.md');
    expect(warning.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(provider.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('passes a chosen or dropped file on', () => {
    const { onFile } = setup();
    const file = new File(['text'], 'essay.txt');
    fireEvent.change(screen.getByLabelText('Choose a file (.txt or .md, up to 2 MB)'), { target: { files: [file] } });
    expect(onFile.mock.calls.at(-1)?.[0]).toBe(file); // identity: two Files compare equal structurally
    const dropped = new File(['more'], 'notes.md');
    fireEvent.drop(screen.getByRole('group', { name: 'Your file' }), { dataTransfer: { files: [dropped] } });
    expect(onFile.mock.calls.at(-1)?.[0]).toBe(dropped);
  });

  it('offers paste as an alternative, behind a disclosure button', () => {
    const { onPaste } = setup();
    const toggle = screen.getByRole('button', { name: 'Paste text instead' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByLabelText('Your text')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'My pasted work.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this text' }));
    expect(onPaste).toHaveBeenCalledWith('My pasted work.');
  });

  it('shows an error in one polite region that is always present, in EN and ES', () => {
    const { rerender } = setup();
    const regions = document.querySelectorAll('[aria-live="polite"]');
    expect(regions).toHaveLength(1);
    expect(regions[0].textContent).toBe('');
    rerender({ error: 'defense.error.size' });
    expect(regions[0].textContent).toBe('This file is over 2 MB. Use a shorter file, or paste the part you want to discuss.');
    rerender({ error: 'defense.error.type', locale: 'es' });
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Este tipo de archivo no se admite aquí. Usa un archivo .txt o .md, o pega el texto.');
  });
});

describe('FileUpload: samples (ghost-defense-live task 7b)', () => {
  const samples = [
    { lang: 'en' as const, text: 'An English sample.' },
    { lang: 'es' as const, text: 'Un ejemplo en español.' },
  ];
  it('offers one button per sample, in a labeled group, and passes the sample text and language on', () => {
    const onSample = vi.fn();
    setup({ samples, onSample });
    const group = screen.getByRole('group', { name: 'Or try a sample file' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Sample in English', 'Sample in Spanish']);
    fireEvent.click(buttons[1]);
    expect(onSample).toHaveBeenCalledWith(samples[1]);
  });

  it('shows no sample group when the app has no samples', () => {
    setup();
    expect(screen.queryByRole('group', { name: 'Or try a sample file' })).toBeNull();
  });
});
