// Phase 2 — /users client table.
//
// REQUIREMENTS:
//   - AUTH-07 (entry) — Invite user trigger surfaced in the toolbar + empty-state.
//   - AUTH-08 (entry) — Inline role select per row (UserRoleSelectInline).
//   - AUTH-09 (entry + surface) — Disable button per row (DisableUserButton)
//     + "Disabled" badge inline next to displayName for already-disabled users.
//   - REP-06 / REP-07 — DataTable URL state + 50/page default; Phase 2 swaps
//     to cursor-based pagination per D-17 (prev/next-only).
//   - UI-SPEC empty-state copy: "Just you, for now" / "Invite teammates to
//     check items in and out." + [Invite user] CTA.
//
// Phase 2: Server Component seeds initialUsers + nextCursor; client takes
// over via useUsersLive (onSnapshot scoped to the visible 50-row window per
// D-20). Pagination chrome is the DataTable's default + a cursor-aware
// "Next page" link rendered separately.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users as UsersIcon, ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { useUsersLive } from "@/lib/hooks/use-users-live";
import type { UserDoc } from "@/lib/types/user";
import { DataTable } from "@/components/feature/table/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

import { UserRoleSelectInline } from "./UserRoleSelectInline";
import { DisableUserButton } from "./DisableUserButton";
import { InviteUserSheet } from "./InviteUserSheet";

export function UsersTable({
  initialUsers,
  nextCursor,
  currentUserUid,
}: {
  initialUsers: UserDoc[];
  nextCursor: string | null;
  currentUserUid: string;
}) {
  const router = useRouter();
  // Live subscription seeded from SSR; onSnapshot updates the slice in real
  // time per D-20. We don't pass opts so the hook subscribes to the default
  // 50-row window over the whole users collection.
  const usersRaw = useUsersLive(initialUsers);
  const users = useMemo(() => [...usersRaw], [usersRaw]);

  // currentUserUid is reserved for future use (e.g., suppressing the disable
  // affordance on the actor's own row); referenced here to keep the prop
  // contract tied into the component, satisfying noUnusedLocals.
  void currentUserUid;

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
    <div className="space-y-3">
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
      {/* D-17 cursor pagination: prev/next-only. "← Previous" uses router.back();
          "Next page →" is rendered when the SSR seed reports more rows. */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          ← Previous
        </Button>
        {nextCursor ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/users?cursor=${encodeURIComponent(nextCursor)}`}>
              Next page →
            </Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">End of list</span>
        )}
      </div>
    </div>
  );
}
