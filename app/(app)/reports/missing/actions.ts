"use server";
// app/(app)/reports/missing/actions.ts — RESEARCH §6.2.
//
// MIS-02 / MIS-03 / MIS-04: admin-only resolution of an open missingItems
// doc. Two outcomes:
//   - "found"       → qty returns to inventory.availableQty (the missing
//                     stock was recovered). totalQty unchanged.
//   - "writtenOff"  → inventory.totalQty decrements by qty (the stock is
//                     permanently lost). availableQty unchanged (we
//                     never had it back).
//
// Both outcomes:
//   - Flip missingItems/{id}.status from "open" to "found"/"writtenOff"
//     and record resolvedAt + resolvedBy (MIS-02).
//   - Write a follow-up `adjustment` transaction (MIS-04 / AUD-01) so
//     the resolution shows in the audit feed alongside the original
//     `missing` row. notes carries the resolution outcome.
//   - Recompute isLowStock atomically (P11) since availableQty (found)
//     or totalQty (writtenOff) changed and either could shift the
//     low-stock threshold relationship.
//
// firestore.rules `missingItems` denies all client writes → this Admin
// SDK Server Action is the only writer. The companion 'adjustment'
// transaction row is similarly server-only per AUD-04 (transactions are
// immutable + server-write-only).
//
// SIGNATURE PARITY: matches Phase 1 mock-store resolveMissing
// (lib/mock/store.ts lines 517-574) so ResolveMissingSheet swap is a
// one-import + one-call change. The mock returns void; Phase 2 returns
// ActionResult so the Sheet can show toast.error on failure (e.g.,
// double-resolve race).

import { requireAdmin } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { computeIsLowStock } from "@/lib/schemas/item";
import { z } from "zod";

const ResolveMissingActionSchema = z.object({
  missingId: z.string().min(1),
  resolution: z.enum(["found", "writtenOff"]),
});

export type ResolveMissingResult =
  | { ok: true }
  | { ok: false; error: string };

export async function resolveMissing(input: {
  missingId: string;
  resolution: "found" | "writtenOff";
}): Promise<ResolveMissingResult> {
  const session = await requireAdmin();

  const parsed = ResolveMissingActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { missingId, resolution } = parsed.data;

  try {
    await adminDb.runTransaction(async (tx) => {
      const missingRef = adminDb.collection("missingItems").doc(missingId);
      const missingSnap = await tx.get(missingRef);
      if (!missingSnap.exists) throw new Error("MISSING_NOT_FOUND");
      const m = missingSnap.data()!;
      if (m.status !== "open") {
        throw new Error("ALREADY_RESOLVED");
      }

      const itemRef = adminDb.collection("inventory").doc(m.itemId);
      const itemSnap = await tx.get(itemRef);
      if (!itemSnap.exists) throw new Error("ITEM_NOT_FOUND");
      const item = itemSnap.data()!;
      const qty = m.qty as number;

      let newAvailable = (item.availableQty as number) ?? 0;
      let newTotal = (item.totalQty as number) ?? 0;
      let resolutionNote = "";

      if (resolution === "found") {
        // MIS-03 — returns qty to availableQty.
        newAvailable = newAvailable + qty;
        resolutionNote = "Missing resolved: found";
      } else {
        // MIS-03 — writtenOff decrements totalQty (permanent loss).
        newTotal = Math.max(0, newTotal - qty);
        resolutionNote = "Missing resolved: writtenOff";
      }

      // RESEARCH P11 — recompute isLowStock atomically (Firestore where()
      // cannot compare two fields, so we denormalize the derived bool).
      const isLowStock = computeIsLowStock({
        availableQty: newAvailable,
        lowStockThreshold: (item.lowStockThreshold as number) ?? 0,
      });

      tx.update(itemRef, {
        availableQty: newAvailable,
        totalQty: newTotal,
        isLowStock,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      });

      tx.update(missingRef, {
        status: resolution,
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: session.uid,
      });

      // MIS-04 — follow-up audit row. We always store positive qty on
      // the transaction; the `type` ("adjustment") + notes carries the
      // semantics. For writtenOff we still record positive qty (matching
      // Phase 1 mock-store) since the audit answers "how many were
      // adjusted" not "by how much did the inventory net change".
      const followupRef = adminDb.collection("transactions").doc();
      tx.set(followupRef, {
        type: "adjustment",
        itemId: m.itemId as string,
        itemSku: (item.sku as string) ?? (m.itemId as string),
        itemName: m.itemName as string,
        eventId: m.eventId as string,
        eventName: m.eventName as string,
        qty,
        actorUid: session.uid,
        actorName: session.displayName,
        actorRoleAtTimeOfAction: session.role,
        at: FieldValue.serverTimestamp(),
        notes: resolutionNote,
        parentTxId:
          (m.parentCheckinTxId as string | undefined) ??
          (m.parentCheckoutTxId as string | undefined) ??
          null,
        clientTxId: null,
      });
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message === "MISSING_NOT_FOUND")
      return { ok: false, error: "Missing-item record not found." };
    if (message === "ALREADY_RESOLVED")
      return { ok: false, error: "Already resolved." };
    if (message === "ITEM_NOT_FOUND")
      return { ok: false, error: "Linked inventory item is missing." };
    return { ok: false, error: message };
  }

  revalidatePath("/reports/missing");
  revalidatePath("/inventory");
  revalidatePath("/reports/history");
  revalidatePath("/");
  return { ok: true };
}
