// Phase 1 — /users client table.
//
// REQUIREMENTS:
//   - AUTH-07 (entry) — Invite user trigger surfaced in the toolbar + empty-state.
//   - AUTH-08 (entry) — Inline role select per row (UserRoleSelectInline).
//   - AUTH-09 (entry + surface) — Disable button per row (DisableUserButton)
//     + "Disabled" badge inline next to displayName for already-disabled users.
//   - REP-06 / REP-07 — DataTable URL state + 50/page default (unused here at
//     5 seed users but the wrapper provides the chrome for free).
//   - UI-SPEC empty-state copy (Q8): "Just you, for now" / "Invite teammates
//     to check items in and out." + [Invite user] CTA.
//
// Selector pattern: read `s.users` directly via useMockStore. This is the
// reference-stable raw slice — no inline filter, no D-01-11-A re-render trap.
// Plan 11's StockReportTable hit that issue because it filtered inside the
// selector; here we just read the raw array.
//
// D-11 sortable-columns rule: only `displayName` is sortable. `email`, `role`,
// `createdAt`, and `actions` carry the `// D-11: <col> is NOT sortable` audit
// comment.

"use client";

import { useMemo } from "react";
import { Users as UsersIcon, ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { useMockStore } from "@/lib/hooks/use-mock-store";
import type { UserDoc } from "@/lib/types/user";
import { DataTable } from "@/components/feature/table/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

import { UserRoleSelectInline } from "./UserRoleSelectInline";
import { DisableUserButton } from "./DisableUserButton";
import { InviteUserSheet } from "./InviteUserSheet";

export function UsersTable() {
  // Read raw slice via useMockStore (reference-stable across snapshots per
  // D-01-11-A). Project to a mutable array inside useMemo so DataTable's
  // `data: T[]` (TanStack's mutable contract) accepts it without a typescript
  // readonly mismatch. The spread copies the reference array shape but keeps
  // dependency identity stable through useMemo.
  const usersRaw = useMockStore((s) => s.users);
  const users = useMemo(() => [...usersRaw], [usersRaw]);

  const columns: ColumnDef<UserDoc>[] = useMemo(
    () => [
      {
        accessorKey: "displayName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Name <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.displayName}</span>
            {row.original.disabled ? (
              <Badge variant="outline" className="text-xs">
                Disabled
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "email",
        // D-11: email is NOT sortable.
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "role",
        // D-11: role is NOT sortable (filter axis only; inline editor is the affordance).
        header: "Role",
        cell: ({ row }) => (
          <UserRoleSelectInline
            uid={row.original.uid}
            currentRole={row.original.role}
            disabled={row.original.disabled}
          />
        ),
      },
      {
        accessorKey: "createdAt",
        // D-11: createdAt date is presented for context only — not sortable in this table.
        header: "Created",
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        id: "actions",
        // D-11: actions is NOT sortable.
        header: "",
        cell: ({ row }) => (
          <DisableUserButton
            uid={row.original.uid}
            displayName={row.original.displayName}
            alreadyDisabled={row.original.disabled}
          />
        ),
      },
    ],
    [],
  );

  return (
    <DataTable<UserDoc>
      columns={columns}
      data={users}
      globalFilterPlaceholder="Search users…"
      toolbarExtras={<InviteUserSheet />}
      emptyState={
        <EmptyState
          icon={UsersIcon}
          heading="Just you, for now"
          body="Invite teammates to check items in and out."
          action={<InviteUserSheet />}
        />
      }
    />
  );
}
