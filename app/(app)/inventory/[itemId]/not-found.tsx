// Phase 2 — Plan 02-12 — Wave 11 Block H
// Item-specific not-found page — rendered when getItemServer(itemId)
// returns null and the [itemId]/page.tsx (or edit/page.tsx) calls
// notFound() from next/navigation.
//
// More specific than the generic (app)/not-found.tsx — explicitly tells
// the user the *item* is gone (or never existed) and points back to the
// inventory list rather than the dashboard.
//
// HTML hygiene: rendered inside (app)/layout.tsx's <main>, so this uses
// <div> not <main> to avoid nested landmarks.

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ItemNotFound() {
  return (
    <div className="grid place-items-center min-h-[60vh] px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Item not found</h1>
        <p className="text-muted-foreground">
          This item doesn&apos;t exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>
    </div>
  );
}
