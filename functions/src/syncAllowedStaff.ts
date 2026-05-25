// functions/src/syncAllowedStaff.ts
// Cloud Function 2 per refined D-02 — ONE logical function (allowedStaff sync),
// TWO trigger registrations because the union depends on data from two collections:
//  - onEventTeamChange: an event's team fields changed → recompute that event
//  - onUserRoleChange:  a user's admin role flipped → recompute ALL events
// Both triggers funnel through recomputeForEvent(eventId).
// Self-write loop guard per RESEARCH P5 + A6 (skip if before/after differ ONLY in allowedStaff).

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

async function recomputeForEvent(eventId: string): Promise<void> {
  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  const event = eventSnap.data();
  if (!event) return;

  const adminsQuery = await db.collection("users").where("role", "==", "admin").get();
  const adminUids = adminsQuery.docs.map((d) => d.id);

  const allowed = new Set<string>([
    ...adminUids,
    ...((event.teamLeads as string[] | undefined) ?? []),
    ...((event.backupTeams as string[] | undefined) ?? []),
  ]);

  await eventRef.update({ allowedStaff: Array.from(allowed) });
}

/**
 * Trigger when an event's team fields change (or when a new event needs initial fill).
 * Self-write guard: if the ONLY difference between before and after is allowedStaff,
 * we wrote that ourselves — skip to prevent infinite recursion.
 */
export const onEventTeamChange = onDocumentWritten(
  { document: "events/{eventId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return; // event deleted

    const teamLeadsChanged =
      JSON.stringify(before?.teamLeads) !== JSON.stringify(after.teamLeads);
    const backupChanged =
      JSON.stringify(before?.backupTeams) !== JSON.stringify(after.backupTeams);
    const allowedMissing = !(after.allowedStaff as unknown[] | undefined)?.length;

    if (!teamLeadsChanged && !backupChanged && !allowedMissing) return;

    // RESEARCH P5 + A6: self-write loop guard. If before and after differ
    // ONLY in allowedStaff, this is our own write firing the trigger again.
    const beforeWithoutAllowed = { ...before, allowedStaff: null };
    const afterWithoutAllowed = { ...after, allowedStaff: null };
    const onlyAllowedStaffChanged =
      JSON.stringify(beforeWithoutAllowed) === JSON.stringify(afterWithoutAllowed);
    if (onlyAllowedStaffChanged) return;

    await recomputeForEvent(event.params.eventId);
  },
);

/**
 * Trigger when a user's role changes. Admins are in EVERY event's allowedStaff,
 * so promoting/demoting an admin requires recomputing all events.
 */
export const onUserRoleChange = onDocumentWritten(
  { document: "users/{uid}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const oldRole = before?.role as string | undefined;
    const newRole = after?.role as string | undefined;
    if (oldRole === newRole) return;

    if (oldRole === "admin" || newRole === "admin") {
      const events = await db.collection("events").get();
      await Promise.all(events.docs.map((doc) => recomputeForEvent(doc.id)));
    }
  },
);
