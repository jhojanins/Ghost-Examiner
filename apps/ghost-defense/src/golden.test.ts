import {
  createDemoProvider,
  parseDefenseQuestions,
  parseDefenseReply,
  parseDefenseSummary,
  splitExcerpts,
  verifyQuote,
  type DefenseQuestion,
  type Excerpt,
  type LLMRequest,
  type Locale,
} from '@ghost-examiner/core';
import { parsePastedText } from '@ghost-examiner/web';
import { describe, expect, it } from 'vitest';

/**
 * The golden set (ghost-defense-live Req 15.5, 15.6): 6 fictional files in EN and ES, each with an
 * expectations file. The demo provider must pass them automatically (schema, grounding, quotes);
 * `wrongClaim` is for the real-provider evaluation before release, so here it is only checked to
 * be a real passage of the file.
 */
interface Expectation {
  kind: string;
  lang: Locale;
  minQuestions: number;
  /** The sections good questions may cite. */
  questionHeadings: string[];
  /** Sections at least one question must cite. */
  mustAskAbout: string[];
  /** Text no quote may contain (injected instructions, fake delimiters, notes about the file). */
  neverQuote: string[];
  /** Text the ghost may never say (what an injection asks for). */
  neverSay: string[];
  wrongClaim: { heading: string; claim: string; evidence: string } | null;
}

const texts = import.meta.glob<string>('../content/samples/*.md', { query: '?raw', import: 'default', eager: true });
const expectations = import.meta.glob<Expectation>('../content/samples/*.expect.json', { import: 'default', eager: true });
const names = Object.keys(texts).map((p) => p.replace(/^.*\/(.+)\.md$/, '$1'));
const demo = createDemoProvider();
const EXCERPT_CHARS = 1500; // as the app splits

async function ask(req: LLMRequest): Promise<unknown> {
  const r = await demo.complete(req);
  if (!r.ok) throw new Error(r.error);
  return JSON.parse(r.text);
}
const input = (excerpts: Excerpt[]) => excerpts.map(({ id, text }) => ({ id, text }));
const contains = (text: string, needles: string[]) => needles.filter((n) => text.toLowerCase().includes(n.toLowerCase()));

describe('golden set (Req 15.5)', () => {
  it('has 6 files, 3 in English and 3 in Spanish, each with an expectations file', () => {
    expect(names).toHaveLength(6);
    for (const name of names) expect(expectations[`../content/samples/${name}.expect.json`], name).toBeDefined();
    const langs = names.map((n) => expectations[`../content/samples/${n}.expect.json`].lang);
    expect(langs.filter((l) => l === 'en')).toHaveLength(3);
    expect(langs.filter((l) => l === 'es')).toHaveLength(3);
  });
});

for (const name of names) {
  const text = texts[`../content/samples/${name}.md`];
  const x = expectations[`../content/samples/${name}.expect.json`];
  const excerpts = splitExcerpts(text, { maxChars: EXCERPT_CHARS });
  const headingOf = (id: string) => excerpts.find((e) => e.id === id)?.heading;

  describe(`golden file ${name} (${x.kind}): the demo provider (Req 15.6)`, () => {
    it('passes the upload limits and names only sections that exist', () => {
      expect(parsePastedText(text)).toMatchObject({ ok: true, truncated: false });
      const headings = new Set(excerpts.map((e) => e.heading));
      for (const h of [...x.questionHeadings, ...x.mustAskAbout]) expect(headings, h).toContain(h);
      if (x.wrongClaim) {
        const section = excerpts.find((e) => e.heading === x.wrongClaim?.heading);
        expect(section && verifyQuote(x.wrongClaim.claim, section.text)).toBe(true);
        expect(excerpts.some((e) => verifyQuote(x.wrongClaim!.evidence, e.text))).toBe(true);
      }
    });

    for (const locale of ['en', 'es'] as const) {
      it(`${locale} UI: grounded questions with verified quotes, replies and a summary that pass the guards`, async () => {
        const req: LLMRequest = { task: 'defense-questions', locale, maxOutputTokens: 800, input: { excerpts: input(excerpts), count: 4, fileLang: x.lang } };
        const parsed = parseDefenseQuestions(await ask(req), { excerpts, locale, count: 4 });
        expect(parsed.ok).toBe(true);
        const questions: DefenseQuestion[] = parsed.ok ? parsed.value : [];
        expect(questions.length).toBeGreaterThanOrEqual(x.minQuestions);
        const cited = questions.map((q) => headingOf(q.excerptId));
        for (const h of cited) expect(x.questionHeadings, `cited "${h}"`).toContain(h);
        for (const h of x.mustAskAbout) expect(cited).toContain(h);
        for (const q of questions) {
          expect(contains(q.quote, x.neverQuote), q.quote).toEqual([]);
          expect(contains(q.prompt, x.neverSay), q.prompt).toEqual([]);
        }

        const turns = [];
        for (const q of questions) {
          // A matching answer, a vague one, and a vague one where no follow-up is allowed.
          for (const [answer, followUpAllowed] of [[q.quote, true], ['I am not sure about this part.', true], ['No lo sé muy bien.', false]] as const) {
            const replyReq: LLMRequest = {
              task: 'defense-reply',
              locale,
              maxOutputTokens: 400,
              input: { excerpts: input(excerpts), question: q.prompt, quote: q.quote, answer, followUpAllowed },
            };
            const reply = parseDefenseReply(await ask(replyReq), { excerpts, locale, followUpAllowed });
            expect(reply.ok, `${q.excerptId}: ${answer}`).toBe(true);
            if (!reply.ok) continue;
            expect(contains([...reply.value.say, reply.value.followUp ?? ''].join(' '), x.neverSay)).toEqual([]);
            expect(contains(reply.value.quote ?? '', x.neverQuote)).toEqual([]);
            turns.push({ question: q.prompt, answer, kind: reply.value.kind });
          }
        }
        const summary = parseDefenseSummary(
          await ask({ task: 'defense-summary', locale, maxOutputTokens: 500, input: { turns, excerpts: input(excerpts) } }),
          { excerpts, locale },
        );
        expect(summary.ok).toBe(true);
        if (summary.ok) for (const r of summary.value.review) expect(contains(r.quote, x.neverQuote), r.quote).toEqual([]);
      });
    }
  });
}
