// Phase 2 — /reports/history route (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-04 — global transaction log with filters: type, event, item, actor.
//   - REP-06 — every filter / sort / page state is URL-synced.
//   - REP-07 — 50 rows per page (cursor window).
//
// Phase 2 swap: getTransactionsPage SSR seed → HistoryTable + useTransactionsLive.

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { requireSession } from "@/lib/auth/dal";
import { getTransactionsPage } from "@/lib/data/transactions.server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { HistoryTable } from "@/components/feature/reports/HistoryTable";

export const metadata: Metadata = { title: "History" };

type RouteProps = {
  searchParams: Promise<{
    cursor?: string;
    type?: string;
    eventId?: string;
    itemId?: string;
    actorUid?: string;
  }>;
};

export default async function HistoryReportPage({ searchParams }: RouteProps) {
  await requireSession();
  const p = await searchParams;
  const { transactions, nextCursor } = await getTransactionsPage({
    cursor: p.cursor ?? null,
    filters: {
      type: p.type,
      eventId: p.eventId,
      itemId: p.itemId,
      actorUid: p.actorUid,
    },
    limit: 50,
  });
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
      <HistoryTable initial={transactions} nextCursor={nextCursor} />
    </div>
  );
}
