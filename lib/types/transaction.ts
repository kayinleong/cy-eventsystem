// Mirrors transactions/{txId} in .planning/research/ARCHITECTURE.md (lines 122-142).
//
// Append-only audit log. `availableQty` on inventory is a materialized projection
// of the transaction stream. Every state-changing action writes a transaction
// alongside an inventory update inside a Firestore transaction in Phase 2.
//
// REQUIREMENTS.md AUD-01 — actor identity is denormalized at write time
// (`actorName` / `actorRoleAtTimeOfAction`) so historical reports stay
// accurate even if the user record is renamed or disabled later.

import type { UserRole } from "./user";

export type TransactionType =
  | "checkout"
  | "checkin"
  | "adjustment"
  | "missing";

export type TransactionDoc = {
  id: string;
  type: TransactionType;
  itemId: string;
  itemSku: string;
  itemName: string;
  // Null for adjustment-only transactions that are not tied to an event.
  eventId: string | null;
  eventName: string | null;
  qty: number; // always positive; sign implied by `type`
  actorUid: string;
  actorName: string; // denormalized snapshot per AUD-01
  actorRoleAtTimeOfAction: UserRole; // denormalized snapshot per AUD-01
  at: string; // ISO; Phase 1 uses fixed 2026 strings per D-04
  notes: string;
  // REQUIREMENTS.md CI-08 — links check-in transactions to their originating check-out.
  parentTxId: string | null;
  // Optional client-supplied idempotency key for retries.
  clientTxId: string | null;
};
