import { describe, expect, it } from 'vitest';
import { selectExcerpts, splitExcerpts, type Excerpt } from './excerpts';

const texts = (es: Excerpt[]) => es.map((e) => e.text.trim());

describe('splitExcerpts', () => {
  it('starts a new excerpt at each Markdown heading and carries the heading to the section', () => {
    const doc = '# Method\n\nWe used a queue.\n\nIt was slow.\n\n## Results\n\nIt worked.';
    const es = splitExcerpts(doc, { maxChars: 1500 });
    expect(texts(es)).toEqual(['# Method\n\nWe used a queue.\n\nIt was slow.', '## Results\n\nIt worked.']);
    expect(es.map((e) => e.heading)).toEqual(['Method', 'Results']);
  });

  it('groups paragraphs up to the limit, then starts a new excerpt', () => {
    const para = 'A'.repeat(30) + '.';
    const es = splitExcerpts([para, para, para].join('\n\n'), { maxChars: 70 });
    expect(texts(es)).toEqual([`${para}\n\n${para}`, para]);
  });

  it('cuts a paragraph longer than the limit at sentence ends', () => {
    const s = (c: string) => c.repeat(20) + '.';
    const es = splitExcerpts(`${s('a')} ${s('b')} ${s('c')}`, { maxChars: 45 });
    expect(texts(es)).toEqual([`${s('a')} ${s('b')}`, s('c')]);
  });

  it('keeps one sentence longer than the limit whole', () => {
    const long = 'word '.repeat(40).trim() + '.';
    expect(texts(splitExcerpts(long, { maxChars: 50 }))).toEqual([long]);
  });

  it('gives the heading to every excerpt of a long section', () => {
    const para = 'B'.repeat(40) + '.';
    const es = splitExcerpts(`# Intro\n\n${para}\n\n${para}`, { maxChars: 60 });
    expect(es.map((e) => e.heading)).toEqual(['Intro', 'Intro']);
  });

  it('returns nothing for blank text', () => {
    expect(splitExcerpts(' \n\t\n ', { maxChars: 100 })).toEqual([]);
  });
});

describe('selectExcerpts', () => {
  const make = (n: number, size: number): Excerpt[] =>
    Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, text: 'x'.repeat(size), start: i * size, end: (i + 1) * size }));
  const ids = (es: Excerpt[]) => es.map((e) => e.id);

  it('takes everything when it fits', () => {
    expect(ids(selectExcerpts(make(4, 100), { budget: 1000 }))).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('samples evenly across the document, in order, within the budget', () => {
    expect(ids(selectExcerpts(make(10, 100), { budget: 300 }))).toEqual(['e1', 'e6', 'e10']);
  });

  it('around an excerpt: that one first, then its neighbors, returned in document order', () => {
    expect(ids(selectExcerpts(make(10, 100), { budget: 300, around: 'e5' }))).toEqual(['e4', 'e5', 'e6']);
    expect(ids(selectExcerpts(make(10, 100), { budget: 300, around: 'e1' }))).toEqual(['e1', 'e2', 'e3']);
  });

  it('never includes an excerpt larger than the budget', () => {
    const es = [...make(2, 100), { id: 'e3', text: 'y'.repeat(900), start: 200, end: 1100 }];
    expect(ids(selectExcerpts(es, { budget: 500 }))).toEqual(['e1', 'e2']);
  });
});
