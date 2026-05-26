"use server";
// app/(app)/events/[eventId]/checkin/actions.ts — RESEARCH §6.1.
//
// Block F marquee transactional Server Action. Mirrors the structure of
// commitCheckoutCartAction (Plan 02-08) but reconciles a checked-out
// transaction instead of opening one:
//
//   1. EVT-08 access gate (admin OR uid in event.allowedStaff) before the
//      transaction opens. Status-actionable note: /checkin accepts any
//      event status (a completed/cancelled event might still have
//      stragglers to reconcile).
//   2. One runTransaction wraps:
//      a. Read each parent checkout transaction (parentTxId chain — CI-08).
//      b. Sum prior check-in qty (returned + damaged + missing-via-tx)
//         for this parentTxId so CI-07 partial check-ins across multiple
//         actions stay correct. We use the existing composite index
//         `transactions(eventId, type, parentTxId, at desc)` from plan
//         02-02 firestore.indexes.json to cover the query. Note:
//         tx.get(Query) is supported by Firestore Admin SDK and the
//         results count as transactional reads.
//      c. Read inventory item once per SKU.
//      d. Per-line validation:
//         - returnedQty + damagedQty <= remaining (parentQty - prior)
//         - If returnedQty + damagedQty < remaining → missingReason
//           required (CI-04).
//         - Cart-wide collection of failures (consistent with checkout's
//           failedLines shape) so the toast can show every problem in
//           one round trip.
//      e. Apply per-SKU inventory deltas (CI-05/06/P11):
//         - availableQty += returnedQty (non-damaged returns)
//         - damagedQty   += damagedQty (CI-06)
//         - outQty       -= movement (returnedQty + damagedQty +
//           missingDelta for THIS action — not the full parentQty;
//           partial check-ins leave the rest open)
//         - lifecycleState bump (available if any returns; damaged if
//           the residual is only damaged stock)
//         - isLowStock recomputed atomically (RESEARCH P11)
//      f. Write a `checkin` transaction row per line (CI-08 parentTxId
//         set; AUD-01 actor identity denormalized).
//      g. Write a missingItems doc + a `missing` audit transaction row
//         per line with missingDelta > 0 (MIS-01; AUD-01).
//   3. revalidatePath matrix per RESEARCH §8.5:
//      /events/[id], /events/[id]/checkin (form re-reads remaining
//      lines), /inventory (availableQty/outQty/damagedQty changed), /
//      (dashboard KPIs), /reports/missing (new docs), /reports/out
//      (close out-lines), /reports/history (new audit rows).
//
// Concurrent correctness: two staff checking in lines from the same event
// at the same time — Firestore serializes the transactions and the second
// tx's reads see the first tx's writes. Result is consistent: prior
// sum-of-check-ins always reflects the latest committed state, and the
// invariant `returnedQty + damagedQty <= remaining` either accepts or
// rejects with failedLines. No path to over-return.
//
// Architecture: cloud functions removed in commit 93bf62d — no Cloud
// Function 2 triggers on transactions. Event allowedStaff is unchanged
// by check-in, so no recompute needed.
//
// SIGNATURE PARITY: matches the Phase 1 mock-store checkin API
// (lib/mock/store.ts lines 192-329) so the existing CheckinForm + Phase 1
// MissingItem flow stays unchanged at the call-site.

import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { CheckinCartSchema } from "@/lib/schemas/transaction";
import { computeIsLowStock } from "@/lib/schemas/item";
import type { ItemLifecycleState } from "@/lib/types/item";

export type CheckinResult =
  | { ok: true; txIds: string[]; missingIds: string[] }
  | {
      ok: false;
      error: string;
      failedLines?: {
        parentTxId: string;
        reason: string;
      }[];
    };

class BizError extends Error {}

