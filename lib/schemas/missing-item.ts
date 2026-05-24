import { z } from "zod";

// Mirrors MissingReason and MissingStatus from lib/types/missing-item.ts.
export const MissingReasonEnum = z.enum([
  "Lost",
  "Damaged",
  "Not returned",
  "Unknown",
]);

export const MissingStatusEnum = z.enum(["open", "found", "writtenOff"]);

// Used by the resolve-missing-item Sheet (CONTEXT.md "Sheets vs Dialogs").
export const ResolveMissingSchema = z.object({
  missingId: z.string().min(1),
  resolution: z.enum(["found", "writtenOff"]),
  notes: z.string().max(1000).default(""),
});

export type ResolveMissingInput = z.input<typeof ResolveMissingSchema>;
