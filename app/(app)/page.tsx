// Dashboard route — `/`.
//
// This route lives in the (app) route group so the `(app)/layout.tsx` role
// gate runs first and redirects anonymous users to /login. `requireSession()`
// here additionally narrows the session type for the widgets.
//
// Phase 2 (Block G — plan 02-10):
//   - KpiCards: 4 Firestore count() aggregations per D-21 (no .reduce()).
//   - LowStockWidget: SSR-seeded via getInventoryPage({isLowStock:true}) +
//     useInventoryLive takes over for live updates (D-20 50-row window).
//   - ActiveEventsWidget / OverdueReturnsWidget: SSR-seeded via getEventsPage
//     (EVT-08 enforced) + useEventsLive (Block D — plan 02-07).
//   - RecentActivityFeed: useTransactionsLive scoped to limit=20.

import type { Metadata } from "next";

import { requireSession } from "@/lib/auth/dal";
import { getDashboardKpis } from "@/lib/data/aggregations.server";
import { getEventsPage } from "@/lib/data/events.server";
import { getInventoryPage } from "@/lib/data/inventory.server";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCards } from "@/components/feature/dashboard/KpiCards";
import { ActiveEventsWidget } from "@/components/feature/dashboard/ActiveEventsWidget";
import { LowStockWidget } from "@/components/feature/dashboard/LowStockWidget";
import { OverdueReturnsWidget } from "@/components/feature/dashboard/OverdueReturnsWidget";
import { RecentActivityFeed } from "@/components/feature/dashboard/RecentActivityFeed";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  const greeting = session.displayName.split(" ")[0] ?? "there";

  // Parallelize: 4 count() aggregations + active-events seed + low-stock seed.
  // EVT-08 enforced inside getEventsPage. Limit caps match the widget D-20
  // listener-window sizes.
  const [kpis, activeSeed, lowStockSeed] = await Promise.all([
    getDashboardKpis(),
    getEventsPage({ filters: { status: "active" }, limit: 10, session }),
    getInventoryPage({ filters: { isLowStock: true }, limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${greeting}`}
        description="Active events, stock alerts, and recent activity at a glance."
      />
      <KpiCards
        totalItems={kpis.totalItems}
        itemsOut={kpis.itemsOut}
        lowStockCount={kpis.lowStockCount}
        activeEvents={kpis.activeEvents}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActiveEventsWidget initial={activeSeed.events} session={session} />
        <LowStockWidget initialItems={lowStockSeed.items} />
        <OverdueReturnsWidget initial={activeSeed.events} session={session} />
        <RecentActivityFeed />
      </div>
    </div>
  );
}
