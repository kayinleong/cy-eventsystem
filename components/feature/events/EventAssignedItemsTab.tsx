// Phase 1 — Event detail "Assigned items" tab.
//
// REQUIREMENTS:
//   - EVT-04 — event detail surface includes a list of items currently
//     checked out for the event (open checkouts).
//
// Subscribes to the mock store via `useMockStore` so checkout/checkin
// mutations re-render the list live. Uses `selectOpenCheckoutsForEvent`
// (sums matched checkin qty against each checkout qty to compute open lines).

"use client";

import Link from "next/link";
import { PackageOpen } from "lucide-react";

import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectOpenCheckoutsForEvent } from "@/lib/mock/selectors";
import { EmptyState } from "@/components/ui/empty-state";

export function EventAssignedItemsTab({ eventId }: { eventId: string }) {
  const open = useMockStore((s) => selectOpenCheckoutsForEvent(s, eventId));

  if (open.length === 0) {
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
      {open.map((t) => (
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
