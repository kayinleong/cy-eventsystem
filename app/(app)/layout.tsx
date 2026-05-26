// (app) layout — role gate spine for every authenticated route.
//
// Reads the __session cookie via the Phase 2 DAL (requireSession), redirects
// to /login if missing or disabled. Per-route admin gates (requireAdmin) are
// imposed by individual admin-only pages (`/users`, `/users/invite`,
// `/inventory/new`, `/inventory/[id]/edit`, `/events/new`) and bounce the
// user to `/unauthorized` (this group's unauthorized page) rather than back
// to /login.
//
// Server Component — MUST NOT have `'use client'`. Next 16's async cookies()
// is invoked inside `requireSession()`.
//
// The layout's JSX and the AppSidebar/TopBar contracts stay identical to
// Phase 1 — only the requireSession() import path swaps to the real DAL.

import { requireSession } from "@/lib/auth/dal";
import { AppSidebar } from "@/components/feature/shell/AppSidebar";
import { TopBar } from "@/components/feature/shell/TopBar";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-svh flex-col">
      {/* RES-02 — global offline banner. Renders null when navigator.onLine
          is true so it has zero visual cost in the steady state. */}
      <OfflineBanner />
      <div className="flex flex-1 min-h-0">
        <AppSidebar role={session.role} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar session={session} />
          <main className="flex-1 max-w-350 w-full mx-auto px-4 md:px-6 py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
