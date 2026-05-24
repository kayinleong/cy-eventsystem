// Phase 1 — /events/[eventId]/checkin Client form.
//
// REQUIREMENTS:
//   - CI-01 — pre-populated with every open check-out line for the event.
//   - CI-03 — returnedQty defaults to checkedOutQty (the parent transaction's
//     qty); see buildLine below.
//   - CI-04 — submit-time validation: every line must satisfy
//     (returnedQty + damagedQty <= checkedOutQty) AND (missingDelta == 0 OR
//     missingReason set). Inline per-row validation is already surfaced by
//     CheckinLineRow; the submit handler enforces the same rules before
//     calling store.checkin.
//   - CI-06 — damaged routes to item.damagedQty via store.checkin's checkin
//     mutator (Plan 02 D-02-D + the checkin algorithm in lib/mock/store.ts
//     lines 282-329).
//   - CI-07 — partial check-ins: a line where returnedQty == checkedOutQty
//     AND damagedQty == 0 AND no missing delta is omitted from the payload
//     ONLY if the user has not changed any defaults. By default every line
//     has returnedQty == checkedOutQty, which IS a full check-in for that
//     line, so the default cart sends every line as a "fully returned"
//     check-in. Users can leave the form unchanged and submit to mark
//     everything returned at once, or decrement some lines to leave them
//     open for later (those lines are filtered out of payload).
//   - CI-08 — each payload line carries parentTxId; store.checkin uses it
//     to write the new transaction with parentTxId set.
//   - MIS-01 — when missingDelta > 0 AND missingReason set, store.checkin
//     creates a MissingItemDoc with parentCheckinTxId linking the missing
//     record to the new check-in transaction.
//
// Design notes:
//   - This is purely client state (no react-hook-form) because the shape
//     of the form changes with the live store snapshot (CI-07 partial
//     check-ins drop committed lines from the list). rhf's useFieldArray
//     would either require manual remove() calls synced to the store or
//     a full reset() on every snapshot diff — both more fragile than
//     direct React state. Phase 2 will use useActionState + a Server
//     Action returning the same CheckinResult contract.
//   - The two-track sync: `lines` is the user-edited state keyed by
//     parentTxId; `liveOpen` is the reactive store snapshot. On every
//     render we compute `currentLines = lines ∩ liveOpen` (drops
//     committed entries) and `missingFromState = liveOpen - lines`
//     (catches newly-appeared transactions that the form hasn't yet
//     captured — defensive; not actually expected in Phase 1).
//   - The form scrolls inside a Card; the submit row sits at the bottom
//     of the Card content (not sticky) so the user always sees the cart
//     in full before confirming.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectOpenCheckoutsForEvent } from "@/lib/mock/selectors";
import { checkin } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckinLineRow } from "@/components/feature/checkin/CheckinLineRow";
import type { MissingReason } from "@/lib/types/missing-item";
import type { TransactionDoc } from "@/lib/types/transaction";

type LineState = {
  parentTxId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  checkedOutQty: number;
  returnedQty: number;
  damagedQty: number;
  missingReason: MissingReason | "";
};

function buildLine(t: TransactionDoc): LineState {
  return {
    parentTxId: t.id,
    itemId: t.itemId,
    itemSku: t.itemSku,
    itemName: t.itemName,
    checkedOutQty: t.qty,
    // CI-03 — default returned = checked-out. User decrements if anything
    // didn't come back.
    returnedQty: t.qty,
    damagedQty: 0,
    missingReason: "",
  };
}

