// Phase 1 — /inventory/new admin-gated create form route.
//
// REQUIREMENTS:
//   - INV-01 — admins can create new inventory items
//   - AUTH-10 — only admins can access this route (staff → /unauthorized)
//
// The role gate runs server-side via requireAdmin() (Plan 02 helper). The form
// itself is a client island — see ItemForm.tsx.

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/mock-session";
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
