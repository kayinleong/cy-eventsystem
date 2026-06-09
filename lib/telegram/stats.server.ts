import "server-only";
// lib/telegram/stats.server.ts
// quick-kayinleong-018 — read-only stats helper for the Telegram bot's /events
// command. This is the ONE command lacking a session-free fetcher: the paged
// events reader requires a `session: Session` for EVT-08 access filtering,
// which the cookieless webhook does not have. So we read active events
// directly via adminDb and compute per-event checked-out + open-missing counts.
//
// READ-ONLY by construction: no Firestore write operations and no transactions
// anywhere in this module — only collection reads and a count() aggregation.

import { adminDb } from "@/lib/firebase/admin";
import { getOpenCheckoutsForEventServer } from "@/lib/data/events.server";

export type ActiveEventStats = {
  id: string;
  name: string;
  checkedOutQty: number;
  openMissing: number;
};

/**
 * Active events with per-event open checked-out quantity and open-missing count.
 *
 * Capped to ~10 active events (default) to bound time/cost — the whole call
 * must return inside grammY's 8000ms webhook timeout. Per-event work runs in
 * parallel via Promise.all.
 *
 * - open-missing: count() aggregation on missingItems WHERE eventId == id AND
 *   status == "open" (single backend request, O(1) for the client).
 * - checked-out: sum of qty across the event's still-open checkout transactions
 *   (getOpenCheckoutsForEventServer already nets out checked-in lines).
 */
export async function getActiveEventsStats(opts?: {
  limit?: number;
}): Promise<ActiveEventStats[]> {
  const limit = opts?.limit ?? 10;

  const eventsSnap = await adminDb
    .collection("events")
    .where("status", "==", "active")
    .limit(limit)
    .get();

  return Promise.all(
    eventsSnap.docs.map(async (doc) => {
      const data = doc.data();
      const id = doc.id;
      const name = (data.name as string | undefined) ?? id;

      const [openMissingAgg, openCheckouts] = await Promise.all([
        adminDb
          .collection("missingItems")
          .where("eventId", "==", id)
          .where("status", "==", "open")
          .count()
          .get(),
        getOpenCheckoutsForEventServer(id),
      ]);

      const checkedOutQty = openCheckouts.reduce(
        (sum, tx) => sum + (tx.qty ?? 0),
        0,
      );

      return {
        id,
        name,
        checkedOutQty,
        openMissing: openMissingAgg.data().count,
      };
    }),
  );
}
