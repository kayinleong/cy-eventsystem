// Phase 2 — Event detail "History" tab (Block D UI swap, plan 02-07).
//
// REQUIREMENTS:
//   - AUD-03 — chronological transactions for the event (newest first).
//   - AUD-01 — each row shows the actor's role at write-time (the denormalized
//     `actorRoleAtTimeOfAction` snapshot from the transaction record).
//
// Subscribes to the transactions collection via useTransactionsLive scoped
// to {eventId} so any later mutation (checkout, checkin, missing,
// cancellation) re-renders the feed without a server roundtrip. Mirrors the
// inventory ItemHistoryTab shape from plan 02-06.

"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";
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

export function EventHistoryTab({ eventId }: { eventId: string }) {
  // Composite index transactions(eventId, at desc) from plan 02-02 covers
  // this query. 100-row limit is enough for typical event audit history.
  const txs = useTransactionsLive({ eventId, limit: 100 });

  if (txs.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        heading="No activity yet"
        body="Transactions for this event will appear here."
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
              {" × "}
              <Link
                href={`/inventory/${t.itemId}`}
                className="hover:underline"
              >
                {t.itemName}
              </Link>
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
