import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceInput, type VoiceInputProps, type VoiceInputState } from './VoiceInput';

afterEach(cleanup);

const idle: VoiceInputState = { availability: { available: true }, listening: false, final: '', interim: '' };

function setup(props: Partial<VoiceInputProps> = {}) {
  const handlers = { onListen: vi.fn(), onStop: vi.fn(), onPrivacy: vi.fn() };
  const all: VoiceInputProps = { locale: 'en', voice: idle, ...handlers, ...props };
  const view = render(<VoiceInput {...all} />);
  const rerender = (next: Partial<VoiceInputProps>) => view.rerender(<VoiceInput {...all} {...next} />);
  return { ...view, ...handlers, rerender };
}
const status = () => document.querySelector('[aria-live="polite"]') as HTMLElement;
const button = () => document.querySelector('.ge-voice-button') as HTMLButtonElement;

describe('VoiceInput (spec b task 32)', () => {
  it('is a labeled region with one native button that starts listening', () => {
    const { onListen } = setup();
    expect(screen.getByRole('region', { name: 'Answer by voice' })).toBeTruthy();
    const start = screen.getByRole('button', { name: 'Start speaking' });
    expect(start.getAttribute('type')).toBe('button');
    fireEvent.click(start);
    expect(onListen).toHaveBeenCalledTimes(1);
  });

  it('while listening, the same button becomes "Stop speaking", keeps focus and calls onStop', () => {
    const { onStop, onListen, rerender } = setup();
    const control = button();
    control.focus();
    rerender({ voice: { ...idle, listening: true } });
    expect(button()).toBe(control);
    expect(document.activeElement).toBe(control);
    expect(control.textContent).toBe('Stop speaking');
    fireEvent.click(control);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onListen).not.toHaveBeenCalled();
  });

  it('shows the listening state in words and with a shape, not by color alone', () => {
    setup({ voice: { ...idle, listening: true } });
    expect(status().textContent).toBe('Listening…');
    expect(button().getAttribute('data-listening')).toBe('true'); // the CSS draws a square "stop" sign
    expect(button().querySelector('.ge-voice-sign')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('"Your words" shows final and interim text styled differently, in the answer language, and is not live', () => {
    const { rerender } = setup({ voice: { ...idle, listening: true, final: 'I fixed the build', interim: 'on Friday' } });
    const words = document.querySelector('.ge-voice-words-text') as HTMLElement;
    expect(screen.getByText('Your words')).toBeTruthy();
    expect(words.getAttribute('lang')).toBe('en');
    expect(words.querySelector('.ge-voice-final')?.textContent).toBe('I fixed the build');
    expect(words.querySelector('.ge-voice-interim')?.textContent).toBe('on Friday');
    expect(words.closest('[aria-live]')).toBeNull();
    rerender({ locale: 'es', voice: { ...idle, listening: true, final: 'Arreglé', interim: '' } });
    expect(words.getAttribute('lang')).toBe('es');
  });

  it('one polite status, always rendered: start, stop and an error are each announced once', () => {
    const { rerender } = setup();
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(status().textContent).toBe(''); // nothing to say before the first use

    rerender({ voice: { ...idle, listening: true } });
    expect(status().textContent).toBe('Listening…');
    const listening = status().firstChild;
    rerender({ voice: { ...idle, listening: true, interim: 'I fixed' } }); // partial text: no new announcement
    expect(status().firstChild).toBe(listening);

    rerender({ voice: idle });
    expect(status().textContent).toBe('Stopped listening.');
    rerender({ voice: { ...idle, error: 'voice.error.noMic' } });
    expect(status().textContent).toBe("I can't find a microphone. Connect one and try again, or type your answer.");
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(button().getAttribute('aria-describedby')).toBe(status().id);
  });

  it('reserves room for its longest message: hidden copies of every message share the status cell (no layout shift)', () => {
    setup();
    const sizers = [...document.querySelectorAll('.ge-voice-sizer')];
    expect(sizers.length).toBe(9); // listening, stopped, unavailable, empty and five errors
    for (const sizer of sizers) expect(sizer.getAttribute('aria-hidden')).toBe('true');
    expect(sizers.every((s) => s.parentElement === status().parentElement)).toBe(true);
  });

  it('a short privacy note sits next to the control, with a link to the notice (Req 9.5)', () => {
    const { onPrivacy } = setup();
    expect(screen.getByText('Your browser may send your voice to its maker to turn it into text.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Privacy notice' }));
    expect(onPrivacy).toHaveBeenCalledTimes(1);
  });

  it('when voice is unavailable, the button is marked unavailable, does nothing, and the reason is the status', () => {
    const { onListen, rerender } = setup();
    rerender({ voice: { ...idle, availability: { available: false, reason: 'voice.unavailable' } } });
    const control = screen.getByRole('button', { name: 'Start speaking' });
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(control.hasAttribute('disabled')).toBe(false); // still reachable by Tab, so the reason is heard
    fireEvent.click(control);
    expect(onListen).not.toHaveBeenCalled();
    expect(status().textContent).toBe("Voice input isn't available in this browser. You can type your answer.");
  });

  it('works in Spanish', () => {
    setup({ locale: 'es', voice: { ...idle, listening: true } });
    expect(screen.getByRole('region', { name: 'Responder por voz' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dejar de hablar' })).toBeTruthy();
    expect(status().textContent).toBe('Escuchando…');
    expect(screen.getByText('Tus palabras')).toBeTruthy();
  });
});
