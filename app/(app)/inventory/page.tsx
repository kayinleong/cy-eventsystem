// Phase 2 — /inventory list page (Block C UI swap).
//
// Server Component shell that:
//   - Verifies the session via the real DAL (requireSession redirects to
//     /api/auth/expire-session if the __session cookie is missing/invalid).
//   - Issues a cursor-paged Admin SDK read via getInventoryPage (50-row slice
//     per D-20). The slice + the SSR-seeded `nextCursor` are passed to the
//     client InventoryTable, which subscribes to the same window via
//     onSnapshot (Web SDK) for live updates.
//   - Gates the admin-only "Add item" CTA on session.role === "admin".
//
// URL contract per D-17 (Phase 2 amendment): `?cursor=xxx` opaque base64
// JSON blob replaces Phase 1's `?page=N`. Filter URL params (`?category=`,
// `?lifecycleState=`, `?isLowStock=`, `?q=`) survive unchanged per REP-06.
//
// REQUIREMENTS:
//   - INV-06 — filterable list by category, lifecycle, low-stock
//   - INV-07 — free-text search by name/SKU (filtered client-side within the
//     50-row cursor window per D-20; server-side text search out-of-scope)
//   - REP-06 — shareable filter URLs (cursor + filters)
//   - REP-07 — 50 rows/page (the cursor window size)

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/dal";
import { getInventoryPage } from "@/lib/data/inventory.server";
import { InventoryTable } from "@/components/feature/inventory/InventoryTable";

export const metadata: Metadata = { title: "Inventory" };

type RouteProps = {
  searchParams: Promise<{
    cursor?: string;
    category?: string;
    lifecycleState?: string;
    isLowStock?: string;
    q?: string;
  }>;
};

export default async function InventoryListPage({ searchParams }: RouteProps) {
  // Defense-in-depth: the (app) layout already gated auth; requireSession
  // here also narrows session.role + session.uid to non-nullable for the
  // admin CTA. requireSession redirects to /api/auth/expire-session on a
  // revoked/missing cookie.
  const session = await requireSession();
  const isAdmin = session.role === "admin";

  const params = await searchParams; // Next 16 async
  const { items, nextCursor } = await getInventoryPage({
    cursor: params.cursor ?? null,
    filters: {
      category: params.category,
      lifecycleState: params.lifecycleState,
      isLowStock: params.isLowStock === "true" ? true : undefined,
    },
  });

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
      <InventoryTable initialItems={items} nextCursor={nextCursor} />
    </div>
  );
}
