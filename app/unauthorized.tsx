// Phase 2 — Plan 02-12 — Wave 11 Block H — AUTH-10
// Top-level unauthorized.tsx — paired with Next 16's `unauthorized()`
// navigation function (next/navigation). When `unauthorized()` is invoked,
// Next renders the nearest unauthorized.tsx going up the tree AND returns
// a 401 status code.
//
// IMPORTANT: This file lives at app/unauthorized.tsx (top-level, outside
// the (app) route group) so it can pair with `unauthorized()` calls from
// ANY route — including unauthenticated areas. The existing
// app/(app)/unauthorized/page.tsx is a REGULAR ROUTE for the current
// redirect("/unauthorized") flow used by lib/auth/dal.ts requireAdmin()
// (which has not switched to `unauthorized()` because that function is
// still experimental in Next 16 and requires experimental.authInterrupts).
//
// Both coexist intentionally:
//   - app/(app)/unauthorized/page.tsx      → target of redirect("/unauthorized")
//   - app/unauthorized.tsx (this file)     → target of unauthorized() call
//
// When the DAL graduates to `unauthorized()` (post-v1), the (app)/unauthorized
// route can be deleted; until then the surfaces are intentionally redundant.
//
// HTML hygiene: at top level (no parent layout's <main>), so this CAN use
// <main> as the page-level landmark.

import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Unauthorized" };

export default function Unauthorized() {
  return (
    <main className="min-h-svh grid place-items-center px-4 py-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="text-muted-foreground">
          You don&apos;t have access to this page. Contact an admin if you
          think this is a mistake.
        </p>
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
