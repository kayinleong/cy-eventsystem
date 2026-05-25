// Dashboard route — `/`.
//
// This route lives in the (app) route group so the `(app)/layout.tsx` role
// gate runs first and redirects anonymous users to /login. `getSession()`
// here never returns null at runtime because the layout has already
// required a session — we use it only to greet the user by first name.
//
// Server Component shell that composes the 5 client widgets. Widgets still
// subscribe to the mock store via useSyncExternalStore in this plan — the
// dashboard real-time swap to Firestore count() aggregations + live hooks
// is plan 02-10 (Block G). PageHeader is the UI-SPEC primitive from Plan 03.

import type { Metadata } from "next";

import { getSession as getMockSession } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCards } from "@/components/feature/dashboard/KpiCards";
import { ActiveEventsWidget } from "@/components/feature/dashboard/ActiveEventsWidget";
import { LowStockWidget } from "@/components/feature/dashboard/LowStockWidget";
import { OverdueReturnsWidget } from "@/components/feature/dashboard/OverdueReturnsWidget";
import { RecentActivityFeed } from "@/components/feature/dashboard/RecentActivityFeed";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getMockSession();
  const greeting = session?.displayName.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${greeting}`}
        description="Active events, stock alerts, and recent activity at a glance."
      />
      <KpiCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActiveEventsWidget />
        <LowStockWidget />
        <OverdueReturnsWidget />
        <RecentActivityFeed />
      </div>
    </div>
  );
}
