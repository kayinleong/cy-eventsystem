// Phase 1 mock seed: users.
//
// CONTEXT.md D-03 — 5 users: 2 admin + 3 staff, one disabled.
// CONTEXT.md D-04 — fixed 2026 ISO dates (no `new Date().toISOString()`).
// CONTEXT.md D-08 — all 5 share password "password"; the password is NOT
// stored in this file. The login form checks against the literal string.
//
// Phase 2: this file is deleted wholesale and the Firestore users collection
// becomes the source of truth. Field names must not drift.

import type { UserDoc } from "@/lib/types/user";

export const seedUsers: UserDoc[] = [
  {
    uid: "u-admin-1",
    email: "alex.chen@example.com",
    displayName: "Alex Chen",
    role: "admin",
    disabled: false,
    createdAt: "2026-01-12T09:00:00.000Z",
    createdBy: "system",
    lastLoginAt: "2026-05-22T08:14:00.000Z",
  },
  {
    uid: "u-admin-2",
    email: "morgan.lee@example.com",
    displayName: "Morgan Lee",
    role: "admin",
    disabled: false,
    createdAt: "2026-01-15T10:30:00.000Z",
    createdBy: "u-admin-1",
    lastLoginAt: "2026-05-23T12:01:00.000Z",
  },
  {
    uid: "u-staff-1",
    email: "sam.patel@example.com",
    displayName: "Sam Patel",
    role: "staff",
    disabled: false,
    createdAt: "2026-02-02T14:00:00.000Z",
    createdBy: "u-admin-1",
    lastLoginAt: "2026-05-23T09:50:00.000Z",
  },
  {
    uid: "u-staff-2",
    email: "jordan.kim@example.com",
    displayName: "Jordan Kim",
    role: "staff",
    disabled: false,
    createdAt: "2026-02-15T11:20:00.000Z",
    createdBy: "u-admin-2",
    lastLoginAt: "2026-05-21T16:35:00.000Z",
  },
  {
    uid: "u-staff-3",
    email: "casey.ramirez@example.com",
    displayName: "Casey Ramirez",
    role: "staff",
    disabled: true,
    createdAt: "2026-03-04T08:45:00.000Z",
    createdBy: "u-admin-1",
    lastLoginAt: "2026-04-10T18:20:00.000Z",
  },
];
