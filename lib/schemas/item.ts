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
