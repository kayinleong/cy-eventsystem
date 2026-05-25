// Phase 2 — /events/[eventId]/edit route (Block D UI swap, plan 02-07).
//
// REQUIREMENTS:
//   - EVT-05 — admins OR any team lead of the event can edit. Page gate
//     rejects non-members early (notFound for anti-enumeration).
//
// Next 16 — `params` is async, must be awaited (per AGENTS.md). The role
// gate happens AFTER the event read so non-existent events and access-denied
// events both render the same notFound() path.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/dal";
import { canEditEvent } from "@/lib/auth/roles";
import { getEventServer } from "@/lib/data/events.server";
import { getUsersPage } from "@/lib/data/users.server";
import { EventForm } from "@/components/feature/events/EventForm";

export const metadata: Metadata = { title: "Edit event" };

type RouteProps = { params: Promise<{ eventId: string }> };

export default async function EditEventPage({ params }: RouteProps) {
  const session = await requireSession();
  const { eventId } = await params;

  // EVT-08 enforced by getEventServer — staff non-members get null and
  // we 404 (same path as truly-missing events).
  const event = await getEventServer(eventId, session);
  if (!event) notFound();

  // EVT-05 — admin OR team lead may edit. Non-leads see the same notFound
  // path so we don't reveal that they can read the event but not edit it.
  if (!canEditEvent(session, event)) notFound();

  // SSR-seed the users list for the comboboxes.
  const { users } = await getUsersPage({ limit: 200 });

  return (
    <div className="space-y-6">
      <PageHeader title="Edit event" description={event.name} />
      <EventForm
        mode="edit"
        eventId={eventId}
        users={users}
        initial={{
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
          description: event.description,
          teamLeads: event.teamLeads,
          backupTeams: event.backupTeams,
        }}
      />
    </div>
  );
}
