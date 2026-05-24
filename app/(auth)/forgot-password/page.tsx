// /forgot-password — request a password reset link.
//
// AUTH-03 — Phase 1 only shows a sonner toast and routes back to /login.
// Phase 2 swaps to Firebase generatePasswordResetLink + email delivery.

import type { Metadata } from "next";
import { ForgotPasswordForm } from "./_components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-lg font-semibold">Forgot password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </header>
      <ForgotPasswordForm />
    </div>
  );
}