export async function commitCheckinCartAction(input: {
  eventId: string;
  lines: {
    parentTxId: string;
    itemId: string;
    returnedQty: number;
    damagedQty: number;
    missingReason?: "Lost" | "Damaged" | "Not returned" | "Unknown";
  }[];
}): Promise<CheckinResult> {
  const session = await requireSession();

  const parsed = CheckinCartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid cart" };

  // EVT-08 access check — admin OR uid in event.allowedStaff. Server-side
  // gate for clean error path; firestore.rules also enforces isMember.
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

  const txIds: string[] = [];
  const missingIds: string[] = [];

  try {
    await adminDb.runTransaction(async (tx) => {
      // PHASE 1: Reads
      //
      // For each line:
      //   - parent checkout doc (qty = parentQty)
      //   - prior check-in / missing rows for this parentTxId (CI-07)
      //   - inventory item (per SKU, once)
      //
      // NB: Firestore transactions require all reads before any writes.
      // We do them sequentially per line so the validation pass can
      // short-circuit cleanly; for the cart sizes expected in v1
      // (≤ ~20 lines) this is well within the 5-second tx budget.

      type ReadResult = {
        line: typeof parsed.data.lines[number];
        parentRef: FirebaseFirestore.DocumentReference;
        parentQty: number;
        priorMovement: number; // sum of qty across all prior children for this parentTxId
        itemRef: FirebaseFirestore.DocumentReference;
        itemSnap: FirebaseFirestore.DocumentSnapshot;
        itemSku: string;
        itemName: string;
      };
      const reads: ReadResult[] = [];
      const failedLines: { parentTxId: string; reason: string }[] = [];

      // De-dup inventory reads across lines that share an SKU (P8).
      const itemSnapBySku = new Map<
        string,
        FirebaseFirestore.DocumentSnapshot
      >();

      for (const line of parsed.data.lines) {
        const parentRef = adminDb
          .collection("transactions")
          .doc(line.parentTxId);
        const parentSnap = await tx.get(parentRef);

        if (!parentSnap.exists) {
          failedLines.push({
            parentTxId: line.parentTxId,
            reason: "Parent checkout not found",
          });
          continue;
        }
        const parent = parentSnap.data()!;
        if (parent.type !== "checkout") {
          failedLines.push({
            parentTxId: line.parentTxId,
            reason: "Parent is not a checkout",
          });
          continue;
        }
        if (parent.eventId !== input.eventId) {
          failedLines.push({
            parentTxId: line.parentTxId,
            reason: "Parent belongs to a different event",
          });
          continue;
        }
        const parentQty = parent.qty as number;

        // Sum prior children for this parent. The composite index
        // `transactions(eventId, type, parentTxId, at desc)` from plan
        // 02-02 covers this; we union over `checkin` and `missing` to
        // count returned + damaged + already-recorded-missing.
        const priorCheckinsQuery = adminDb
          .collection("transactions")
          .where("eventId", "==", input.eventId)
          .where("type", "==", "checkin")
          .where("parentTxId", "==", line.parentTxId);
        const priorMissingsQuery = adminDb
          .collection("transactions")
          .where("eventId", "==", input.eventId)
          .where("type", "==", "missing")
          .where("parentTxId", "==", line.parentTxId);
        const [priorCheckinSnap, priorMissingSnap] = await Promise.all([
          tx.get(priorCheckinsQuery),
          tx.get(priorMissingsQuery),
        ]);
        const priorMovement =
          priorCheckinSnap.docs.reduce(
            (sum, d) => sum + ((d.data().qty as number) ?? 0),
            0,
          ) +
          priorMissingSnap.docs.reduce(
            (sum, d) => sum + ((d.data().qty as number) ?? 0),
            0,
          );

        // Inventory item read (one per SKU)
        const itemRef = adminDb.collection("inventory").doc(line.itemId);
        let itemSnap = itemSnapBySku.get(line.itemId);
        if (!itemSnap) {
          itemSnap = await tx.get(itemRef);
          itemSnapBySku.set(line.itemId, itemSnap);
        }
        if (!itemSnap.exists) {
          failedLines.push({
            parentTxId: line.parentTxId,
            reason: "Inventory item missing",
          });
          continue;
        }

        reads.push({
          line,
          parentRef,
          parentQty,
          priorMovement,
          itemRef,
          itemSnap,
          itemSku: parent.itemSku as string,
          itemName: parent.itemName as string,
        });
      }

      // Validation pass — uses the read context above so all checks see
      // the same committed state.
      for (const r of reads) {
        const remaining = r.parentQty - r.priorMovement;
        const submitted = r.line.returnedQty + r.line.damagedQty;

        if (submitted > remaining) {
          failedLines.push({
            parentTxId: r.line.parentTxId,
            reason: `Cannot return ${submitted}; only ${remaining} remain (of original ${r.parentQty}).`,
          });
          continue;
        }
        // CI-04 — missing reason required for any short return
        const missingDelta = remaining - submitted;
        if (missingDelta > 0 && !r.line.missingReason) {
          failedLines.push({
            parentTxId: r.line.parentTxId,
            reason: "MISSING_REASON_REQUIRED",
          });
          continue;
        }
      }

      if (failedLines.length > 0) {
        const err = new BizError("CHECKIN_REJECTED");
        (err as Error & { failed?: typeof failedLines }).failed = failedLines;
        throw err;
      }

      // PHASE 2: Writes
      //
      // Aggregate per-SKU inventory deltas across all lines (a cart may
      // hit two parents that share an SKU). Then issue one update per
      // SKU + the per-line audit + missingItems writes.

      const itemDeltaBySku = new Map<
        string,
        {
          availableDelta: number;
          damagedDelta: number;
          outDelta: number;
          snap: FirebaseFirestore.DocumentSnapshot;
        }
      >();

      for (const r of reads) {
        const submitted = r.line.returnedQty + r.line.damagedQty;
        const remaining = r.parentQty - r.priorMovement;
        const missingDelta = remaining - submitted;

        const movement = submitted + missingDelta; // = remaining when reason given

        const cur = itemDeltaBySku.get(r.line.itemId) ?? {
          availableDelta: 0,
          damagedDelta: 0,
          outDelta: 0,
          snap: r.itemSnap,
        };
        cur.availableDelta += r.line.returnedQty;
        cur.damagedDelta += r.line.damagedQty;
        cur.outDelta += movement;
        itemDeltaBySku.set(r.line.itemId, cur);

        // CI-05/CI-08 — write checkin tx (always; even a zero-returnedQty
        // line documents the reconciliation when damagedQty>0 or
        // missingDelta>0). Skip the row only if NOTHING moved at all.
        if (submitted > 0) {
          const checkinTxRef = adminDb.collection("transactions").doc();
          txIds.push(checkinTxRef.id);
          tx.set(checkinTxRef, {
            type: "checkin",
            itemId: r.line.itemId,
            itemSku: r.itemSku,
            itemName: r.itemName,
            eventId: input.eventId,
            eventName: event.name ?? "",
            qty: submitted, // returned + damaged combined
            actorUid: session.uid,
            actorName: session.displayName,
            actorRoleAtTimeOfAction: session.role,
            at: FieldValue.serverTimestamp(),
            notes:
              r.line.damagedQty > 0
                ? `${r.line.damagedQty} damaged`
                : "",
            parentTxId: r.line.parentTxId,
            clientTxId: null,
          });
        }

        // MIS-01 — missingItems doc + missing tx if missingDelta > 0
        if (missingDelta > 0) {
          const missingRef = adminDb.collection("missingItems").doc();
          missingIds.push(missingRef.id);
          // parentCheckinTxId links the missing doc back to the new
          // check-in tx if there was one; otherwise to the parent
          // checkout. Phase 1 contract: parentCheckinTxId points at
          // a transaction id; either works.
          const parentForMissing =
            txIds[txIds.length - 1] ?? r.line.parentTxId;
          tx.set(missingRef, {
            id: missingRef.id,
            itemId: r.line.itemId,
            itemName: r.itemName,
            eventId: input.eventId,
            eventName: event.name ?? "",
            qty: missingDelta,
            reason: r.line.missingReason ?? "Unknown",
            reportedBy: session.uid,
            reportedByName: session.displayName,
            reportedAt: FieldValue.serverTimestamp(),
            status: "open",
            resolvedAt: null,
            resolvedBy: null,
            parentCheckinTxId: parentForMissing,
          });

          // Audit row (AUD-01) — a 'missing' typed transaction so the
          // history feed shows it as a movement (not just a missingItems
          // entry).
          const missTxRef = adminDb.collection("transactions").doc();
          tx.set(missTxRef, {
            type: "missing",
            itemId: r.line.itemId,
            itemSku: r.itemSku,
            itemName: r.itemName,
            eventId: input.eventId,
            eventName: event.name ?? "",
            qty: missingDelta,
            actorUid: session.uid,
            actorName: session.displayName,
            actorRoleAtTimeOfAction: session.role,
            at: FieldValue.serverTimestamp(),
            notes: r.line.missingReason ?? "Unknown",
            parentTxId: r.line.parentTxId,
            clientTxId: null,
          });
        }
      }

      // Apply per-SKU inventory updates (CI-05 + CI-06 + RESEARCH P11)
      for (const [itemId, delta] of itemDeltaBySku) {
        const item = delta.snap.data()!;
        const newAvailable =
          (item.availableQty as number) + delta.availableDelta;
        const newDamaged =
          ((item.damagedQty as number) ?? 0) + delta.damagedDelta;
        const newOut = Math.max(
          0,
          ((item.outQty as number) ?? 0) - delta.outDelta,
        );

        // Lifecycle bump: if there's available stock again, mark
        // "available"; otherwise if nothing is out and only damaged
        // remains, mark "damaged"; otherwise leave as-is.
        let newLifecycle = item.lifecycleState as ItemLifecycleState;
        if (newAvailable > 0) {
          newLifecycle = "available";
        } else if (newOut === 0 && newDamaged > 0) {
          newLifecycle = "damaged";
        }

        const isLowStock = computeIsLowStock({
          availableQty: newAvailable,
          lowStockThreshold: (item.lowStockThreshold as number) ?? 0,
        });

        tx.update(adminDb.collection("inventory").doc(itemId), {
          availableQty: newAvailable,
          damagedQty: newDamaged,
          outQty: newOut,
          lifecycleState: newLifecycle,
          isLowStock,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        });
      }
    });
  } catch (err) {
    if (err instanceof BizError && err.message === "CHECKIN_REJECTED") {
      const failed = (
        err as BizError & {
          failed?: { parentTxId: string; reason: string }[];
        }
      ).failed;
      // CI-04 surfaces a friendly message; other reasons pass through.
      const hasMissingReason = failed?.some(
        (f) => f.reason === "MISSING_REASON_REQUIRED",
      );
      return {
        ok: false,
        error: hasMissingReason
          ? "Missing reason required for any short return."
          : "Some lines were rejected.",
        failedLines: failed,
      };
    }
    throw err;
  }

  // RESEARCH §8.5 revalidate matrix
  revalidatePath(`/events/${input.eventId}`);
  revalidatePath(`/events/${input.eventId}/checkin`);
  revalidatePath("/inventory");
  revalidatePath("/");
  revalidatePath("/reports/out");
  revalidatePath("/reports/missing");
  revalidatePath("/reports/history");
  return { ok: true, txIds, missingIds };
}
