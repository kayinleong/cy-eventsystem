// Mirrors events/{eventId} in .planning/research/ARCHITECTURE.md (lines 104-120).
//
// `allowedStaff` is the denormalized union of `teamLeads + backupTeams + admin uids`.
// In Phase 1 the mock seed populates it explicitly; in Phase 2 a Cloud Function
// recomputes it on team-membership changes (security-rules cheap path).

// REQUIREMENTS.md EVT-02 lifecycle.
export type EventStatus = "planned" | "active" | "completed" | "cancelled";

export type EventDoc = {
  id: string;
  name: string;
  startDate: string; // ISO
  endDate: string; // ISO
  status: EventStatus;
  location: string;
  description: string;
  teamLeads: string[]; // uids
  backupTeams: string[]; // uids
  // Denormalized union of teamLeads + backupTeams + admin uids. Used in security
  // rules for cheap `array-contains-any` checks (see ARCHITECTURE.md line 118).
  allowedStaff: string[];
  plannedItems: Record<string, { plannedQty: number; notes: string }>;
  createdAt: string;
  createdBy: string;
  closedAt: string | null;
  closedBy: string | null;
};
