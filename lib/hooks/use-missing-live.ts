"use client";
// lib/hooks/use-missing-live.ts
// Live hook for /reports/missing scoped to the visible 50-row window per D-20.
// SSR seed pattern: server passes `initial` from getMissingPage; hook takes
// over via onSnapshot for the same query window.
//
// Auth race note: identical pattern to useInventoryLive / useTransactionsLive
// — register onSnapshot INSIDE onAuthStateChanged so auth.currentUser is
// hydrated before the query fires. Without this gate, Firestore treats the
// request as unauthenticated → permission-denied even when the rule allows
// signed-in users (firestore.rules:78 missingItems `allow get, list: if
// isSignedIn()`).
//
// Composite indexes (firestore.indexes.json from plan 02-02):
//   - missingItems(status, reportedAt desc)
//   - missingItems(eventId, reportedAt desc)
// Cover the dominant filter shapes; status-only is the most common path.
//
// Type compatibility: matches lib/data/missing.server.ts conversion of
// Firestore Timestamps → ISO strings so MissingItemDoc shape is consistent
// between the SSR seed and the client live update. `reportedByName` is
// denormalized at write time in the Server Actions that create missingItems;
// older docs missing the denorm fall back to "Unknown" on the client (the
// server-side reader hydrates from users/{uid} as a one-shot read; the
// client-side listener stays minimal — denorm is the steady state).

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  documentId,
  type QueryConstraint,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
  type FirestoreError,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type {
  MissingItemDoc,
  MissingReason,
  MissingStatus,
} from "@/lib/types/missing-item";

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

function toMissingDoc(d: QueryDocumentSnapshot): MissingItemDoc {
  const data = d.data();
  return {
    id: d.id,
    itemId: data.itemId ?? "",
    itemName: data.itemName ?? "",
    eventId: data.eventId ?? "",
    eventName: data.eventName ?? "",
    qty: data.qty ?? 0,
    reason: (data.reason ?? "Unknown") as MissingReason,
    reportedBy: data.reportedBy ?? "",
    reportedByName: data.reportedByName ?? "Unknown",
    reportedAt: tsToIso(data.reportedAt) ?? new Date(0).toISOString(),
    status: (data.status ?? "open") as MissingStatus,
    resolvedAt: tsToIso(data.resolvedAt),
    resolvedBy: data.resolvedBy ?? null,
    parentCheckinTxId:
      data.parentCheckinTxId ?? data.parentCheckoutTxId ?? "",
  };
}

export function useMissingLive(
  initial: MissingItemDoc[],
  opts: {
    status?: MissingStatus;
    eventId?: string;
    limit?: number;
  } = {},
): MissingItemDoc[] {
  const [items, setItems] = useState<MissingItemDoc[]>(initial);

  useEffect(() => {
    let unsubSnap: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnap) {
        unsubSnap();
        unsubSnap = null;
      }
      if (!user) return;

      const constraints: QueryConstraint[] = [];
      if (opts.status) constraints.push(where("status", "==", opts.status));
      if (opts.eventId)
        constraints.push(where("eventId", "==", opts.eventId));
      constraints.push(
        orderBy("reportedAt", "desc"),
        orderBy(documentId()),
        fbLimit(opts.limit ?? 50),
      );

      const q = query(collection(db, "missingItems"), ...constraints);
      unsubSnap = onSnapshot(
        q,
        (snap: QuerySnapshot) => {
          setItems(snap.docs.map((d) => toMissingDoc(d as QueryDocumentSnapshot)));
        },
        (err: FirestoreError) => {
          console.error(
            "[useMissingLive] onSnapshot error:",
            err.code,
            err.message,
          );
        },
      );
    });

    return () => {
      if (unsubSnap) unsubSnap();
      unsubAuth();
    };
  }, [opts.status, opts.eventId, opts.limit]);

  return items;
}
