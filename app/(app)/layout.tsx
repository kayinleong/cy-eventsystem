// (app) layout — role gate spine for every authenticated route.
//
// CONTEXT.md D-05/D-07 — reads the mock_session cookie via the Phase 1
// server helper (requireSession), redirects to /login if missing or disabled.
// Per-route admin gates (requireAdmin) are imposed by individual admin-only
// pages (`/users`, `/users/invite`, `/inventory/new`, `/inventory/[id]/edit`,
// `/events/new`) and bounce the user to `/unauthorized` (this group's
// unauthorized page) rather than back to /login.
//
// Server Component — MUST NOT have `'use client'`. Next 16's async cookies()
// is invoked inside `requireSession()`.
//
// Phase 2 swap surface: only the body of `requireSession()` changes (cookie
// decoder swaps from JSON.parse to next-firebase-auth-edge verifyTokens()).
// The layout's JSX and the AppSidebar/TopBar contracts stay identical.

import { requireSession } from "@/lib/auth/mock-session";
import { AppSidebar } from "@/components/feature/shell/AppSidebar";
import { TopBar } from "@/components/feature/shell/TopBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-svh">
      <AppSidebar role={session.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar session={session} />
        <main className="flex-1 max-w-350 w-full mx-auto px-4 md:px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
