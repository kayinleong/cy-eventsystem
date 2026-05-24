// Mirrors missingItems/{missingId} in .planning/research/ARCHITECTURE.md (lines 144-153).
//
// A missing-item record is created on check-in when `returnedQty < checkedOutQty`
// (REQUIREMENTS.md CI-04). Resolution is either `found` (returned later) or
// `writtenOff` (lost permanently — flows into stock-adjustment in Phase 2).

// REQUIREMENTS.md CI-04 — required enum.
export type MissingReason = "Lost" | "Damaged" | "Not returned" | "Unknown";

export type MissingStatus = "open" | "found" | "writtenOff";

export type MissingItemDoc = {
  id: string;
  itemId: string;
  itemName: string;
  eventId: string;
  eventName: string;
  qty: number;
  reason: MissingReason;
  reportedBy: string; // uid
  reportedByName: string; // denormalized snapshot
  reportedAt: string; // ISO
  status: MissingStatus;
  resolvedAt: string | null;
  resolvedBy: string | null; // uid
  // Links back to the check-in transaction that produced the missing record.
  parentCheckinTxId: string;
};
