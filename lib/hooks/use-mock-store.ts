// Phase 1 React 19 hook that wraps useSyncExternalStore around the mock store
// (CONTEXT.md D-02). Consumers pass a pure selector and receive a slice that
// re-renders whenever the underlying store mutates.
//
// USAGE
//   import { useMockStore } from "@/lib/hooks/use-mock-store";
//   import { selectLowStockItems } from "@/lib/mock/selectors";
//
//   const lowStock = useMockStore(selectLowStockItems);
//
// Phase 2: the function body swaps to subscribe to Firestore listeners
// while keeping this exact signature. Components do not change.

"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  type StoreSnapshot,
} from "@/lib/mock/store";

// Subscribe to the raw store snapshot — getSnapshot/getServerSnapshot return
// the same frozen `state` reference until a mutation rebuilds it, so
// useSyncExternalStore's identity check is satisfied. We then derive the slice
// via useMemo. This avoids the infinite-loop trap where a selector that
// returns `.filter(...)` / `.map(...)` produces a fresh array reference on
// every getSnapshot call.
export function useMockStore<T>(selector: (snapshot: StoreSnapshot) => T): T {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => selector(snapshot), [snapshot, selector]);
}
