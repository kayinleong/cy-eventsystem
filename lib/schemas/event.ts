import { z } from "zod";

// REQUIREMENTS.md EVT-02 — lifecycle.
export const EventStatusEnum = z.enum([
  "planned",
  "active",
  "completed",
  "cancelled",
]);

// Form-input variant for /events/new and /events/[id]/edit.
// `allowedStaff`, `plannedItems`, and `status` are derived/managed elsewhere.
//
// Phase 1 retains this shape (ISO date strings) for the existing EventForm.
// Phase 2 Server Actions ALSO accept this same shape, coercing strings to
// Date objects inside the Server Action so both legacy + new callers work.
export const EventFormSchema = z
  .object({
    name: z.string().min(1, "Name is required."),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    location: z.string().default(""),
    description: z.string().max(2000).default(""),
    teamLeads: z
      .array(z.string())
      .min(1, "At least one team lead is required."),
    backupTeams: z.array(z.string()).default([]),
  })
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    message: "End date must be on or after start date.",
    path: ["endDate"],
  });

export type EventFormInput = z.input<typeof EventFormSchema>;

// ---------- Phase 2 Server Action inputs ----------
//
// CreateEventSchema and UpdateEventSchema are consumed by app/(app)/events/actions.ts.
// They mirror EventFormSchema's shape so the EventForm can hand off its
// validated payload straight to the action. UpdateEventSchema makes all
// fields optional + adds an optional `status` enum so the action can support
// partial updates (e.g., a status-only transition).

export const CreateEventSchema = z
  .object({
    name: z.string().min(1, "Name is required.").max(120),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    location: z.string().default(""),
    description: z.string().max(2000).default(""),
    teamLeads: z
      .array(z.string())
      .min(1, "At least one team lead is required."),
    backupTeams: z.array(z.string()).default([]),
  })
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    message: "End date must be on or after start date.",
    path: ["endDate"],
  });

export const UpdateEventSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  location: z.string().optional(),
  description: z.string().max(2000).optional(),
  teamLeads: z.array(z.string()).min(1).optional(),
  backupTeams: z.array(z.string()).optional(),
  status: EventStatusEnum.optional(),
});

// EVT-06 — cancellation requires reconciliation per open checkout (keyed by
// the open checkout's transaction id, value = the chosen resolution).
export const CancelEventReconciliationSchema = z.object({
  eventId: z.string().min(1),
  reconciliation: z.record(
    z.string(),
    z.enum(["returned", "lost", "still_with_owner"]),
  ),
});

export type CreateEventValues = z.infer<typeof CreateEventSchema>;
export type UpdateEventValues = z.infer<typeof UpdateEventSchema>;
export type CancelEventReconciliation = z.infer<
  typeof CancelEventReconciliationSchema
>;
