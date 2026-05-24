// Phase 1 — Item detail "History" tab.
//
// REQUIREMENTS:
//   - AUD-02 — chronological transactions for the item (newest first)
//   - AUD-01 — every row shows the actor's role at write-time (the denormalized
//     `actorRoleAtTimeOfAction` snapshot from the transaction record)
//
// Subscribes to the mock store via useMockStore so any later mutation
// (checkout, checkin, missing) re-renders the feed.

"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectTransactionsForItem } from "@/lib/mock/selectors";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import {
  statusToTone,
  statusToLabel,
} from "@/components/feature/status/status-to-tone";
import { EmptyState } from "@/components/ui/empty-state";

function actionVerb(type: string): string {
  switch (type) {
    case "checkout":
      return "checked out";
    case "checkin":
      return "returned";
    case "missing":
      return "flagged missing";
    case "adjustment":
      return "adjusted";
    default:
      return type;
  }
}

export function ItemHistoryTab({ itemId }: { itemId: string }) {
  const txs = useMockStore((s) => selectTransactionsForItem(s, itemId));

  if (txs.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        heading="No activity yet"
        body="Transactions involving this item will appear here."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {txs.map((t) => (
        <li key={t.id} className="py-3 flex items-start gap-3">
          <StatusBadge tone={statusToTone(t.type)} className="mt-0.5">
            {statusToLabel(t.type)}
          </StatusBadge>
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-medium">{t.actorName}</span>{" "}
              {actionVerb(t.type)}{" "}
              <span className="font-medium">{t.qty}</span>
              {t.eventId ? (
                <>
                  {" for "}
                  <Link
                    href={`/events/${t.eventId}`}
                    className="hover:underline"
                  >
                    {t.eventName}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(t.at), { addSuffix: true })} · role:{" "}
              {t.actorRoleAtTimeOfAction}
            </p>
            {t.notes ? (
              <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
