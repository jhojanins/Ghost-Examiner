import type { SessionEvent } from '@ghost-examiner/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSession, type SessionStore } from './useSession';

afterEach(cleanup);

type View = { phase: string };

/** A hand-driven stand-in for the runtime handle from @ghost-examiner/web. */
function fakeHandle(initial: View) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const handle: SessionStore<View> = {
    getSnapshot: () => snapshot,
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    dispatch: vi.fn(),
  };
  return {
    handle,
    listeners,
    /** Changes the snapshot without telling anyone. */
    setSilently: (next: View) => (snapshot = next),
    /** Changes the snapshot and notifies, like the runtime after a dispatch. */
    publish: (next: View) => act(() => {
      snapshot = next;
      listeners.forEach((l) => l());
    }),
    /** Notifies without changing the snapshot. */
    ping: () => act(() => listeners.forEach((l) => l())),
  };
}

function Screen({ handle }: { handle: SessionStore<View> }) {
  const { view, dispatch } = useSession(handle);
  return (
    <>
      <p>phase: {view.phase}</p>
      <button type="button" onClick={() => dispatch({ type: 'start' })}>
        Start
      </button>
    </>
  );
}

function mount(handle: SessionStore<View>) {
  const renders = { count: 0 };
  const view = render(
    <Profiler id="screen" onRender={() => renders.count++}>
      <Screen handle={handle} />
    </Profiler>,
  );
  return { ...view, renders };
}

describe('useSession', () => {
  it('renders the current snapshot', () => {
    const { handle } = fakeHandle({ phase: 'intro' });
    mount(handle);
    expect(screen.getByText('phase: intro')).toBeTruthy();
  });

  it('re-renders when the handle notifies with a new snapshot', () => {
    const fake = fakeHandle({ phase: 'intro' });
    const { renders } = mount(fake.handle);
    const before = renders.count;
    fake.publish({ phase: 'privacy' });
    expect(screen.getByText('phase: privacy')).toBeTruthy();
    expect(renders.count).toBe(before + 1);
  });

  it('does not re-render otherwise: no notification, or a notification with the same snapshot', () => {
    const fake = fakeHandle({ phase: 'intro' });
    const { renders } = mount(fake.handle);
    const before = renders.count;

    fake.setSilently({ phase: 'privacy' }); // changed, but nobody was told
    expect(renders.count).toBe(before);

    const fake2 = fakeHandle({ phase: 'intro' });
    cleanup();
    const second = mount(fake2.handle);
    const before2 = second.renders.count;
    fake2.ping(); // told, but the snapshot is the same object
    expect(second.renders.count).toBe(before2);
  });

  it('dispatch reaches the handle', () => {
    const { handle } = fakeHandle({ phase: 'intro' });
    mount(handle);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(handle.dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'start' } satisfies SessionEvent);
  });

  it('subscribes once and unsubscribes on unmount', () => {
    const fake = fakeHandle({ phase: 'intro' });
    const { unmount } = mount(fake.handle);
    fake.publish({ phase: 'privacy' });
    expect(fake.handle.subscribe).toHaveBeenCalledTimes(1);
    expect(fake.listeners.size).toBe(1);
    unmount();
    expect(fake.listeners.size).toBe(0);
  });
});
