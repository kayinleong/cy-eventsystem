// Phase 1 — /reports/missing route.
//
// REQUIREMENTS:
//   - REP-03 — show open missing-item records.
//   - MIS-02 — admin resolve action surfaced inline per row.
//   - REP-07 — 50 rows per page (DataTable default).
//   - UI-SPEC — Export CSV button rendered but disabled (Phase 1 out-of-scope).
//   - UI-SPEC empty-state copy table: "Nothing missing" / "All checked-out
//     items are accounted for." (rendered inside MissingItemsTable).

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { MissingItemsTable } from "@/components/feature/reports/MissingItemsTable";

export const metadata: Metadata = { title: "Missing" };

export default function MissingReportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Missing"
        description="Open missing-item records."
        action={
          <Button variant="outline" disabled>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      />
      <MissingItemsTable />
    </div>
  );
}
