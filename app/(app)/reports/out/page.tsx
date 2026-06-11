// Phase 2 — /reports/out route (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-02 — items currently checked out across active events.
//   - REP-06 — sort/page/filter state is URL-synced.
//   - REP-07 — 50 rows per page (cursor window).
//
// Strategy (quick-kayinleong-020): get the cursor-paged checkout transactions,
// then derive open-only SERVER-SIDE — fetch the checkin transactions whose
// `parentTxId` references a checkout in this page and subtract them. Previously
// open-only was derived from a client onSnapshot listener inside ItemsOutTable;
// that listener clobbered the cursor seed (broke Next) and doubled reads, so it
// was dropped. The open-only set must therefore be computed here so already
// returned checkouts don't reappear. nextCursor stays the checkout page cursor.

import type { Metadata } from "next";
import { Download } from "lucide-react";

import { requireSession } from "@/lib/auth/dal";
import { getTransactionsPage } from "@/lib/data/transactions.server";
import { getOpenCheckoutIdsForCheckouts } from "@/lib/data/transactions.server";
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
  // Subtract checkouts that already have a matching checkin (open-only).
  const closedIds = await getOpenCheckoutIdsForCheckouts(
    transactions.map((t) => t.id),
  );
  const openCheckouts = transactions.filter((t) => !closedIds.has(t.id));
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
      <ItemsOutTable initialCheckouts={openCheckouts} nextCursor={nextCursor} />
    </div>
  );
}
