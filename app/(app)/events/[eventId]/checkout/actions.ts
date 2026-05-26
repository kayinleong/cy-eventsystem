"use server";
// app/(app)/events/[eventId]/checkout/actions.ts
// Per RESEARCH §5.1 + PATTERNS §4 excerpt B. The marquee transactional Server Action.
// CO-04 (atomic), CO-05 (invariant cart-wide), CO-06 (revert via CheckoutResult shape).
//
// One runTransaction wraps:
//   1. Single round-trip read of every distinct itemId in the cart (P8 mitigation
//      — cart with two lines for the same item is aggregated BEFORE the
//      transaction; reads must come before writes; runTransaction does not see
//      same-tx writes).
//   2. Invariant assertion `available >= requested` per item (CO-05). If ANY
//      line fails, the entire transaction aborts via thrown BizError → caller
//      returns { ok: false, failedLines } so the client's useOptimistic state
//      reverts and the cart stays intact for user adjustment + retry.
//   3. Per-item updates (availableQty -=, outQty +=, lifecycleState bump,
//      isLowStock recompute per RESEARCH P11, updatedAt/updatedBy).
//   4. Per-line audit row writes (AUD-01 — actor identity denormalized at
//      write time; preserves original cart shape in history).
//
// CheckoutResult shape matches Phase 1's mock-store checkout return so the
// Phase 1 useOptimistic + revert wiring in scan-session.tsx works unchanged
// (CO-06; CONTEXT.md `<specifics>` last bullet; PATTERNS §4 excerpt B).
//
// Concurrent correctness: two browsers checking out the same SKU concurrently
// — Firestore serializes the transactions and the second tx's tx.get() sees
// the first tx's committed write, so the invariant pass either accepts or
// rejects with failedLines. No path to negative availableQty (ROADMAP success
// criterion #3).
//
// EVT-08 access: admin OR uid ∈ event.allowedStaff. firestore.rules also
// enforces `isMember(resource)` on events read, but the Server Action gate
// here lets us return a structured error rather than a permission-denied
// throw on the client.
//
// SIGNATURE PARITY: matches the Phase 1 mock-store checkout API
// (lib/mock/store.ts lines 109-188 — CheckoutResult discriminated union) so
// the existing scan-session commit handler swap is a one-import + one-call
// change. CheckoutResult adds an optional `requested` field on failedLines
// for richer toast copy (Phase 1 only carried `available`).

import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { CheckoutCartSchema } from "@/lib/schemas/transaction";
import { computeIsLowStock } from "@/lib/schemas/item";
import type { ItemLifecycleState } from "@/lib/types/item";

export type CheckoutResult =
  | { ok: true; txIds: string[] }
  | {
      ok: false;
      error: string;
      failedLines?: { itemId: string; available: number; requested: number }[];
    };

class BizError extends Error {}

