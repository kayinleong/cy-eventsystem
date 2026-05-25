// Phase 2 dashboard — Active events widget (Block D UI swap, plan 02-07).
//
// REQUIREMENTS:
//   - EVT-08 — staff sees only events where uid ∈ allowedStaff (enforced
//     server-side in the SSR seed via getEventsPage + client-side in the
//     onSnapshot listener via useEventsLive's array-contains filter).
//
// Reads active events via useEventsLive scoped to {status: "active"} so
// new event creations / cancellations re-render live. SSR-seeded by the
// dashboard page (app/(app)/page.tsx) to avoid the empty-then-fill flash
// on first paint.
//
// Note: the full dashboard swap (KPI count() aggregations + RecentActivity
// feed via useTransactionsLive) is plan 02-10 (Block G). This plan ships
// the events portion only.

"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
import { useEventsLive } from "@/lib/hooks/use-events-live";
import type { EventDoc } from "@/lib/types/event";
import type { Session } from "@/lib/types/session";

export function ActiveEventsWidget({
  initial,
  session,
}: {
  initial: EventDoc[];
  session: Session;
}) {
  const events = useEventsLive(initial, {
    session,
    status: "active",
    limit: 10,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Active events</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            icon={Calendar}
            heading="No active events"
            body="Active events will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <li
                key={e.id}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/events/${e.id}`}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {e.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{e.location}</p>
                </div>
                <StatusBadge tone={statusToTone(e.status)}>
                  {statusToLabel(e.status)}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
