// Phase 2 — /inventory/new admin-gated create form route (Block C UI swap).
//
// REQUIREMENTS:
//   - INV-01 — admins can create new inventory items
//   - AUTH-10 — only admins can access this route (staff → /unauthorized via
//     requireAdmin's redirect)
//
// The role gate runs server-side via requireAdmin() from the real DAL
// (lib/auth/dal.ts). The form itself is a Client Component — see ItemForm.tsx
// — and calls the createItem Server Action defined in app/(app)/inventory/
// actions.ts (plan 02-05) on submit.

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { ItemForm } from "@/components/feature/inventory/ItemForm";

export const metadata: Metadata = { title: "Add item" };

export default async function NewItemPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <PageHeader title="Add item" description="Create a new inventory item." />
      <ItemForm mode="create" />
    </div>
  );
}
