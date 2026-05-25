"use client";
// lib/hooks/use-transactions-live.ts
// Live audit-feed hook. Scoped by itemId / eventId / actorUid / type.
// Used by:
//   - ItemHistoryTab (plan 02-06)  — itemId-scoped chronological feed
//   - EventHistoryTab (plan 02-08) — eventId-scoped feed
//   - HistoryTable (plan 02-10)    — filtered global history
//   - RecentActivityFeed dashboard widget (plan 02-10) — limit=20 newest
//
// Composite indexes per D-18 already declared in firestore.indexes.json
// (plan 02-02):
//   - transactions(itemId, at desc)
//   - transactions(eventId, at desc)
//   - transactions(actorUid, at desc)
//   - transactions(type, at desc)
//
// D-20 listener scope: limit defaults to 50 (the visible window). Consumers
// pass `limit: 20` for compact widgets.
//
// Firestore rule: `transactions` collection allows `read: if isSignedIn()`
// (firestore.rules line 58) — no per-doc role check, so onSnapshot should
// never permission-deny here (unlike the Plan 02-04 useUsersLive fallout
// where the users-collection per-doc rule required claims the auth-edge
// token lacked). Defensive console.error on FirestoreError surfaces any
// future rule tightening immediately.

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  type QueryConstraint,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { TransactionDoc, TransactionType } from "@/lib/types/transaction";
import type { UserRole } from "@/lib/types/user";

function tsToIso(ts: unknown): string {
  if (!ts) return new Date(0).toISOString();
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return new Date(0).toISOString();
}

function toTx(d: QueryDocumentSnapshot): TransactionDoc {
  const data = d.data();
  return {
    id: d.id,
    type: data.type as TransactionType,
    itemId: data.itemId,
    itemSku: data.itemSku,
    itemName: data.itemName,
    eventId: data.eventId ?? null,
    eventName: data.eventName ?? null,
    qty: data.qty,
    actorUid: data.actorUid,
    actorName: data.actorName,
    actorRoleAtTimeOfAction: data.actorRoleAtTimeOfAction as UserRole,
    at: tsToIso(data.at),
    notes: data.notes ?? "",
    parentTxId: data.parentTxId ?? null,
    clientTxId: data.clientTxId ?? null,
  };
}

export type UseTransactionsLiveOpts = {
  itemId?: string;
  eventId?: string;
  actorUid?: string;
  type?: TransactionType;
  limit?: number;
  initial?: TransactionDoc[];
};

/**
 * Live subscription to the transactions collection, scoped by one or more
 * of itemId / eventId / actorUid / type. Always orders by `at` descending
 * (newest first) — composite indexes per D-18 cover the single-filter cases.
 *
 * Returns the current rows; updates as Firestore pushes changes.
 */
export function useTransactionsLive(
  opts: UseTransactionsLiveOpts = {},
): TransactionDoc[] {
  const [txs, setTxs] = useState<TransactionDoc[]>(opts.initial ?? []);

  useEffect(() => {
    const constraints: QueryConstraint[] = [];
    if (opts.itemId) constraints.push(where("itemId", "==", opts.itemId));
    if (opts.eventId) constraints.push(where("eventId", "==", opts.eventId));
    if (opts.actorUid) constraints.push(where("actorUid", "==", opts.actorUid));
    if (opts.type) constraints.push(where("type", "==", opts.type));
    constraints.push(orderBy("at", "desc"), fbLimit(opts.limit ?? 50));

    const q = query(collection(db, "transactions"), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot) => {
        setTxs(snap.docs.map((d) => toTx(d as QueryDocumentSnapshot)));
      },
      (err: FirestoreError) => {
        console.error(
          "[useTransactionsLive] onSnapshot error:",
          err.code,
          err.message,
        );
      },
    );
    return () => unsub();
  }, [opts.itemId, opts.eventId, opts.actorUid, opts.type, opts.limit]);

  return txs;
}
