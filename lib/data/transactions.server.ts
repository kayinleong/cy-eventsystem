import "server-only";
// lib/data/transactions.server.ts
// Per REP-04 + D-17 cursor pagination + D-20 listener-scope window.
// Mirrors lib/data/inventory.server.ts / events.server.ts / missing.server.ts
// shape so the SSR-seed → onSnapshot handoff is structurally identical
// across collections.
//
// firestore.rules `transactions`:
//   - allow get, list: if isSignedIn()
//   - allow create/update/delete: if false   (server-only writes per INT-03)
//
// Composite indexes pre-declared in plan 02-02 firestore.indexes.json:
//   - transactions(eventId, at desc)
//   - transactions(itemId, at desc)
//   - transactions(actorUid, at desc)
//   - transactions(type, at desc)
//   - transactions(eventId, type, parentTxId, at desc)  (used by checkin)
//
// REP-04: history page supports filtering by eventId / itemId / actorUid /
// type — each maps onto one of the single-axis composite indexes above.
// Multi-axis filters (e.g. type+eventId) fall back to client-side filtering
// within the 50-row cursor window per D-20.
//
// Type compatibility: TransactionDoc (lib/types/transaction.ts) uses ISO
// string for `at` per Phase 1 contract. Firestore Timestamps → ISO at the
// boundary so consumers (HistoryTable, RecentActivityFeed) keep working
// without prop-shape changes.

import { adminDb } from "@/lib/firebase/admin";
import type {
  TransactionDoc,
  TransactionType,
} from "@/lib/types/transaction";
import type { UserRole } from "@/lib/types/user";

type TxCursor = { at: number; id: string };

export type TransactionsPage = {
  transactions: TransactionDoc[];
  nextCursor: string | null;
};

function encodeCursor(c: TxCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64");
}

function decodeCursor(s: string): TxCursor | null {
  try {
    return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as TxCursor;
  } catch {
    return null;
  }
}

function tsToIso(ts: unknown): string {
  if (!ts) return new Date(0).toISOString();
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return new Date(0).toISOString();
}

function tsToMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === "function") {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === "string") return new Date(ts).getTime() || 0;
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function toTx(snap: FirebaseFirestore.QueryDocumentSnapshot): TransactionDoc {
  const d = snap.data();
  return {
    id: snap.id,
    type: d.type as TransactionType,
    itemId: d.itemId ?? "",
    itemSku: d.itemSku ?? "",
    itemName: d.itemName ?? "",
    eventId: d.eventId ?? null,
    eventName: d.eventName ?? null,
    qty: d.qty ?? 0,
    actorUid: d.actorUid ?? "",
    actorName: d.actorName ?? "",
    actorRoleAtTimeOfAction: (d.actorRoleAtTimeOfAction ?? "staff") as UserRole,
    at: tsToIso(d.at),
    notes: d.notes ?? "",
    parentTxId: d.parentTxId ?? null,
    clientTxId: d.clientTxId ?? null,
    deliveryOrderId: d.deliveryOrderId ?? null,
    location: d.location ?? null,
  };
}

/**
 * REP-04 — cursor-paged transactions reader with single-axis filter support.
 *
 * Orders by `at desc` (most recent first) then by document id for
 * deterministic pagination. Composite indexes cover each single-filter
 * axis; combining multiple filters works but may scan more rows than a
 * dedicated composite index. For the history page's default case
 * (no filter), the orderBy("at") path is index-free and uses Firestore's
 * automatic single-field index on `at`.
 */
export async function getTransactionsPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: {
    eventId?: string;
    itemId?: string;
    actorUid?: string;
    type?: string;
  };
}): Promise<TransactionsPage> {
  const limit = opts.limit ?? 50;
  let q: FirebaseFirestore.Query = adminDb.collection("transactions");
  if (opts.filters?.eventId)
    q = q.where("eventId", "==", opts.filters.eventId);
  if (opts.filters?.itemId) q = q.where("itemId", "==", opts.filters.itemId);
  if (opts.filters?.actorUid)
    q = q.where("actorUid", "==", opts.filters.actorUid);
  if (opts.filters?.type) q = q.where("type", "==", opts.filters.type);

  q = q.orderBy("at", "desc").orderBy("__name__").limit(limit + 1);

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    q = q.startAfter(new Date(cursor.at), cursor.id);
  }

  const snap = await q.get();
  const docs = snap.docs.slice(0, limit);
  const hasMore = snap.docs.length > limit;
  const transactions = docs.map(toTx);
  const last = docs[docs.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          at: tsToMillis(last.data().at),
          id: last.id,
        })
      : null;
  return { transactions, nextCursor };
}

/**
 * quick-kayinleong-020 — open-only derivation for /reports/out.
 *
 * Given a page of checkout transaction ids, returns the SET of those ids that
 * are CLOSED — i.e. referenced by at least one checkin's `parentTxId`. The
 * caller subtracts this set from the checkout page to render open-only rows.
 *
 * Replaces the old client-side `checkinsLive` onSnapshot derivation in
 * ItemsOutTable (which clobbered the cursor seed and doubled reads). Uses a
 * `where("parentTxId","in",[…])` query chunked at Firestore's 30-id `in`-clause
 * limit. Returns an empty set when given no ids.
 */
export async function getOpenCheckoutIdsForCheckouts(
  checkoutIds: string[],
): Promise<Set<string>> {
  const closed = new Set<string>();
  if (checkoutIds.length === 0) return closed;

  const CHUNK = 30; // Firestore `in`-clause limit.
  const chunks: string[][] = [];
  for (let i = 0; i < checkoutIds.length; i += CHUNK) {
    chunks.push(checkoutIds.slice(i, i + CHUNK));
  }

  const snaps = await Promise.all(
    chunks.map((ids) =>
      adminDb
        .collection("transactions")
        .where("type", "==", "checkin")
        .where("parentTxId", "in", ids)
        .get(),
    ),
  );

  for (const snap of snaps) {
    for (const doc of snap.docs) {
      const parent = doc.data().parentTxId;
      if (typeof parent === "string" && parent.length > 0) {
        closed.add(parent);
      }
    }
  }
  return closed;
}
