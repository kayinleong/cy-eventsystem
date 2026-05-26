// Phase 2 — /reports/out route (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-02 — items currently checked out across active events.
//   - REP-06 — sort/page/filter state is URL-synced.
//   - REP-07 — 50 rows per page (cursor window).
//
// Strategy: get cursor-paged checkout transactions, then filter client-side
// (in ItemsOutTable) to those whose `id` is NOT referenced by any checkin's
// `parentTxId`. Same pattern as EventAssignedItemsTab (02-08).

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { requireSession } from "@/lib/auth/dal";
import { getTransactionsPage } from "@/lib/data/transactions.server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ItemsOutTable } from "@/components/feature/reports/ItemsOutTable";

export const metadata: Metadata = { title: "Items out" };

type RouteProps = {
  searchParams: Promise<{ cursor?: string; eventId?: string }>;
};

export default async function ItemsOutPage({ searchParams }: RouteProps) {
  await requireSession();
  const p = await searchParams;
  const { transactions, nextCursor } = await getTransactionsPage({
    cursor: p.cursor ?? null,
    filters: { type: "checkout", eventId: p.eventId },
    limit: 50,
  });
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
      <ItemsOutTable initialCheckouts={transactions} nextCursor={nextCursor} />
    </div>
  );
}
