// Phase 1 client hook returning the current mock session, or null when the
// user is not signed in.
//
// Implementation note: uses `useSyncExternalStore` (React 19's canonical
// pattern for syncing with browser-side external state) so the hook is
// SSR-safe and avoids the `setState-in-effect` cascading render warning.
//
// On the server side, the snapshot is always `null` (the server has no
// access to `document.cookie` from a client-component import path). On the
// client, the snapshot is read from `document.cookie` on every render but
// `useSyncExternalStore` keeps the returned reference stable via cache key
// equality on the `Session | null` JSON.
//
// Used by:
//   - UserMenu, PhaseOnePocRoleSwitcher (need the current uid/role to render
//     menu items and switch roles).
//   - Any client component that needs to know the actor for store mutator
//     calls (e.g., scan-cart commit, missing-item resolve).
//
// Phase 2: swap the external-store callbacks for a server-roundtrip read
// via `/api/auth/whoami` or a SWR subscription.

"use client";

import { useSyncExternalStore } from "react";
import { readMockSessionClient } from "@/lib/mock/cookie";
import type { Session } from "@/lib/types/session";

// Snapshot is cached so identical-content reads return the same reference,
// keeping consumers stable across renders. PhaseOnePocRoleSwitcher (Plan 04)
// drives change detection by calling `router.refresh()` which remounts the
// client tree — at which point the cache is rebuilt and re-reads the cookie.
let cachedSnapshot: Session | null = null;
let cachedKey: string | null = null;

function getClientSnapshot(): Session | null {
  if (typeof document === "undefined") return null;
  const fresh = readMockSessionClient();
  const key = fresh ? JSON.stringify(fresh) : "";
  if (key !== cachedKey) {
    cachedKey = key;
    cachedSnapshot = fresh;
  }
  return cachedSnapshot;
}

function getServerSnapshot(): Session | null {
  // SSR: there is no document.cookie. The role-gate happens server-side via
  // `lib/auth/mock-session.ts`; consumers of this hook are always client
  // components that mount after hydration.
  return null;
}

// `useCurrentUser` doesn't need a real subscription — the cookie can only
// change via PhaseOnePocRoleSwitcher (which calls router.refresh()) or the
// login form (which redirects), both of which remount the client tree.
// We return a no-op unsubscribe so useSyncExternalStore is happy.
function subscribe(): () => void {
  return () => {};
}

export function useCurrentUser(): Session | null {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
