// Phase 1 — /events list page.
//
// Server-Component shell that hands off to the client `EventsTable` island.
// The role-gate from (app)/layout.tsx (Plan 04) has already enforced auth at
// this point; per D-07, /events/new is admin-only, so we gate the "Create
// event" CTA on session.role === "admin" too (mirrors the inventory shell).
//
// URL state (q, status, page, sort) lives inside the client table via
// `useUrlTableState` (Plan 03). No prop drilling.
//
// REQUIREMENTS:
//   - EVT-03 — filterable list, default filter status=active, sortable by startDate
//   - EVT-08 — staff sees only events where uid ∈ allowedStaff (enforced inside
//              EventsTable via selectAccessibleEvents)
//   - REP-06 — shareable filter URLs (DataTable + useUrlTableState)
//   - REP-07 — 50 rows/page default

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/mock-session";
import { EventsTable } from "@/components/feature/events/EventsTable";

export const metadata: Metadata = { title: "Events" };

export default async function EventsListPage() {
  // Read session server-side so the table can render the EVT-08 access
  // projection on the SSR pass (no empty-then-fill flash on first paint).
  // The (app) layout already enforced auth, but call requireSession() here
  // to narrow `session.uid` + `session.role` to non-nullable for the prop
  // hand-off below — also defensive against direct route invocation.
  const session = await requireSession();
  const isAdmin = session.role === "admin";
  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Plan, run, and close out events."
        action={
          isAdmin ? (
            <Button asChild>
              <Link href="/events/new">
                <Plus className="mr-2 size-4" />
                Create event
              </Link>
            </Button>
          ) : null
        }
      />
      <EventsTable uid={session.uid} role={session.role} />
    </div>
  );
}
