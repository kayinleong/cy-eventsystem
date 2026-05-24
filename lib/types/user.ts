// Mirrors users/{uid} in .planning/research/ARCHITECTURE.md (lines 67-77).
//
// Phase 1: shape is the source of truth for mock data in lib/mock/users.ts.
// Phase 2: Firestore doc-to-type mapper produces this exact shape; field names
//          must not drift so the swap is data-source-only.

export type UserRole = "admin" | "staff";

export type UserDoc = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  disabled: boolean;
  // ISO strings in Phase 1 (CONTEXT.md D-04 fixed 2026 dates).
  // Phase 2 will convert to Firestore Timestamps at the data-layer boundary.
  createdAt: string;
  createdBy: string;
  lastLoginAt: string | null;
};
