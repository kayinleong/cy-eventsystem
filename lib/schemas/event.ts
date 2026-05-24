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
