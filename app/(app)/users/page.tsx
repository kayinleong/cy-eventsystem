// Phase 1 — /users admin-only users list route.
//
// REQUIREMENTS:
//   - AUTH-07 — admin-only entry surfaces (Invite user) rendered inside
//     UsersTable's toolbar + empty-state.
//   - AUTH-08 — inline role select per row.
//   - AUTH-09 — disable button per row + "Disabled" badge surface inline.
//   - AUTH-10 — /users nav item + entire page is admin-only.
//
// CONTEXT.md D-07 — strict admin gate at the route level. Staff hitting this
// URL directly is redirected to /unauthorized by requireAdmin().
// AppSidebar already gates the /users nav item to admin (Plan 04), but the
// route-level gate is the defense-in-depth required by CONTEXT.md.

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/mock-session";
import { UsersTable } from "@/components/feature/users/UsersTable";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members and their access."
      />
      <UsersTable />
    </div>
  );
}
