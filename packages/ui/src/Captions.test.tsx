import { buildTimeline } from '@ghost-examiner/core';
import { cleanup, render } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Captions, type CaptionLine } from './Captions';

// requestAnimationFrame you step by hand.
let frames: Map<number, FrameRequestCallback>;
let nextId: number;
beforeEach(() => {
  frames = new Map();
  nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(nextId, cb);
    return nextId++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function frame(t: number) {
  const pending = [...frames.values()];
  frames.clear();
  for (const cb of pending) cb(t);
}

// Words (see timeline.test.ts): "Mamá," 0-240, pause 240-440, "hola." 440-680, then rest to 1080.
const line = (p: Partial<CaptionLine> = {}): CaptionLine => ({
  id: 1,
  text: 'Mamá, hola.',
  locale: 'es',
  timeline: buildTimeline('Mamá, hola.', 'es'),
  startedAt: 1000,
  playing: true,
  ...p,
});
const words = (c: HTMLElement) => [...c.querySelectorAll('.ge-caption-word')].map((w) => w.textContent);
const current = (c: HTMLElement) =>
  [...c.querySelectorAll('.ge-caption-word--current')].map((w) => w.textContent);

describe('Captions', () => {
  it('renders the full line at once, before any frame runs', () => {
    const { container } = render(<Captions line={line()} />);
    expect(words(container)).toEqual(['Mamá,', 'hola.']);
    expect(container.textContent).toBe('Mamá, hola.');
    expect(current(container)).toEqual([]);
  });

  it('marks the word at the mocked time with the underline-and-bold class', () => {
    const { container } = render(<Captions line={line()} />);
    const at = (t: number) => {
      frame(1000 + t);
      return current(container);
    };
    expect(at(0)).toEqual(['Mamá,']);
    expect(at(239)).toEqual(['Mamá,']);
    expect(at(300)).toEqual(['Mamá,']); // during the comma pause the last word stays marked
    expect(at(440)).toEqual(['hola.']);
    expect(at(1079)).toEqual(['hola.']);
    expect(at(1080)).toEqual([]); // the line is over
    expect(at(-10)).toEqual([]); // not started yet
  });

  it('marks no word once the line has finished playing', () => {
    const { container } = render(<Captions line={line({ playing: false })} />);
    frame(1100);
    expect(current(container)).toEqual([]);
    expect(words(container)).toEqual(['Mamá,', 'hola.']); // the text stays visible
  });

  it('is aria-hidden (the transcript announces lines) and carries the line language', () => {
    const { container } = render(<Captions line={line()} />);
    const captions = container.querySelector('.ge-captions')!;
    expect(captions.getAttribute('aria-hidden')).toBe('true');
    expect(captions.getAttribute('lang')).toBe('es');
  });

  it('moves the marker without re-rendering, and a new line starts unmarked', () => {
    let commits = 0;
    const tree = (l: CaptionLine) => (
      <Profiler id="captions" onRender={() => commits++}>
        <Captions line={l} />
      </Profiler>
    );
    const { container, rerender } = render(tree(line()));
    const afterMount = commits;
    for (let t = 1000; t < 2100; t += 16) frame(t);
    expect(commits).toBe(afterMount);

    frame(1100); // marks word 0, which the next line also has
    expect(current(container)).toEqual(['Mamá,']);
    rerender(tree(line({ id: 2, text: 'Bien.', timeline: buildTimeline('Bien.', 'es'), startedAt: 5000 })));
    expect(words(container)).toEqual(['Bien.']);
    expect(current(container)).toEqual([]); // no marker carried over from the old line
  });

  it('renders nothing without a line, and stops its loop on unmount', () => {
    const { container, unmount } = render(<Captions />);
    expect(container.querySelector('.ge-caption-word')).toBeNull();
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });
});
