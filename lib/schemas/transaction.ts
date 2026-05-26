import { z } from "zod";

// Mirrors TransactionType from lib/types/transaction.ts.
export const TransactionTypeEnum = z.enum([
  "checkout",
  "checkin",
  "adjustment",
  "missing",
]);

// One scanned-cart line during check-out. The full cart is a CheckoutCart.
export const CheckoutLineSchema = z.object({
  itemId: z.string().min(1),
  qty: z.number().int().positive(),
});

// Used by the scan-to-cart flow's "Confirm check-out" CTA (CONTEXT.md D-14).
export const CheckoutCartSchema = z.object({
  eventId: z.string().min(1),
  lines: z.array(CheckoutLineSchema).min(1, "Add at least one item."),
});

// One returning item during check-in. REQUIREMENTS.md CI-04 requires a
// missing-reason when returnedQty + damagedQty < checkedOutQty — enforced
// inside the Server Action (Plan 02-09 commitCheckinCartAction).
// damagedQty is a SEPARATE bucket from returnedQty (CI-06) — damaged stock
// flows into item.damagedQty, NOT availableQty.
export const CheckinLineSchema = z
  .object({
    parentTxId: z.string().min(1),
    itemId: z.string().min(1),
    returnedQty: z.number().int().nonnegative(),
    damagedQty: z.number().int().nonnegative().default(0),
    missingReason: z
      .enum(["Lost", "Damaged", "Not returned", "Unknown"])
      .optional(),
  })
  .refine(
    (v) =>
      v.returnedQty > 0 || v.damagedQty > 0 || v.missingReason !== undefined,
    {
      message: "Must specify returned, damaged, or missing.",
      path: ["returnedQty"],
    },
  );

// Used by /events/[eventId]/checkin commitCheckinCartAction.
// Plan 02-09 marquee transaction input.
export const CheckinCartSchema = z.object({
  eventId: z.string().min(1),
  lines: z.array(CheckinLineSchema).min(1, "Check in at least one line."),
});

export type CheckoutCartInput = z.input<typeof CheckoutCartSchema>;
export type CheckinLineInput = z.input<typeof CheckinLineSchema>;
export type CheckinCartInput = z.input<typeof CheckinCartSchema>;
