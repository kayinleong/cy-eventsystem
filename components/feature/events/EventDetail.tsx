// Phase 2 — Event detail surface (Block D UI swap, plan 02-07).
//
// REQUIREMENTS:
//   - EVT-02 — status transitions: planned → active → completed (or cancelled).
//     Primary CTA depends on current status:
//       - planned → "Start check-out" → /events/[id]/checkout (Plan 02-08)
//       - active  → "Check in"        → /events/[id]/checkin  (Plan 02-09)
//       - completed / cancelled → no primary CTA
//   - EVT-04 — detail surface includes Assigned items + History tabs.
//   - EVT-05 — Edit button visible to admin OR any team lead of the event.
//   - EVT-06 — Cancel event admin-only and only when status is not terminal.
//
// Phase 2 swap: removed mock-store users subscription; the parent page seeds
// users via SSR and passes them in. Tabs are unchanged at the call-site —
// they subscribe to Firestore via use-transactions-live + use-events-live
// internally.

"use client";

import Link from "next/link";
import { Edit, ScanLine, ArrowDownToLine } from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import {
  statusToTone,
  statusToLabel,
} from "@/components/feature/status/status-to-tone";
import type { EventDoc } from "@/lib/types/event";
import type { UserDoc } from "@/lib/types/user";
import { deriveEventStatus } from "@/lib/utils/event-status";
import { EventAssignedItemsTab } from "./EventAssignedItemsTab";
import { EventHistoryTab } from "./EventHistoryTab";
import { CancelEventDialog } from "./CancelEventDialog";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function EventDetail({
  event,
  users,
  isAdmin,
  canEdit,
}: {
  event: EventDoc;
  users: UserDoc[];
  isAdmin: boolean;
  canEdit: boolean;
}) {
  // Resolve uid → display name from the SSR-seeded users list. Falls back
  // to the uid when the user has been deleted (defensive).
  const resolveName = (uid: string) =>
    users.find((u) => u.uid === uid)?.displayName ?? uid;

  // Derive effective status from dates + stored cancellation, so manual
  // Firestore edits to startDate/endDate reflect immediately in the UI
  // (the stored `status` field is informational; lifecycle is date-driven).
  const effectiveStatus = deriveEventStatus(event);

  // Action visibility:
  //   - planned   → only "Start check-out" (event hasn't started yet)
  //   - active    → both "Start check-out" + "Check in"
  //   - completed → only "Check in" (event ended; reconcile any open items)
  //   - cancelled → neither (terminal)
  const showCheckout =
    effectiveStatus === "planned" || effectiveStatus === "active";
  const showCheckin =
    effectiveStatus === "active" || effectiveStatus === "completed";

  const showCancel =
    isAdmin &&
    effectiveStatus !== "cancelled" &&
    effectiveStatus !== "completed";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold">{event.name}</h1>
            <StatusBadge tone={statusToTone(effectiveStatus)}>
              {statusToLabel(effectiveStatus)}
            </StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            {fmt(event.startDate)} – {fmt(event.endDate)} ·{" "}
            {event.location || "—"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {showCheckout ? (
            <Button asChild>
              <Link href={`/events/${event.id}/checkout`}>
                <ScanLine className="mr-2 size-4" />
                Start check-out
              </Link>
            </Button>
          ) : null}
          {showCheckin ? (
            <Button asChild variant={showCheckout ? "outline" : "default"}>
              <Link href={`/events/${event.id}/checkin`}>
                <ArrowDownToLine className="mr-2 size-4" />
                Start check-in
              </Link>
            </Button>
          ) : null}
          {canEdit ? (
            <Button asChild variant="outline">
              <Link href={`/events/${event.id}/edit`}>
                <Edit className="mr-2 size-4" />
                Edit
              </Link>
            </Button>
          ) : null}
          {showCancel ? (
            <CancelEventDialog eventId={event.id} eventName={event.name} />
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Leads: </span>
            {event.teamLeads.length === 0
              ? "—"
              : event.teamLeads.map(resolveName).join(", ")}
          </div>
          <div>
            <span className="text-muted-foreground">Backup: </span>
            {event.backupTeams.length === 0
              ? "—"
              : event.backupTeams.map(resolveName).join(", ")}
          </div>
        </CardContent>
      </Card>

      {event.description ? (
        <p className="text-sm text-muted-foreground max-w-3xl whitespace-pre-wrap">
          {event.description}
        </p>
      ) : null}

      <Tabs defaultValue="assigned">
        <TabsList>
          <TabsTrigger value="assigned">Assigned items</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="assigned" className="pt-4">
          <EventAssignedItemsTab eventId={event.id} />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <EventHistoryTab eventId={event.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
