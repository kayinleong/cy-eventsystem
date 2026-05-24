// Phase 1 dashboard — Active events widget.
//
// Reads `selectActiveEvents` from the mock store via useSyncExternalStore.
// Seed data (Plan 02) contains 2 active events: "Spring Product Demo" and
// "Marketing Pop-Up Booth" (the latter is also overdue per EVT-07 and surfaces
// in the OverdueReturnsWidget separately).
//
// Each row links to /events/[id] (Plan 07's detail page) and shows a
// StatusBadge using the central statusToTone mapping (Plan 03).

"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectActiveEvents } from "@/lib/mock/selectors";

export function ActiveEventsWidget() {
  const events = useMockStore(selectActiveEvents);
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
