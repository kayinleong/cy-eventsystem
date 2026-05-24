// Phase 1 — /reports/history route.
//
// REQUIREMENTS:
//   - REP-04 — global transaction log with filters: date range, event, item,
//     actor, action type.
//   - REP-06 — every filter / sort / page state is URL-synced.
//   - REP-07 — 50 rows per page (DataTable default).
//   - UI-SPEC — Export CSV button rendered but disabled (Phase 1 out-of-scope).

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { HistoryTable } from "@/components/feature/reports/HistoryTable";

export const metadata: Metadata = { title: "History" };

export default function HistoryReportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="Every transaction across the system."
        action={
          <Button variant="outline" disabled>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      />
      <HistoryTable />
    </div>
  );
}
