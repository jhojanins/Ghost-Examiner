import type { DefenseRequest } from './prompts';

/**
 * The JSON schema each defense task asks the model to follow (design §3.2), for Gemini's
 * `responseJsonSchema`. Only plain keywords (type, properties, required, items, enum, maxItems),
 * so any provider with JSON-schema output accepts it. The client guards still check every field:
 * a schema is a request to the model, not a guarantee.
 */
const str = { type: 'string' } as const;
const quoted = (third: string) => ({
  type: 'object',
  properties: { excerptId: str, quote: str, [third]: str },
  required: ['excerptId', 'quote', third],
});

export function defenseSchema(req: DefenseRequest): object {
  switch (req.task) {
    case 'defense-questions':
      return {
        type: 'object',
        properties: { questions: { type: 'array', items: quoted('prompt'), maxItems: req.input.count + 2 } },
        required: ['questions'],
      };
    case 'defense-reply': {
      const kinds = req.input.followUpAllowed ? ['correction', 'follow-up', 'acknowledgment', 'not-in-file'] : ['correction', 'acknowledgment', 'not-in-file'];
      // Key order: kind, excerptId and quote come before say (design §3.2, for streaming in phase 3).
      return {
        type: 'object',
        properties: { kind: { type: 'string', enum: kinds }, excerptId: str, quote: str, say: { type: 'array', items: str, minItems: 1, maxItems: 4 }, followUp: str },
        required: ['kind', 'say'],
      };
    }
    case 'defense-summary':
      return {
        type: 'object',
        properties: { strength: str, review: { type: 'array', items: quoted('point'), maxItems: 3 } },
        required: ['strength', 'review'],
      };
  }
}
