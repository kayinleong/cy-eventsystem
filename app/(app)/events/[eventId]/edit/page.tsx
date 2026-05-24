// Phase 1 — /events/[eventId]/edit route.
//
// REQUIREMENTS:
//   - EVT-05 — admins OR any team lead of the event can edit. Staff
//     non-leads are redirected to /unauthorized.
//
// Next 16 — `params` is async, must be awaited (per AGENTS.md). The role
// gate happens BEFORE the snapshot read to keep the redirect path cheap.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/mock-session";
import { getSnapshot } from "@/lib/mock/store";
import { selectEventById } from "@/lib/mock/selectors";
import { EventForm } from "@/components/feature/events/EventForm";

export const metadata: Metadata = { title: "Edit event" };

type RouteProps = { params: Promise<{ eventId: string }> };

export default async function EditEventPage({ params }: RouteProps) {
  const session = await requireSession();
  const { eventId } = await params;
  const event = selectEventById(getSnapshot(), eventId);
  if (!event) notFound();

  // EVT-05 — admin OR any team lead of THIS event may edit.
  const allowed =
    session.role === "admin" || event.teamLeads.includes(session.uid);
  if (!allowed) redirect("/unauthorized");

  return (
    <div className="space-y-6">
      <PageHeader title="Edit event" description={event.name} />
      <EventForm
        mode="edit"
        eventId={eventId}
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
