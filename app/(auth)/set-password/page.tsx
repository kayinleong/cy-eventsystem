// /set-password — complete an invite or reset link.
//
// AUTH-04 — Phase 1 only shows a sonner toast and routes back to /login.
// Phase 2: signed-link verification + Firebase updatePassword.

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
      <SetPasswordForm />
    </div>
  );
}
