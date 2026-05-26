// Phase 2 — Plan 02-12 — Wave 11 Block H
// Event-specific not-found page — rendered when getEventServer(eventId)
// returns null (either because the event truly doesn't exist OR the
// staff user is not in allowedStaff per EVT-08).
//
// T-02-12-02 mitigation (anti-enumeration): the copy is intentionally
// ambiguous between "doesn't exist" and "you lack access". A staff user
// must NOT be able to learn from the error whether an event with that ID
// exists in the system. This mirrors the same-path notFound() pattern
// used in the [eventId]/page.tsx, checkout/page.tsx, checkin/page.tsx,
// and edit/page.tsx routes.
//
// HTML hygiene: rendered inside (app)/layout.tsx's <main>, so this uses
// <div> not <main>.

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EventNotFound() {
  return (
    <div className="grid place-items-center min-h-[60vh] px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Event not found</h1>
        <p className="text-muted-foreground">
          This event doesn&apos;t exist, or you don&apos;t have access to it.
          Contact an admin if this is a mistake.
        </p>
        <Button asChild>
          <Link href="/events">Back to events</Link>
        </Button>
      </div>
    </div>
  );
}
