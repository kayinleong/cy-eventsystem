// Phase 1 — /reports/out route.
//
// REQUIREMENTS:
//   - REP-02 — items currently checked out across active events.
//   - REP-07 — 50 rows per page (DataTable default).
//   - UI-SPEC — Export CSV button rendered but disabled (Phase 1 out-of-scope).

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ItemsOutTable } from "@/components/feature/reports/ItemsOutTable";

export const metadata: Metadata = { title: "Items out" };

export default function ItemsOutPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Items out"
        description="Items currently checked out across active events."
        action={
          <Button variant="outline" disabled>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      />
      <ItemsOutTable />
    </div>
  );
}
