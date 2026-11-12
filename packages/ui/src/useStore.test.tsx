import { act, cleanup, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStore, type Store } from './useStore';

afterEach(cleanup);

type View = { on: boolean };

/** A hand-driven store, like the sound store of WebSpeechOutput (@ghost-examiner/web). */
function fakeStore(initial: View) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const store: Store<View> = {
    getSnapshot: () => snapshot,
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  return {
    store,
    listeners,
    setSilently: (next: View) => (snapshot = next),
    publish: (next: View) =>
      act(() => {
        snapshot = next;
        listeners.forEach((l) => l());
      }),
    ping: () => act(() => listeners.forEach((l) => l())),
  };
}

function Status({ store }: { store: Store<View> }) {
  const view = useStore(store);
  return <p>sound: {view.on ? 'on' : 'off'}</p>;
}

function mount(store: Store<View>) {
  const renders = { count: 0 };
  const utils = render(
    <Profiler id="status" onRender={() => renders.count++}>
      <Status store={store} />
    </Profiler>,
  );
  return { ...utils, renders };
}

describe('useStore', () => {
  it('returns the current snapshot', () => {
    mount(fakeStore({ on: true }).store);
    expect(screen.getByText('sound: on')).toBeTruthy();
  });

  it('re-renders with the new snapshot when the store notifies', () => {
    const fake = fakeStore({ on: true });
    const { renders } = mount(fake.store);
    const before = renders.count;
    fake.publish({ on: false });
    expect(screen.getByText('sound: off')).toBeTruthy();
    expect(renders.count).toBe(before + 1);
  });

  it('does not re-render without a notification, or for a notification with the same snapshot', () => {
    const fake = fakeStore({ on: true });
    const { renders } = mount(fake.store);
    const before = renders.count;
    fake.ping();
    expect(renders.count).toBe(before);
    fake.setSilently({ on: false });
    expect(renders.count).toBe(before);
    expect(screen.getByText('sound: on')).toBeTruthy();
  });

  it('subscribes once and unsubscribes on unmount', () => {
    const fake = fakeStore({ on: true });
    const { unmount } = mount(fake.store);
    fake.publish({ on: false });
    expect(fake.store.subscribe).toHaveBeenCalledTimes(1);
    expect(fake.listeners.size).toBe(1);
    unmount();
    expect(fake.listeners.size).toBe(0);
  });
});
