import { createDemoProvider, parseDefenseQuestions, splitExcerpts, type Locale } from '@ghost-examiner/core';
import { parsePastedText } from '@ghost-examiner/web';
import { describe, expect, it } from 'vitest';
import { SAMPLES } from './samples';

describe('bundled sample files (Req 1.10)', () => {
  it('has one English and one Spanish sample', () => {
    expect(SAMPLES.map((s) => s.lang)).toEqual(['en', 'es']);
  });

  for (const sample of SAMPLES) {
    it(`${sample.lang}: passes the length rules, splits into at least 4 parts, and gives 4 grounded demo questions in either UI language`, async () => {
      const parsed = parsePastedText(sample.text);
      expect(parsed).toMatchObject({ ok: true, truncated: false });
      const excerpts = splitExcerpts(sample.text, { maxChars: 1500 });
      expect(excerpts.length).toBeGreaterThanOrEqual(4);
      for (const locale of ['en', 'es'] as Locale[]) {
        const r = await createDemoProvider().complete({
          task: 'defense-questions',
          locale,
          maxOutputTokens: 800,
          input: { excerpts: excerpts.map(({ id, text }) => ({ id, text })), count: 4, fileLang: sample.lang },
        });
        const questions = r.ok ? parseDefenseQuestions(JSON.parse(r.text), { excerpts, locale, count: 4 }) : { ok: false as const };
        expect(questions.ok && questions.value.length).toBe(4);
      }
    });
  }
});
