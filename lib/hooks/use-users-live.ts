"use client";
// lib/hooks/use-users-live.ts
// Live hook scoped to the visible cursor page per D-20 (50-row window).
// SSR seed pattern: server passes `initial` from getUsersPage; hook takes over
// via onSnapshot for the same query window. See PATTERNS §4 excerpt A/C.
//
// Type compatibility: matches lib/data/users.server.ts conversion of Firestore
// Timestamps → ISO strings so UserDoc shape stays consistent across the SSR
// seed and the client live update.

import type { UserDoc } from "@/lib/types/user";

// Plan 02-04 fallout — the onSnapshot listener requires the Web SDK ID token
// to carry the role=admin custom claim. In practice the seed/repair flow can
// leave the user's token without the claim (Firebase only refreshes ~hourly
// or on explicit getIdToken(true)). The listener then dies with
// permission-denied and the UI never updates.
//
// For Phase 2 v1, we bypass the listener for /users and let router.refresh()
// in UserRoleSelectInline / DisableUserButton re-fetch via the Server
// Component path. This loses cross-admin live updates, but /users is
// admin-only + low-traffic so the trade-off is fine.
//
// We keep useUsersLive's signature so callers don't change; the hook just
// returns the SSR-seeded data directly. Subsequent plans (02-10 reports,
// 02-13 hardening) can revisit if/when we want true live updates on this
// collection (would need a rules rewrite to drop the per-doc admin check,
// or a different read-model collection).
export function useUsersLive(initial: UserDoc[]): UserDoc[] {
  return initial;
}
