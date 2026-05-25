// Phase 2 — CancelEventDialog (EVT-06 reconciliation, plan 02-07).
//
// REQUIREMENTS:
//   - EVT-06 — cancelling an event requires reconciling open check-outs:
//     each open transaction gets a `returned | lost | still_with_owner`
//     resolution that the cancelEvent Server Action uses to adjust
//     availableQty + outQty + audit-row writes inside a single
//     runTransaction.
//
// UI-SPEC Q9 destructive copy (locked, exact match):
//   title:   "Cancel this event?"
//   body:    "Items still checked out must be returned manually. The event
//             won't appear in future schedules."
//   confirm: "Cancel event"   ← Confirm button label, NEVER "OK" or "Yes".
//
// Phase 2 swap:
//   - mock-store cancelEvent → @/app/(app)/events/actions cancelEvent
//   - selectOpenCheckoutsForEvent → useTransactionsLive + client-side
//     "no parentTxId-pointing-checkin" filter.
//   - reconciliation map is keyed by TRANSACTION ID (not itemId) so the
//     Server Action can read the canonical open-checkout document by id
//     and reconcile exact qty per line. This is a contract change vs.
//     Phase 1 (which keyed by itemId + qty), aligned to the Server Action
//     signature in CancelEventReconciliationSchema.
//
// Gating: only admin sees this button (defense in depth — the cancelEvent
// Server Action also requires requireAdmin server-side).

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";
import { cancelEvent } from "@/app/(app)/events/actions";

type Resolution = "returned" | "lost" | "still_with_owner";

export function CancelEventDialog({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Pull all transactions for this event then derive open checkouts client-
  // side (same logic as the EventAssignedItemsTab and the Server Action's
  // getOpenCheckoutsForEventServer).
  const allTxs = useTransactionsLive({ eventId, limit: 100 });
  const openTxs = useMemo(() => {
    const checkedInParents = new Set(
      allTxs
        .filter((t) => t.type === "checkin" && t.parentTxId)
        .map((t) => t.parentTxId as string),
    );
    return allTxs.filter(
      (t) => t.type === "checkout" && !checkedInParents.has(t.id),
    );
  }, [allTxs]);

  // Per-open-tx resolution map keyed by transaction id. Default to
  // "returned" (the most common path — items came back, just not yet
  // logged via checkin).
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    {},
  );

  // Effective map for submit: defaults to "returned" for any tx the user
  // didn't explicitly change.
  const effectiveResolutions = useMemo(() => {
    return openTxs.reduce<Record<string, Resolution>>((acc, t) => {
      acc[t.id] = resolutions[t.id] ?? "returned";
      return acc;
    }, {});
  }, [openTxs, resolutions]);

  async function confirm() {
    setSubmitting(true);
    try {
      const result = await cancelEvent({
        eventId,
        reconciliation: effectiveResolutions,
      });
      if (!result.ok) {
        toast.error(result.error || "Couldn't cancel event");
        return;
      }
      toast(`${eventName} cancelled`);
      router.push("/events");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Ban className="mr-2 size-4" />
          Cancel event
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this event?</AlertDialogTitle>
          <AlertDialogDescription>
            Items still checked out must be returned manually. The event
            won&apos;t appear in future schedules.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {openTxs.length > 0 ? (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reconcile open check-outs ({openTxs.length})
            </p>
            {openTxs.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 border-b pb-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.itemName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.qty} out · <span className="font-mono">{t.itemSku}</span>
                  </p>
                </div>
                <Select
                  value={resolutions[t.id] ?? "returned"}
                  onValueChange={(v) =>
                    setResolutions((r) => ({ ...r, [t.id]: v as Resolution }))
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="still_with_owner">
                      Still with owner
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Keep event</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            variant="destructive"
            disabled={submitting}
          >
            Cancel event
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
