import { buildTimeline, type GhostState } from '@ghost-examiner/core';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ghost } from './Ghost';
import { useGhostPose } from './useGhostPose';

// ---- Fakes: requestAnimationFrame you step by hand, and prefers-reduced-motion ----------
let frames: Map<number, FrameRequestCallback>;
let nextId: number;
let reduce: boolean;
let mediaListeners: Set<() => void>;
let mediaQueries: number;

beforeEach(() => {
  frames = new Map();
  nextId = 1;
  reduce = false;
  mediaListeners = new Set();
  mediaQueries = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(nextId, cb);
    return nextId++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('matchMedia', (query: string) => {
    mediaQueries++;
    return {
      get matches() {
        return query === '(prefers-reduced-motion: reduce)' && reduce;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => mediaListeners.delete(listener),
    };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Runs every pending frame at time `t`, like the browser does once per display refresh. */
function frame(t: number) {
  const pending = [...frames.values()];
  frames.clear();
  for (const cb of pending) cb(t);
}

// ---- The component under test: Ghost driven by the hook --------------------------------
function AnimatedGhost({ state }: { state: GhostState }) {
  const { ref, pose } = useGhostPose(state);
  return <Ghost ref={ref} pose={pose} locale="en" />;
}

function mount(state: GhostState) {
  const commits = { count: 0 };
  const utils = render(
    <Profiler id="ghost" onRender={() => commits.count++}>
      <AnimatedGhost state={state} />
    </Profiler>,
  );
  return { ...utils, commits, svg: screen.getByRole('img') };
}

const idle: GhostState = { activity: 'idle', expression: 'neutral', seed: 42 };
const visibleMouth = (svg: Element) =>
  svg.querySelector('[data-part="mouth"] path[visibility="visible"]')?.getAttribute('data-viseme');

/** Steps 16 ms frames over [from, to) and records each change of data-blink. */
function blinkChanges(svg: Element, from: number, to: number) {
  const changes: { t: number; blink: string | null }[] = [];
  let last = svg.getAttribute('data-blink');
  for (let t = from; t < to; t += 16) {
    frame(t);
    const now = svg.getAttribute('data-blink');
    if (now !== last) changes.push({ t, blink: now });
    last = now;
  }
  return changes;
}

describe('useGhostPose', () => {
  it('blinking toggles the eye attribute through the ref, without re-rendering the component', () => {
    const { svg, commits } = mount(idle);
    const rendersAfterMount = commits.count;

    const changes = blinkChanges(svg, 0, 9000);
    // One blink per 4.5 s cycle: closes, then opens again, twice in 9 s.
    expect(changes.map((c) => c.blink)).toEqual(['true', 'false', 'true', 'false']);
    expect(changes[1].t - changes[0].t).toBeLessThanOrEqual(128); // ~120 ms, at 16 ms frames
    expect(commits.count).toBe(rendersAfterMount);
  });

  it('with prefers-reduced-motion: reduce, the eyes never close', () => {
    reduce = true;
    const { svg } = mount(idle);
    expect(blinkChanges(svg, 0, 20000)).toEqual([]);
    expect(svg.getAttribute('data-blink')).toBe('false');
  });

  it('follows a change of the reduced-motion setting while running', () => {
    const { svg } = mount(idle);
    reduce = true;
    act(() => mediaListeners.forEach((l) => l()));
    expect(blinkChanges(svg, 0, 20000)).toEqual([]);
  });

  it('moves the mouth with the speech timeline, still without re-rendering', () => {
    const timeline = buildTimeline('Mamá, hola.', 'es'); // MBP 0-60, A 60-120, ..., O 500-620
    const speaking: GhostState = { ...idle, activity: 'speaking', speech: { timeline, startedAt: 1000 } };
    const { svg, commits } = mount(speaking);
    const rendersAfterMount = commits.count;

    const seen = [1000, 1070, 1300, 1510, 1650, 2200].map((t) => {
      frame(t);
      return visibleMouth(svg);
    });
    expect(seen).toEqual(['MBP', 'A', 'rest', 'O', 'A', 'rest']);
    expect(svg.querySelectorAll('[data-part="mouth"] path[visibility="visible"]')).toHaveLength(1);
    expect(commits.count).toBe(rendersAfterMount);
  });

  it('reads the latest state after a re-render, without restarting the loop', () => {
    const timeline = buildTimeline('Hola.', 'es');
    const { svg, rerender } = mount(idle);
    frame(100);
    expect(visibleMouth(svg)).toBe('rest');
    const pendingFrame = [...frames.keys()];
    const queriesBefore = mediaQueries;

    rerender(
      <Profiler id="ghost" onRender={() => {}}>
        <AnimatedGhost state={{ ...idle, activity: 'speaking', speech: { timeline, startedAt: 100 } }} />
      </Profiler>,
    );
    // Same pending frame and no new media query: the loop was not torn down and restarted.
    expect([...frames.keys()]).toEqual(pendingFrame);
    expect(mediaQueries).toBe(queriesBefore);
    frame(100 + timeline.mouth.find((c) => c.viseme === 'O')!.start);
    expect(visibleMouth(svg)).toBe('O');
  });

  it('renders the static parts of the pose (expression, activity) for React to show', () => {
    const { svg } = mount({ ...idle, activity: 'reacting', expression: 'skeptical' });
    expect(svg.getAttribute('data-expression')).toBe('skeptical');
    expect(svg.getAttribute('data-activity')).toBe('reacting');
    expect(screen.getByRole('img', { name: 'The ghost examiner, looking skeptical.' })).toBe(svg);
  });

  it('runs one loop, and stops it and the media listener on unmount', () => {
    const { unmount } = mount(idle);
    expect(frames.size).toBe(1);
    expect(mediaListeners.size).toBe(1);
    frame(16);
    expect(frames.size).toBe(1); // re-scheduled itself once
    unmount();
    expect(frames.size).toBe(0);
    expect(mediaListeners.size).toBe(0);
  });

  it('works without matchMedia (feature-detected): blinks normally', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { svg } = mount(idle);
    expect(blinkChanges(svg, 0, 9000)).toHaveLength(4);
  });
});
