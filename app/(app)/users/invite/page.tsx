// Phase 1 — /users/invite admin-only full-page invite form route.
//
// REQUIREMENTS:
//   - AUTH-07 — admin-only invite entry; full-page form per UI-SPEC "Layout &
//     Route Patterns" (full-page route for `/users/new` invite).
//   - AUTH-10 — admin-only.
//
// CONTEXT.md D-07 — strict admin gate. Staff hitting this URL directly is
// redirected to /unauthorized by requireAdmin().
//
// The form lives in a colocated client component (`_components/invite-user-
// page-form.tsx`) so the page itself stays a Server Component (SSR'd title,
// requireAdmin gate, no client bundle for chrome).

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { InviteUserPageForm } from "./_components/invite-user-page-form";

export const metadata: Metadata = { title: "Invite user" };

export default async function InviteUserPage() {
  await requireAdmin();
  return (
    <div className="space-y-4 max-w-md">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/users">
          <ChevronLeft className="mr-1 size-4" />
          Back to users
        </Link>
      </Button>
      <PageHeader
        title="Invite user"
        description="They'll receive a sign-in link."
      />
      <Card>
        <CardContent className="p-6">
          <InviteUserPageForm />
        </CardContent>
      </Card>
    </div>
  );
}
