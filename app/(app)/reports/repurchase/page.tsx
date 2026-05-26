// Phase 2 — /reports/repurchase route (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-05 — items below threshold (low-stock signal).
//   - RP-04 — admin can mark a low-stock item as "ordered" (inline button).
//   - REP-06 — sort/page/filter state is URL-synced.
//   - REP-07 — 50 rows per page (cursor window).
//
// v1 scope: surface `isLowStock === true` items only. The "frequently-flagged
// missing" secondary signal from Phase 1 is deferred — it would require a
// cross-collection aggregation (count missingItems per itemId) that doesn't
// fit cleanly into a single Firestore cursor page.

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { requireSession } from "@/lib/auth/dal";
import { getInventoryPage } from "@/lib/data/inventory.server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { RepurchaseTable } from "@/components/feature/reports/RepurchaseTable";

export const metadata: Metadata = { title: "Repurchase" };

type RouteProps = {
  searchParams: Promise<{ cursor?: string }>;
};

export default async function RepurchasePage({ searchParams }: RouteProps) {
  await requireSession();
  const p = await searchParams;
  const { items, nextCursor } = await getInventoryPage({
    cursor: p.cursor ?? null,
    filters: { isLowStock: true },
    limit: 50,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Repurchase"
        description="Items below their low-stock threshold."
        action={
          <Button variant="outline" disabled>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      />
      <RepurchaseTable initial={items} nextCursor={nextCursor} />
    </div>
  );
}
