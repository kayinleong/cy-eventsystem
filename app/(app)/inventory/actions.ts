"use server";
// app/(app)/inventory/actions.ts
// Per RESEARCH §3.2-§3.4 + RESEARCH P11 (isLowStock denorm) + AUD-01..04.
//
// Block C — Inventory CRUD. All 6 mutators wrap state-changing logic in
// adminDb.runTransaction so INT-01 (atomic stock invariant) holds. Every
// action that touches availableQty or lowStockThreshold recomputes
// isLowStock atomically inside the same transaction (RESEARCH P11 —
// Firestore where() cannot compare two fields, so we denormalize a
// derived boolean indexed via firestore.indexes.json).
//
// SIGNATURE PARITY: matches the Phase 1 mock-store mutator API
// (lib/mock/store.ts lines 333-639) so UI call sites in plan 02-06
// can swap imports only — call shapes unchanged.
//
// AUDIT TRAIL: retireItem and adjustItemStock write a transactions row
// inside the same runTransaction (AUD-01 / INT-03 — only Admin SDK writes
// to transactions, never the client). createItem / updateItem /
// updateLowStockThreshold / markLowStockOrdered do NOT write transactions
// rows in this plan — they're not stock-changing in the AUD-04 sense
// (creation/threshold/ordering are configuration, not movement). Future
// plans 02-08/02-09 follow the same audit-row pattern for checkout/checkin.

import { requireAdmin } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import {
  CreateItemSchema,
  UpdateItemSchema,
  AdjustStockSchema,
  computeIsLowStock,
} from "@/lib/schemas/item";

type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; errors?: Record<string, string[]> };

/** INV-01 + INV-02 — SKU = doc ID; uniqueness via tx.get assert. */
export async function createItem(
  input: unknown,
): Promise<ActionResult<{ itemId: string }>> {
  const session = await requireAdmin();
  const parsed = CreateItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const docRef = adminDb.collection("inventory").doc(data.sku);

  try {
    await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(docRef);
      if (existing.exists) {
        throw new Error("SKU_EXISTS");
      }
      const isLowStock = computeIsLowStock({
        availableQty: data.totalQty,
        lowStockThreshold: data.lowStockThreshold ?? 0,
      });
      tx.set(docRef, {
        id: data.sku,
        sku: data.sku,
        name: data.name,
        totalQty: data.totalQty,
        availableQty: data.totalQty,
        outQty: 0,
        damagedQty: 0,
        unit: data.unit,
        category: data.category,
        notes: data.notes ?? "",
        lifecycleState: "available",
        lowStockThreshold: data.lowStockThreshold ?? 0,
        lowStockOrderedAt: null,
        photoUrl: data.photoUrl ?? null,
        isLowStock,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: session.uid,
        updatedBy: session.uid,
      });
    });
    revalidatePath("/inventory");
    revalidatePath("/");
    revalidatePath("/reports/stock");
    return { ok: true, itemId: data.sku };
  } catch (err) {
    if ((err as Error).message === "SKU_EXISTS") {
      return {
        ok: false,
        error: "SKU already exists",
        errors: { sku: ["SKU already exists."] },
      };
    }
    return { ok: false, error: (err as Error).message };
  }
}

/** INV-03 — edit name, category, notes, unit, photoUrl, lowStockThreshold. */
export async function updateItem(
  itemId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = UpdateItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const itemRef = adminDb.collection("inventory").doc(itemId);

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(itemRef);
      if (!snap.exists) throw new Error("ITEM_NOT_FOUND");
      const current = snap.data()!;
      const nextThreshold =
        data.lowStockThreshold ?? current.lowStockThreshold ?? 0;
      // RESEARCH P11: recompute isLowStock when threshold changes.
      const isLowStock = computeIsLowStock({
        availableQty: current.availableQty,
        lowStockThreshold: nextThreshold,
      });
      tx.update(itemRef, {
        name: data.name ?? current.name,
        category: data.category ?? current.category,
        notes: data.notes ?? current.notes,
        unit: data.unit ?? current.unit,
        photoUrl: data.photoUrl ?? current.photoUrl,
        lowStockThreshold: nextThreshold,
        isLowStock,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      });
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath("/");
    revalidatePath("/reports/stock");
    revalidatePath("/reports/repurchase");
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "ITEM_NOT_FOUND") {
      return { ok: false, error: "Item not found." };
    }
    return { ok: false, error: msg };
  }
}

