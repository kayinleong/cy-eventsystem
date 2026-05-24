// Phase 1 — /reports/stock route.
//
// REQUIREMENTS:
//   - REP-01 — list every active item with availableQty/outQty/damagedQty/totalQty/threshold/low-stock flag.
//   - REP-07 — 50 rows per page (DataTable default).
//   - UI-SPEC — Export CSV button rendered but disabled (Phase 1 out-of-scope).
//
// The route shell is a Server Component (gets the SSR'd <title>); the table
// itself is a client island (StockReportTable) that subscribes to the mock store.

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StockReportTable } from "@/components/feature/reports/StockReportTable";

export const metadata: Metadata = { title: "Stock" };

export default function StockReportPage() {
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
      <StockReportTable />
    </div>
  );
}
