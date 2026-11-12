import type { GhostState } from '@ghost-examiner/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ghost } from './Ghost';
import { MotionToggle } from './MotionToggle';
import { useGhostPose } from './useGhostPose';

// requestAnimationFrame stepped by hand; no matchMedia, so only the toggle can stop motion.
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
  vi.stubGlobal('matchMedia', undefined);
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

describe('MotionToggle', () => {
  it('is a native toggle button: aria-pressed shows paused, named in full in EN and ES', () => {
    const onChange = vi.fn();
    const { rerender } = render(<MotionToggle locale="en" paused={false} onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Pause motion', pressed: false });
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<MotionToggle locale="en" paused onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Pause motion', pressed: true })).toBe(button);
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith(false);
    rerender(<MotionToggle locale="es" paused onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Pausar movimiento', pressed: true })).toBe(button);
  });

  it('has a short visible label for narrow screens, contained in the accessible name (WCAG 2.5.3)', () => {
    for (const [locale, full, short] of [
      ['en', 'Pause motion', 'Pause'],
      ['es', 'Pausar movimiento', 'Pausar'],
    ] as const) {
      render(<MotionToggle locale={locale} paused={false} onChange={() => {}} />);
      const button = screen.getByRole('button', { name: full });
      expect([...button.querySelectorAll('span')].map((s) => s.textContent)).toEqual([full, short]);
      // Whole words, as axe's label-content-name-mismatch checks: "Pausa" inside "Pausar" failed it.
      expect(full.split(' ')).toContain(short);
      cleanup();
    }
  });

  it('wired to the ghost: pressing it stops floating and blinking; pressing again brings them back', () => {
    const idle: GhostState = { activity: 'idle', expression: 'neutral', seed: 42 };
    function Page() {
      const [paused, setPaused] = useState(false);
      const { ref, pose } = useGhostPose(idle, undefined, paused);
      return (
        <>
          <MotionToggle locale="en" paused={paused} onChange={setPaused} />
          <Ghost ref={ref} pose={pose} locale="en" />
        </>
      );
    }
    render(<Page />);
    const svg = screen.getByRole('img');
    const wrapper = svg.parentElement as HTMLElement;
    /** Steps 16 ms frames over [from, to): every float offset seen, and whether the eyes closed. */
    const motion = (from: number, to: number) => {
      const offsets = new Set<string>();
      let blinked = false;
      for (let t = from; t < to; t += 16) {
        frame(t);
        offsets.add(wrapper.style.transform);
        blinked ||= svg.getAttribute('data-blink') === 'true';
      }
      return { offsets: offsets.size, blinked };
    };
    expect(motion(0, 10000)).toMatchObject({ blinked: true });
    expect(motion(0, 10000).offsets).toBeGreaterThan(10);

    fireEvent.click(screen.getByRole('button', { name: 'Pause motion' }));
    expect(screen.getByRole('button', { name: 'Pause motion', pressed: true })).toBeTruthy();
    expect(motion(10000, 30000)).toEqual({ offsets: 1, blinked: false });
    expect(wrapper.style.transform).toBe('translateY(0px)');

    fireEvent.click(screen.getByRole('button', { name: 'Pause motion' }));
    expect(motion(30000, 40000)).toMatchObject({ blinked: true });
  });
});
