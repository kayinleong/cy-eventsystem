// Phase 1 — /events/[eventId]/checkin route.
//
// REQUIREMENTS:
//   - CI-01 — From an event detail page, an authorized user can open a
//     check-in screen pre-populated with the event's open check-out lines.
//   - CI-03 — For each open line, returnedQty defaults to the originally
//     checked-out qty (set in the Client form's buildLine helper).
//   - CI-04 — When returnedQty + damagedQty < checkedOutQty, the user MUST
//     pick a missingReason (enforced inline in CheckinLineRow and at submit
//     time in CheckinForm).
//   - CI-05 — Returned-qty flows back into availableQty atomically (inside
//     store.checkin — called from the Client form's submit).
//   - CI-06 — Damaged-qty goes into the damaged lifecycle bucket on the
//     item, not back into available (handled inside store.checkin).
//   - CI-07 — Partial check-ins supported: after submit, lines that were
//     committed drop out; remaining lines stay open across visits because
//     selectOpenCheckoutsForEvent re-reads the latest snapshot every render.
//   - CI-08 — Each new check-in transaction records parentTxId pointing at
//     its originating check-out (set inside store.checkin).
//   - MIS-01 — Missing delta > 0 with reason set → store.checkin creates a
//     MissingItemDoc record with the reason + parentCheckinTxId link.
//   - EVT-08 — Access gate: admin OR uid in event.allowedStaff (same shape
//     as /events/[eventId]/checkout per Plan 09).
//   - NFR-05 — Page renders without console errors in next dev.
//
// Architecture:
//   - Server Component shell mirrors /events/[eventId]/checkout/page.tsx
//     (the Plan 09 server-shell + client-island template) — requireSession +
//     async params + selectEventById + notFound + EVT-08 redirect.
//   - Reads open checkouts at request time; if there are none, renders an
//     EmptyState ("Nothing to check in") so the Client form never has to
//     handle the empty case. After a partial check-in, the user is redirected
//     back to the event detail page; re-navigating to /checkin will show
//     remaining open lines (or the empty state if all are now closed).
//   - The Client form is colocated at _components/checkin-form.tsx and
//     manages its own state — no rhf because the shape is driven by the
//     dynamic store snapshot, not a static schema.
//
// Status-actionable note: unlike /checkout (which rejects completed +
// cancelled events), /checkin accepts any event status. A completed event
// might still have stragglers to reconcile; a cancelled event might have
// open checkouts that need to come back. The EmptyState handles the "no
// open checkouts" case (e.g., planned events that haven't checked out yet,
// or already-fully-reconciled events).

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, PackageOpen } from "lucide-react";

import { requireSession } from "@/lib/auth/mock-session";
import { getSnapshot } from "@/lib/mock/store";
import {
  selectEventById,
  selectOpenCheckoutsForEvent,
} from "@/lib/mock/selectors";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckinForm } from "./_components/checkin-form";

type RouteProps = { params: Promise<{ eventId: string }> };

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const { eventId } = await params;
  const ev = selectEventById(getSnapshot(), eventId);
  return { title: ev ? `Check in · ${ev.name}` : "Check in" };
}

export default async function CheckinPage({ params }: RouteProps) {
  const session = await requireSession();
  const { eventId } = await params;
  const event = selectEventById(getSnapshot(), eventId);
  if (!event) notFound();

  // EVT-08 — admin sees all events; staff must be in allowedStaff
  // (= teamLeads ∪ backupTeams ∪ admins).
  if (
    session.role !== "admin" &&
    !event.allowedStaff.includes(session.uid)
  ) {
    redirect("/unauthorized");
  }

  // Read open checkouts at request time. The Client form re-reads via
  // useMockStore so newly-committed lines drop out of the displayed list
  // without a page refresh.
  const openTxs = selectOpenCheckoutsForEvent(getSnapshot(), eventId);

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
      {openTxs.length === 0 ? (
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
        <CheckinForm eventId={eventId} initialOpenTxs={openTxs} />
      )}
    </div>
  );
}
