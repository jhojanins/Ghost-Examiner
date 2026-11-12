import { ghostPose, type GhostPose, type GhostState } from '@ghost-examiner/core';
import { useEffect, useRef, type RefObject } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Animates a <Ghost> (design §5.1, Req 3.3, 3.6): one requestAnimationFrame loop computes
 * `ghostPose` every frame and writes only the changing attributes (blink, visible mouth)
 * straight to the SVG through `ref`, so React never re-renders per frame.
 *
 * The frame timestamp is on the `performance.now()` clock, the same one as `systemClock`,
 * so `state.speech.startedAt` from the speech output lines up with the mouth.
 *
 * Usage: `const { ref, pose } = useGhostPose(state); <Ghost ref={ref} pose={pose} locale={locale} />`.
 * `pose` holds the parts React renders (activity, expression and label); blink and mouth start
 * at rest and the loop takes over from the first frame.
 *
 * `origin` (spec b design §4): the playing line's timeline origin, read every frame. While the
 * ghost speaks, it replaces `state.speech.startedAt`, so a boundary resync moves the mouth with
 * no re-render. `ghostPose` itself stays pure.
 */
export function useGhostPose(
  state: GhostState,
  origin?: () => number,
): { ref: RefObject<SVGSVGElement | null>; pose: GhostPose } {
  const ref = useRef<SVGSVGElement>(null);
  const latest = useRef({ state, origin });

  // The loop reads the newest state and origin without restarting.
  useEffect(() => {
    latest.current = { state, origin };
  });

  useEffect(() => {
    // Feature-detected: without matchMedia the ghost animates normally.
    const media = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(REDUCED_MOTION) : undefined;
    let reducedMotion = media?.matches ?? false;
    const onChange = () => {
      reducedMotion = media?.matches ?? false;
    };
    media?.addEventListener('change', onChange);

    let frame = 0;
    const tick = (now: number) => {
      if (ref.current) writePose(ref.current, ghostPose(withOrigin(latest.current), now, { reducedMotion }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      media?.removeEventListener('change', onChange);
    };
  }, []);

  return { ref, pose: { activity: state.activity, expression: state.expression, viseme: 'rest', blink: false } };
}

/** The state with the speech's start replaced by the current origin, when both exist. */
function withOrigin({ state, origin }: { state: GhostState; origin?: () => number }): GhostState {
  if (!origin || !state.speech) return state;
  return { ...state, speech: { ...state.speech, startedAt: origin() } };
}

/** Writes an attribute only when its value differs, so unchanged frames touch nothing. */
function setIfChanged(el: Element, name: string, value: string) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function writePose(svg: SVGSVGElement, pose: GhostPose) {
  setIfChanged(svg, 'data-blink', String(pose.blink));
  for (const path of svg.querySelectorAll('[data-part="mouth"] path')) {
    setIfChanged(path, 'visibility', path.getAttribute('data-viseme') === pose.viseme ? 'visible' : 'hidden');
  }
}
