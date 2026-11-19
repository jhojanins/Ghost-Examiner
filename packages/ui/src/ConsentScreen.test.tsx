import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsentScreen, type ConsentScreenProps } from './ConsentScreen';

afterEach(cleanup);

function setup(props: Partial<ConsentScreenProps> = {}) {
  const onAI = vi.fn();
  const onOffline = vi.fn();
  const view = render(<ConsentScreen locale="en" provider="proxy" onAI={onAI} onOffline={onOffline} {...props} />);
  return { ...view, onAI, onOffline };
}

describe('ConsentScreen (ghost-defense-live design §6.1, Req 3.1, 3.2)', () => {
  it.each([
    [
      'en',
      'Before the AI reads your file',
      [
        "Who answers: Google Gemini, through this site's server.",
        'What is sent: parts of the text of your file, at most 6,000 characters per request (never the file itself), the examiner\'s questions, and the answers you confirm.',
        'What is not sent: the file, the rest of its text, audio, camera images, and anything you typed but did not confirm.',
        "This app stores nothing, and this site's server does not log what is sent.",
        "Google's free tier may use what it receives to improve its products, and human reviewers may read it. Do not include sensitive, confidential or personal information.",
        'Replies are practice feedback, not a grade.',
      ],
      ['Continue with AI', 'Continue offline (demo)'],
    ],
    [
      'es',
      'Antes de que la IA lea tu archivo',
      [
        'Quién responde: Google Gemini, a través del servidor de este sitio.',
        'Qué se envía: partes del texto de tu archivo, como máximo 6.000 caracteres por solicitud (nunca el archivo en sí), las preguntas del examinador y las respuestas que confirmas.',
        'Qué no se envía: el archivo, el resto de su texto, audio, imágenes de cámara y nada de lo que escribiste sin confirmar.',
        'Esta app no guarda nada, y el servidor de este sitio no registra lo que se envía.',
        'El nivel gratuito de Google puede usar lo que recibe para mejorar sus productos, y personas que lo revisan pueden leerlo. No incluyas información sensible, confidencial ni personal.',
        'Las respuestas son comentarios de práctica, no una calificación.',
      ],
      ['Seguir con IA', 'Seguir sin conexión (demo)'],
    ],
  ] as const)('%s: names the provider, what is and is not sent, storage, data use and practice, as a list', (locale, heading, points, buttons) => {
    setup({ locale });
    const region = screen.getByRole('region', { name: heading });
    expect(within(region).getAllByRole('listitem').map((li) => li.textContent)).toEqual(points);
    expect(within(region).getAllByRole('button').map((b) => b.textContent)).toEqual(buttons);
  });
  it('offers two equal choices, with neither one preselected or focused; focus starts on the heading', () => {
    setup();
    const [ai, offline] = screen.getAllByRole('button');
    expect(ai.className).toBe(offline.className);
    expect(ai.getAttribute('aria-pressed')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Before the AI reads your file' }));
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
  });
  it('calls the handler of the choice made', () => {
    const { onAI, onOffline } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Continue offline (demo)' }));
    expect(onOffline).toHaveBeenCalledOnce();
    expect(onAI).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with AI' }));
    expect(onAI).toHaveBeenCalledOnce();
  });
});
