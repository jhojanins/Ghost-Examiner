import type { Expression, GhostPose, Locale, Viseme } from '@ghost-examiner/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Ghost } from './Ghost';
import css from './Ghost.css?raw';

afterEach(cleanup);

const EXPRESSIONS: Expression[] = ['neutral', 'attentive', 'thinking', 'approving', 'skeptical', 'amused', 'surprised'];
const VISEMES: Viseme[] = ['rest', 'A', 'E', 'O', 'U', 'MBP', 'FV'];
const LABELS: Record<Locale, Record<Expression, string>> = {
  en: {
    neutral: 'The ghost examiner, looking calm.',
    attentive: 'The ghost examiner, listening closely.',
    thinking: 'The ghost examiner, thinking.',
    approving: 'The ghost examiner, looking satisfied.',
    skeptical: 'The ghost examiner, looking skeptical.',
    amused: 'The ghost examiner, looking quietly amused.',
    surprised: 'The ghost examiner, looking surprised.',
  },
  es: {
    neutral: 'El examinador fantasma, tranquilo.',
    attentive: 'El examinador fantasma, escuchando con atención.',
    thinking: 'El examinador fantasma, pensando.',
    approving: 'El examinador fantasma, satisfecho.',
    skeptical: 'El examinador fantasma, con cara de duda.',
    amused: 'El examinador fantasma, con un gesto divertido.',
    surprised: 'El examinador fantasma, sorprendido.',
  },
};
// Design §5.3 / Req 3.11: body gradient, glasses, bow tie, features and outlines. No purple, nothing else.
const PALETTE = new Set(['#ffffff', '#e3fbf4', '#a9e8d6', '#e8a13a', '#e8892f', '#0b1020']);

const pose = (p: Partial<GhostPose> = {}): GhostPose => ({
  activity: 'idle',
  expression: 'neutral',
  viseme: 'rest',
  blink: false,
  ...p,
});
const visibleMouths = (svg: Element) =>
  [...svg.querySelectorAll('[data-part="mouth"] path')]
    .filter((p) => p.getAttribute('visibility') === 'visible')
    .map((p) => p.getAttribute('data-viseme'));

describe('Ghost', () => {
  for (const locale of ['en', 'es'] as const) {
    for (const expression of EXPRESSIONS) {
      for (const viseme of VISEMES) {
        it(`${locale}, ${expression}, ${viseme}: only the ${viseme} mouth is visible and the label names the expression`, () => {
          render(<Ghost pose={pose({ expression, viseme })} locale={locale} />);
          const svg = screen.getByRole('img', { name: LABELS[locale][expression] });
          expect(svg.tagName.toLowerCase()).toBe('svg');
          expect(svg.getAttribute('data-expression')).toBe(expression);
          expect(visibleMouths(svg)).toEqual([viseme]);
        });
      }
    }
  }

  it('gives every expression but neutral its own look in Ghost.css, on brows and eyes', () => {
    /** Each expression's rules, as "part: transform" pairs, from the stylesheet text. */
    const rules = (expression: Expression) =>
      [...css.matchAll(new RegExp(`\\[data-expression='${expression}'\\] \\.ge-([a-z-]+) \\{\\s*transform: ([^;]+);`, 'g'))]
        .map(([, part, transform]) => `${part}: ${transform}`)
        .sort()
        .join('; ');
    expect(rules('neutral')).toBe(''); // neutral is the drawing itself
    const looks = EXPRESSIONS.filter((e) => e !== 'neutral').map((e) => [e, rules(e)] as const);
    for (const [expression, look] of looks) {
      expect(look, expression).toMatch(/brow/);
      expect(look, expression).toMatch(/eye/);
    }
    expect(new Set(looks.map(([, look]) => look)).size).toBe(looks.length);
  });

  it('has one pre-drawn mouth path per viseme', () => {
    render(<Ghost pose={pose()} locale="en" />);
    const paths = [...screen.getByRole('img').querySelectorAll('[data-part="mouth"] path')];
    expect(paths.map((p) => p.getAttribute('data-viseme'))).toEqual(VISEMES);
  });

  it('uses only the design palette (no purple can slip in)', () => {
    render(<Ghost pose={pose({ expression: 'skeptical', viseme: 'A' })} locale="en" />);
    const svg = screen.getByRole('img');
    const colors = [svg, ...svg.querySelectorAll('*')].flatMap((el) =>
      ['fill', 'stroke', 'stop-color', 'color', 'style']
        .map((attr) => el.getAttribute(attr))
        .filter((v): v is string => v !== null),
    );
    expect(colors.length).toBeGreaterThan(20);
    for (const value of colors) {
      if (value === 'none' || /^url\(#[^)]+\)$/.test(value)) continue;
      expect(PALETTE, `color "${value}"`).toContain(value.toLowerCase());
    }
  });

  it('draws the examiner: body, eyes, brows, glasses, mouth, bow tie, clipboard and hands', () => {
    render(<Ghost pose={pose()} locale="en" />);
    const parts = [...screen.getByRole('img').querySelectorAll('[data-part]')].map((el) => el.getAttribute('data-part'));
    expect(parts).toEqual(
      expect.arrayContaining(['body', 'brows', 'eye-left', 'eye-right', 'glasses', 'mouth', 'bowtie', 'clipboard', 'hands']),
    );
  });

  it('exposes blink and activity for the stylesheet and the animation hook', () => {
    render(<Ghost pose={pose({ blink: true, activity: 'speaking' })} locale="en" />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('data-blink')).toBe('true');
    expect(svg.getAttribute('data-activity')).toBe('speaking');
  });

  it('rounds every coordinate to at most 1 decimal', () => {
    render(<Ghost pose={pose()} locale="en" />);
    const svg = screen.getByRole('img');
    const geometry = [svg, ...svg.querySelectorAll('*')].flatMap((el) =>
      ['d', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'viewBox', 'stroke-width']
        .map((attr) => el.getAttribute(attr) ?? ''),
    );
    for (const value of geometry) expect(value, value).not.toMatch(/\d\.\d{2,}/);
  });

  it('gives each ghost its own gradient id, so two ghosts on a page never clash', () => {
    render(
      <>
        <Ghost pose={pose()} locale="en" />
        <Ghost pose={pose()} locale="en" />
      </>,
    );
    const ids = [...document.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
    for (const svg of screen.getAllByRole('img')) {
      const id = svg.querySelector('linearGradient')!.id;
      expect(svg.querySelector('[data-part="body"]')!.getAttribute('fill')).toBe(`url(#${id})`);
    }
  });
});
