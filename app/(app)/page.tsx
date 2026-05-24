// Phase 1 dashboard route — `/`.
//
// CONTEXT.md D-07 — this route lives in the (app) route group so the
// `(app)/layout.tsx` role gate (Plan 04) runs first and redirects anonymous
// users to /login. `getMockSession()` here never returns null at runtime
// because the layout has already required a session — we use it only to
// greet the user by first name.
//
// Server Component shell that composes the 5 client widgets built in Plan
// 01-05 Task 1. Widgets subscribe to the mock store via
// useSyncExternalStore — any later-plan mutation (checkout, checkin,
// resolveMissing, markLowStockOrdered) causes them to re-render with fresh
// values. PageHeader is the UI-SPEC primitive from Plan 03.

import type { Metadata } from "next";

import { getMockSession } from "@/lib/auth/mock-session";
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
