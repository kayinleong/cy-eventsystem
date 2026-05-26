// Phase 2 dashboard — Recent activity feed (Block G UI swap, plan 02-10).
//
// REQUIREMENTS.md AUD-01 — every transaction carries a denormalized
// `actorRoleAtTimeOfAction` snapshot (the role at write-time). This widget
// surfaces that snapshot in the meta line per AUD-01's audit-trail intent.
//
// Phase 2 swap from Phase 1:
//   - useMockStore + selectRecentActivity → useTransactionsLive scoped to
//     {limit: 20} (D-20 listener window for the dashboard widget).
//   - Newest-first ordering preserved (composite index transactions(at desc)
//     via Firestore's automatic single-field index).
//
// No filter axes — the widget shows the global activity tail. For filtered
// views see /reports/history (HistoryTable consumes useTransactionsLive with
// URL-driven filter state).

"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import {
  statusToTone,
  statusToLabel,
} from "@/components/feature/status/status-to-tone";
import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";

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

export function RecentActivityFeed() {
  const txs = useTransactionsLive({ limit: 20 });
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {txs.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={Activity}
              heading="No activity yet"
              body="Recent transactions will appear here."
            />
          </div>
        ) : (
          <ScrollArea className="h-80">
            <ul className="divide-y divide-border">
              {txs.map((t) => (
                <li key={t.id} className="px-6 py-3 flex items-start gap-3">
                  <StatusBadge tone={statusToTone(t.type)} className="mt-0.5">
                    {statusToLabel(t.type)}
                  </StatusBadge>
                  <div className="min-w-0 flex-1">
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
                      {formatDistanceToNow(new Date(t.at), { addSuffix: true })}{" "}
                      · role: {t.actorRoleAtTimeOfAction}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
