"use server";
// app/(app)/delivery-orders/actions.ts
// quick-kayinleong-001 — admin uploads a vendor Delivery Order document
// against one or more inventory items.
// quick-kayinleong-010 — createCheckoutDeliveryOrderAction: auto-creates a
// DO when checkout succeeds. Staff-gated (requireSession); no file required.
//
// Auth: requireAdmin() for manual upload (Storage rule only gates
// signed-in + size + content-type; the admin check lives here for
// defense-in-depth, mirroring the photo upload pattern documented in
// storage.rules:22-28).
// requireSession() for checkout-sourced DOs (staff can trigger checkout).
//
// Transactional shape (manual upload):
//   - Read all referenced inventory docs first (Firestore tx rule: reads
//     before writes). Missing items are skipped-and-warned rather than
//     aborting the entire upload, since the items picker may be slightly
//     stale relative to a concurrent retire.
//   - Write deliveryOrders/{doId} once.
//   - Append the new doId to each existing item's deliveryOrderIds via
//     arrayUnion (idempotent on retry).

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";

import { requireAdmin, requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { CreateDeliveryOrderSchema } from "@/lib/schemas/delivery-order";

type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; errors?: Record<string, string[]> };

export async function createDeliveryOrder(
  input: unknown,
): Promise<ActionResult<{ doId: string; skippedItemIds: string[] }>> {
  const session = await requireAdmin();
  const parsed = CreateDeliveryOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const doRef = adminDb.collection("deliveryOrders").doc(data.doId);

  // De-duplicate item ids defensively — the form should already, but
  // arrayUnion is idempotent and so is the picker's toggle.
  const uniqueItemIds = Array.from(new Set(data.itemIds));

  try {
    const skipped: string[] = [];
    await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(doRef);
      if (existing.exists) throw new Error("DO_ID_TAKEN");

      const itemRefs = uniqueItemIds.map((id) =>
        adminDb.collection("inventory").doc(id),
      );
      const itemSnaps = await tx.getAll(...itemRefs);
      const presentItemIds: string[] = [];
      for (const snap of itemSnaps) {
        if (snap.exists) presentItemIds.push(snap.id);
        else skipped.push(snap.id);
      }
      if (presentItemIds.length === 0) {
        throw new Error("NO_VALID_ITEMS");
      }

      tx.set(doRef, {
        id: data.doId,
        vendor: data.vendor,
        doType: data.doType,
        fileUrl: data.fileUrl,
        filePath: data.filePath,
        originalFilename: data.originalFilename,
        contentType: data.contentType,
        itemIds: presentItemIds,
        notes: data.notes ?? "",
        uploadedAt: FieldValue.serverTimestamp(),
        uploadedBy: session.uid,
      });

      for (const id of presentItemIds) {
        tx.update(adminDb.collection("inventory").doc(id), {
          deliveryOrderIds: FieldValue.arrayUnion(data.doId),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        });
      }
    });

    revalidatePath("/delivery-orders");
    revalidatePath(`/delivery-orders/${data.doId}`);
    for (const id of uniqueItemIds) {
      revalidatePath(`/inventory/${id}`);
    }
    return { ok: true, doId: data.doId, skippedItemIds: skipped };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "DO_ID_TAKEN") {
      return { ok: false, error: "A delivery order with that id already exists." };
    }
    if (msg === "NO_VALID_ITEMS") {
      return {
        ok: false,
        error: "None of the selected items exist any more — refresh and try again.",
      };
    }
    return { ok: false, error: msg };
  }
}

// ---- createCheckoutDeliveryOrderAction (quick-kayinleong-010) ----
// Auto-creates a Delivery Order when a checkout succeeds. No file upload
// required — the DO captures the event, items, and transaction IDs only.
//
// Auth: requireSession() — staff can trigger checkout and this DO is a
// downstream artifact of that checkout. Admin-only gate would block staff
// from creating the DO for events they're authorized to check out for.
//
// Batch write (not runTransaction) — we're adding the doId back-reference
// to each item. The DO doc is written first; item updates use FieldValue
// .arrayUnion which is idempotent on retry. If the batch partially fails,
// a retry from the client produces a duplicate-ID error on the DO write
// (doId is deterministic per checkout call — callers should pass a
// stable ID or accept idempotency via a pre-checked exists guard).

export async function createCheckoutDeliveryOrderAction(input: {
  eventId: string;
  eventName: string;
  itemIds: string[];
  txIds: string[];
  notes?: string;
}): Promise<{ ok: true; doId: string } | { ok: false; error: string }> {
  const session = await requireSession();

  const doRef = adminDb.collection("deliveryOrders").doc();
  const doId = doRef.id;

  const uniqueItemIds = Array.from(new Set(input.itemIds));

  try {
    const batch = adminDb.batch();

    batch.set(doRef, {
      id: doId,
      vendor: input.eventName,
      fileUrl: null,
      filePath: null,
      originalFilename: null,
      contentType: null,
      doType: "external-outbound",
      sourceType: "checkout",
      eventId: input.eventId,
      itemIds: uniqueItemIds,
      notes: input.notes ?? "",
      uploadedAt: FieldValue.serverTimestamp(),
      uploadedBy: session.uid,
    });

    for (const itemId of uniqueItemIds) {
      batch.update(adminDb.collection("inventory").doc(itemId), {
        deliveryOrderIds: FieldValue.arrayUnion(doId),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      });
    }

    await batch.commit();

    revalidatePath("/delivery-orders");
    revalidatePath(`/delivery-orders/${doId}`);
    for (const itemId of uniqueItemIds) {
      revalidatePath(`/inventory/${itemId}`);
    }

    return { ok: true, doId };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
