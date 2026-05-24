// Phase 1 — /inventory list page.
//
// Server-Component shell that hands off to the client `InventoryTable` island.
// The role-gate from (app)/layout.tsx (Plan 04) has already enforced auth at
// this point; here we only need the session.role to gate the admin-only
// "Add item" CTA in the page header.
//
// URL state (q, category, lifecycle, lowStock, page, sort) lives inside the
// client table via `useUrlTableState` (Plan 03). No prop drilling.
//
// REQUIREMENTS:
//   - INV-06 — filterable list by category, lifecycle, low-stock
//   - INV-07 — free-text search by name/SKU
//   - REP-06 — shareable filter URLs
//   - REP-07 — 50 rows/page default (DataTable wrapper default)

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getMockSession } from "@/lib/auth/mock-session";
import { InventoryTable } from "@/components/feature/inventory/InventoryTable";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryListPage() {
  const session = await getMockSession();
  const isAdmin = session?.role === "admin";
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Browse, filter, and manage your equipment."
        action={
          isAdmin ? (
            <Button asChild>
              <Link href="/inventory/new">
                <Plus className="mr-2 size-4" />
                Add item
              </Link>
            </Button>
          ) : null
        }
      />
      <InventoryTable />
    </div>
  );
}
