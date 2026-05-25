// /login — sign-in page (Server Component shell + client form island).
//
// AUTH-01 — primary sign-in route.
//
// Phase 2: form submits via Firebase signInWithEmailAndPassword + POST to
// /api/auth/session. The proxy.ts authMiddleware intercepts the POST and
// mints the HMAC-signed __session cookie. The POC seed-users disclosure was
// removed (Phase 1 D-08 affordance is gone in Phase 2 per AUTH-06).
//
// UI-SPEC primary CTA: "Sign in".

import type { Metadata } from "next";
import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use your work email and password.</p>
      </header>
      <LoginForm />
    </div>
  );
}
