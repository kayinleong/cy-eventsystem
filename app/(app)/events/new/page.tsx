// Phase 2 — /events/new create form route (Block D UI swap, plan 02-07).
//
// REQUIREMENTS:
//   - EVT-01 — any signed-in user can attempt create; the Server Action
//     (createEvent in @/app/(app)/events/actions) gates further: admin OR
//     the requester must name themselves in teamLeads.
//
// Phase 1 used `requireAdmin` here (admin-only). Phase 2 broadens the page
// gate to `requireSession` per EVT-01 + canEditEvent semantics — team leads
// can self-create. The Server Action remains the security boundary.

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/dal";
import { EventForm } from "@/components/feature/events/EventForm";

export const metadata: Metadata = { title: "Create event" };

export default async function NewEventPage() {
  await requireSession();
  return (
    <div className="space-y-6">
      <PageHeader title="Create event" description="Schedule a new event." />
      <EventForm mode="create" />
    </div>
  );
}