/** INV-05 — soft-delete via lifecycleState=retired. Refuse if items are out (PITFALLS C5). */
export async function retireItem(itemId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const itemRef = adminDb.collection("inventory").doc(itemId);
  const txRef = adminDb.collection("transactions").doc();

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(itemRef);
      if (!snap.exists) throw new Error("ITEM_NOT_FOUND");
      const item = snap.data()!;
      if ((item.outQty ?? 0) > 0) throw new Error("ITEM_OUT");

      tx.update(itemRef, {
        lifecycleState: "retired",
        // Retired items must not trigger the low-stock dashboard widget.
        isLowStock: false,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      });
      // AUD-01: audit row inside the same transaction.
      tx.set(txRef, {
        type: "adjustment",
        itemId,
        itemSku: item.sku,
        itemName: item.name,
        eventId: null,
        eventName: null,
        qty: 0,
        actorUid: session.uid,
        actorName: session.displayName,
        actorRoleAtTimeOfAction: session.role,
        at: FieldValue.serverTimestamp(),
        notes: "Item retired",
        parentTxId: null,
        clientTxId: null,
      });
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath("/");
    revalidatePath("/reports/stock");
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "ITEM_OUT") {
      return { ok: false, error: "Can't retire — items are still checked out." };
    }
    if (msg === "ITEM_NOT_FOUND") {
      return { ok: false, error: "Item not found." };
    }
    return { ok: false, error: msg };
  }
}

/** INV-04 — adjust totalQty (and matching availableQty) with required reason + audit row. */
export async function adjustItemStock(input: {
  itemId: string;
  delta: number;
  reason: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = AdjustStockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const { itemId, delta, reason } = parsed.data;

  const itemRef = adminDb.collection("inventory").doc(itemId);
  const txRef = adminDb.collection("transactions").doc();

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(itemRef);
      if (!snap.exists) throw new Error("ITEM_NOT_FOUND");
      const item = snap.data()!;
      const newTotal = item.totalQty + delta;
      const newAvailable = item.availableQty + delta;
      if (newTotal < 0 || newAvailable < 0) {
        throw new Error("WOULD_GO_NEGATIVE");
      }

      // RESEARCH P11: recompute isLowStock when availableQty changes.
      const isLowStock = computeIsLowStock({
        availableQty: newAvailable,
        lowStockThreshold: item.lowStockThreshold ?? 0,
      });

      tx.update(itemRef, {
        totalQty: newTotal,
        availableQty: newAvailable,
        isLowStock,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      });

      // AUD-01 audit row — type="adjustment" + required reason.
      tx.set(txRef, {
        type: "adjustment",
        itemId,
        itemSku: item.sku,
        itemName: item.name,
        eventId: null,
        eventName: null,
        qty: Math.abs(delta),
        actorUid: session.uid,
        actorName: session.displayName,
        actorRoleAtTimeOfAction: session.role,
        at: FieldValue.serverTimestamp(),
        notes: reason,
        parentTxId: null,
        clientTxId: null,
      });
    });
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath("/inventory");
    revalidatePath("/");
    revalidatePath("/reports/stock");
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "WOULD_GO_NEGATIVE") {
      return { ok: false, error: "Adjustment would create negative stock." };
    }
    if (msg === "ITEM_NOT_FOUND") {
      return { ok: false, error: "Item not found." };
    }
    return { ok: false, error: msg };
  }
}

/** RP-01 — update lowStockThreshold; recompute isLowStock atomically. */
export async function updateLowStockThreshold(
  itemId: string,
  threshold: number,
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (
    typeof threshold !== "number" ||
    threshold < 0 ||
    !Number.isFinite(threshold) ||
    !Number.isInteger(threshold)
  ) {
    return { ok: false, error: "Threshold must be a non-negative integer." };
  }
  const itemRef = adminDb.collection("inventory").doc(itemId);
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(itemRef);
      if (!snap.exists) throw new Error("ITEM_NOT_FOUND");
      const item = snap.data()!;
      // RESEARCH P11: recompute isLowStock when threshold changes.
      const isLowStock = computeIsLowStock({
        availableQty: item.availableQty,
        lowStockThreshold: threshold,
      });
      tx.update(itemRef, {
        lowStockThreshold: threshold,
        // RP-04: any threshold change clears the "ordered" marker so the
        // admin reassesses whether new threshold still needs a reorder.
        lowStockOrderedAt: null,
        isLowStock,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      });
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath("/reports/repurchase");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "ITEM_NOT_FOUND") {
      return { ok: false, error: "Item not found." };
    }
    return { ok: false, error: msg };
  }
}

/** RP-04 — mark low-stock as ordered (admin clicked "Mark ordered"). No qty change → no isLowStock recompute. */
export async function markLowStockOrdered(itemId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const itemRef = adminDb.collection("inventory").doc(itemId);
  try {
    await itemRef.update({
      lowStockOrderedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    });
    revalidatePath("/reports/repurchase");
    revalidatePath("/");
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${itemId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
