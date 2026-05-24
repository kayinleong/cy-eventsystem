// Phase 1 — /events/[eventId]/checkout route.
//
// REQUIREMENTS:
//   - CO-01 — From an event detail page, an authorized user can open a
//     check-out screen scoped to that event.
//   - EVT-08 — Staff can only act on events where they are a member of
//     teamLeads or backupTeams (== uid in allowedStaff). Admins can act on
//     any event. Non-allowed users redirect to /unauthorized.
//   - CO-02/CO-04/CO-05/CO-06/CO-07/CO-08/CO-09/CO-10 — inherited from
//     Plan 08's scanner substrate. This page just pre-scopes the
//     ScanSessionProvider with initialEvent={event} (no EventPickerDialog
//     needed) and forces initialMode="checkout".
//   - Page silently rejects non-actionable statuses (completed / cancelled)
//     by redirecting back to the event detail page — you cannot check out
//     items for a closed event.
//
// Architecture:
//   - Server Component shell does the auth + event lookup + role gate
//     (mirrors the shape of /events/[eventId]/page.tsx so Phase 2's DAL
//     swap is mechanical).
//   - Hands the resolved event to the colocated Client wrapper
//     (./_components/checkout-client.tsx) which mounts ScanSessionProvider
//     and the Plan 08 scan-feature components inside the client island.
//   - Next 16 — `params` is async, must be awaited (per AGENTS.md).

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/mock-session";
import { getSnapshot } from "@/lib/mock/store";
import { selectEventById } from "@/lib/mock/selectors";
import { CheckoutClient } from "./_components/checkout-client";

type RouteProps = { params: Promise<{ eventId: string }> };

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const { eventId } = await params;
  const ev = selectEventById(getSnapshot(), eventId);
  return { title: ev ? `Check out · ${ev.name}` : "Check out" };
}

export default async function CheckoutPage({ params }: RouteProps) {
  const session = await requireSession();
  const { eventId } = await params;
  const event = selectEventById(getSnapshot(), eventId);
  if (!event) notFound();

  // EVT-08 — admin sees all events; staff must be in allowedStaff.
  if (
    session.role !== "admin" &&
    !event.allowedStaff.includes(session.uid)
  ) {
    redirect("/unauthorized");
  }

  // Reject non-actionable statuses. Completed / cancelled events cannot
  // accept new check-outs; bounce the user back to the event detail page
  // so they see the closed-state messaging.
  if (event.status !== "planned" && event.status !== "active") {
    redirect(`/events/${eventId}`);
  }

  return <CheckoutClient event={event} />;
}
