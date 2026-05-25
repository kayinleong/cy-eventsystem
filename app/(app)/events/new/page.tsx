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
//
// SSR seed: fetch the users list once so the EventForm's TeamLead /
// BackupTeam comboboxes have a populated picker on first paint. Cap at
// 200 (D-16 scale — 5-10 internal users plus headroom).

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/dal";
import { getUsersPage } from "@/lib/data/users.server";
import { EventForm } from "@/components/feature/events/EventForm";

export const metadata: Metadata = { title: "Create event" };

export default async function NewEventPage() {
  await requireSession();
  const { users } = await getUsersPage({ limit: 200 });
  return (
    <div className="space-y-6">
      <PageHeader title="Create event" description="Schedule a new event." />
      <EventForm mode="create" users={users} />
    </div>
  );
}
