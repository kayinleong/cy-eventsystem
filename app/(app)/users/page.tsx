// Phase 2 — /users admin-only users list route.
//
// REQUIREMENTS:
//   - AUTH-07 — admin-only entry surfaces (Invite user) rendered inside
//     UsersTable's toolbar + empty-state.
//   - AUTH-08 — inline role select per row.
//   - AUTH-09 — disable button per row + "Disabled" badge surface inline.
//   - AUTH-10 — /users nav item + entire page is admin-only.
//
// CONTEXT.md D-07 (Phase 1) — strict admin gate at the route level.
// Plan 02-04: requireAdmin() now comes from @/lib/auth/dal (real DAL); page
// becomes the SSR seed for UsersTable via getUsersPage. UsersTable's client
// component takes over via useUsersLive(onSnapshot) for live updates.

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { getUsersPage } from "@/lib/data/users.server";
import { UsersTable } from "@/components/feature/users/UsersTable";

export const metadata: Metadata = { title: "Users" };

type RouteProps = {
  searchParams: Promise<{ cursor?: string; role?: "admin" | "staff" }>;
};

export default async function UsersPage({ searchParams }: RouteProps) {
  const session = await requireAdmin();
  const params = await searchParams;
  const { users, nextCursor } = await getUsersPage({
    cursor: params.cursor ?? null,
    filters: params.role ? { role: params.role } : undefined,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members and their access."
      />
      <UsersTable
        initialUsers={users}
        nextCursor={nextCursor}
        currentUserUid={session.uid}
      />
    </div>
  );
}
