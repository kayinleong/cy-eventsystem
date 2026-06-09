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
// quick-kayinleong-010: also subscribes to a secondary per-item snapshot to
// show current location alongside each checked-out item.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PackageOpen } from "lucide-react";
import {
  collection,
  query,
  where,
  documentId,
  onSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "@/lib/firebase/client";
import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";
import { EmptyState } from "@/components/ui/empty-state";

// Small helper: subscribes to inventory docs for the given item IDs
// and returns a map of itemId → location string.
// Uses where(documentId(), "in", ids) — Firestore "in" limit is 30 per query.
// v1 events have well under 30 distinct item IDs in open checkouts.
//
// The effect is keyed by a sorted-join of ids. When ids is empty, the effect
// returns without subscribing; the map stays at its initial empty state.
// setState is only called inside the async onSnapshot callback (not
// synchronously in the effect body), which satisfies react-hooks/set-state-in-effect.
function useItemLocations(itemIds: string[]): Map<string, string> {
  const [locationMap, setLocationMap] = useState<Map<string, string>>(
    new Map(),
  );

  // Stable key for the effect dep — join sorted IDs into a string.
  // Computed inline so it's a simple identifier in the dep array.
  const idsKey = itemIds.slice().sort().join(",");

  useEffect(() => {
    if (!idsKey) return; // no ids — leave map as-is (stays empty on first render)

    // Parse the stable key back into the IDs for the Firestore query.
    const ids = idsKey.split(",");
    let unsubSnap: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnap) {
        unsubSnap();
        unsubSnap = null;
      }
      if (!user) return;

      const q = query(
        collection(db, "inventory"),
        where(documentId(), "in", ids),
      );
      // setState called inside async callback — not synchronous in effect body.
      unsubSnap = onSnapshot(q, (snap) => {
        const map = new Map<string, string>();
        snap.docs.forEach((d: QueryDocumentSnapshot) => {
          const data = d.data();
          map.set(d.id, (data.location as string) ?? "");
        });
        setLocationMap(map);
      });
    });

    return () => {
      if (unsubSnap) unsubSnap();
      unsubAuth();
    };
  }, [idsKey]);

  return locationMap;
}

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

  // Collect distinct itemIds from open checkouts for the location lookup.
  const itemIds = useMemo(
    () => Array.from(new Set(openCheckouts.map((t) => t.itemId))),
    [openCheckouts],
  );

  const locationMap = useItemLocations(itemIds);

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
            {locationMap.get(t.itemId) ? (
              <p className="text-xs text-muted-foreground">
                {locationMap.get(t.itemId)}
              </p>
            ) : null}
          </div>
          <span className="text-sm">{t.qty} out</span>
        </li>
      ))}
    </ul>
  );
}
