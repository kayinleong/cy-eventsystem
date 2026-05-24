// Phase 1 React 19 hook that wraps useSyncExternalStore around the mock store
// (CONTEXT.md D-02). Consumers pass a pure selector and receive a slice that
// re-renders whenever the selector's output changes by reference.
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

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  type StoreSnapshot,
} from "@/lib/mock/store";

export function useMockStore<T>(selector: (snapshot: StoreSnapshot) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getServerSnapshot()),
  );
}
