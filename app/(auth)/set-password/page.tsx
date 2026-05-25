// /set-password — complete an invite or reset link.
//
// AUTH-04 — Phase 2: form verifies oobCode via Firebase, applies the new
// password via confirmPasswordReset, and auto-signs the user in per D-08.
//
// The SetPasswordForm calls useSearchParams() to read `?oobCode=...`. Next 16
// requires a <Suspense> boundary around any client component using
// useSearchParams() so the page can prerender — without it the static build
// fails the CSR bailout check.

import { Suspense } from "react";
import type { Metadata } from "next";
import { SetPasswordForm } from "./_components/set-password-form";

export const metadata: Metadata = { title: "Set password" };

export default function SetPasswordPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-lg font-semibold">Set password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password (at least 8 characters).
        </p>
      </header>
      <Suspense
        fallback={
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        }
      >
        <SetPasswordForm />
      </Suspense>
    </div>
  );
}
