"use server";
// app/(app)/events/actions.ts
// Per RESEARCH §4 + EVT-01..06 + AUD-01/AUD-03 + the D-02 re-amendment
// (Cloud Functions removed; allowedStaff sync inlined into Server Actions).
//
// Three actions:
//   - createEvent — admin OR a user who names themselves as a team lead
//     can create. Seeds initial allowedStaff = [admins ∪ teamLeads ∪
//     backupTeams]; calls recomputeAllowedStaffForEvent post-tx to
//     re-canonicalize (idempotent no-op when the seed already matches).
//   - updateEvent — admin OR an existing team lead of the event can edit.
//     Does NOT write allowedStaff in the tx itself; instead, if teamLeads
//     or backupTeams changed, calls recomputeAllowedStaffForEvent after
//     the tx commits.
//   - cancelEvent — admin only. Single runTransaction reconciles each
//     open checkout per the supplied map (returned / lost /
//     still_with_owner) + writes audit rows + flips event.status =
//     "cancelled".
//
// SIGNATURE PARITY: matches the Phase 1 mock-store mutator API
// (lib/mock/store.ts createEvent / updateEvent / cancelEvent) so UI call
// sites in Task 4 can swap imports only.

import { requireSession, requireAdmin } from "@/lib/auth/dal";
import { canEditEvent } from "@/lib/auth/roles";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import {
  CreateEventSchema,
  UpdateEventSchema,
  CancelEventReconciliationSchema,
} from "@/lib/schemas/event";
import { recomputeAllowedStaffForEvent } from "@/lib/data/allowed-staff.server";

type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; errors?: Record<string, string[]> };

/**
 * EVT-01 — create event.
 *
 * Auth: any signed-in user, but they must either be admin OR include
 * themselves in `teamLeads`. The Server Action enforces this server-side;
 * firestore.rules also allows `create: if isSignedIn()`.
 *
 * Allowed-staff handling:
 *   1. Compute initial union = admins ∪ teamLeads ∪ backupTeams. This
 *      seed avoids the empty-allowedStaff window where rule lookups would
 *      fail for the just-named team leads.
 *   2. Write the event with the seed value.
 *   3. Call recomputeAllowedStaffForEvent for re-canonicalization (idempotent
 *      no-op when the seed already matches the canonical union).
 */
