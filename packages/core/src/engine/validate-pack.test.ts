import { describe, expect, it } from 'vitest';
import type { AnswerKind, InputAdapter, InputMethodId } from '../input/types';
import type { Question, QuestionPack } from './types';
import { validatePack } from './validate-pack';

function fakeAdapter(id: InputMethodId, supports: readonly AnswerKind[]): InputAdapter {
  return {
    id,
    supports,
    requires: { camera: false, microphone: false },
    experimental: false,
    checkAvailability: async () => ({ available: true }),
    start() {},
    stop() {},
  };
}

const all: AnswerKind[] = ['free-text', 'choice', 'yes-no'];
const question = (id: string, kind: AnswerKind = 'free-text'): Question => ({
  id,
  kind,
  prompt: { en: 'Question?', es: '¿Pregunta?' },
  keyPoints: [],
});
const pack = (questions: Question[]): QuestionPack => ({
  id: 'test',
  greeting: { en: 'Hello.', es: 'Hola.' },
  closing: { en: 'Goodbye.', es: 'Adiós.' },
  questions,
});

const keyboard = fakeAdapter('keyboard', all);
const morse = fakeAdapter('morse', all);
const twoQuestions = pack([question('q1'), question('q2', 'yes-no')]);

describe('validatePack', () => {
  it('one adapter + preview: a warning per question', () => {
    expect(validatePack(twoQuestions, [keyboard], { preview: true })).toEqual([
      { kind: 'too-few-inputs', questionId: 'q1', severity: 'warning', supportedBy: ['keyboard'] },
      { kind: 'too-few-inputs', questionId: 'q2', severity: 'warning', supportedBy: ['keyboard'] },
    ]);
  });

  it('one adapter, not preview: an error per question', () => {
    expect(validatePack(twoQuestions, [keyboard], { preview: false })).toEqual([
      { kind: 'too-few-inputs', questionId: 'q1', severity: 'error', supportedBy: ['keyboard'] },
      { kind: 'too-few-inputs', questionId: 'q2', severity: 'error', supportedBy: ['keyboard'] },
    ]);
  });

  it('two adapters: no issues', () => {
    expect(validatePack(twoQuestions, [keyboard, morse], { preview: false })).toEqual([]);
  });

  it.each([true, false])('zero questions is an error, preview: %s', (preview) => {
    expect(validatePack(pack([]), [keyboard, morse], { preview })).toEqual([{ kind: 'no-questions', severity: 'error' }]);
  });

  it('counts input methods, not adapter objects: the same method twice is one method', () => {
    expect(validatePack(pack([question('q1')]), [keyboard, fakeAdapter('keyboard', all)], { preview: false })).toEqual([
      { kind: 'too-few-inputs', questionId: 'q1', severity: 'error', supportedBy: ['keyboard'] },
    ]);
  });
});
