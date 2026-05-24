// Phase 1 — Inline role selector for /users table rows.
//
// REQUIREMENTS:
//   - AUTH-08 — admins can change another user's role from staff to admin or
//     vice versa. The mutator (store.setUserRole) recomputes allowedStaff on
//     every event because admin promotion changes the admin-union baked into
//     each event's allowedStaff (Plan 02).
//
// Per D-01-05-E actor-resolution pattern: useCurrentUser() gives the role/uid;
// resolve the full UserDoc from seedUsers at submit time; pass to mutator.
//
// Admin-only at the UI level (UsersTable's parent route also gates via
// requireAdmin()). The Select is intentionally NOT guarded at the component
// level — UsersTable renders this inline for every row, including the actor's
// own row. Self-protection (last-admin cannot demote self) lives upstream in
// the mutator if/when REQUIREMENTS extends to it; Plan 1 mock accepts any
// role change.

"use client";

import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUserRole } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
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
  const session = useCurrentUser();

  function change(role: UserRole) {
    if (role === currentRole) return;
    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't change role");
      return;
    }
    setUserRole(uid, role, actor);
    toast.success(`Role updated to ${role}`);
  }

  return (
    <Select
      value={currentRole}
      onValueChange={(v) => change(v as UserRole)}
      disabled={disabled}
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
