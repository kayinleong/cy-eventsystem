// Phase 1 server-side session helpers for the (app) layout and admin-only
// routes.
//
// CONTEXT.md D-07 — strict role gate. Staff hitting an admin-only route
// (`/users`, `/users/invite`, `/inventory/new`, `/inventory/[id]/edit`,
// `/events/new`) is redirected to `/unauthorized`.
//
// This file is server-only by virtue of importing `next/navigation`'s
// `redirect` (only valid in Server Components, Server Actions, and Route
// Handlers). Plan 04 will wire it into `app/(app)/layout.tsx` and the
// admin-only routes.
//
// Phase 2 swaps the cookie decoder (`readMockSessionServer` →
// `next-firebase-auth-edge.getTokens()`) — these helper signatures stay the same.

import { redirect } from "next/navigation";
import { readMockSessionServer } from "@/lib/mock/cookie";
import type { Session } from "@/lib/types/session";

/**
 * Returns the current mock session if one exists, or null. Never redirects.
 * Use this for layouts that need to conditionally render based on auth state
 * without forcing a redirect.
 */
export async function getMockSession(): Promise<Session | null> {
  return readMockSessionServer();
}

/**
 * Requires a valid mock session. Redirects to /login when missing or when
 * the user has been disabled (AUTH-09 — disabled users cannot use the app).
 */
export async function requireSession(): Promise<Session> {
  const session = await getMockSession();
  if (!session || session.disabled) redirect("/login");
  return session;
}

/**
 * Requires the current session to be an admin (D-07 strict gate). Redirects:
 *   - missing/disabled → /login
 *   - role !== "admin" → /unauthorized
 *
 * Use this in `app/(app)/users/page.tsx`, `app/(app)/users/invite/page.tsx`,
 * `app/(app)/inventory/new/page.tsx`, `app/(app)/inventory/[itemId]/edit/page.tsx`,
 * `app/(app)/events/new/page.tsx`.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/unauthorized");
  return session;
}
