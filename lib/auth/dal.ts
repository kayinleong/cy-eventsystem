// lib/auth/dal.ts
// Per spike FINDINGS A1 + Correction 1: use getTokens() from
// next-firebase-auth-edge to decode the HMAC-signed __session envelope,
// NOT admin.auth().verifySessionCookie (which only works on Firebase
// native session cookies, not auth-edge's envelope format).
//
// For AUTH-09 immediate revocation, after getTokens decodes the cookie
// we additionally call adminAuth.verifyIdToken(token, /*checkRevoked*/true)
// to reject sessions whose refresh tokens were revoked since the ID token
// was minted (revokeRefreshTokens propagates ~1.5s per spike A6).
//
// The three exports (getSession / verifySession / requireSession /
// requireAdmin) match the Phase 1 mock-session.ts surface so 02-05
// can swap import paths only — call sites unchanged.

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getTokens } from "next-firebase-auth-edge";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Session } from "@/lib/types/session";
import type { UserRole } from "@/lib/types/user";

const COOKIE_OPTS = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: "__session",
  cookieSignatureKeys: [
    process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!,
    process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!,
  ],
  serviceAccount: {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  },
};

/**
 * verifySession — decodes the __session cookie, performs the AUTH-09
 * checkRevoked round-trip, then fills missing claims (role, displayName)
 * from users/{uid} for fresh users whose ID token predates the
 * custom-claim Cloud Function execution.
 *
 * React.cache memoizes the result per-request so a layout, a page, and
 * a Server Action all share one decode + one Firestore read.
 *
 * Returns null when:
 *   - no __session cookie present
 *   - cookie HMAC invalid (tampered or wrong signature key)
 *   - ID token signature invalid
 *   - refresh token revoked (AUTH-09)
 *   - users/{uid}.disabled === true (additional safety check;
 *     normally revokeRefreshTokens fires when admin sets disabled)
 */
export const verifySession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies(); // Next 16: async
  let tokens;
  try {
    tokens = await getTokens(cookieStore, COOKIE_OPTS);
  } catch {
    return null;
  }
  if (!tokens) return null;

  // AUTH-09 hot path: re-verify with checkRevoked=true so revoked sessions
  // are rejected immediately (proxy alone accepts stale ID tokens up to
  // the 1h ID-token TTL).
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(tokens.token, true);
  } catch {
    return null;
  }

  // Role + displayName come from custom claims set by Cloud Function 1
  // (plan 02-04). For brand-new users whose token predates the function
  // execution, claims may be missing — fall through to users/{uid}.
  let role = (decoded.role as UserRole | undefined) ?? null;
  let displayName = (decoded.name as string | undefined) ?? null;
  let disabled = false;

  if (!role || !displayName) {
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const data = userDoc.data();
    role = (data?.role as UserRole) ?? "staff";
    displayName = data?.displayName ?? decoded.email ?? "Unknown";
    disabled = data?.disabled === true;
  }

  if (disabled) {
    // Belt-and-braces: revoke + return null. Next request hits
    // handleInvalidToken in proxy.ts and redirects to /login.
    await adminAuth.revokeRefreshTokens(decoded.uid);
    return null;
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? "",
    displayName: displayName ?? decoded.email ?? "Unknown",
    role,
    disabled: false,
  };
});

/** Phase 1 parity alias — same name as mock-session.ts's getMockSession. */
export const getSession = verifySession;

/**
 * Redirects when there's no valid session. Use at the top of protected
 * layouts / Server Actions.
 *
 * Redirects to /api/auth/logout (not /login directly) because the auth-edge
 * __session cookie's HMAC remains valid after revokeRefreshTokens — the
 * proxy can't tell a revoked session apart from a fresh one without a
 * Firebase round-trip. Redirecting to /login with a "valid" cookie still
 * present means the proxy bounces back to / → infinite loop.
 * /api/auth/logout's GET handler clears the cookie via Set-Cookie before
 * redirecting to /login, breaking the loop.
 */
export async function requireSession(): Promise<Session> {
  const session = await verifySession();
  if (!session) redirect("/api/auth/logout?reason=session-invalid");
  return session;
}

/**
 * Redirects to /unauthorized when the session is not an admin.
 * Use at the top of admin-only routes (/users, /inventory/new, etc.).
 *
 * Note: we use redirect("/unauthorized") (stable since Next 13) rather than
 * unauthorized() (experimental Next 16, requires experimental.authInterrupts).
 * The existing /unauthorized page from Phase 1 already renders the
 * "you don't have access" UI.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/unauthorized");
  return session;
}
