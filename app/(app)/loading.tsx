// Phase 2 — Plan 02-12 — Wave 11 Block H
// App-wide loading skeleton — shown while any /(app)/* Server Component
// (page, layout, or child) awaits data. Wrapped by Suspense automatically.
//
// Server Component (no "use client") — renders identically on first paint
// and during route transitions. Matches the (app)/layout.tsx <main> shape
// so the swap to real content is jitter-free.

import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
