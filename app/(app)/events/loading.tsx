// Phase 2 — Plan 02-12 — Wave 11 Block H
// Section loading skeleton for /events and all descendants.
//
// Matches the events list layout: PageHeader (h-8 title + Create CTA) +
// a status filter chip row + an 8-row event-card list. Shape mirrors
// EventsTable so the swap is jitter-free.
//
// Server Component — wrapped in Suspense automatically.

import { Skeleton } from "@/components/ui/skeleton";

export default function EventsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
