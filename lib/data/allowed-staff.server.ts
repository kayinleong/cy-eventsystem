// lib/data/allowed-staff.server.ts
//
// Shared helper that owns the event.allowedStaff invariant:
//   allowedStaff = union(active admins, event.teamLeads, event.backupTeams)
//
// History: in plan 02-04 this logic lived in two Cloud Function triggers
// (onUserRoleChange on users/{uid}, onEventTeamChange on events/{id}).
// Those functions were removed in favor of inline Server Action calls
// because:
//   - Server Actions run synchronously — user sees the recomputed state
//     immediately, no ~1s propagation lag.
//   - One deploy surface (Next.js) instead of two (Next.js + functions/).
//   - The self-write loop guard the functions needed (RESEARCH P5/A6) is
//     not required when the writer is the action itself.
//
// CONTEXT.md D-02 amended accordingly. Both logical functions still
// exist — they're just inlined into the Server Actions that produce the
// state change, not as Firestore triggers.
//
// Callers:
//   - app/(app)/users/actions.ts setUserRole, disableUser  → admin status
//     flip triggers recomputeAllowedStaffForAllEvents()
//   - app/(app)/events/actions.ts createEvent, updateEvent (plan 02-07,
//     not yet implemented) → team membership change triggers
//     computeAllowedStaff(eventId) on that one event
//   - scripts/seed-first-admin.ts                          → no recompute
//     needed; the seed runs before any events exist.

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Computes the canonical allowedStaff array for an event.
 *
 * Reads:
 *   - events/{eventId}  (for teamLeads + backupTeams)
 *   - users  WHERE role == "admin" AND disabled == false
 *
 * Returns the deduped union of admin uids + teamLead uids + backupTeam uids.
 * Returns [] if the event doesn't exist.
 */
export async function computeAllowedStaff(eventId: string): Promise<string[]> {
  const eventSnap = await adminDb.collection("events").doc(eventId).get();
  if (!eventSnap.exists) return [];
  const eventData = eventSnap.data() ?? {};
  const teamLeads = Array.isArray(eventData.teamLeads)
    ? (eventData.teamLeads as string[])
    : [];
  const backupTeams = Array.isArray(eventData.backupTeams)
    ? (eventData.backupTeams as string[])
    : [];

  const adminsSnap = await adminDb
    .collection("users")
    .where("role", "==", "admin")
    .where("disabled", "==", false)
    .get();
  const adminUids = adminsSnap.docs.map((d) => d.id);

  return Array.from(new Set([...adminUids, ...teamLeads, ...backupTeams]));
}

/**
 * Recomputes allowedStaff on a SINGLE event. Use when only that event
 * changed (team membership update) — much cheaper than the all-events
 * sweep below.
 *
 * No-op when the computed union already matches the stored value.
 */
export async function recomputeAllowedStaffForEvent(
  eventId: string,
): Promise<void> {
  const newAllowedStaff = await computeAllowedStaff(eventId);
  const eventRef = adminDb.collection("events").doc(eventId);
  const current = await eventRef.get();
  if (!current.exists) return;
  const currentAllowedStaff = (current.data()?.allowedStaff ?? []) as string[];
  if (
    JSON.stringify([...currentAllowedStaff].sort()) ===
    JSON.stringify([...newAllowedStaff].sort())
  ) {
    return;
  }
  await eventRef.update({
    allowedStaff: newAllowedStaff,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Recomputes allowedStaff for ALL events. Use when admin status flips for
 * any user (setUserRole role change OR disableUser disable/enable on an
 * admin). Iterates events sequentially; at v1 scale (<100 events) the
 * round-trip cost is acceptable for what is a low-frequency action.
 *
 * Per-event no-op when the union already matches.
 */
export async function recomputeAllowedStaffForAllEvents(): Promise<void> {
  const eventsSnap = await adminDb.collection("events").get();
  for (const eventDoc of eventsSnap.docs) {
    const newAllowedStaff = await computeAllowedStaff(eventDoc.id);
    const currentAllowedStaff = (eventDoc.data()?.allowedStaff ??
      []) as string[];
    if (
      JSON.stringify([...currentAllowedStaff].sort()) ===
      JSON.stringify([...newAllowedStaff].sort())
    ) {
      continue;
    }
    await eventDoc.ref.update({
      allowedStaff: newAllowedStaff,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
