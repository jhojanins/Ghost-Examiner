import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../speech/timeline';
import { ghostPose, type GhostState } from './pose';

const state: fc.Arbitrary<GhostState> = fc.record(
  {
    activity: fc.constantFrom('idle', 'speaking', 'listening', 'thinking', 'reacting'),
    expression: fc.constantFrom('neutral', 'attentive', 'thinking', 'approving', 'skeptical', 'amused', 'surprised'),
    seed: fc.integer(),
    speech: fc.record({
      timeline: fc.tuple(fc.string(), fc.constantFrom('en', 'es') as fc.Arbitrary<'en' | 'es'>).map(([t, l]) => buildTimeline(t, l)),
      startedAt: fc.integer({ min: 0, max: 1e9 }),
    }),
  },
  { requiredKeys: ['activity', 'expression', 'seed'] },
);
// Times as a page clock reports them: fractional milliseconds, from 0 up to about 11 days.
const now = fc.double({ min: 0, max: 1e9, noNaN: true });

describe('ghost pose properties', () => {
  it('P7: deterministic, and under reduced motion blink is false and float is 0 (only those differ)', () => {
    fc.assert(
      fc.property(state, now, (s, t) => {
        const normal = ghostPose(s, t, { reducedMotion: false });
        expect(ghostPose(s, t, { reducedMotion: false })).toEqual(normal);
        expect(Math.abs(normal.float)).toBeLessThanOrEqual(1); // normalized: the view scales it to pixels
        const reduced = ghostPose(s, t, { reducedMotion: true });
        expect(reduced.blink).toBe(false);
        expect(reduced.float).toBe(0);
        expect(reduced).toEqual({ ...normal, blink: false, float: 0 });
      }),
      { numRuns: 100 },
    );
  });

  it('P8: without reduced motion, consecutive blink starts are 3000 to 6000 ms apart', () => {
    fc.assert(
      fc.property(state, fc.integer({ min: 0, max: 1e9 }), (s, t0) => {
        // Scan a 15 s window at 1 ms steps; with gaps of at most 6 s it holds at least 2 blinks.
        const starts: number[] = [];
        let prev = ghostPose(s, t0, { reducedMotion: false }).blink;
        for (let t = t0 + 1; t <= t0 + 15000; t++) {
          const blink = ghostPose(s, t, { reducedMotion: false }).blink;
          if (blink && !prev) starts.push(t);
          prev = blink;
        }
        expect(starts.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < starts.length; i++) {
          const gap = starts[i] - starts[i - 1];
          expect(gap).toBeGreaterThanOrEqual(3000);
          expect(gap).toBeLessThanOrEqual(6000);
        }
      }),
      { numRuns: 100 },
    );
  });
});
