// Client hook returning the current Firebase session, or null when the user
// is not signed in.
//
// Phase 2: subscribes to `onAuthStateChanged(auth, ...)` from the Web SDK
// (RESEARCH §1 — research/STACK.md line 287) and reads the user's role from
// the ID token's custom claims (set server-side by Cloud Function 1 in plan
// 02-04 on each users/{uid} write).
//
// SIGNATURE PRESERVED: `useCurrentUser(): Session | null`. All 13 consumers
// (TopBar, UserMenu, scan-session, dashboard widgets, etc.) re-render
// correctly because the returned shape matches Phase 1's mock-cookie payload
// (lib/types/session.ts — same Session type).
//
// Note on stale role claims (T-02-03-02): role changes apply on the next
// ID-token refresh (≤1h) or hard nav after role mutation. Documented UX —
// admins/users sign out + back in to pick up fresh claims; alternatively
// the DAL's checkRevoked path on the next request rejects sessions that
// were revoked server-side.

"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";

import { auth } from "@/lib/firebase/client";
import type { Session } from "@/lib/types/session";
import type { UserRole } from "@/lib/types/user";

export function useCurrentUser(): Session | null {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSession(null);
        return;
      }
      // Pull custom claims from the ID token result. role is set by
      // Cloud Function 1 (plan 02-04) on users/{uid} writes; fresh users
      // whose token predates the function execution briefly see role
      // undefined → default to "staff" until next token refresh (≤1h).
      let role: UserRole = "staff";
      try {
        const tokenResult = await getIdTokenResult(user);
        const claims = tokenResult.claims as { role?: UserRole };
        if (claims.role === "admin" || claims.role === "staff") {
          role = claims.role;
        }
      } catch {
        // If the token can't be read for any reason, keep default "staff".
      }

      setSession({
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? user.email ?? "Unknown",
        role,
        disabled: false,
      });
    });
    return () => unsubscribe();
  }, []);

  return session;
}
