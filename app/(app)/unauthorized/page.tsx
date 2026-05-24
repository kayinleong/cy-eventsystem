// /unauthorized — landed when a staff user hits an admin-only route (D-07).
//
// AUTH-10 — admin gating. The route is inside the (app) group so the
// authenticated shell (sidebar + topbar) is preserved; just the body shows
// the empty-state explanation.
//
// We reuse the UI-SPEC EmptyState primitive (Plan 03) and the ShieldAlert
// lucide icon to signal "access denied" without using the destructive token
// reserved for actually-destructive actions.

import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Unauthorized" };

export default function UnauthorizedPage() {
  return (
    <EmptyState
      icon={ShieldAlert}
      heading="Unauthorized"
      body="You don't have permission to view this page. Switch to an admin role or contact your administrator."
      action={
        <Button asChild variant="outline">
          <Link href="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
