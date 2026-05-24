// Phase 1 — /reports/repurchase route.
//
// REQUIREMENTS:
//   - REP-05 — items below low-stock threshold plus items frequently flagged missing/damaged.
//   - RP-04 — admin can mark a low-stock item as "ordered" (inline button per row).
//   - REP-07 — 50 rows per page (DataTable default).
//   - UI-SPEC — Export CSV button rendered but disabled (Phase 1 out-of-scope).

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { RepurchaseTable } from "@/components/feature/reports/RepurchaseTable";

export const metadata: Metadata = { title: "Repurchase" };

export default function RepurchasePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Repurchase"
        description="Items below threshold plus items frequently flagged missing or damaged."
        action={
          <Button variant="outline" disabled>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      />
      <RepurchaseTable />
    </div>
  );
}
