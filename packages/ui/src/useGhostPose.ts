import { ghostPose, type GhostPose, type GhostState } from '@ghost-examiner/core';
import { useEffect, useRef, type RefObject } from 'react';
import { floatTransform } from './Ghost';

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
 *
 * `paused` (design §5.4, Req 3.7): the motion toggle. While true the ghost moves as under
 * `prefers-reduced-motion`, whatever the media query says: no floating, no blinking.
 */
export function useGhostPose(
  state: GhostState,
  origin?: () => number,
  paused = false,
): { ref: RefObject<SVGSVGElement | null>; pose: GhostPose } {
  const ref = useRef<SVGSVGElement>(null);
  const latest = useRef({ state, origin, paused });

  // The loop reads the newest state, origin and paused without restarting.
  useEffect(() => {
    latest.current = { state, origin, paused };
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
      const reduce = reducedMotion || latest.current.paused;
      if (ref.current) writePose(ref.current, ghostPose(withOrigin(latest.current), now, { reducedMotion: reduce }), reduce);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      media?.removeEventListener('change', onChange);
    };
  }, []);

  return { ref, pose: { activity: state.activity, expression: state.expression, viseme: 'rest', blink: false, float: 0 } };
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

/** Writes the per-frame parts: blink, the motion setting (Ghost.css caps transitions), mouth, float. */
function writePose(svg: SVGSVGElement, pose: GhostPose, reducedMotion: boolean) {
  setIfChanged(svg, 'data-blink', String(pose.blink));
  setIfChanged(svg, 'data-reduced-motion', String(reducedMotion));
  const wrapper = svg.parentElement;
  if (wrapper?.classList.contains('ge-ghost-float')) {
    const transform = floatTransform(pose.float);
    if (wrapper.style.transform !== transform) wrapper.style.transform = transform;
  }
  for (const path of svg.querySelectorAll('[data-part="mouth"] path')) {
    setIfChanged(path, 'visibility', path.getAttribute('data-viseme') === pose.viseme ? 'visible' : 'hidden');
  }
}
