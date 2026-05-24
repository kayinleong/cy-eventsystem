// Phase 1 mock seed: missing-item records.
//
// CONTEXT.md D-03 — 6 records mixing open + resolved.
// Distribution:
//   3 open    — one per reason variant (Lost, Damaged, Not returned)
//   2 resolved (found)
//   1 resolved (writtenOff)
//
// CONTEXT.md D-04 — fixed 2026 ISO dates.
//
// REQUIREMENTS.md CI-04 — `reason` is the required enum.
// Every `parentCheckinTxId` references an existing checkin-type transaction
// id in lib/mock/transactions.ts. Resolved records also populate
// `resolvedAt` + `resolvedBy`.

import type { MissingItemDoc } from "@/lib/types/missing-item";

export const seedMissingItems: MissingItemDoc[] = [
  // OPEN — Lost (still pending after Q1 Town Hall)
  {
    id: "miss-001",
    itemId: "AUD-MIC-01",
    itemName: "Shure SM58 wireless mic",
    eventId: "evt-completed-01",
    eventName: "Q1 Town Hall",
    qty: 1,
    reason: "Lost",
    reportedBy: "u-admin-2",
    reportedByName: "Morgan Lee",
    reportedAt: "2026-03-10T18:12:00.000Z",
    status: "open",
    resolvedAt: null,
    resolvedBy: null,
    parentCheckinTxId: "tx-0011",
  },
  // OPEN — Damaged (HDMI cable returned with damage)
  {
    id: "miss-002",
    itemId: "DSP-HDM-01",
    itemName: "HDMI 2.1 cable 15ft",
    eventId: "evt-completed-01",
    eventName: "Q1 Town Hall",
    qty: 1,
    reason: "Damaged",
    reportedBy: "u-staff-1",
    reportedByName: "Sam Patel",
    reportedAt: "2026-03-10T18:26:00.000Z",
    status: "open",
    resolvedAt: null,
    resolvedBy: null,
    parentCheckinTxId: "tx-0016",
  },
  // OPEN — Not returned (C-stand still out)
  {
    id: "miss-003",
    itemId: "LGT-STD-01",
    itemName: "Manfrotto C-stand 25in",
    eventId: "evt-completed-01",
    eventName: "Q1 Town Hall",
    qty: 1,
    reason: "Not returned",
    reportedBy: "u-staff-1",
    reportedByName: "Sam Patel",
    reportedAt: "2026-03-10T18:36:00.000Z",
    status: "open",
    resolvedAt: null,
    resolvedBy: null,
    parentCheckinTxId: "tx-0019",
  },
  // RESOLVED — found (brochure box reappeared)
  {
    id: "miss-004",
    itemId: "MKT-BRO-01",
    itemName: "Product brochure (box of 100)",
    eventId: "evt-completed-01",
    eventName: "Q1 Town Hall",
    qty: 1,
    reason: "Damaged",
    reportedBy: "u-staff-1",
    reportedByName: "Sam Patel",
    reportedAt: "2026-03-10T18:43:00.000Z",
    status: "found",
    resolvedAt: "2026-03-12T11:00:00.000Z",
    resolvedBy: "u-admin-1",
    parentCheckinTxId: "tx-0021",
  },
  // RESOLVED — found (XLR cable showed up later)
  {
    id: "miss-005",
    itemId: "AUD-CBL-01",
    itemName: "XLR cable 25ft",
    eventId: "evt-completed-01",
    eventName: "Q1 Town Hall",
    qty: 1,
    reason: "Unknown",
    reportedBy: "u-staff-1",
    reportedByName: "Sam Patel",
    reportedAt: "2026-03-10T18:39:00.000Z",
    status: "found",
    resolvedAt: "2026-03-18T15:00:00.000Z",
    resolvedBy: "u-admin-1",
    parentCheckinTxId: "tx-0020",
  },
  // RESOLVED — writtenOff (one brochure box could not be located)
  {
    id: "miss-006",
    itemId: "MKT-BRO-01",
    itemName: "Product brochure (box of 100)",
    eventId: "evt-completed-01",
    eventName: "Q1 Town Hall",
    qty: 1,
    reason: "Lost",
    reportedBy: "u-staff-1",
    reportedByName: "Sam Patel",
    reportedAt: "2026-03-10T18:43:30.000Z",
    status: "writtenOff",
    resolvedAt: "2026-03-15T09:30:00.000Z",
    resolvedBy: "u-admin-2",
    parentCheckinTxId: "tx-0021",
  },
];
