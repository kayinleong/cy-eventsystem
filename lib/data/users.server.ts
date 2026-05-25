// lib/data/users.server.ts
// Per RESEARCH §3.1 pattern + D-17 cursor pagination + D-20 listener scope.
//
// Type compatibility note: UserDoc (lib/types/user.ts) was authored in Phase 1
// with `createdAt: string` and `lastLoginAt: string | null` (ISO strings) so the
// mock store and the Phase 2 data layer could share the same shape. We convert
// Firestore Timestamps to ISO strings here to honor that contract — keeping
// UsersTable's `new Date(row.original.createdAt).toLocaleDateString()` working
// without any consumer-side changes.

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { UserDoc } from "@/lib/types/user";

type UserCursor = { displayName: string; uid: string };

export type UsersPage = {
  users: UserDoc[];
  nextCursor: string | null;
};

function encodeCursor(c: UserCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64");
}
function decodeCursor(s: string): UserCursor | null {
  try {
    return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as UserCursor;
  } catch {
    return null;
  }
}

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  // Firestore Timestamp has a .toDate() method that returns a Date.
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  // Fallback: string or already a Date
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

function toUser(snap: FirebaseFirestore.DocumentSnapshot): UserDoc {
  const data = snap.data() ?? {};
  return {
    uid: snap.id,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    disabled: data.disabled === true,
    createdAt: tsToIso(data.createdAt) ?? new Date(0).toISOString(),
    createdBy: data.createdBy ?? "",
    lastLoginAt: tsToIso(data.lastLoginAt),
  };
}

export async function getUsersPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: { role?: "admin" | "staff" };
}): Promise<UsersPage> {
  const limit = opts.limit ?? 50;
  let q: FirebaseFirestore.Query = adminDb.collection("users");
  if (opts.filters?.role) q = q.where("role", "==", opts.filters.role);
  q = q.orderBy("displayName").orderBy("__name__").limit(limit + 1);

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) q = q.startAfter(cursor.displayName, cursor.uid);

  const snap = await q.get();
  const docs = snap.docs.slice(0, limit);
  const hasMore = snap.docs.length > limit;

  const users = docs.map(toUser);
  const last = docs[docs.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ displayName: last.data().displayName, uid: last.id })
      : null;
  return { users, nextCursor };
}

export async function getUserServer(uid: string): Promise<UserDoc | null> {
  const snap = await adminDb.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return toUser(snap);
}
