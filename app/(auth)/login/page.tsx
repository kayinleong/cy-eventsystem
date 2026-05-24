// /login — sign-in page (Server Component shell + client form island).
//
// AUTH-01 — primary sign-in route. CONTEXT.md D-08: look up against
// lib/mock/users.ts; all seed users share password "password" (Phase 1 only).
// CONTEXT.md D-05: writes the non-httpOnly `mock_session` cookie.
//
// UI-SPEC primary CTA: "Sign in". Includes the POC seed-users disclosure
// per "Shared #9" (PATTERNS.md lines 1184-1186).
//
// Phase 2: replaces the form's mutation handler with Firebase
// signInWithEmailAndPassword + session cookie POST to /api/auth/session.

import type { Metadata } from "next";
import { LoginForm } from "./_components/login-form";
import { SeedUsersDisclosure } from "./_components/seed-users-disclosure";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use your work email and password.</p>
      </header>
      <LoginForm />
      <SeedUsersDisclosure />
    </div>
  );
}
