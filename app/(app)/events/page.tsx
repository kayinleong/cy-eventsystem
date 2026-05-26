// Phase 2 — /events list page (Block D UI swap, plan 02-07).
//
// Server-Component shell that:
//   - Verifies the session via the real DAL (requireSession redirects to
//     /api/auth/expire-session if the __session cookie is missing/invalid).
//   - Issues a cursor-paged Admin SDK read via getEventsPage (50-row slice
//     per D-20). EVT-08 enforced server-side — staff only see events whose
//     allowedStaff array contains their uid; admin sees all.
//   - Hands off `events`, `nextCursor`, and the full `session` to the
//     client EventsTable, which subscribes to the same window via
//     onSnapshot (Web SDK) for live updates.
//   - Surfaces a "Create event" CTA (EVT-01 — any signed-in user can in
//     principle create; the Server Action narrows to admin OR self-team-lead).
//
// URL contract per D-17: `?cursor=xxx` opaque base64 JSON blob replaces
// Phase 1's `?page=N`. Filter URL params (`?status=`) survive unchanged per
// REP-06.
//
// REQUIREMENTS:
//   - EVT-03 — filterable list, default filter status=active
//   - EVT-08 — staff sees only events where uid ∈ allowedStaff
//   - REP-06 — shareable filter URLs
//   - REP-07 — 50 rows/page (the cursor window size)

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/dal";
import { getEventsPage } from "@/lib/data/events.server";
import { EventsTable } from "@/components/feature/events/EventsTable";

export const metadata: Metadata = { title: "Events" };

type RouteProps = {
  searchParams: Promise<{
    cursor?: string;
    status?: string;
  }>;
};

export default async function EventsListPage({ searchParams }: RouteProps) {
  // Defense-in-depth: the (app) layout already gated auth; requireSession
  // here narrows session for the SSR seed below.
  const session = await requireSession();

  const params = await searchParams; // Next 16 async
  // Default to all statuses — users browse every event they have access to
  // (gated separately by EVT-08 allowedStaff projection in getEventsPage).
  // Explicit ?status=<value> narrows; ?status=_all is the same as omitted.
  const statusParam = params.status;
  const statusFilter =
    !statusParam || statusParam === "_all" ? undefined : statusParam;

  const { events, nextCursor } = await getEventsPage({
    cursor: params.cursor ?? null,
    filters: { status: statusFilter },
    session,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Plan, run, and close out events."
        action={
          <Button asChild>
            <Link href="/events/new">
              <Plus className="mr-2 size-4" />
              Create event
            </Link>
          </Button>
        }
      />
      <EventsTable
        initialEvents={events}
        nextCursor={nextCursor}
        session={session}
      />
    </div>
  );
}
