import type { InputAdapter, InputMethodId } from '../input/types';
import type { QuestionPack } from './types';

export type PackIssue =
  | { kind: 'too-few-inputs'; questionId: string; severity: 'warning' | 'error'; supportedBy: InputMethodId[] }
  // Always an error, even in Preview: the engine needs at least one question.
  | { kind: 'no-questions'; severity: 'error' };

/**
 * Reports every question that fewer than 2 registered input methods can answer (Req 5.5):
 * a warning in a Preview build, an error otherwise. Methods are counted by id, so two
 * adapters with the same id count once.
 */
export function validatePack(
  pack: QuestionPack,
  adapters: readonly InputAdapter[],
  opts: { preview: boolean },
): PackIssue[] {
  if (pack.questions.length === 0) return [{ kind: 'no-questions', severity: 'error' }];
  const severity = opts.preview ? 'warning' : 'error';
  return pack.questions.flatMap((q) => {
    const supportedBy = [...new Set(adapters.filter((a) => a.supports.includes(q.kind)).map((a) => a.id))];
    return supportedBy.length < 2 ? [{ kind: 'too-few-inputs' as const, questionId: q.id, severity, supportedBy }] : [];
  });
}
