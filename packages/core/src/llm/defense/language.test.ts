import { describe, expect, it } from 'vitest';
import { inLanguage } from './language';

describe('inLanguage', () => {
  it('accepts text in the requested language', () => {
    expect(inLanguage('Why did you choose a queue for the payment step?', 'en')).toBe(true);
    expect(inLanguage('¿Por qué elegiste una cola para el pago?', 'es')).toBe(true);
  });

  it('rejects text clearly in the other language', () => {
    expect(inLanguage('Your file says the queue was slow. Why did you choose it?', 'es')).toBe(false);
    expect(inLanguage('Tu archivo dice que la cola era lenta y que el pago tardaba.', 'en')).toBe(false);
  });

  it('lets short sentences and a short quoted phrase pass', () => {
    expect(inLanguage('OK.', 'es')).toBe(true);
    expect(inLanguage('Bien hecho.', 'en')).toBe(true);
    expect(inLanguage('Tu archivo dice «the queue was slow». ¿Por qué?', 'es')).toBe(true);
  });
});
