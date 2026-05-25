// Phase 2 — /events/[eventId] detail route (Block D UI swap, plan 02-07).
//
// REQUIREMENTS:
//   - EVT-04 — detail page with assigned items + status + history.
//   - EVT-05 — Edit button gated by admin OR event team-lead membership.
//   - EVT-06 — Cancel button admin-only and only when status is not terminal.
//   - EVT-08 — staff sees only events where their uid ∈ allowedStaff;
//     otherwise notFound (anti-enumeration). Admin sees all events.
//
// Next 16 — params is async (must be awaited). The Server Component reads
// the doc once for SSR (title + initial render of EventDetail); the
// interactive surfaces (cancel dialog, assigned/history tabs) live in client
// islands that subscribe via Web SDK onSnapshot.
//
// Also SSR-seeds the users list (lightweight at the Phase 2 D-16 scale of
// ~5-10 internal users) so EventDetail can resolve teamLead / backupTeam
// uids → display names without a client-side fetch.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/dal";
import { canEditEvent } from "@/lib/auth/roles";
import { getEventServer } from "@/lib/data/events.server";
import { getUsersPage } from "@/lib/data/users.server";
import { EventDetail } from "@/components/feature/events/EventDetail";

type RouteProps = { params: Promise<{ eventId: string }> };

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const { eventId } = await params;
  // generateMetadata runs unauthenticated context in some Next versions; we
  // can't pass a session here, so just return a generic title. The detail
  // page itself enforces EVT-08 separately.
  return { title: `Event ${eventId}` };
}

export default async function EventDetailPage({ params }: RouteProps) {
  const session = await requireSession();
  const { eventId } = await params;

  // EVT-08 enforced inside getEventServer — returns null for non-members.
  const event = await getEventServer(eventId, session);
  if (!event) notFound();

  const isAdmin = session.role === "admin";
  const canEdit = canEditEvent(session, event); // EVT-05

  // SSR-seed users for the team-member chip resolution.
  const { users } = await getUsersPage({ limit: 200 });

  return (
    <EventDetail
      event={event}
      users={users}
      isAdmin={isAdmin}
      canEdit={canEdit}
    />
  );
}
