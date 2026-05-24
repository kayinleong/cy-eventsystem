// PHASE 1 ONLY — REMOVE IN PHASE 2 (CONTEXT.md D-06).
//
// POC role switcher embedded inside the user menu. Flips the mock_session
// cookie's `role` field between "admin" and "staff" and calls
// router.refresh() so Server Components (notably (app)/layout.tsx) re-evaluate.
//
// Filename intentionally signals removal in Phase 2 — `PhaseOnePoc` prefix is
// greppable and easy to delete wholesale.
//
// We use `useCurrentUser()` (Plan 02) which wraps useSyncExternalStore so the
// component re-renders correctly across role flips without violating React 19's
// `react-hooks/set-state-in-effect` rule (D-01-02-A).

"use client";

import { useRouter } from "next/navigation";

import { readMockSessionClient, writeMockSessionClient } from "@/lib/mock/cookie";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/lib/types/user";

export function PhaseOnePocRoleSwitcher() {
  const router = useRouter();
  const session = useCurrentUser();
  if (!session) return null;

  const flip = (role: UserRole) => {
    // Read the current cookie (avoid trusting the hook's snapshot in case of
    // a stale render closure), spread, replace role, write back.
    const current = readMockSessionClient();
    if (!current) return;
    if (current.role === role) return; // no-op when already on target role
    writeMockSessionClient({ ...current, role });
    router.refresh();
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Switch role (POC only)
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={session.role}
        onValueChange={(v) => flip(v as UserRole)}
      >
        <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="staff">Staff</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}
