// Phase 2 — /events/[eventId]/checkin Client form.
//
// REQUIREMENTS:
//   - CI-01 — pre-populated with every open check-out line for the event.
//   - CI-03 — returnedQty defaults to the remaining qty (parentQty minus
//     any prior returned + damaged + missing). For a fresh check-out
//     this equals the original checked-out qty.
//   - CI-04 — submit-time validation: every line must satisfy
//     (returnedQty + damagedQty <= remaining) AND (missingDelta == 0 OR
//     missingReason set). Final gate lives in commitCheckinCartAction.
//   - CI-06 — damaged routes to item.damagedQty via the Server Action
//     (Plan 02-09 commitCheckinCartAction).
//   - CI-07 — Partial check-ins: after each submit, useTransactionsLive
//     pushes the new checkin + missing rows into our `liveChildren`
//     state; the openLines recompute drops any parent whose children
//     now sum to its qty, and shows the new remaining for any parent
//     that's still partly open.
//   - CI-08 — each payload line carries parentTxId; the Server Action
//     writes the new transaction with parentTxId set.
//   - MIS-01 — when missingDelta > 0 AND missingReason set, the Server
//     Action creates a MissingItemDoc with parentCheckinTxId linking
//     the missing record to the new check-in transaction.
//
// Phase 2 changes vs Phase 1:
//   - Removed mock-store hook + Phase 1 open-checkout selector + mock
//     checkin mutator.
//   - Added useTransactionsLive for live updates across both `checkout`
//     and `checkin` + `missing` rows. Open-line computation is now
//     a useMemo over these three live arrays.
//   - Submit calls commitCheckinCartAction (Server Action) and surfaces
//     failedLines (per-parent rejection reasons) via toast.
//   - router.refresh() after success bridges any race between the
//     Server Action's revalidatePath and the live listener catching up.
//
// Design notes preserved from Phase 1:
//   - No react-hook-form — line shape is driven by the dynamic live
//     state, not a static schema. useFieldArray would require manual
//     remove() calls synced to the live arrays or a full reset() on
//     every snapshot diff — both more fragile than direct React state.
//   - The two-track sync: `lines` is the user-edited state keyed by
//     parentTxId; `openLines` is the live-computed list of currently
//     open parents. On every render we render the intersection.

"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";
import { commitCheckinCartAction } from "@/app/(app)/events/[eventId]/checkin/actions";
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
  // Remaining qty available to reconcile (parentQty - prior movement).
  remainingQty: number;
  returnedQty: number;
  damagedQty: number;
  missingReason: MissingReason | "";
};

