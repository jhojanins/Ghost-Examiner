import type { SessionEvent } from '@ghost-examiner/core';
import { useSyncExternalStore } from 'react';

/**
 * What useSession needs from a running session. The handle from `createSession`
 * (@ghost-examiner/web) has this shape; ui does not depend on web, so the type is structural.
 * `getSnapshot` must return the same object until something changes (the runtime does).
 */
export interface SessionStore<View> {
  getSnapshot(): View;
  subscribe(listener: () => void): () => void;
  dispatch(event: SessionEvent): void;
}

/**
 * Reads a session in React (design §5.1, Req 5.1): re-renders only when the runtime notifies
 * with a new snapshot, and passes events straight to the runtime.
 * The store's methods must keep their identity between renders, or React resubscribes.
 */
export function useSession<View>(store: SessionStore<View>): {
  view: View;
  dispatch: (event: SessionEvent) => void;
} {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { view, dispatch: store.dispatch };
}
