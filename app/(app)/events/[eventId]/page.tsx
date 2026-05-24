// Phase 1 — /events/[eventId] detail route.
//
// REQUIREMENTS:
//   - EVT-04 — detail page with assigned items + status + history.
//   - EVT-05 — Edit button gated by admin OR event team-lead membership.
//   - EVT-08 — staff sees only events where their uid ∈ allowedStaff; otherwise
//     redirect /unauthorized. Admin sees all events unconditionally.
//
// Next 16 — params is async (must be awaited). The Server Component reads
// the snapshot once for SSR (title + initial render of EventDetail); the
// interactive surfaces (cancel dialog, assigned/history tabs) live in client
// islands that subscribe via useMockStore so mutations re-render live.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/mock-session";
import { getSnapshot } from "@/lib/mock/store";
import { selectEventById } from "@/lib/mock/selectors";
import { EventDetail } from "@/components/feature/events/EventDetail";

type RouteProps = { params: Promise<{ eventId: string }> };

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const { eventId } = await params;
  const ev = selectEventById(getSnapshot(), eventId);
  return { title: ev ? ev.name : "Event not found" };
}

export default async function EventDetailPage({ params }: RouteProps) {
  const session = await requireSession();
  const { eventId } = await params;
  const event = selectEventById(getSnapshot(), eventId);
  if (!event) notFound();

  // EVT-08 — staff non-allowed users redirected. Admin sees all.
  if (
    session.role !== "admin" &&
    !event.allowedStaff.includes(session.uid)
  ) {
    redirect("/unauthorized");
  }

  const isAdmin = session.role === "admin";
  const canEdit = isAdmin || event.teamLeads.includes(session.uid); // EVT-05

  return <EventDetail event={event} isAdmin={isAdmin} canEdit={canEdit} />;
}
