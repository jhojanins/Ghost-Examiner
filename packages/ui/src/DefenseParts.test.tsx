import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DefenseSummary, type DefenseSummaryProps } from './DefenseSummary';
import { InlineConfirm } from './InlineConfirm';
import { ModeLabel } from './ModeLabel';
import { QuoteBlock } from './QuoteBlock';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InlineConfirm', () => {
  const candidate = { text: 'I chose a queue because the API is slow', method: 'voice' as const, candidateId: 3 };
  it('shows the answer and its method, with Send focused and described by both, so Enter confirms', () => {
    const onSend = vi.fn();
    render(<InlineConfirm locale="en" candidate={candidate} onSend={onSend} onEdit={() => {}} onRetry={() => {}} />);
    const send = screen.getByRole('button', { name: 'Send' });
    expect(document.activeElement).toBe(send);
    const described = (send.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(['I chose a queue because the API is slow', 'How you answered: Spoken']);
    fireEvent.click(send); // a focused native button: Enter and Space activate it
    expect(onSend).toHaveBeenCalledWith(3);
  });

  it('includes the notice in what Send reads, and offers Edit and Answer again', () => {
    const onEdit = vi.fn();
    const onRetry = vi.fn();
    render(<InlineConfirm locale="es" candidate={{ ...candidate, notice: 'voice.error.noMic' }} onSend={() => {}} onEdit={onEdit} onRetry={onRetry} />);
    const send = screen.getByRole('button', { name: 'Enviar' });
    expect(send.getAttribute('aria-describedby')?.split(' ')).toHaveLength(3);
    expect(screen.getByText(/No encuentro un micrófono/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Responder de nuevo' }));
    expect([onEdit.mock.calls.length, onRetry.mock.calls.length]).toEqual([1, 1]);
  });
});

describe('QuoteBlock', () => {
  it('shows the quote as a quote in the file\'s language, labeled as coming from the file', () => {
    render(<QuoteBlock locale="es" quote="We chose a queue." lang="en" />);
    const figure = screen.getByRole('figure', { name: 'De tu archivo' });
    const quote = within(figure).getByText('We chose a queue.');
    expect(quote.tagName).toBe('BLOCKQUOTE');
    expect(quote.getAttribute('lang')).toBe('en');
  });
});

describe('ModeLabel', () => {
  it('names the source of questions and replies, in a polite region', () => {
    const { rerender } = render(<ModeLabel locale="en" mode="ai" provider="Google Gemini" />);
    const label = screen.getByText('Questions and replies come from AI: Google Gemini.');
    expect(label.getAttribute('aria-live')).toBe('polite');
    rerender(<ModeLabel locale="en" mode="demo" />);
    expect(screen.getByText('Demo mode: questions and feedback come from simple rules, not AI.')).toBe(label);
  });
});

describe('DefenseSummary', () => {
  const props: DefenseSummaryProps = {
    locale: 'en',
    fileLang: 'en',
    source: 'demo',
    questions: ['Why did you choose a queue?', 'How did you measure it?'],
    summary: { strength: 'You explained your choices.', review: [{ excerptId: 'e2', quote: 'We measured it for two weeks.', point: 'Look again at the timing.' }] },
    onAgain: vi.fn(),
    onNew: vi.fn(),
  };

  it('shows the questions, the strength and the review points with their quotes, labeled as practice feedback from the demo', () => {
    render(<DefenseSummary {...props} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Practice summary' })).toBeTruthy();
    const questions = screen.getByRole('list', { name: 'Questions' });
    expect(within(questions).getAllByRole('listitem').map((li) => li.textContent)).toEqual(props.questions);
    expect(screen.getByText('You explained your choices.')).toBeTruthy();
    const review = screen.getByRole('list', { name: 'Worth a second look' });
    expect(within(review).getByText('Look again at the timing.')).toBeTruthy();
    expect(within(review).getByRole('figure', { name: 'From your file' })).toBeTruthy();
    expect(screen.getByText('Practice feedback, not a grade. Written by the offline demo rules.')).toBeTruthy();
  });

  it('copies the summary as plain text and says so politely; without a clipboard there is no Copy button', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<DefenseSummary {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy summary' }));
    await vi.waitFor(() => expect(screen.getByText('Summary copied.').getAttribute('aria-live')).toBe('polite'));
    const copied = writeText.mock.calls[0]?.[0] ?? '';
    expect(copied).toContain('Practice summary');
    expect(copied).toContain('- Why did you choose a queue?');
    expect(copied).toContain('"We measured it for two weeks."');
    expect(copied).not.toMatch(/<[a-z]/i);
    cleanup();
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    render(<DefenseSummary {...props} />);
    expect(screen.queryByRole('button', { name: 'Copy summary' })).toBeNull();
  });

  it('offers to start again with the same file or another one', () => {
    render(<DefenseSummary {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start again with this file' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use another file' }));
    expect([(props.onAgain as ReturnType<typeof vi.fn>).mock.calls.length, (props.onNew as ReturnType<typeof vi.fn>).mock.calls.length]).toEqual([1, 1]);
  });
});
