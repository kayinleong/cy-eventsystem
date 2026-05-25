import { z } from "zod";

// Zod 4 enums — runtime values exported for select dropdowns + lookup tables.
export const ItemLifecycleStateEnum = z.enum([
  "available",
  "checked_out",
  "damaged",
  "retired",
]);

// CONTEXT.md D-03 — fixed category set for Phase 1 seed.
export const ItemCategoryEnum = z.enum([
  "Audio",
  "Lighting",
  "Display",
  "Marketing",
]);

// Full inventory doc schema — mirrors lib/types/item.ts.
// Used by the mock store mutators for shape-checking and by future Phase 2
// Server Actions to validate Firestore reads at the boundary.
export const ItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1, "Name is required."),
    sku: z
      .string()
      .min(1, "SKU is required.")
      .regex(/^[A-Z0-9-]+$/i, "Letters, digits, hyphens only."),
    category: ItemCategoryEnum,
    totalQty: z.number().int().nonnegative(),
    availableQty: z.number().int().nonnegative(),
    outQty: z.number().int().nonnegative(),
    damagedQty: z.number().int().nonnegative(),
    unit: z.string().min(1).default("pcs"),
    photoUrl: z.url().nullable(),
    notes: z.string().max(2000).default(""),
    lifecycleState: ItemLifecycleStateEnum,
    lowStockThreshold: z.number().int().nonnegative().default(0),
    lowStockOrderedAt: z.string().nullable(),
    // RESEARCH P11 denormalized boolean; computed by computeIsLowStock below.
    isLowStock: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    createdBy: z.string(),
    updatedBy: z.string(),
  })
  .refine(
    // ARCHITECTURE.md: availableQty is a projection; outQty + damagedQty are
    // implied by transactions. The invariant: available + out + damaged
    // cannot exceed total (retired stock is removed from totalQty).
    (v) => v.availableQty + v.outQty + v.damagedQty <= v.totalQty,
    {
      message: "available + out + damaged cannot exceed total.",
      path: ["availableQty"],
    },
  );

// Form-input variant for /inventory/new and /inventory/[id]/edit.
// Audit fields, projected quantities, and lifecycle state are derived
// server-side in Phase 2; the form only carries user-editable inputs.
export const ItemFormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  sku: z
    .string()
    .min(1, "SKU is required.")
    .regex(/^[A-Z0-9-]+$/i, "Letters, digits, hyphens only."),
  category: ItemCategoryEnum,
  totalQty: z.number().int().nonnegative(),
  unit: z.string().min(1).default("pcs"),
  // Allow empty string for "no photo" — Zod 4 union of url-or-empty.
  photoUrl: z.url().nullable().or(z.literal("")),
  notes: z.string().max(2000).default(""),
  lowStockThreshold: z.number().int().nonnegative().default(0),
});

export type ItemInput = z.input<typeof ItemSchema>;
export type ItemFormInput = z.input<typeof ItemFormSchema>;

/**
 * SINGLE source of truth for the RESEARCH P11 denormalization rule.
 * Every Server Action that touches availableQty or lowStockThreshold MUST
 * import + call this helper inside its runTransaction and write the result
 * to the inventory doc atomically. Firestore cannot compare two fields in
 * where() — see RESEARCH §7.2 / P11.
 *
 * Convention: threshold of 0 means "no alert" (matches Phase 1 default).
 */
export function computeIsLowStock(args: {
  availableQty: number;
  lowStockThreshold: number;
}): boolean {
  return args.lowStockThreshold > 0 && args.availableQty <= args.lowStockThreshold;
}

// ---------- Server Action input schemas (Phase 2) ----------
//
// CreateItemSchema mirrors the mock store's createItem(...) signature
// (lib/mock/store.ts lines 333-345). The 6 user-editable fields plus an
// optional photoUrl. Audit fields, projected qtys, lifecycleState, and
// isLowStock are derived server-side.

export const CreateItemSchema = z.object({
  name: z.string().min(1, "Name is required."),
  sku: z
    .string()
    .min(1, "SKU is required.")
    .regex(/^[A-Z0-9-]+$/i, "Letters, digits, hyphens only."),
  category: ItemCategoryEnum,
  totalQty: z.number().int().nonnegative(),
  unit: z.string().min(1).default("pcs"),
  notes: z.string().max(2000).default(""),
  lowStockThreshold: z.number().int().nonnegative().default(0),
  photoUrl: z.url().nullable().optional(),
});

// UpdateItemSchema — partial; only user-editable surfaces. totalQty is
// changed via adjustItemStock (so the audit log captures every delta).
export const UpdateItemSchema = z.object({
  name: z.string().min(1).optional(),
  category: ItemCategoryEnum.optional(),
  unit: z.string().min(1).optional(),
  notes: z.string().max(2000).optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  photoUrl: z.url().nullable().optional(),
});

// AdjustStockSchema — required reason per AUD-01 / INV-04. Delta can be
// negative (loss / write-down) but the action enforces no-negative-total
// invariant inside the transaction.
export const AdjustStockSchema = z.object({
  itemId: z.string().min(1),
  delta: z.number().int().refine((n) => n !== 0, "Delta must be non-zero."),
  reason: z.string().min(1, "Reason is required.").max(500),
});

export type CreateItemInput = z.input<typeof CreateItemSchema>;
export type UpdateItemInput = z.input<typeof UpdateItemSchema>;
export type AdjustStockInput = z.input<typeof AdjustStockSchema>;
