import type { StatusTone } from "./StatusBadge";

/**
 * DomainStatus — every status string that may appear in the UI, drawn from the
 * lib/types/* enums (Phase 1) and computed projection states.
 *
 * The Phase 2 swap keeps this enum verbatim; only the data source changes.
 */
export type DomainStatus =
  // item lifecycle
  | "available"
  | "checked_out"
  | "damaged"
  | "retired"
  // event status
  | "planned"
  | "active"
  | "completed"
  | "cancelled"
  // missing status
  | "open"
  | "found"
  | "writtenOff"
  | "missing"
  // computed dashboard states
  | "low-stock"
  | "overdue"
  | "in-progress"
  // transaction types
  | "checkout"
  | "checkin"
  | "adjustment";

/**
 * statusToTone — maps every domain status string to its UI-SPEC tone.
 *
 * Locked per UI-SPEC "Status Palette (Q4)":
 *  - green       → available / planned / active
 *  - blue        → checked_out / in-progress / checkout-tx
 *  - amber       → damaged / low-stock / overdue
 *  - muted       → retired / completed / cancelled / found / writtenOff / checkin / adjustment
 *  - destructive → missing / open
 *
 * Note about "open" (missing-item status): UI-SPEC marks `missing` as destructive,
 * and an open missing-item row is by definition the destructive case — render
 * its badge with destructive tone. Once resolved (found / writtenOff) the row
 * collapses to muted.
 */
export function statusToTone(status: string): StatusTone {
  if (status === "available" || status === "planned" || status === "active") {
    return "green";
  }
  if (
    status === "checked_out" ||
    status === "in-progress" ||
    status === "checkout"
  ) {
    return "blue";
  }
  if (
    status === "damaged" ||
    status === "low-stock" ||
    status === "overdue"
  ) {
    return "amber";
  }
  if (
    status === "retired" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "found" ||
    status === "writtenOff" ||
    status === "checkin" ||
    status === "adjustment"
  ) {
    return "muted";
  }
  if (status === "missing" || status === "open") {
    return "destructive";
  }
  return "muted";
}

/**
 * statusToLabel — human-readable label for every DomainStatus value.
 *
 * Sentence-case per UI-SPEC voice rules ("Checked out", not "CHECKED_OUT" or
 * "Checked Out"). Falls through to the raw status string for unknown values
 * so the UI degrades gracefully on a forward-compat schema change.
 */
export function statusToLabel(status: string): string {
  switch (status) {
    case "available":
      return "Available";
    case "checked_out":
      return "Checked out";
    case "damaged":
      return "Damaged";
    case "retired":
      return "Retired";
    case "planned":
      return "Planned";
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "open":
      return "Open";
    case "found":
      return "Found";
    case "writtenOff":
      return "Written off";
    case "missing":
      return "Missing";
    case "low-stock":
      return "Low stock";
    case "overdue":
      return "Overdue";
    case "in-progress":
      return "In progress";
    case "checkout":
      return "Check-out";
    case "checkin":
      return "Check-in";
    case "adjustment":
      return "Adjustment";
    default:
      return status;
  }
}