export async function commitCheckoutCartAction(input: {
  eventId: string;
  lines: { itemId: string; qty: number }[];
}): Promise<CheckoutResult> {
  const session = await requireSession();

  const parsed = CheckoutCartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid cart" };

  // EVT-08 access check — admin OR uid ∈ event.allowedStaff. Server-side gate
  // for clean error path; firestore.rules also enforces isMember(resource).
  const eventRef = adminDb.collection("events").doc(input.eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) return { ok: false, error: "Event not found" };
  const event = eventSnap.data()!;

  const isAdmin = session.role === "admin";
  const isMember =
    (event.allowedStaff as string[] | undefined)?.includes(session.uid) ===
    true;
  if (!isAdmin && !isMember) {
    return { ok: false, error: "Not authorized for this event" };
  }
  if (event.status === "completed" || event.status === "cancelled") {
    return { ok: false, error: `Event is ${event.status}` };
  }

  // P8 mitigation — aggregate per item BEFORE the transaction. A cart may
  // have two lines for the same itemId; runTransaction reads a single fresh
  // snapshot per ref, so we must dedupe inputs to validate against the same
  // stock. parsed.data.lines is preserved for per-line audit rows below.
  const requestedByItem = new Map<string, number>();
  for (const line of parsed.data.lines) {
    requestedByItem.set(
      line.itemId,
      (requestedByItem.get(line.itemId) ?? 0) + line.qty,
    );
  }
  const itemIds = Array.from(requestedByItem.keys());
  const itemRefs = itemIds.map((id) =>
    adminDb.collection("inventory").doc(id),
  );

  const txIds: string[] = [];

  try {
    await adminDb.runTransaction(async (tx) => {
      const itemSnaps = await Promise.all(
        itemRefs.map((ref) => tx.get(ref)),
      );

      // Invariant pass — CO-05 cart-wide. Collect EVERY failure, not just
      // the first, so the toast can surface the full breakdown for the user.
      const failed: {
        itemId: string;
        available: number;
        requested: number;
      }[] = [];
      for (let i = 0; i < itemSnaps.length; i++) {
        const snap = itemSnaps[i];
        const requested = requestedByItem.get(itemIds[i])!;
        if (!snap.exists) {
          failed.push({
            itemId: itemIds[i],
            available: 0,
            requested,
          });
          continue;
        }
        const data = snap.data()!;
        if (data.lifecycleState === "retired") {
          failed.push({
            itemId: itemIds[i],
            available: 0,
            requested,
          });
          continue;
        }
        const available = (data.availableQty as number) ?? 0;
        if (available < requested) {
          failed.push({ itemId: itemIds[i], available, requested });
        }
      }
      if (failed.length > 0) {
        // Structured throw — the catch block surfaces failedLines back to
        // the client. tx aborts atomically; no writes have happened yet.
        const err = new BizError("STOCK_INSUFFICIENT");
        (err as Error & { failed?: typeof failed }).failed = failed;
        throw err;
      }

      // Apply decrements + isLowStock denorm (P11). Per-item update — at
      // this point every line has passed the invariant pass.
      for (let i = 0; i < itemSnaps.length; i++) {
        const snap = itemSnaps[i];
        const item = snap.data()!;
        const qty = requestedByItem.get(itemIds[i])!;
        const newAvailable = (item.availableQty as number) - qty;
        const newOut = ((item.outQty as number) ?? 0) + qty;

        // Lifecycle bump: any qty out → checked_out. If new available is
        // still positive and equals totalQty, leave the existing state.
        let newLifecycle = item.lifecycleState as ItemLifecycleState;
        if (newAvailable < (item.totalQty as number)) {
          if (newLifecycle === "available") {
            newLifecycle = "checked_out";
          }
        }

        // RESEARCH P11: recompute isLowStock atomically inside the same tx.
        const isLowStock = computeIsLowStock({
          availableQty: newAvailable,
          lowStockThreshold: (item.lowStockThreshold as number) ?? 0,
        });

        tx.update(itemRefs[i], {
          availableQty: newAvailable,
          outQty: newOut,
          lifecycleState: newLifecycle,
          isLowStock,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        });
      }

      // Per-line audit row — preserve original cart shape per AUD-01.
      // Even if two cart lines share an itemId (e.g., user scanned the same
      // SKU twice), we write two audit rows so history reflects the cart.
      for (const line of parsed.data.lines) {
        const idx = itemIds.indexOf(line.itemId);
        const item = itemSnaps[idx].data()!;
        const txRef = adminDb.collection("transactions").doc();
        txIds.push(txRef.id);
        tx.set(txRef, {
          type: "checkout",
          itemId: line.itemId,
          itemSku: item.sku,
          itemName: item.name,
          eventId: input.eventId,
          eventName: event.name ?? "",
          qty: line.qty,
          actorUid: session.uid,
          actorName: session.displayName,
          actorRoleAtTimeOfAction: session.role,
          at: FieldValue.serverTimestamp(),
          notes: "",
          parentTxId: null,
          clientTxId: null,
        });
      }
    });
  } catch (err) {
    if (err instanceof BizError && err.message === "STOCK_INSUFFICIENT") {
      const failed = (
        err as BizError & {
          failed?: { itemId: string; available: number; requested: number }[];
        }
      ).failed;
      return {
        ok: false,
        error: "One or more items are out of stock.",
        failedLines: failed,
      };
    }
    throw err;
  }

  // Block H revalidate matrix per RESEARCH §8.5: the affected event page,
  // inventory list (availableQty changed), dashboard (KPI counts),
  // out-report (new open checkouts), history (new audit rows).
  revalidatePath(`/events/${input.eventId}`);
  revalidatePath("/inventory");
  revalidatePath("/");
  revalidatePath("/reports/out");
  revalidatePath("/reports/history");
  return { ok: true, txIds };
}
