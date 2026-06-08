// quick-kayinleong-012 — Delivery Order "History" feed.
//
// Location updates made via Scan → Location against one of this DO's group
// barcodes stamp the owning `deliveryOrderId` on their transaction (see
// app/(app)/scan/actions.ts). This client island subscribes to those rows via
// useTransactionsLive({ deliveryOrderId }) — composite index
// transactions(deliveryOrderId, at desc) declared in firestore.indexes.json.

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
    case "location":
      return "updated location";
    default:
      return type;
  }
}

export function DOHistoryTab({ doId }: { doId: string }) {
  const txs = useTransactionsLive({ deliveryOrderId: doId, limit: 100 });

  if (txs.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        heading="No activity yet"
        body="Location updates for this delivery order's items will appear here."
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
              {actionVerb(t.type)}
              {t.type === "location" ? (
                <>
                  {" of "}
                  <Link
                    href={`/inventory/${t.itemId}`}
                    className="hover:underline"
                  >
                    {t.itemName}
                  </Link>
                </>
              ) : (
                <>
                  {" "}
                  <span className="font-medium">{t.qty}</span>
                  {" × "}
                  <Link
                    href={`/inventory/${t.itemId}`}
                    className="hover:underline"
                  >
                    {t.itemName}
                  </Link>
                </>
              )}
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
