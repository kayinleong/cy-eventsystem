// Phase 2 — /reports/missing route (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-03 — show open missing-item records.
//   - MIS-02 — admin resolve action surfaced inline per row.
//   - REP-06 — every filter / sort / page state is URL-synced.
//   - REP-07 — 50 rows per page (cursor window).
//
// Phase 2 swap: getMissingPage SSR seed → MissingItemsTable + useMissingLive.

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { requireSession } from "@/lib/auth/dal";
import { getMissingPage } from "@/lib/data/missing.server";
import type { MissingStatus } from "@/lib/types/missing-item";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { MissingItemsTable } from "@/components/feature/reports/MissingItemsTable";

export const metadata: Metadata = { title: "Missing" };

type RouteProps = {
  searchParams: Promise<{
    cursor?: string;
    status?: MissingStatus;
    eventId?: string;
  }>;
};

export default async function MissingReportPage({ searchParams }: RouteProps) {
  await requireSession();
  const p = await searchParams;
  // Default status filter = "open" per REP-03 (the actionable view).
  const status: MissingStatus = p.status ?? "open";
  const { missing, nextCursor } = await getMissingPage({
    cursor: p.cursor ?? null,
    filters: { status, eventId: p.eventId },
    limit: 50,
  });
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
      <MissingItemsTable
        initial={missing}
        nextCursor={nextCursor}
        initialStatus={status}
      />
    </div>
  );
}
