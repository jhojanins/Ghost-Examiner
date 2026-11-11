import type { Feedback } from '../engine/types';

/** Longest accepted text field, in UTF-16 code units. Demo feedback lines are well under 200. */
export const FEEDBACK_TEXT_MAX = 500;

const TEXT_KEYS = ['summary', 'strength', 'improvement'] as const;
const KEYS: ReadonlySet<PropertyKey> = new Set([...TEXT_KEYS, 'reaction', 'locale']);
const REACTIONS: readonly unknown[] = ['approving', 'skeptical'];
const LOCALES: readonly unknown[] = ['en', 'es'];

const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '' && v.length <= FEEDBACK_TEXT_MAX;

/**
 * Strict guard for untrusted evaluator output (model text after JSON.parse). Accepts only a
 * plain object with exactly the five `Feedback` keys as own properties: no missing or extra
 * keys (an own "__proto__" key from JSON counts as extra), non-blank text up to
 * FEEDBACK_TEXT_MAX, and only the known `reaction` and `locale` values.
 */
export function isFeedback(value: unknown): value is Feedback {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;

  // Exactly the five keys, all own: nothing extra, and nothing read through a prototype
  // (even a polluted Object.prototype can't supply a missing field).
  const keys = Reflect.ownKeys(value);
  if (keys.length !== KEYS.size || !keys.every((k) => KEYS.has(k))) return false;

  const v = value as Record<string, unknown>;
  return TEXT_KEYS.every((k) => isText(v[k])) && REACTIONS.includes(v.reaction) && LOCALES.includes(v.locale);
}
