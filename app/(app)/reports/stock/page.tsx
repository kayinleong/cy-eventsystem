// Phase 2 — /reports/stock route (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-01 — every active item: name + sku + category + availableQty +
//     outQty + damagedQty + totalQty + threshold + low-stock badge.
//   - REP-06 — sort/page/filter state is URL-synced.
//   - REP-07 — 50 rows per page (cursor window).
//
// Phase 2 swap:
//   - Server Component fetches initial page via getInventoryPage.
//   - StockReportTable consumes useInventoryLive + cursor pagination.

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { requireSession } from "@/lib/auth/dal";
import { getInventoryPage } from "@/lib/data/inventory.server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StockReportTable } from "@/components/feature/reports/StockReportTable";

export const metadata: Metadata = { title: "Stock" };

type RouteProps = {
  searchParams: Promise<{
    cursor?: string;
    category?: string;
    lifecycleState?: string;
  }>;
};

export default async function StockReportPage({ searchParams }: RouteProps) {
  await requireSession();
  const p = await searchParams;
  const { items, nextCursor } = await getInventoryPage({
    cursor: p.cursor ?? null,
    filters: {
      category: p.category,
      lifecycleState: p.lifecycleState,
    },
    limit: 50,
  });

  // REP-01 — exclude retired items by default UNLESS the URL filter
  // explicitly asks for retired. Anti-leak: even if the server query
  // returns retired items (e.g. when no lifecycleState filter set), the
  // client filter below removes them from the default view.
  const visibleItems = items.filter(
    (i) => i.lifecycleState !== "retired" || p.lifecycleState === "retired",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Current stock"
        description="Live stock levels across all active items."
        action={
          <Button variant="outline" disabled>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      />
      <StockReportTable initialItems={visibleItems} nextCursor={nextCursor} />
    </div>
  );
}
