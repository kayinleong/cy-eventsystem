// Phase 1 — /events/new admin-gated create form route.
//
// REQUIREMENTS:
//   - EVT-01 — admins (and in Phase 2 also team leads) can create events.
//
// CONTEXT.md D-07 — Phase 1 keeps `/events/new` strictly admin-only. The
// REQUIREMENTS allow team-lead creation in Phase 2; Phase 1 mirrors the
// strict /inventory/new gate so role-aware UI is testable end-to-end with the
// PhaseOnePocRoleSwitcher.

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/mock-session";
import { EventForm } from "@/components/feature/events/EventForm";

export const metadata: Metadata = { title: "Create event" };

export default async function NewEventPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <PageHeader title="Create event" description="Schedule a new event." />
      <EventForm mode="create" />
    </div>
  );
}
