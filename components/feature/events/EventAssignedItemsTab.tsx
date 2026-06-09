// Phase 2 — Event detail "Assigned items" tab (Block D UI swap, plan 02-07).
//
// REQUIREMENTS:
//   - EVT-04 — event detail surface includes a list of items currently
//     checked out for the event (open checkouts).
//
// Subscribes to the transactions collection via useTransactionsLive scoped
// to {eventId} so checkout/checkin mutations re-render the list live.
//
// "Open checkout" definition (matches lib/data/events.server.ts
// getOpenCheckoutsForEventServer): a checkout transaction whose id is not
// referenced as parentTxId by any check-in transaction for the same event.
// The simple "did any check-in close this checkout?" model; partial returns
// aren't expected in v1 (Phase 2 02-09 check-in flow returns the full
// checkout qty per line).
//
// quick-kayinleong-013: shows each checked-out item's current (group) location,
// derived from the event's `location` transactions (already in the subscribed
// stream — group location scans stamp eventId). Replaces the prior
// quick-kayinleong-010 inventory-doc subscription (home location) per the
// user's "item in group" intent. No client checkoutGroups/inventory reads.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PackageOpen } from "lucide-react";

import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";
import { EmptyState } from "@/components/ui/empty-state";

export function EventAssignedItemsTab({ eventId }: { eventId: string }) {
  // Subscribe to ALL transactions for this event so we can split into
  // checkouts + checkins client-side. limit=100 covers the v1 D-16 scale
  // (events have on the order of dozens of line items, not hundreds).
  const allTxs = useTransactionsLive({ eventId, limit: 100 });

  const openCheckouts = useMemo(() => {
    const checkedInParents = new Set(
      allTxs
        .filter((t) => t.type === "checkin" && t.parentTxId)
        .map((t) => t.parentTxId as string),
    );
    return allTxs.filter(
      (t) => t.type === "checkout" && !checkedInParents.has(t.id),
    );
  }, [allTxs]);

  // quick-kayinleong-013 — current (group) location per item = the `location`
  // value of its latest `type:"location"` tx. The hook orders `at desc`, so the
  // FIRST location tx per itemId is the latest. Empty values are skipped.
  const currentLocationMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of allTxs) {
      if (t.type !== "location") continue;
      if (map.has(t.itemId)) continue;
      const loc = t.location ?? "";
      if (!loc) continue;
      map.set(t.itemId, loc);
    }
    return map;
  }, [allTxs]);

  if (openCheckouts.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        heading="Nothing checked out"
        body="Items checked out for this event will appear here."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {openCheckouts.map((t) => (
        <li
          key={t.id}
          className="py-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <Link
              href={`/inventory/${t.itemId}`}
              className="text-sm font-medium hover:underline"
            >
              {t.itemName}
            </Link>
            <p className="text-xs text-muted-foreground font-mono">
              {t.itemSku}
            </p>
            {currentLocationMap.get(t.itemId) ? (
              <p className="text-xs text-muted-foreground">
                {currentLocationMap.get(t.itemId)}
              </p>
            ) : null}
          </div>
          <span className="text-sm">{t.qty} out</span>
        </li>
      ))}
    </ul>
  );
}