export function CheckinForm({
  eventId,
  initialOpenTxs,
}: {
  eventId: string;
  initialOpenTxs: TransactionDoc[];
}) {
  const router = useRouter();
  const session = useCurrentUser();

  // Reactive subscription so newly-committed lines (after a partial check-in
  // round-trip via router.push back to this page) drop out of the displayed
  // list. Phase 2 will use a Firestore onSnapshot listener via this same
  // selector signature.
  const liveOpen = useMockStore((s) =>
    selectOpenCheckoutsForEvent(s, eventId),
  );

  // User-controlled per-line state keyed by parentTxId. Initialized from the
  // SSR'd snapshot; merged with `liveOpen` on every render to drop committed
  // lines and add any newly-appeared ones.
  const [lines, setLines] = useState<LineState[]>(() =>
    initialOpenTxs.map(buildLine),
  );
  const [submitting, setSubmitting] = useState(false);

  // Two-track sync: keep `lines` in sync with `liveOpen`.
  //   - currentLines    = lines that still appear in liveOpen
  //   - missingFromState = liveOpen entries not yet tracked in `lines`
  // The render-time merge avoids a useEffect (which would also avoid the
  // React 19 set-state-in-effect rule). State only changes when the user
  // edits a line OR submits.
  const liveIds = new Set(liveOpen.map((t) => t.id));
  const currentLines = lines.filter((l) => liveIds.has(l.parentTxId));
  const missingFromState = liveOpen.filter(
    (t) => !lines.some((l) => l.parentTxId === t.id),
  );
  const allLines: LineState[] = [
    ...currentLines,
    ...missingFromState.map(buildLine),
  ];

  function update(parentTxId: string, patch: Partial<LineState>): void {
    setLines((prev) => {
      const exists = prev.find((l) => l.parentTxId === parentTxId);
      if (!exists) {
        // The line came in via liveOpen but the user is editing it before
        // the next render pulls it into `lines`. Hydrate from liveOpen on
        // the fly so the edit isn't lost.
        const fromLive = liveOpen.find((t) => t.id === parentTxId);
        if (!fromLive) return prev;
        return [...prev, { ...buildLine(fromLive), ...patch }];
      }
      return prev.map((l) =>
        l.parentTxId === parentTxId ? { ...l, ...patch } : l,
      );
    });
  }

  // Per-line CI-04 validation. Returns null when the line is valid, or a
  // human-readable error string when invalid. CheckinLineRow renders the
  // same errors inline; this function gates the submit.
  function validate(line: LineState): string | null {
    if (line.returnedQty + line.damagedQty > line.checkedOutQty) {
      return "Returned + damaged cannot exceed checked out.";
    }
    const missingDelta =
      line.checkedOutQty - line.returnedQty - line.damagedQty;
    if (missingDelta > 0 && !line.missingReason) {
      return "Pick a reason for missing items.";
    }
    return null;
  }

  function submit(): void {
    // CI-04 — block submit until every line is valid.
    const errors = allLines.map(validate).filter(Boolean);
    if (errors.length > 0) {
      toast.error("Fix the errors above before submitting.");
      return;
    }

    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't check in");
      return;
    }

    // Only commit lines where SOMETHING happens. A line where the user
    // hasn't touched the defaults still counts: returnedQty == checkedOutQty
    // means "everything came back" — full return, do commit it. The filter
    // below drops only the degenerate case where returned=0, damaged=0, and
    // missing=0 (impossible by the per-line zod refine but defensive).
    const payload = allLines
      .filter(
        (l) =>
          l.returnedQty > 0 ||
          l.damagedQty > 0 ||
          l.checkedOutQty - l.returnedQty - l.damagedQty > 0,
      )
      .map((l) => ({
        parentTxId: l.parentTxId,
        itemId: l.itemId,
        returnedQty: l.returnedQty,
        damagedQty: l.damagedQty,
        // Cast empty string to undefined for the store mutator (its arg
        // type is MissingReason | undefined, not "").
        missingReason: l.missingReason || undefined,
      }));

    if (payload.length === 0) {
      toast.error("Nothing to check in");
      return;
    }

    setSubmitting(true);
    const result = checkin({ eventId, lines: payload, actor });
    if (result.ok) {
      // CI-07 — partial check-ins: ANY line where returnedQty + damagedQty <
      // checkedOutQty AND missingReason set will commit a check-in tx with
      // that delta only; the parent checkout becomes "fully reconciled" at
      // that point (the missing portion is recorded via MissingItem +
      // missing-typed tx, completing the chain). The event detail page
      // re-reads the snapshot on next visit; if any check-outs are still
      // open they'll appear here.
      toast.success(
        `${payload.length} ${payload.length === 1 ? "line" : "lines"} checked in`,
      );
      router.push(`/events/${eventId}`);
    } else {
      // The current store.checkin always returns ok:true (it's defensive
      // about missing events / items), so this branch is unreachable in
      // Phase 1. Kept for symmetry with the checkout flow so Phase 2's
      // Server Action return shape can drop straight in.
      toast.error("Couldn't check in");
    }
    setSubmitting(false);
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        {/* Column headers — hidden on mobile (the row labels handle that) */}
        <div className="hidden md:grid grid-cols-12 gap-3 pb-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <div className="col-span-4">Item</div>
          <div className="col-span-2">Returned</div>
          <div className="col-span-2">Damaged</div>
          <div className="col-span-1 text-center">Missing</div>
          <div className="col-span-3">Reason</div>
        </div>
        {allLines.map((line) => (
          <CheckinLineRow
            key={line.parentTxId}
            parentTxId={line.parentTxId}
            itemId={line.itemId}
            itemSku={line.itemSku}
            itemName={line.itemName}
            checkedOutQty={line.checkedOutQty}
            returnedQty={line.returnedQty}
            damagedQty={line.damagedQty}
            missingReason={line.missingReason}
            onReturned={(v) => update(line.parentTxId, { returnedQty: v })}
            onDamaged={(v) => update(line.parentTxId, { damagedQty: v })}
            onMissingReason={(v) =>
              update(line.parentTxId, { missingReason: v })
            }
          />
        ))}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting || allLines.length === 0}
          >
            Confirm return
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
