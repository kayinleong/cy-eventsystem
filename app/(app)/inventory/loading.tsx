// Phase 2 — Plan 02-12 — Wave 11 Block H
// Section loading skeleton for /inventory and all descendants.
//
// Matches the inventory list layout: PageHeader (h-8 title + CTA button)
// + a filter bar (two h-9 controls) + an 8-row table-like list. The
// shape mirrors InventoryTable so the swap to real content has minimal
// visual jitter.
//
// Server Component (no "use client" needed) — Next 16 wraps it in
// Suspense automatically.

import { Skeleton } from "@/components/ui/skeleton";

export default function InventoryLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
