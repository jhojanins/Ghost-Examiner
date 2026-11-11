import { describe, expect, it } from 'vitest';
import { FEEDBACK_TEXT_MAX, isFeedback } from './is-feedback';

const valid = {
  summary: 'A clear answer with a real example.',
  strength: 'You covered the action.',
  improvement: 'Add one result you can measure.',
  reaction: 'approving',
  locale: 'en',
};
const without = (key: keyof typeof valid) => Object.fromEntries(Object.entries(valid).filter(([k]) => k !== key));

describe('isFeedback', () => {
  it('accepts a complete feedback object, including one parsed from JSON', () => {
    expect(isFeedback(valid)).toBe(true);
    expect(isFeedback(JSON.parse(JSON.stringify({ ...valid, reaction: 'skeptical', locale: 'es' })))).toBe(true);
  });

  it.each(Object.keys(valid) as (keyof typeof valid)[])('rejects a missing field: %s', (key) => {
    expect(isFeedback(without(key))).toBe(false);
  });

  it('rejects extra fields, including a JSON "__proto__" key', () => {
    expect(isFeedback({ ...valid, score: 10 })).toBe(false);
    expect(isFeedback({ ...valid, followUp: undefined })).toBe(false);
    expect(isFeedback(JSON.parse(`{"__proto__": {"x": 1}, ${JSON.stringify(valid).slice(1)}`))).toBe(false);
  });

  it.each([
    ['summary', 42],
    ['strength', null],
    ['improvement', ['Add a result.']],
    ['reaction', true],
    ['locale', { en: true }],
  ])('rejects a wrong type: %s = %j', (key, value) => {
    expect(isFeedback({ ...valid, [key]: value })).toBe(false);
  });

  it.each([
    ['reaction', 'amused'],
    ['reaction', 'APPROVING'],
    ['locale', 'fr'],
    ['locale', 'es-MX'],
  ])('rejects an unknown value: %s = %s', (key, value) => {
    expect(isFeedback({ ...valid, [key]: value })).toBe(false);
  });

  it('rejects empty, blank and over-long text', () => {
    expect(isFeedback({ ...valid, summary: '' })).toBe(false);
    expect(isFeedback({ ...valid, strength: '  \n ' })).toBe(false);
    expect(isFeedback({ ...valid, improvement: 'x'.repeat(FEEDBACK_TEXT_MAX) })).toBe(true);
    expect(isFeedback({ ...valid, improvement: 'x'.repeat(FEEDBACK_TEXT_MAX + 1) })).toBe(false);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'feedback'],
    ['a number', 3],
    ['an empty array', []],
    ['an array holding valid feedback', [valid]],
    ['a Map with the right entries', new Map(Object.entries(valid))],
  ])('rejects a non-object or non-plain object: %s', (_, value) => {
    expect(isFeedback(value)).toBe(false);
  });

  it('rejects an object whose fields come from its prototype, not its own keys', () => {
    expect(isFeedback(Object.create(valid))).toBe(false);
  });

  it('rejects the right own fields on a non-plain prototype (e.g. one that changes serialization)', () => {
    const sneaky = Object.setPrototypeOf({ ...valid }, { toJSON: () => ({ summary: 'something else' }) });
    expect(isFeedback(sneaky)).toBe(false);
    expect(isFeedback(Object.assign(Object.create(null), valid))).toBe(true); // null prototype is still plain
  });

  it('never reads a missing field through Object.prototype (prototype pollution)', () => {
    const proto = Object.prototype as Record<string, unknown>;
    proto.locale = 'en';
    try {
      expect(isFeedback(without('locale'))).toBe(false);
      // Five own keys, one of them unknown, with the missing field supplied by the prototype.
      expect(isFeedback({ ...without('locale'), score: 10 })).toBe(false);
    } finally {
      delete proto.locale;
    }
  });
});