export async function createEvent(
  input: unknown,
): Promise<ActionResult<{ eventId: string }>> {
  const session = await requireSession();

  const parsed = CreateEventSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // EVT-01 — admin OR you must put yourself in teamLeads.
  if (session.role !== "admin" && !data.teamLeads.includes(session.uid)) {
    return {
      ok: false,
      error: "Only admins or team leads can create events.",
    };
  }

  try {
    // Compute initial allowedStaff seed before opening the doc.
    const adminsSnap = await adminDb
      .collection("users")
      .where("role", "==", "admin")
      .where("disabled", "==", false)
      .get();
    const adminUids = adminsSnap.docs.map((d) => d.id);
    const allowedStaff = Array.from(
      new Set([
        ...adminUids,
        ...data.teamLeads,
        ...(data.backupTeams ?? []),
      ]),
    );

    const eventRef = adminDb.collection("events").doc();
    await eventRef.set({
      id: eventRef.id,
      name: data.name,
      startDate: Timestamp.fromDate(new Date(data.startDate)),
      endDate: Timestamp.fromDate(new Date(data.endDate)),
      location: data.location ?? "",
      description: data.description ?? "",
      teamLeads: data.teamLeads,
      backupTeams: data.backupTeams ?? [],
      allowedStaff,
      status: "planned",
      plannedItems: {},
      createdAt: FieldValue.serverTimestamp(),
      createdBy: session.uid,
      closedAt: null,
      closedBy: null,
    });

    // Re-canonicalize via the helper. Idempotent no-op when the seed already
    // matches the canonical union (the common path). Cheap insurance against
    // admin-list drift between the seed read above and this call.
    await recomputeAllowedStaffForEvent(eventRef.id);

    revalidatePath("/events");
    revalidatePath("/");
    return { ok: true, eventId: eventRef.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * EVT-05 — edit event metadata.
 *
 * Auth: admin OR the requester must already be in the event's teamLeads.
 * Note: this is the canEditEvent helper from lib/auth/roles.ts (backup-team
 * members CANNOT edit — they can only checkout/checkin per EVT-08).
 *
 * Allowed-staff handling:
 *   - The action itself does NOT touch allowedStaff in the tx update.
 *     (firestore.rules also enforces `untouched('allowedStaff')` as a
 *     defense against direct client writes.)
 *   - If teamLeads OR backupTeams changed in this update, we call
 *     recomputeAllowedStaffForEvent AFTER the tx commits so allowedStaff
 *     stays in sync without the client ever seeing a stale value.
 */
export async function updateEvent(
  eventId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = UpdateEventSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const eventRef = adminDb.collection("events").doc(eventId);
  const snap = await eventRef.get();
  if (!snap.exists) {
    return { ok: false, error: "Event not found." };
  }
  const current = snap.data() ?? {};

  // canEditEvent: admin OR uid in teamLeads.
  if (
    !canEditEvent(session, {
      teamLeads: Array.isArray(current.teamLeads)
        ? (current.teamLeads as string[])
        : [],
    })
  ) {
    return { ok: false, error: "You don't have access to this event." };
  }

  // Detect team-membership change so we can re-canonicalize allowedStaff
  // exactly once at the end. Compare sorted-stringified arrays for a stable
  // diff that ignores ordering.
  const prevTeamLeads = JSON.stringify(
    [...((current.teamLeads as string[]) ?? [])].sort(),
  );
  const prevBackupTeams = JSON.stringify(
    [...((current.backupTeams as string[]) ?? [])].sort(),
  );
  const nextTeamLeads = data.teamLeads
    ? JSON.stringify([...data.teamLeads].sort())
    : prevTeamLeads;
  const nextBackupTeams = data.backupTeams
    ? JSON.stringify([...data.backupTeams].sort())
    : prevBackupTeams;
  const teamMembershipChanged =
    prevTeamLeads !== nextTeamLeads || prevBackupTeams !== nextBackupTeams;

  try {
    // Build the update payload (only fields actually provided). Note:
    // `allowedStaff` is INTENTIONALLY OMITTED — it is regenerated below
    // via recomputeAllowedStaffForEvent when team membership changed.
    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    };
    if (data.name !== undefined) update.name = data.name;
    if (data.startDate !== undefined)
      update.startDate = Timestamp.fromDate(new Date(data.startDate));
    if (data.endDate !== undefined)
      update.endDate = Timestamp.fromDate(new Date(data.endDate));
    if (data.location !== undefined) update.location = data.location;
    if (data.description !== undefined) update.description = data.description;
    if (data.teamLeads !== undefined) update.teamLeads = data.teamLeads;
    if (data.backupTeams !== undefined) update.backupTeams = data.backupTeams;
    if (data.status !== undefined) update.status = data.status;

    await eventRef.update(update);

    // Inlined Function 2: if team membership changed, recompute the
    // canonical allowedStaff union (admins ∪ teamLeads ∪ backupTeams).
    if (teamMembershipChanged) {
      await recomputeAllowedStaffForEvent(eventId);
    }

    revalidatePath("/events");
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * EVT-06 — cancel event with reconciliation.
 *
 * Auth: admin only.
 *
 * Input: { eventId, reconciliation: Record<openCheckoutTxId, resolution> }.
 *   - "returned"        — write a check-in audit row, inventory.availableQty
 *                         += qty, outQty -= qty.
 *   - "lost"            — write a missingItems doc + a "missing" audit row,
 *                         outQty -= qty (the item is gone, not available).
 *   - "still_with_owner" — no inventory change; the item stays with the
 *                         owner. We still write an audit row to record the
 *                         decision.
 *
 * One runTransaction wraps all reconciliations + the status flip so the
 * cancellation is atomic. AUD-01: each audit row carries
 * actorRoleAtTimeOfAction; AUD-03: rows tagged with eventId surface in the
 * event's history feed forever.
 */
export async function cancelEvent(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();

  const parsed = CancelEventReconciliationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const { eventId, reconciliation } = parsed.data;

  try {
    await adminDb.runTransaction(async (tx) => {
      const eventRef = adminDb.collection("events").doc(eventId);
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists) throw new Error("EVENT_NOT_FOUND");
      const event = eventSnap.data() ?? {};

      // Read every referenced open-checkout transaction up front. Firestore
      // transactions require all reads before any writes.
      const txIds = Object.keys(reconciliation);
      const openCheckoutRefs = txIds.map((id) =>
        adminDb.collection("transactions").doc(id),
      );
      const openCheckoutSnaps = await Promise.all(
        openCheckoutRefs.map((ref) => tx.get(ref)),
      );

      // Group: collect each itemId's net delta so we can read+write
      // inventory once per item rather than once per reconciled tx.
      type ItemDelta = {
        returnedQty: number; // adds back to availableQty
        outDecrement: number; // subtracts from outQty (returned + lost)
        sku: string;
        name: string;
      };
      const itemDeltas = new Map<string, ItemDelta>();
      const decisions: Array<{
        coRef: FirebaseFirestore.DocumentReference;
        coData: FirebaseFirestore.DocumentData;
        resolution: "returned" | "lost" | "still_with_owner";
      }> = [];

      for (let i = 0; i < txIds.length; i++) {
        const txId = txIds[i];
        const resolution = reconciliation[txId];
        const coSnap = openCheckoutSnaps[i];
        if (!coSnap.exists) continue; // skip stale tx ids defensively
        const coData = coSnap.data() ?? {};
        const qty = (coData.qty as number) ?? 0;
        const itemId = coData.itemId as string;
        if (!itemId) continue;

        const entry =
          itemDeltas.get(itemId) ??
          ({
            returnedQty: 0,
            outDecrement: 0,
            sku: (coData.itemSku as string) ?? itemId,
            name: (coData.itemName as string) ?? "",
          } satisfies ItemDelta);

        if (resolution === "returned") {
          entry.returnedQty += qty;
          entry.outDecrement += qty;
        } else if (resolution === "lost") {
          entry.outDecrement += qty;
        }
        // still_with_owner: no inventory change.

        itemDeltas.set(itemId, entry);
        decisions.push({ coRef: openCheckoutRefs[i], coData, resolution });
      }

      // Read each affected inventory doc once.
      const itemIds = Array.from(itemDeltas.keys());
      const itemRefs = itemIds.map((id) =>
        adminDb.collection("inventory").doc(id),
      );
      const itemSnaps = await Promise.all(itemRefs.map((ref) => tx.get(ref)));

      // ---- All reads done; safe to write now. ----

      // 1. Update each inventory doc based on accumulated delta.
      itemIds.forEach((itemId, idx) => {
        const itemSnap = itemSnaps[idx];
        if (!itemSnap.exists) return;
        const item = itemSnap.data() ?? {};
        const delta = itemDeltas.get(itemId)!;
        const newAvailable = (item.availableQty ?? 0) + delta.returnedQty;
        const newOut = Math.max(0, (item.outQty ?? 0) - delta.outDecrement);
        const update: Record<string, unknown> = {
          availableQty: newAvailable,
          outQty: newOut,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        };
        // RESEARCH P11: recompute isLowStock when availableQty changes.
        const threshold = (item.lowStockThreshold ?? 0) as number;
        update.isLowStock = newAvailable <= threshold && threshold > 0;
        tx.update(itemRefs[idx], update);
      });

      // 2. Per-checkout audit row + (for "lost") missingItems doc.
      for (const { coRef, coData, resolution } of decisions) {
        const reconcileTxRef = adminDb.collection("transactions").doc();
        const itemId = coData.itemId as string;
        const itemSku = (coData.itemSku as string) ?? itemId;
        const itemName = (coData.itemName as string) ?? "";
        const qty = (coData.qty as number) ?? 0;

        if (resolution === "returned") {
          tx.set(reconcileTxRef, {
            type: "checkin",
            itemId,
            itemSku,
            itemName,
            eventId,
            eventName: event.name ?? "",
            qty,
            actorUid: session.uid,
            actorName: session.displayName,
            actorRoleAtTimeOfAction: session.role,
            at: FieldValue.serverTimestamp(),
            notes: "Reconciled at event cancellation: returned",
            parentTxId: coRef.id,
            clientTxId: null,
          });
        } else if (resolution === "lost") {
          const missingRef = adminDb.collection("missingItems").doc();
          tx.set(missingRef, {
            id: missingRef.id,
            itemId,
            itemName,
            eventId,
            eventName: event.name ?? "",
            qty,
            reason: "Lost at cancelled event",
            reportedBy: session.uid,
            reportedAt: FieldValue.serverTimestamp(),
            status: "open",
            resolvedAt: null,
            resolvedBy: null,
            parentCheckoutTxId: coRef.id,
          });
          tx.set(reconcileTxRef, {
            type: "missing",
            itemId,
            itemSku,
            itemName,
            eventId,
            eventName: event.name ?? "",
            qty,
            actorUid: session.uid,
            actorName: session.displayName,
            actorRoleAtTimeOfAction: session.role,
            at: FieldValue.serverTimestamp(),
            notes: "Reconciled at event cancellation: lost",
            parentTxId: coRef.id,
            clientTxId: null,
          });
        } else {
          // still_with_owner — record decision, no state change
          tx.set(reconcileTxRef, {
            type: "adjustment",
            itemId,
            itemSku,
            itemName,
            eventId,
            eventName: event.name ?? "",
            qty,
            actorUid: session.uid,
            actorName: session.displayName,
            actorRoleAtTimeOfAction: session.role,
            at: FieldValue.serverTimestamp(),
            notes: "Reconciled at event cancellation: still with owner",
            parentTxId: coRef.id,
            clientTxId: null,
          });
        }
      }

      // 3. Flip the event status.
      tx.update(eventRef, {
        status: "cancelled",
        closedAt: FieldValue.serverTimestamp(),
        closedBy: session.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      });
    });

    revalidatePath("/events");
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/inventory");
    revalidatePath("/reports/missing");
    revalidatePath("/reports/out");
    revalidatePath("/reports/stock");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "EVENT_NOT_FOUND") {
      return { ok: false, error: "Event not found." };
    }
    return { ok: false, error: msg };
  }
}
