// Phase 2 — Inline role selector for /users table rows.
//
// REQUIREMENTS:
//   - AUTH-08 — admins can change another user's role from staff to admin or
//     vice versa. Cloud Function 1 (plan 02-04) mirrors users/{uid}.role to
//     Auth custom claims + revokes refresh tokens on change. Cloud Function 2
//     (onUserRoleChange) recomputes allowedStaff across all events when admin
//     status flips.
//
// Phase 1 used the mock store + a client-side actor lookup. Phase 2 calls
// the setUserRole Server Action which derives the actor server-side via
// requireAdmin() — no client-side lookup, no actor arg.

"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUserRole } from "@/app/(app)/users/actions";
import type { UserRole } from "@/lib/types/user";

export function UserRoleSelectInline({
  uid,
  currentRole,
  disabled = false,
}: {
  uid: string;
  currentRole: UserRole;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function change(role: UserRole) {
    if (role === currentRole) return;
    startTransition(async () => {
      const res = await setUserRole(uid, role);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't change role");
        return;
      }
      toast.success(`Role updated to ${role}`);
    });
  }

  return (
    <Select
      value={currentRole}
      onValueChange={(v) => change(v as UserRole)}
      disabled={disabled || pending}
    >
      <SelectTrigger className="w-28 h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="staff">Staff</SelectItem>
      </SelectContent>
    </Select>
  );
}
