import { describe, expect, it } from 'vitest';
import type { DefenseRequest } from './prompts';
import { defenseSchema } from './schemas';

const excerpts = [{ id: 'e1', text: 'We chose a queue because the payment service was slow.' }];
const reply = (followUpAllowed: boolean): DefenseRequest => ({
  task: 'defense-reply',
  locale: 'en',
  maxOutputTokens: 400,
  input: { excerpts, question: 'Why?', quote: 'We chose a queue', answer: 'It was slow.', followUpAllowed },
});
type Schema = { properties: Record<string, Schema & { enum?: string[]; maxItems?: number; items?: Schema }>; required?: string[] };

describe('defenseSchema (design §3.2: JSON schema output, shared by the proxy and BYOK)', () => {
  it('questions: an object with a questions array of at most count + 2 items, each with excerptId, quote and prompt', () => {
    const s = defenseSchema({ task: 'defense-questions', locale: 'en', maxOutputTokens: 800, input: { excerpts, count: 5, fileLang: 'en' } }) as Schema;
    expect(s.required).toEqual(['questions']);
    expect(s.properties.questions.maxItems).toBe(7);
    expect(s.properties.questions.items?.required).toEqual(['excerptId', 'quote', 'prompt']);
  });
  it('reply: kind first and say last, so a stream delivers the head first; follow-up only when allowed', () => {
    const s = defenseSchema(reply(true)) as Schema;
    expect(Object.keys(s.properties)).toEqual(['kind', 'excerptId', 'quote', 'say', 'followUp']);
    expect(s.required).toEqual(['kind', 'say']);
    expect(s.properties.kind.enum).toEqual(['correction', 'follow-up', 'acknowledgment', 'not-in-file']);
    expect((defenseSchema(reply(false)) as Schema).properties.kind.enum).toEqual(['correction', 'acknowledgment', 'not-in-file']);
    expect(s.properties.say.maxItems).toBe(4);
  });
  it('summary: a strength and at most 3 review points with quotes', () => {
    const s = defenseSchema({ task: 'defense-summary', locale: 'es', maxOutputTokens: 500, input: { excerpts, turns: [] } }) as Schema;
    expect(s.required).toEqual(['strength', 'review']);
    expect(s.properties.review.maxItems).toBe(3);
    expect(s.properties.review.items?.required).toEqual(['excerptId', 'quote', 'point']);
  });
});