function buildLine(t: TransactionDoc, remainingQty: number): LineState {
  return {
    parentTxId: t.id,
    itemId: t.itemId,
    itemSku: t.itemSku,
    itemName: t.itemName,
    remainingQty,
    // CI-03 — default returned = remaining. User decrements if anything
    // didn't come back.
    returnedQty: remainingQty,
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
  const [pending, startTransition] = useTransition();

  // Live arrays for all three relevant transaction types in this event:
  //   - checkouts:  parent transactions (initial set + any new checkouts)
  //   - checkins:   prior children (count toward "movement" reducing remaining)
  //   - missings:   prior missing-tx children (count toward "movement")
  //
  // Each subscription has its own composite index from plan 02-02
  // (transactions(eventId, type, ...)).
  const checkoutTxs = useTransactionsLive({
    eventId,
    type: "checkout",
    initial: initialOpenTxs,
    limit: 500,
  });
  const checkinTxs = useTransactionsLive({
    eventId,
    type: "checkin",
    limit: 500,
  });
  const missingTxs = useTransactionsLive({
    eventId,
    type: "missing",
    limit: 500,
  });

  // Compute open lines: for each checkout, sum child qty (checkins +
  // missings with this parentTxId) → remaining = parentQty - sum.
  // Lines with remaining > 0 are still open.
  const openLines = useMemo(() => {
    const movementByParent = new Map<string, number>();
    for (const ci of checkinTxs) {
      if (!ci.parentTxId) continue;
      movementByParent.set(
        ci.parentTxId,
        (movementByParent.get(ci.parentTxId) ?? 0) + ci.qty,
      );
    }
    for (const m of missingTxs) {
      if (!m.parentTxId) continue;
      movementByParent.set(
        m.parentTxId,
        (movementByParent.get(m.parentTxId) ?? 0) + m.qty,
      );
    }
    return checkoutTxs
      .map((co) => {
        const remaining = co.qty - (movementByParent.get(co.id) ?? 0);
        return { tx: co, remaining };
      })
      .filter((l) => l.remaining > 0);
  }, [checkoutTxs, checkinTxs, missingTxs]);

  // User-controlled per-line state keyed by parentTxId. Initialized
  // lazily from openLines on first render; reconciled at render time
  // for any new open lines that appear.
  const [lines, setLines] = useState<LineState[]>(() =>
    openLines.map((l) => buildLine(l.tx, l.remaining)),
  );

  // Render-time merge: keep `lines` aligned with `openLines`. Drops
  // committed parents and adds new ones with default state. We do the
  // merge per render (not via useEffect) to avoid the React 19
  // set-state-in-effect rule.
  const openIds = new Set(openLines.map((l) => l.tx.id));
  const currentLines = lines
    .filter((l) => openIds.has(l.parentTxId))
    // Refresh remainingQty in case partial check-ins happened since
    // last edit (defensive — the user's edits in `lines` win for the
    // current input values).
    .map((l) => {
      const live = openLines.find((o) => o.tx.id === l.parentTxId);
      if (!live || live.remaining === l.remainingQty) return l;
      // If the remaining shrank (e.g., concurrent partial check-in)
      // clamp the user's inputs to the new remaining.
      const remaining = live.remaining;
      const returnedQty = Math.min(l.returnedQty, remaining);
      const damagedQty = Math.min(l.damagedQty, Math.max(0, remaining - returnedQty));
      return { ...l, remainingQty: remaining, returnedQty, damagedQty };
    });
  const missingFromState = openLines.filter(
    (l) => !lines.some((s) => s.parentTxId === l.tx.id),
  );
  const allLines: LineState[] = [
    ...currentLines,
    ...missingFromState.map((l) => buildLine(l.tx, l.remaining)),
  ];

  function update(parentTxId: string, patch: Partial<LineState>): void {
    setLines((prev) => {
      const exists = prev.find((l) => l.parentTxId === parentTxId);
      if (!exists) {
        // The line came in via openLines but the user is editing it
        // before the next render pulls it into `lines`. Hydrate from
        // openLines on the fly so the edit isn't lost.
        const fromOpen = openLines.find((o) => o.tx.id === parentTxId);
        if (!fromOpen) return prev;
        return [...prev, { ...buildLine(fromOpen.tx, fromOpen.remaining), ...patch }];
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
    if (line.returnedQty + line.damagedQty > line.remainingQty) {
      return "Returned + damaged cannot exceed remaining.";
    }
    const missingDelta =
      line.remainingQty - line.returnedQty - line.damagedQty;
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

    // Only commit lines where SOMETHING happens. A degenerate line where
    // returned=0, damaged=0, and missing=0 is impossible against an
    // open parent but defensive filter.
    const payload = allLines
      .filter(
        (l) =>
          l.returnedQty > 0 ||
          l.damagedQty > 0 ||
          l.remainingQty - l.returnedQty - l.damagedQty > 0,
      )
      .map((l) => ({
        parentTxId: l.parentTxId,
        itemId: l.itemId,
        returnedQty: l.returnedQty,
        damagedQty: l.damagedQty,
        // Cast empty string to undefined for the Server Action's
        // optional missingReason field.
        missingReason: l.missingReason || undefined,
      }));

    if (payload.length === 0) {
      toast.error("Nothing to check in");
      return;
    }

    startTransition(async () => {
      const result = await commitCheckinCartAction({ eventId, lines: payload });
      if (!result.ok) {
        const detail = result.failedLines?.length
          ? ` (${result.failedLines.length} line${result.failedLines.length === 1 ? "" : "s"} rejected)`
          : "";
        toast.error(`${result.error}${detail}`);
        return;
      }
      toast.success(
        `${result.txIds.length} ${result.txIds.length === 1 ? "line" : "lines"} checked in${
          result.missingIds.length > 0
            ? ` · ${result.missingIds.length} flagged missing`
            : ""
        }`,
      );
      // Defense-in-depth: revalidatePath in the Server Action handles
      // SSR re-fetch, but useTransactionsLive subscribes on the client.
      // router.refresh() flushes both paths. We navigate after the
      // refresh resolves so the user lands on a fresh event detail page.
      router.push(`/events/${eventId}`);
      router.refresh();
    });
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
            checkedOutQty={line.remainingQty}
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
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || allLines.length === 0}
          >
            {pending ? "Submitting…" : "Confirm return"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
