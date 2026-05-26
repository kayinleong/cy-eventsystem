import "server-only";
// lib/data/missing.server.ts
// Per RESEARCH §6 + D-17 cursor pagination + D-20 listener-scope window.
// Mirrors lib/data/inventory.server.ts / users.server.ts / events.server.ts
// shape so the SSR-seed → onSnapshot handoff is structurally identical
// across collections.
//
// firestore.rules `missingItems`:
//   - allow get, list: if isSignedIn()  → any signed-in user can read
//   - allow create/update/delete: if false → server-only writes
// So this Admin SDK reader runs without any per-role projection (REP-03).
//
// Composite indexes pre-declared in plan 02-02 firestore.indexes.json:
//   - missingItems(status, reportedAt desc)
//   - missingItems(eventId, reportedAt desc)
// MissingItemsTable filters by status (default "open") + eventId; both
// indexes cover the dominant query shapes.
//
// Type compatibility: MissingItemDoc.reportedAt is an ISO string per
// the Phase 1 contract. Firestore Timestamps → ISO at the boundary.
// `reportedByName` is denormalized at write time when possible (the
// /events cancel path writes it; the /checkin commit path writes it).
// Where it is missing we hydrate from users/{uid} as a one-shot read.

import { adminDb } from "@/lib/firebase/admin";
import type {
  MissingItemDoc,
  MissingReason,
  MissingStatus,
} from "@/lib/types/missing-item";

type MissingCursor = { reportedAt: number; id: string };

export type MissingPage = {
  missing: MissingItemDoc[];
  nextCursor: string | null;
};

function encodeCursor(c: MissingCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64");
}

function decodeCursor(s: string): MissingCursor | null {
  try {
    return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as MissingCursor;
  } catch {
    return null;
  }
}

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return null;
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

function toMissingDoc(
  snap: FirebaseFirestore.DocumentSnapshot,
  reporterName: string,
): MissingItemDoc {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    itemId: d.itemId ?? "",
    itemName: d.itemName ?? "",
    eventId: d.eventId ?? "",
    eventName: d.eventName ?? "",
    qty: d.qty ?? 0,
    reason: (d.reason ?? "Unknown") as MissingReason,
    reportedBy: d.reportedBy ?? "",
    reportedByName: d.reportedByName ?? reporterName,
    reportedAt: tsToIso(d.reportedAt) ?? new Date(0).toISOString(),
    status: (d.status ?? "open") as MissingStatus,
    resolvedAt: tsToIso(d.resolvedAt),
    resolvedBy: d.resolvedBy ?? null,
    parentCheckinTxId:
      d.parentCheckinTxId ?? d.parentCheckoutTxId ?? "",
  };
}

/**
 * Resolves missing `reportedByName` denormalization from users/{uid}.
 * The /events cancel + /events checkin commits both write
 * `reportedByName` at create time; this fallback handles any docs
 * that predate the denorm (e.g., manually-seeded test data).
 */
async function hydrateReporterNames(
  snaps: FirebaseFirestore.DocumentSnapshot[],
): Promise<Map<string, string>> {
  const namesByUid = new Map<string, string>();
  const uidsNeedingHydration = new Set<string>();
  for (const snap of snaps) {
    const d = snap.data() ?? {};
    const uid = d.reportedBy as string | undefined;
    const denormName = d.reportedByName as string | undefined;
    if (!uid) continue;
    if (denormName) {
      namesByUid.set(uid, denormName);
      continue;
    }
    uidsNeedingHydration.add(uid);
  }
  if (uidsNeedingHydration.size === 0) return namesByUid;

  // Batch hydrate via individual lookups. Firestore Admin SDK does not
  // support an `in` query for >10 values reliably across the collection
  // here; the per-doc lookup is cheaper than splitting into batches at
  // ≤50-row windows.
  await Promise.all(
    Array.from(uidsNeedingHydration).map(async (uid) => {
      const userSnap = await adminDb.collection("users").doc(uid).get();
      const data = userSnap.data();
      namesByUid.set(uid, data?.displayName ?? data?.email ?? "Unknown");
    }),
  );
  return namesByUid;
}

/**
 * REP-03 / MIS-02 — cursor-paged missing-items reader.
 *
 * Orders by `reportedAt desc` (most recent first) then by document id for
 * deterministic pagination. The composite indexes cover the dominant
 * filter axes (status, eventId). itemId filter is rare enough that the
 * order-by-only path is acceptable.
 */
export async function getMissingPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: { status?: MissingStatus; eventId?: string; itemId?: string };
}): Promise<MissingPage> {
  const limit = opts.limit ?? 50;
  let q: FirebaseFirestore.Query = adminDb.collection("missingItems");
  if (opts.filters?.status) q = q.where("status", "==", opts.filters.status);
  if (opts.filters?.eventId) q = q.where("eventId", "==", opts.filters.eventId);
  if (opts.filters?.itemId) q = q.where("itemId", "==", opts.filters.itemId);
  q = q.orderBy("reportedAt", "desc").orderBy("__name__").limit(limit + 1);

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    q = q.startAfter(new Date(cursor.reportedAt), cursor.id);
  }

  const snap = await q.get();
  const docs = snap.docs.slice(0, limit);
  const hasMore = snap.docs.length > limit;

  const namesByUid = await hydrateReporterNames(docs);
  const missing = docs.map((d) => {
    const uid = (d.data().reportedBy as string | undefined) ?? "";
    const name = namesByUid.get(uid) ?? "Unknown";
    return toMissingDoc(d, name);
  });

  const last = docs[docs.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          reportedAt: tsToMillis(last.data().reportedAt),
          id: last.id,
        })
      : null;
  return { missing, nextCursor };
}
