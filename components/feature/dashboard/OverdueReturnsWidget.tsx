// Phase 2 dashboard — Overdue returns widget (Block D UI swap, plan 02-07).
//
// REQUIREMENTS.md EVT-07 — active events whose endDate < now(). Phase 1 used
// a fixed PHASE_1_TODAY constant (2026-05-24); Phase 2 uses Date.now() so
// the widget reflects real time.
//
// Subscribes via useEventsLive scoped to {status: "active"} + client-side
// filter for endDate < now. EVT-08 enforced inside the live hook + SSR seed.
//
// Each row links straight to the event's check-in flow (/events/[id]/checkin,
// plan 02-09) to make the recovery path one click away.

"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import { useEventsLive } from "@/lib/hooks/use-events-live";
import type { EventDoc } from "@/lib/types/event";
import type { Session } from "@/lib/types/session";

function formatShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// External "now" store synchronized via setInterval. Using
// useSyncExternalStore keeps React's purity rules happy (no Date.now() in
// render, no synchronous setState in effect) while still letting the
// overdue filter refresh every minute. SSR returns 0 — equivalent to
// "nothing overdue yet" — and the first client-hydration tick promotes to
// the real timestamp.
let currentNow = 0;
const nowSubscribers = new Set<() => void>();
let nowInterval: ReturnType<typeof setInterval> | null = null;

function getClientNow(): number {
  return currentNow;
}
function getServerNow(): number {
  return 0;
}
function subscribeNow(cb: () => void): () => void {
  if (currentNow === 0) currentNow = Date.now();
  nowSubscribers.add(cb);
  if (nowInterval === null && typeof window !== "undefined") {
    nowInterval = setInterval(() => {
      currentNow = Date.now();
      nowSubscribers.forEach((sub) => sub());
    }, 60_000);
  }
  // Schedule a microtask to deliver the initial currentNow → consumers
  // notice the bump from 0 → Date.now() after their first commit.
  queueMicrotask(cb);
  return () => {
    nowSubscribers.delete(cb);
    if (nowSubscribers.size === 0 && nowInterval !== null) {
      clearInterval(nowInterval);
      nowInterval = null;
    }
  };
}

export function OverdueReturnsWidget({
  initial,
  session,
}: {
  initial: EventDoc[];
  session: Session;
}) {
  const activeEvents = useEventsLive(initial, {
    session,
    status: "active",
    limit: 50,
  });

  const nowMs = useSyncExternalStore(
    subscribeNow,
    getClientNow,
    getServerNow,
  );

  // EVT-07 — overdue = active AND endDate < now. nowMs=0 means "not
  // hydrated yet" → show empty list, matching SSR.
  const overdueEvents = useMemo(() => {
    if (nowMs === 0) return [];
    return activeEvents.filter((e) => {
      const endMs = new Date(e.endDate).getTime();
      return Number.isFinite(endMs) && endMs < nowMs;
    });
  }, [activeEvents, nowMs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Overdue returns</CardTitle>
      </CardHeader>
      <CardContent>
        {overdueEvents.length === 0 ? (
          <EmptyState
            icon={Clock}
            heading="No overdue returns"
            body="Active events with past end dates will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {overdueEvents.map((e) => (
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
