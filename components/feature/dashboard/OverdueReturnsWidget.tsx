// Phase 1 dashboard — Overdue returns widget.
//
// REQUIREMENTS.md EVT-07 — active events whose endDate < today (CONTEXT.md
// D-04 fixed "today" of 2026-05-24). The seed data ships exactly one such
// event: "Marketing Pop-Up Booth" (endDate 2026-05-22). Items checked out to
// that event are overdue for return.
//
// Each row links straight to the event's check-in flow (/events/[id]/checkin,
// Plan 10) to make the recovery path one click away.

"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectOverdueEvents } from "@/lib/mock/selectors";

function formatShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function OverdueReturnsWidget() {
  const events = useMockStore(selectOverdueEvents);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Overdue returns</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            icon={Clock}
            heading="No overdue returns"
            body="Active events with past end dates will appear here."
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
                    href={`/events/${e.id}/checkin`}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {e.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Ended {formatShort(e.endDate)}
                  </p>
                </div>
                <StatusBadge tone="amber">Overdue</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
