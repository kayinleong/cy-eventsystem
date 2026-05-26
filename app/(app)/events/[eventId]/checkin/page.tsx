// Phase 2 — /events/[eventId]/checkin route.
//
// REQUIREMENTS:
//   - CI-01 — From an event detail page, an authorized user can open a
//     check-in screen pre-populated with the event's open check-out lines.
//   - CI-03 — For each open line, returnedQty defaults to the originally
//     checked-out qty (or its remaining after CI-07 partial returns).
//   - CI-04 — When returnedQty + damagedQty < remaining, the user MUST
//     pick a missingReason (enforced inline in CheckinLineRow and at
//     submit time in CheckinForm; final guard in the Server Action).
//   - CI-05/CI-06/CI-08 — wired in commitCheckinCartAction (Plan 02-09).
//   - CI-07 — Partial check-ins supported: after submit, the form
//     re-reads via useTransactionsLive and shows the new "remaining"
//     for each parent checkout.
//   - MIS-01 — Missing delta with reason creates a MissingItemDoc (server
//     side, inside the same transaction).
//   - EVT-08 — Access gate: admin OR uid in event.allowedStaff. Server-side
//     gate via getEventServer + notFound() for anti-enumeration (same
//     404 path as the checkout page).
//   - NFR-05 — Page renders without console errors.
//
// Phase 2 changes vs Phase 1:
//   - requireSession comes from @/lib/auth/dal (not mock-session).
//   - Event read uses getEventServer (EVT-08 server-side projection;
//     null for non-members → notFound() for anti-enumeration).
//   - Open checkouts come from getOpenCheckoutsForEventServer (Admin
//     SDK + parentTxId-based filter from Plan 02-07).
//   - The CheckinForm consumes these as initial-seed props; live
//     updates flow via useTransactionsLive on the client.
//
// Status-actionable note: unlike /checkout (which rejects completed +
// cancelled events), /checkin accepts any event status — a completed
// event might still have stragglers; a cancelled event might have
// pending returns to reconcile (post-cancel cleanup).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, PackageOpen } from "lucide-react";

import { requireSession } from "@/lib/auth/dal";
import {
  getEventServer,
  getOpenCheckoutsForEventServer,
} from "@/lib/data/events.server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckinForm } from "./_components/checkin-form";

type RouteProps = { params: Promise<{ eventId: string }> };

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const session = await requireSession();
  const { eventId } = await params;
  const event = await getEventServer(eventId, session);
  return { title: event ? `Check in · ${event.name}` : "Check in" };
}

export default async function CheckinPage({ params }: RouteProps) {
  const session = await requireSession();
  const { eventId } = await params;

  // EVT-08 — getEventServer returns null for both missing AND
  // non-accessible events (anti-enumeration; same 404 path).
  const event = await getEventServer(eventId, session);
  if (!event) notFound();

  // SSR seed: initial open checkouts via Admin SDK. The Client form
  // re-reads via useTransactionsLive so newly-committed lines drop out
  // of the displayed list (CI-07 partial check-in story).
  const initialOpenTxs = await getOpenCheckoutsForEventServer(eventId);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/events/${eventId}`}>
          <ChevronLeft className="mr-1 size-4" /> Back to event
        </Link>
      </Button>
      <PageHeader
        title={`Check in · ${event.name}`}
        description="Mark returned, damaged, or missing for each item."
      />
      {initialOpenTxs.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          heading="Nothing to check in"
          body="All items have been returned or the event has no open check-outs."
          action={
            <Button asChild variant="outline">
              <Link href={`/events/${eventId}`}>Back to event</Link>
            </Button>
          }
        />
      ) : (
        <CheckinForm eventId={eventId} initialOpenTxs={initialOpenTxs} />
      )}
    </div>
  );
}
