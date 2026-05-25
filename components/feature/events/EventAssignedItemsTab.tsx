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
          </div>
          <span className="text-sm">{t.qty} out</span>
        </li>
      ))}
    </ul>
  );
}
