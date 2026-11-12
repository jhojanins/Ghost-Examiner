import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../speech/timeline';
import { ghostPose, type GhostState } from './pose';

const timeline = buildTimeline('Mamá, hola.', 'es');
const speaking: GhostState = { activity: 'speaking', expression: 'neutral', seed: 7, speech: { timeline, startedAt: 1000 } };

describe('ghostPose', () => {
  it('shows the mouth cue of the timeline at the elapsed time', () => {
    const at = (now: number) => ghostPose(speaking, now, { reducedMotion: false }).viseme;
    // Cues (see timeline.test.ts): MBP 0-60, A 60-120, ..., rest 240-500, O 500-620, A 620-680, rest 680-1080.
    expect(at(1000)).toBe('MBP');
    expect(at(1070)).toBe('A');
    expect(at(1300)).toBe('rest');
    expect(at(1510)).toBe('O');
    expect(at(1650)).toBe('A');
    for (const cue of timeline.mouth) expect(at(1000 + cue.start)).toBe(cue.viseme);
  });

  it('rests the mouth before the line starts, after it ends, and with no speech', () => {
    expect(ghostPose(speaking, 999, { reducedMotion: false }).viseme).toBe('rest');
    expect(ghostPose(speaking, 1000 + timeline.duration, { reducedMotion: false }).viseme).toBe('rest');
    const idle: GhostState = { activity: 'idle', expression: 'neutral', seed: 7 };
    expect(ghostPose(idle, 1070, { reducedMotion: false }).viseme).toBe('rest');
  });

  it('passes activity and expression through', () => {
    const state: GhostState = { activity: 'reacting', expression: 'skeptical', seed: 1 };
    expect(ghostPose(state, 0, { reducedMotion: false })).toMatchObject({ activity: 'reacting', expression: 'skeptical' });
  });

  it('blinks for 120 ms at a time without reduced motion', () => {
    const idle: GhostState = { activity: 'idle', expression: 'neutral', seed: 42 };
    const blinking = [];
    for (let now = 0; now < 9000; now++) if (ghostPose(idle, now, { reducedMotion: false }).blink) blinking.push(now);
    expect(blinking.length).toBe(2 * 120); // one blink in each 4.5 s cycle
  });

  it('reduced motion (Req 3.6): never blinks or floats, but keeps the same expression and mouth shapes', () => {
    for (let now = 0; now < 20000; now += 5) {
      const normal = ghostPose(speaking, now, { reducedMotion: false });
      const reduced = ghostPose(speaking, now, { reducedMotion: true });
      expect(reduced.blink).toBe(false);
      expect(reduced.float).toBe(0);
      expect(reduced).toEqual({ ...normal, blink: false, float: 0 });
    }
  });

  it('floats gently (phase 2, Req 3.10): sin(now / 2400 ms), one slow cycle of about 15 s', () => {
    const idle: GhostState = { activity: 'idle', expression: 'neutral', seed: 7 };
    const float = (now: number) => ghostPose(idle, now, { reducedMotion: false }).float;
    expect(float(0)).toBe(0);
    expect(float(2400 * (Math.PI / 2))).toBeCloseTo(1, 9); // the top
    expect(float(2400 * Math.PI)).toBeCloseTo(0, 9);
    expect(float(2400 * ((3 * Math.PI) / 2))).toBeCloseTo(-1, 9); // the bottom
  });

  it('has the phase 2 fields: float is the only motion field besides blink', () => {
    expect(Object.keys(ghostPose(speaking, 0, { reducedMotion: false })).sort()).toEqual(
      ['activity', 'blink', 'expression', 'float', 'viseme'],
    );
  });
});
