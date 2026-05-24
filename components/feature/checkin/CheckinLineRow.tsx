// Phase 1 — CheckinLineRow.
//
// One row per open check-out transaction on /events/[eventId]/checkin.
// The row contains:
//   - Left: item name (links to /inventory/[itemId]) + sku + "Checked out: N"
//   - Three controls: Returned (QtyStepper), Damaged (QtyStepper), Missing (computed display)
//   - Right: Reason select (required when missing-delta > 0)
//   - Below: inline validation error if returned+damaged exceeds checked-out OR
//     reason is missing while missing-delta > 0
//
// REQUIREMENTS:
//   - CI-03 — Defaults arrive pre-populated by the parent form (returnedQty
//     defaults to checkedOutQty). This row is the surface where the user
//     decrements if anything didn't come back.
//   - CI-04 — The reason select is REQUIRED when missingDelta > 0
//     (returned + damaged < checkedOut). The required state is visible
//     via the destructive border on the Select trigger AND surfaced as
//     an inline error message below the row.
//   - CI-06 — Damaged qty is a separate stepper that routes to
//     item.damagedQty inside store.checkin (does NOT return to availableQty).
//   - QtyStepper's `max` is dynamic per stepper: Returned's max is
//     (checkedOut - damaged), Damaged's max is (checkedOut - returned).
//     This UI-layer guard means the user can't push returned+damaged past
//     the checked-out total via the +/- buttons. The validation below
//     covers the case where someone types a value directly into the
//     stepper's number input.

"use client";

import Link from "next/link";

import { QtyStepper } from "@/components/feature/inventory/QtyStepper";
import { MissingReasonSelect } from "./MissingReasonSelect";
import type { MissingReason } from "@/lib/types/missing-item";

export function CheckinLineRow({
  itemId,
  itemSku,
  itemName,
  checkedOutQty,
  returnedQty,
  damagedQty,
  missingReason,
  onReturned,
  onDamaged,
  onMissingReason,
}: {
  parentTxId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  checkedOutQty: number;
  returnedQty: number;
  damagedQty: number;
  missingReason: MissingReason | "";
  onReturned: (v: number) => void;
  onDamaged: (v: number) => void;
  onMissingReason: (v: MissingReason | "") => void;
}) {
  // Missing = checkedOut - returned - damaged. Clamped to >=0 so the display
  // doesn't go negative when the user accidentally pushes the steppers past
  // the cap (the validation below surfaces the actual error).
  const missingDelta = Math.max(0, checkedOutQty - returnedQty - damagedQty);
  const exceedsCheckedOut = returnedQty + damagedQty > checkedOutQty;
  const reasonRequired = missingDelta > 0;
  const showError = exceedsCheckedOut || (reasonRequired && !missingReason);

  return (
    <div className="grid grid-cols-12 gap-3 items-start py-3 border-b last:border-b-0">
      {/* Left — item name + sku + checked-out qty reference */}
      <div className="col-span-12 md:col-span-4 min-w-0">
        <Link
          href={`/inventory/${itemId}`}
          className="text-sm font-medium hover:underline truncate block"
        >
          {itemName}
        </Link>
        <p className="text-xs font-mono text-muted-foreground">{itemSku}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Checked out: {checkedOutQty}
        </p>
      </div>

      {/* Returned column */}
      <div className="col-span-6 md:col-span-2">
        <p className="text-xs text-muted-foreground mb-1">Returned</p>
        <QtyStepper
          value={returnedQty}
          onChange={onReturned}
          min={0}
          max={checkedOutQty - damagedQty}
        />
      </div>

      {/* Damaged column (CI-06) */}
      <div className="col-span-6 md:col-span-2">
        <p className="text-xs text-muted-foreground mb-1">Damaged</p>
        <QtyStepper
          value={damagedQty}
          onChange={onDamaged}
          min={0}
          max={checkedOutQty - returnedQty}
        />
      </div>

      {/* Missing (computed) — amber when > 0 to draw attention */}
      <div className="col-span-6 md:col-span-1 flex flex-col items-center pt-3">
        <p className="text-xs text-muted-foreground">Missing</p>
        <p
          className={`text-lg font-semibold ${missingDelta > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
        >
          {missingDelta}
        </p>
      </div>

      {/* Reason (required when missing > 0 per CI-04) */}
      <div className="col-span-6 md:col-span-3">
        <p className="text-xs text-muted-foreground mb-1">Reason</p>
        <MissingReasonSelect
          value={missingReason}
          onChange={onMissingReason}
          required={reasonRequired}
        />
      </div>

      {showError ? (
        <p className="col-span-12 text-xs text-destructive">
          {exceedsCheckedOut
            ? "Returned + damaged cannot exceed checked out."
            : "Select a reason for missing items."}
        </p>
      ) : null}
    </div>
  );
}
