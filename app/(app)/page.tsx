// Dashboard route — `/`.
//
// This route lives in the (app) route group so the `(app)/layout.tsx` role
// gate runs first and redirects anonymous users to /login. `requireSession()`
// here additionally narrows the session type for the widgets — at runtime
// the layout has already required a session, so we just re-read the cached
// React.cache result.
//
// Server Component shell that composes the dashboard widgets. The events
// widgets (Active + Overdue) take an SSR seed + session via plan 02-07
// (Block D); KPI / LowStock / RecentActivity widgets stay on the legacy
// mock-store pattern in this plan — those swap in plan 02-10 (Block G).

import type { Metadata } from "next";

import { requireSession } from "@/lib/auth/dal";
import { getEventsPage } from "@/lib/data/events.server";
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

  // SSR-seed active events (the widget filters to "active" via the live
  // hook query; we seed the same slice). EVT-08 enforced in getEventsPage.
  // Cap at 10 — the widget shows a compact list.
  const { events: activeSeed } = await getEventsPage({
    filters: { status: "active" },
    limit: 10,
    session,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${greeting}`}
        description="Active events, stock alerts, and recent activity at a glance."
      />
      <KpiCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActiveEventsWidget initial={activeSeed} session={session} />
        <LowStockWidget />
        <OverdueReturnsWidget initial={activeSeed} session={session} />
        <RecentActivityFeed />
      </div>
    </div>
  );
}
