import "server-only";
// lib/data/events.server.ts
// Per RESEARCH §4 + D-17 cursor pagination + D-20 listener-scope window.
// Mirrors lib/data/inventory.server.ts + lib/data/users.server.ts shape so
// the SSR-seed → onSnapshot handoff is structurally identical across
// collections.
//
// EVT-08 access projection (the load-bearing decision of this plan):
//   - Admin: sees ALL events. No array-contains filter.
//   - Staff: sees only events where session.uid ∈ allowedStaff. Enforced
//     server-side via `where("allowedStaff", "array-contains", uid)` so even
//     the SSR seed never leaks events the user shouldn't see.
//
// The firestore.rules `isMember(resource)` also enforces this at read-time,
// but the SDK projection here means the page render doesn't waste cycles on
// rows the rule will deny.
//
// Type compatibility: EventDoc (lib/types/event.ts) uses ISO strings for
// startDate / endDate / createdAt / closedAt (Phase 1 contract). We convert
// Firestore Timestamps → ISO strings here at the boundary so consumers
// (EventsTable, EventDetail) keep working without any prop-shape changes.

import { adminDb } from "@/lib/firebase/admin";
import type { EventDoc, EventStatus } from "@/lib/types/event";
import type { TransactionDoc, TransactionType } from "@/lib/types/transaction";
import type { Session } from "@/lib/types/session";
import type { UserRole } from "@/lib/types/user";

type EvCursor = { startDate: number; id: string };

export type EventsPage = {
  events: EventDoc[];
  nextCursor: string | null;
};

function encodeCursor(c: EvCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64");
}

function decodeCursor(s: string): EvCursor | null {
  try {
    return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as EvCursor;
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

function toEvent(snap: FirebaseFirestore.DocumentSnapshot): EventDoc {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    name: d.name ?? "",
    startDate: tsToIso(d.startDate) ?? new Date(0).toISOString(),
    endDate: tsToIso(d.endDate) ?? new Date(0).toISOString(),
    status: (d.status ?? "planned") as EventStatus,
    location: d.location ?? "",
    description: d.description ?? "",
    teamLeads: Array.isArray(d.teamLeads) ? (d.teamLeads as string[]) : [],
    backupTeams: Array.isArray(d.backupTeams) ? (d.backupTeams as string[]) : [],
    allowedStaff: Array.isArray(d.allowedStaff)
      ? (d.allowedStaff as string[])
      : [],
    plannedItems: d.plannedItems ?? {},
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    createdBy: d.createdBy ?? "",
    closedAt: tsToIso(d.closedAt),
    closedBy: d.closedBy ?? null,
  };
}

/**
 * EVT-03 + EVT-08 — cursor-paged events read with access projection.
 *
 * Admin sees all events; staff sees only events where `uid in allowedStaff`.
 * Orders by `startDate asc` (Phase 1 default sort) then by document id for
 * deterministic cursor pagination. The composite index
 * `events(allowedStaff array-contains, status, startDate)` covers the staff
 * case; the simpler `events(status, startDate)` covers the admin case.
 */
export async function getEventsPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: { status?: string };
  session: Session;
}): Promise<EventsPage> {
  const limit = opts.limit ?? 50;
  let q: FirebaseFirestore.Query = adminDb.collection("events");

  // EVT-08 — restrict to events the requester has access to.
  if (opts.session.role !== "admin") {
    q = q.where("allowedStaff", "array-contains", opts.session.uid);
  }
  if (opts.filters?.status) {
    q = q.where("status", "==", opts.filters.status);
  }

  q = q.orderBy("startDate", "asc").orderBy("__name__").limit(limit + 1);

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    // startAfter takes the same field values used in orderBy. We store the
    // startDate as millis in the cursor blob, so we hydrate it back to a Date
    // for the SDK.
    q = q.startAfter(new Date(cursor.startDate), cursor.id);
  }

  const snap = await q.get();
  const docs = snap.docs.slice(0, limit);
  const hasMore = snap.docs.length > limit;
  const events = docs.map(toEvent);
  const last = docs[docs.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          startDate: tsToMillis(last.data().startDate),
          id: last.id,
        })
      : null;
  return { events, nextCursor };
}

/**
 * EVT-04 — single event read with EVT-08 access check applied.
 * Returns null if the event doesn't exist OR the requester lacks access; the
 * caller (Server Component) then calls notFound() so non-members get the same
 * 404 path as non-existent events (anti-enumeration).
 */
export async function getEventServer(
  eventId: string,
  session: Session,
): Promise<EventDoc | null> {
  const snap = await adminDb.collection("events").doc(eventId).get();
  if (!snap.exists) return null;
  const event = toEvent(snap);

  // EVT-08 — staff must be in allowedStaff. Admin sees all.
  if (session.role !== "admin" && !event.allowedStaff.includes(session.uid)) {
    return null;
  }
  return event;
}

/**
 * Used by EventAssignedItemsTab + CancelEventDialog reconciliation —
 * lists open checkouts for an event (checkout transactions with no
 * matching check-in).
 *
 * Algorithm: fetch all checkout transactions + all check-in transactions
 * for the event, then filter checkouts to those whose id is NOT in the
 * set of `parentTxId` values in the check-ins.
 *
 * Note: this is the "simple" version that doesn't account for partial
 * returns (a checkout of qty=5 with a check-in of qty=3 is treated as
 * fully closed). The mock store also uses a "sum of matched qty" pattern
 * (see lib/mock/selectors.ts:selectOpenCheckoutsForEvent), but Phase 2
 * checkout/check-in flows in plans 02-08/02-09 will use full qty per
 * line item, so partial returns aren't expected in v1.
 */
export async function getOpenCheckoutsForEventServer(
  eventId: string,
): Promise<TransactionDoc[]> {
  const [checkoutSnap, checkinSnap] = await Promise.all([
    adminDb
      .collection("transactions")
      .where("eventId", "==", eventId)
      .where("type", "==", "checkout")
      .orderBy("at", "desc")
      .get(),
    adminDb
      .collection("transactions")
      .where("eventId", "==", eventId)
      .where("type", "==", "checkin")
      .get(),
  ]);

  const checkedInParents = new Set(
    checkinSnap.docs
      .map((d) => d.data().parentTxId as string | null)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  return checkoutSnap.docs
    .filter((d) => !checkedInParents.has(d.id))
    .map((d) => {
      const dt = d.data();
      return {
        id: d.id,
        type: dt.type as TransactionType,
        itemId: dt.itemId,
        itemSku: dt.itemSku,
        itemName: dt.itemName,
        eventId: dt.eventId ?? null,
        eventName: dt.eventName ?? null,
        qty: dt.qty,
        actorUid: dt.actorUid,
        actorName: dt.actorName,
        actorRoleAtTimeOfAction: dt.actorRoleAtTimeOfAction as UserRole,
        at: tsToIso(dt.at) ?? new Date(0).toISOString(),
        notes: dt.notes ?? "",
        parentTxId: dt.parentTxId ?? null,
        clientTxId: dt.clientTxId ?? null,
      } as TransactionDoc;
    });
}
