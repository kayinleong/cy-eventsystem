// lib/mock/cookie.ts — Phase 2 throw-on-call shim.
//
// Phase 1 hosted the mock-cookie helpers (readMockSessionClient,
// writeMockSessionClient, clearMockSessionClient, plus the server
// counterparts). Plan 02-03 removed every functional caller:
//   - login-form.tsx → POSTs /api/auth/session (proxy mints __session)
//   - SignOutButton.tsx → POSTs /api/auth/logout (proxy clears __session)
//   - use-current-user.ts → subscribes via onAuthStateChanged
//   - PhaseOnePocRoleSwitcher.tsx → deleted entirely
//   - mock-session.ts → became a re-export shim of dal.ts
//
// If anything still imports from this path it's a stale Phase 1 reference.
// The functions throw at call time (not at import time) so an unused stale
// import doesn't break the build, but the first runtime call surfaces a
// loud, actionable error pointing to the correct Phase 2 API.
//
// **DELETE this file in plan 02-11** along with mock-session.ts.

import type { Session } from "@/lib/types/session";

const PHASE_2_NOTICE = "Phase 2: mock-cookie helpers were removed in plan 02-03.";

export function readMockSessionClient(): Session | null {
  throw new Error(
    `${PHASE_2_NOTICE} Use useCurrentUser() from @/lib/hooks/use-current-user instead.`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function writeMockSessionClient(_session: Session): void {
  throw new Error(
    `${PHASE_2_NOTICE} Login flow now POSTs /api/auth/session — see ` +
      `app/(auth)/login/_components/login-form.tsx.`,
  );
}

export function clearMockSessionClient(): void {
  throw new Error(
    `${PHASE_2_NOTICE} Sign-out now POSTs /api/auth/logout — see ` +
      `components/feature/auth/SignOutButton.tsx.`,
  );
}

export async function readMockSessionServer(): Promise<Session | null> {
  throw new Error(
    `${PHASE_2_NOTICE} Server-side session reads use verifySession() / ` +
      `requireSession() / requireAdmin() from @/lib/auth/dal.`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function setMockSessionServer(_session: Session): Promise<void> {
  throw new Error(
    `${PHASE_2_NOTICE} Session cookie minting happens inside proxy.ts ` +
      `via next-firebase-auth-edge authMiddleware.`,
  );
}

export async function clearMockSessionServer(): Promise<void> {
  throw new Error(
    `${PHASE_2_NOTICE} Session cookie clearing happens inside proxy.ts ` +
      `via next-firebase-auth-edge authMiddleware (logoutPath).`,
  );
}
