// Phase 2 — /events/[eventId]/checkout route.
//
// REQUIREMENTS:
//   - CO-01 — From an event detail page, an authorized user can open a
//     check-out screen scoped to that event.
//   - EVT-08 — Staff can only act on events where they are a member of
//     teamLeads or backupTeams (== uid in allowedStaff). Admins can act on
//     any event. Non-members get notFound() — anti-enumeration: same path
//     as a non-existent event.
//   - CO-02/CO-04/CO-05/CO-06/CO-07/CO-08/CO-09/CO-10 — inherited from
//     Plan 02-08's marquee Server Action (commitCheckoutCartAction) and
//     the preserved Phase 1 scanner substrate. This page pre-scopes the
//     ScanSessionProvider with initialEvent={event} (no EventPickerDialog
//     needed) and forces initialMode="checkout".
//   - Page silently rejects non-actionable statuses (completed / cancelled)
//     by redirecting back to the event detail page — you cannot check out
//     items for a closed event.
//
// Architecture:
//   - Server Component shell does the auth + event lookup + EVT-08 access
//     gate. getEventServer enforces EVT-08 server-side (returns null when
//     the requester is not in allowedStaff and isn't admin); we call
//     notFound() on that null path so non-members get the same 404 path as
//     non-existent events.
//   - Hands the resolved event to the colocated Client wrapper which
//     mounts ScanSessionProvider and the Plan 02-08 scan-feature components.
//   - Next 16 — `params` is async, must be awaited.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/dal";
import { getEventServer } from "@/lib/data/events.server";
import { CheckoutClient } from "./_components/checkout-client";

type RouteProps = { params: Promise<{ eventId: string }> };

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  // Metadata runs in a separate request frame from the page; re-verify
  // session here so the title doesn't leak event names to non-members.
  const { eventId } = await params;
  try {
    const session = await requireSession();
    const ev = await getEventServer(eventId, session);
    return { title: ev ? `Check out · ${ev.name}` : "Check out" };
  } catch {
    return { title: "Check out" };
  }
}

export default async function CheckoutPage({ params }: RouteProps) {
  const session = await requireSession();
  const { eventId } = await params;
  // getEventServer applies EVT-08 server-side: returns null for non-existent
  // OR non-accessible events (anti-enumeration — same path as 404).
  const event = await getEventServer(eventId, session);
  if (!event) notFound();

  // Reject non-actionable statuses. Completed / cancelled events cannot
  // accept new check-outs; bounce the user back to the event detail page
  // so they see the closed-state messaging.
  if (event.status !== "planned" && event.status !== "active") {
    redirect(`/events/${eventId}`);
  }

  return <CheckoutClient event={event} />;
}
