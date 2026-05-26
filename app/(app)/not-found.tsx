// Phase 2 — Plan 02-12 — Wave 11 Block H
// App-wide 404 fallback for /(app)/* routes that don't have a more
// specific not-found.tsx (e.g. inventory/[itemId], events/[eventId]).
//
// Server Component — Next 16 streams a 200 status, but on a non-streamed
// response returns 404. The (app) shell (sidebar + topbar from layout.tsx)
// remains rendered around this content.
//
// HTML hygiene: rendered inside (app)/layout.tsx's <main>, so this uses
// <div> not <main> to avoid nested <main> elements.

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="grid place-items-center min-h-[60vh] px-4 py-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
