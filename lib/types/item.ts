// Mirrors inventory/{itemId} in .planning/research/ARCHITECTURE.md (lines 83-102).
//
// Phase 1 keeps `id` and `sku` populated identically — per PROJECT.md key
// decision #14, Firestore will use SKU as the doc id in Phase 2, but the mock
// store benefits from both fields existing for ergonomic lookups.

export type ItemLifecycleState =
  | "available"
  | "checked_out"
  | "damaged"
  | "retired";

// CONTEXT.md D-03 — fixed category set for Phase 1 seed.
export type ItemCategory = "Audio" | "Lighting" | "Display" | "Marketing";

export type InventoryItem = {
  id: string; // doc id; equals SKU per PROJECT.md key decision #14
  name: string;
  sku: string;
  category: ItemCategory;
  totalQty: number;
  availableQty: number;
  outQty: number;
  // Tracked for the `damaged` lifecycle state per REQUIREMENTS.md INV-09.
  damagedQty: number;
  unit: string; // "pcs" | "set" | etc.
  // Free-text storage location (e.g. "Warehouse A, Shelf 3"). Empty string
  // when unset. Capped at 100 chars by ItemSchema.
  location: string;
  photoUrl: string | null;
  notes: string;
  lifecycleState: ItemLifecycleState;
  // REQUIREMENTS.md RP-01 — admin-editable; defaults to 0 = no alert.
  lowStockThreshold: number;
  // REQUIREMENTS.md RP-04 — null means "not ordered"; ISO timestamp when marked ordered.
  lowStockOrderedAt: string | null;
  /**
   * Derived field — true iff `lowStockThreshold > 0 && availableQty <= lowStockThreshold`.
   * Maintained by every Server Action that touches availableQty or lowStockThreshold
   * (createItem, updateItem, adjustItemStock, retireItem, updateLowStockThreshold,
   * checkoutItem, checkinItem). Required because Firestore where() cannot compare
   * two fields (RESEARCH §7.2 / P11). Indexed via firestore.indexes.json.
   */
  isLowStock: boolean;
  // ISO strings in Phase 1 (CONTEXT.md D-04 fixed 2026 dates).
  createdAt: string;
  updatedAt: string;
  createdBy: string; // uid
  updatedBy: string;
};
