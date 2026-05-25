// lib/auth/roles.ts
// Centralized authorization helpers. Pure functions — safe to import from
// both Server Components and Server Actions.
//
// Server-only because Session originates from server-side cookie decode.
// (Client components never construct Session — they receive UI-ready props
// from Server Components.)

import "server-only";
import type { Session } from "@/lib/types/session";

/**
 * isAdmin — true when the session belongs to a user with the admin role.
 * Accepts null for ergonomic use at the top of layouts.
 */
export function isAdmin(session: Session | null): boolean {
  return session?.role === "admin";
}

/**
 * canEditEvent — admin OR team-lead of this specific event.
 * Used by /events/[eventId]/edit and updateEvent Server Action.
 *
 * Note: backupTeams members CANNOT edit the event (only checkout/checkin
 * per EVT-08); only teamLeads + admins have write authority.
 */
export function canEditEvent(
  session: Session,
  event: { teamLeads: string[] },
): boolean {
  if (session.role === "admin") return true;
  return event.teamLeads.includes(session.uid);
}
