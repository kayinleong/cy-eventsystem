// Phase 2 — Plan 02-12 — Wave 11 Block H
// Section loading skeleton for /reports/* (stock, out, history, missing,
// repurchase). Rendered alongside the ReportsTabs nav from
// reports/layout.tsx, so the layout's tabs stay visible while the inner
// content streams in.
//
// Shape: page title + 6-row tabular skeleton matching the standard
// report table layout. Light-weight; Next 16 wraps in Suspense.

import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
