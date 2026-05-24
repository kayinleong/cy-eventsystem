// Phase 1 dashboard — Recent activity feed (last 20 transactions, newest first).
//
// REQUIREMENTS.md AUD-01 — every transaction carries a denormalized
// `actorRoleAtTimeOfAction` snapshot (the role at write-time, not the user's
// current role). This widget surfaces that snapshot in the meta line per
// AUD-01's audit-trail intent.
//
// Subscribes to the mock store via useSyncExternalStore through
// `selectRecentActivity`. Any later mutation in the session (checkout,
// checkin, resolveMissing, etc.) appends a new transaction and bumps this
// feed to the top.

"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectRecentActivity } from "@/lib/mock/selectors";

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
  const txs = useMockStore((s) => selectRecentActivity(s, 20));
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
