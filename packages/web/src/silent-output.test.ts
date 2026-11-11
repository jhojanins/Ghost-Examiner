import { buildTimeline } from '@ghost-examiner/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSilentOutput } from './silent-output';

const timeline = buildTimeline('Mamá, hola.', 'es'); // 1080 ms
const clock = { now: () => Date.now() }; // Date is faked by vi.useFakeTimers()

function track(done: Promise<void>) {
  const state = { resolved: false };
  void done.then(() => (state.resolved = true));
  return state;
}

describe('createSilentOutput', () => {
  beforeEach(() => vi.useFakeTimers({ now: 5000 }));
  afterEach(() => vi.useRealTimers());

  it('starts at the clock time and resolves exactly at timeline.duration', async () => {
    const { startedAt, done } = createSilentOutput(clock).speak(timeline);
    expect(startedAt).toBe(5000);
    const state = track(done);

    await vi.advanceTimersByTimeAsync(timeline.duration - 1);
    expect(state.resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.resolved).toBe(true);
  });

  it('cancel() resolves early, without error, and clears the timer', async () => {
    const output = createSilentOutput(clock);
    const { done } = output.speak(timeline);
    await vi.advanceTimersByTimeAsync(100);
    output.cancel();
    await expect(done).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a new line ends the previous one: one line plays at a time', async () => {
    const output = createSilentOutput(clock);
    const first = track(output.speak(timeline).done);
    await vi.advanceTimersByTimeAsync(100);
    const second = output.speak(timeline);
    await vi.advanceTimersByTimeAsync(0);
    expect(first.resolved).toBe(true);
    expect(second.startedAt).toBe(5100);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('cancel() with nothing playing does nothing', () => {
    expect(() => createSilentOutput(clock).cancel()).not.toThrow();
  });
});
