// Mirrors CONTEXT.md D-05 — the Phase 1 mock cookie payload shape.
//
// Deliberately the same fields Phase 2's `__session` cookie will yield after
// `next-firebase-auth-edge` decodes it, so the role-gate logic in
// `app/(app)/layout.tsx` can be reused with only the cookie-decoder swapped out.

import type { UserRole } from "./user";

export type Session = {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  disabled: boolean;
};
