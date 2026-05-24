// Phase 1 mock seed: events.
//
// CONTEXT.md D-03 — 6 events covering all 4 statuses, including:
//   * 1 explicitly overdue (status=active AND endDate < today)
//
// CONTEXT.md D-04 — fixed 2026 ISO dates. Phase-1 "today" is 2026-05-24
// (matches the Today's date metadata in the project context), so an event
// with status=active AND endDate=2026-05-22 IS overdue per EVT-07.
//
// `allowedStaff` is the explicit union of `teamLeads + backupTeams + admin uids`
// (u-admin-1, u-admin-2). The Phase 1 mock hard-codes it; in Phase 2 a Cloud
// Function maintains it server-side (ARCHITECTURE.md line 118).

import type { EventDoc } from "@/lib/types/event";

export const seedEvents: EventDoc[] = [
  // 1. PLANNED — future event led by an admin.
  {
    id: "evt-planned-01",
    name: "Summer Tech Conference 2026",
    startDate: "2026-07-15T09:00:00.000Z",
    endDate: "2026-07-17T18:00:00.000Z",
    status: "planned",
    location: "Convention Center, Hall A",
    description: "3-day tech conference with 4 stages.",
    teamLeads: ["u-admin-2"],
    backupTeams: ["u-staff-1"],
    allowedStaff: ["u-admin-1", "u-admin-2", "u-staff-1"],
    plannedItems: {},
    createdAt: "2026-04-15T10:00:00.000Z",
    createdBy: "u-admin-2",
    closedAt: null,
    closedBy: null,
  },
  // 2. ACTIVE — currently running event with items checked out (today is 2026-05-24).
  {
    id: "evt-active-01",
    name: "Spring Product Demo",
    startDate: "2026-05-20T08:00:00.000Z",
    endDate: "2026-05-26T20:00:00.000Z",
    status: "active",
    location: "HQ Atrium",
    description: "On-site product demo week.",
    teamLeads: ["u-admin-1"],
    backupTeams: ["u-staff-1", "u-staff-2"],
    allowedStaff: ["u-admin-1", "u-admin-2", "u-staff-1", "u-staff-2"],
    plannedItems: {},
    createdAt: "2026-05-01T08:00:00.000Z",
    createdBy: "u-admin-1",
    closedAt: null,
    closedBy: null,
  },
  // 3. ACTIVE OVERDUE — endDate=2026-05-22 < today=2026-05-24 (EVT-07).
  {
    id: "evt-overdue-01",
    name: "Marketing Pop-Up Booth",
    startDate: "2026-05-10T10:00:00.000Z",
    endDate: "2026-05-22T18:00:00.000Z",
    status: "active",
    location: "Mall Plaza",
    description: "10-day pop-up; items not yet returned.",
    teamLeads: ["u-staff-2"],
    backupTeams: [],
    allowedStaff: ["u-admin-1", "u-admin-2", "u-staff-2"],
    plannedItems: {},
    createdAt: "2026-04-28T09:00:00.000Z",
    createdBy: "u-admin-1",
    closedAt: null,
    closedBy: null,
  },
  // 4. COMPLETED — full cycle of checkouts + checkins, then closed.
  {
    id: "evt-completed-01",
    name: "Q1 Town Hall",
    startDate: "2026-03-10T09:00:00.000Z",
    endDate: "2026-03-10T17:00:00.000Z",
    status: "completed",
    location: "Auditorium",
    description: "Quarterly town hall.",
    teamLeads: ["u-admin-2"],
    backupTeams: ["u-staff-1"],
    allowedStaff: ["u-admin-1", "u-admin-2", "u-staff-1"],
    plannedItems: {},
    createdAt: "2026-02-15T10:00:00.000Z",
    createdBy: "u-admin-2",
    closedAt: "2026-03-11T10:00:00.000Z",
    closedBy: "u-admin-2",
  },
  // 5. CANCELLED — closed before completion.
  {
    id: "evt-cancelled-01",
    name: "Cancelled Roadshow Stop",
    startDate: "2026-04-20T10:00:00.000Z",
    endDate: "2026-04-22T18:00:00.000Z",
    status: "cancelled",
    location: "Venue TBD",
    description: "Cancelled due to venue conflict.",
    teamLeads: ["u-admin-1"],
    backupTeams: [],
    allowedStaff: ["u-admin-1", "u-admin-2"],
    plannedItems: {},
    createdAt: "2026-03-25T09:00:00.000Z",
    createdBy: "u-admin-1",
    closedAt: "2026-04-18T15:00:00.000Z",
    closedBy: "u-admin-1",
  },
  // 6. PLANNED (small, staff-led).
  {
    id: "evt-planned-02",
    name: "Booth at Annual Expo",
    startDate: "2026-08-12T08:00:00.000Z",
    endDate: "2026-08-14T20:00:00.000Z",
    status: "planned",
    location: "Expo Hall C",
    description: "Annual industry expo.",
    teamLeads: ["u-staff-1"],
    backupTeams: ["u-staff-2"],
    allowedStaff: ["u-admin-1", "u-admin-2", "u-staff-1", "u-staff-2"],
    plannedItems: {},
    createdAt: "2026-05-05T10:00:00.000Z",
    createdBy: "u-staff-1",
    closedAt: null,
    closedBy: null,
  },
];
