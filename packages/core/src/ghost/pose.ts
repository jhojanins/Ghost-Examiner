import type { Timeline, Viseme } from '../speech/timeline';

export type Expression = 'neutral' | 'thinking' | 'approving' | 'skeptical'; // phase 2 adds 3
export type GhostActivity = 'idle' | 'speaking' | 'listening' | 'thinking' | 'reacting';
export interface GhostState {
  activity: GhostActivity;
  expression: Expression;
  speech?: { timeline: Timeline; startedAt: number };
  seed: number;
}
export interface GhostPose {
  activity: GhostActivity;
  expression: Expression;
  viseme: Viseme;
  blink: boolean;
} // phase 2 adds float

const BLINK_CYCLE_MS = 4500;
const BLINK_JITTER_MS = 1500; // blink start offset within a cycle: [0, 1500)
const BLINK_MS = 120;

/** 32-bit integer hash of (seed, cycle); stands in for a seeded RNG so poses are deterministic. */
function hash(seed: number, cycle: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(cycle, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * One blink per 4.5 s cycle, starting at a seeded offset in [0, 1.5 s), so consecutive
 * blinks are 3 to 6 s apart (Req 3.3).
 */
function isBlinking(seed: number, now: number): boolean {
  const cycle = Math.floor(now / BLINK_CYCLE_MS);
  const offset = hash(seed, cycle) % BLINK_JITTER_MS;
  const t = now - cycle * BLINK_CYCLE_MS - offset;
  return t >= 0 && t < BLINK_MS;
}

function visemeAt(speech: GhostState['speech'], now: number): Viseme {
  if (!speech) return 'rest';
  const elapsed = now - speech.startedAt;
  return speech.timeline.mouth.find((c) => elapsed >= c.start && elapsed < c.end)?.viseme ?? 'rest';
}

/**
 * Pure pose of the ghost at time `now` (ms, from the caller's clock) (Req 3.9). Reduced
 * motion removes blinking, the only non-essential motion in phase 1, and keeps the
 * expression and mouth, which carry meaning when muted (Req 3.6).
 */
export function ghostPose(state: GhostState, now: number, opts: { reducedMotion: boolean }): GhostPose {
  return {
    activity: state.activity,
    expression: state.expression,
    viseme: visemeAt(state.speech, now),
    blink: !opts.reducedMotion && isBlinking(state.seed, now),
  };
}
