import { useSyncExternalStore } from 'react';

/**
 * A read-only external store, such as the sound store of `createWebSpeechOutput`
 * (@ghost-examiner/web). ui does not depend on web, so the type is structural.
 * `getSnapshot` must return the same object until something changes.
 */
export interface Store<View> {
  getSnapshot(): View;
  subscribe(listener: () => void): () => void;
}

/**
 * Reads a store in React (spec b design §4, Req 2.1): re-renders only when the store notifies
 * with a new snapshot. The store's methods must keep their identity between renders, or React
 * resubscribes.
 */
export function useStore<View>(store: Store<View>): View {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
