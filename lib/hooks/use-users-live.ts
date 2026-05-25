"use client";
// lib/hooks/use-users-live.ts
// Live hook scoped to the visible cursor page per D-20 (50-row window).
// SSR seed pattern: server passes `initial` from getUsersPage; hook takes over
// via onSnapshot for the same query window. See PATTERNS §4 excerpt A/C.
//
// Type compatibility: matches lib/data/users.server.ts conversion of Firestore
// Timestamps → ISO strings so UserDoc shape stays consistent across the SSR
// seed and the client live update.

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  documentId,
  type DocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { UserDoc } from "@/lib/types/user";

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

function toUser(d: DocumentSnapshot): UserDoc {
  const data = d.data() ?? {};
  return {
    uid: d.id,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    disabled: data.disabled === true,
    createdAt: tsToIso(data.createdAt) ?? new Date(0).toISOString(),
    createdBy: data.createdBy ?? "",
    lastLoginAt: tsToIso(data.lastLoginAt),
  };
}

export function useUsersLive(
  initial: UserDoc[],
  opts: { role?: "admin" | "staff"; limit?: number } = {},
): UserDoc[] {
  const [users, setUsers] = useState<UserDoc[]>(initial);

  useEffect(() => {
    const constraints = [
      ...(opts.role ? [where("role", "==", opts.role)] : []),
      orderBy("displayName"),
      orderBy(documentId()),
      fbLimit(opts.limit ?? 50),
    ];
    const q = query(collection(db, "users"), ...constraints);
    const unsub = onSnapshot(q, (snap: QuerySnapshot) => {
      setUsers(snap.docs.map(toUser));
    });
    return () => unsub();
  }, [opts.role, opts.limit]);

  return users;
}
