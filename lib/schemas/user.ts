import { z } from "zod";

// Mirrors UserRole from lib/types/user.ts.
export const UserRoleEnum = z.enum(["admin", "staff"]);

// Admin-only invite form — see PROJECT.md key decision #2 (admin-invite-only
// registration via Firebase password-reset link). Phase 1 form fires a toast
// and routes back; Phase 2 wires this to a Server Action.
export const InviteUserSchema = z.object({
  email: z.email("Enter a valid email."),
  displayName: z.string().min(1, "Display name is required."),
  role: UserRoleEnum,
});

// Used by the /users page's per-row role selector.
export const SetUserRoleSchema = z.object({
  uid: z.string().min(1),
  role: UserRoleEnum,
});

export type InviteUserInput = z.input<typeof InviteUserSchema>;
export type SetUserRoleInput = z.input<typeof SetUserRoleSchema>;
