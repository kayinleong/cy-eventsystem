// lib/utils/event-status.ts
//
// Single source of truth for an event's effective status.
//
// Phase 1's mock stored `status` as a static field and relied on the
// checkout/checkin actions to bump it. That meant:
//   - manually changing dates in Firestore didn't move the status forward
//   - an event whose endDate had passed but still had open checkouts
//     stayed "active" indefinitely (or stayed "planned" if check-out
//     never bumped it)
//
// Phase 2 derives status at read-time from authoritative inputs:
//   - cancelledAt — terminal state, dominates everything
//   - startDate / endDate — drive planned ↔ active ↔ completed
//
// The stored `event.status` field on Firestore is now informational only
// (kept for index queries that pre-date this change). All UI / decision
// logic should use deriveEventStatus(event).
//
// endDate semantics: the event runs through the END of endDate's day.
// So "completed" means `now > endOfDay(endDate)`.

import type { EventStatus } from "@/lib/types/event";

type EventStatusInputs = {
  status: EventStatus;
  startDate: string;
  endDate: string;
  closedAt?: string | null;
};

/** ISO date or Date — accept either; coerce to Date. */
function toDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

/**
 * Compute the effective status of an event.
 *
 * Precedence:
 *   1. stored status === "cancelled" → "cancelled" (explicit user action;
 *      Phase 2 cancelEvent sets this + closedAt). Terminal.
 *   2. now < startOfDay(startDate) → "planned"
 *   3. now > endOfDay(endDate) → "completed"
 *   4. otherwise → "active"
 *
 * If startDate or endDate is missing/invalid, falls back to the stored
 * status field (so we never break events with malformed data).
 *
 * @param event Event doc fields needed for derivation
 * @param now Override "current time" for testing; defaults to new Date()
 */
export function deriveEventStatus(
  event: EventStatusInputs,
  now: Date = new Date(),
): EventStatus {
  // Cancellation is the only terminal state that requires explicit user
  // action — once set it never reverts. Trust the stored field for it.
  if (event.status === "cancelled") return "cancelled";

  const start = toDate(event.startDate);
  const end = toDate(event.endDate);

  if (!start || !end) return event.status; // malformed dates → trust stored

  if (now < startOfDay(start)) return "planned";
  if (now > endOfDay(end)) return "completed";
  return "active";
}
