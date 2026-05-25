---
phase: phase-kayinleong-02
plan: 03
type: execute
wave: 3
depends_on:
  - 02
files_modified:
  - app/(auth)/login/_components/login-form.tsx
  - app/(auth)/login/page.tsx
  - app/(auth)/forgot-password/_components/forgot-password-form.tsx
  - app/(auth)/set-password/_components/set-password-form.tsx
  - app/(auth)/register/page.tsx
  - app/(app)/layout.tsx
  - app/(app)/page.tsx
  - app/(app)/settings/page.tsx
  - components/feature/auth/SignOutButton.tsx
  - components/feature/shell/UserMenu.tsx
  - lib/hooks/use-current-user.ts
  - scripts/seed-first-admin.ts
  - package.json
files_deleted:
  - components/feature/auth/PhaseOnePocRoleSwitcher.tsx
  - app/(auth)/login/_components/seed-users-disclosure.tsx
  - lib/auth/mock-session.ts
  - lib/mock/cookie.ts
autonomous: false
requirements:
  - AUTH-01
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - AUTH-10
  - INT-04
  - NFR-06

must_haves:
  truths:
    - "/login signs in via Firebase signInWithEmailAndPassword, POSTs ID token to /api/auth/session, and lands on /."
    - "/forgot-password calls sendPasswordResetEmail and shows generic success copy."
    - "/set-password verifies the oobCode, sets the password, auto-signs-in per D-08, and redirects to /."
    - "/register is unreachable (404) per AUTH-06."
    - "(app)/layout.tsx role gate uses lib/auth/dal.ts requireSession() instead of mock-session.ts."
    - "Sign-out button POSTs /api/auth/logout and hard-navigates to /login."
    - "lib/hooks/use-current-user.ts swaps mock-cookie reads for onAuthStateChanged."
    - "Phase 1 POC affordances PhaseOnePocRoleSwitcher and SeedUsersDisclosure are deleted."
    - "scripts/seed-first-admin.ts can be run once to seed the first admin user per D-05."
    - "No file in the repo imports from lib/mock/cookie or lib/auth/mock-session."
  artifacts:
    - path: "app/(auth)/login/_components/login-form.tsx"
      provides: "Login form calling Firebase signInWithEmailAndPassword + POST /api/auth/session"
      contains: "signInWithEmailAndPassword"
    - path: "app/(auth)/forgot-password/_components/forgot-password-form.tsx"
      provides: "Forgot-password form calling Firebase sendPasswordResetEmail"
      contains: "sendPasswordResetEmail"
    - path: "app/(auth)/set-password/_components/set-password-form.tsx"
      provides: "Set-password form: verifyPasswordResetCode + confirmPasswordReset + auto-sign-in"
      contains: "confirmPasswordReset"
    - path: "app/(app)/layout.tsx"
      provides: "Role gate via DAL"
      contains: "@/lib/auth/dal"
    - path: "components/feature/auth/SignOutButton.tsx"
      provides: "Real sign-out: POST /api/auth/logout"
      contains: "/api/auth/logout"
    - path: "lib/hooks/use-current-user.ts"
      provides: "Client hook backed by onAuthStateChanged"
      contains: "onAuthStateChanged"
    - path: "scripts/seed-first-admin.ts"
      provides: "Admin SDK one-shot to create the first admin user"
      contains: "setCustomUserClaims"
  key_links:
    - from: "app/(auth)/login/_components/login-form.tsx"
      to: "app/api/auth/session/route.ts"
      via: "POST /api/auth/session with Authorization: Bearer <idToken>"
      pattern: "fetch\\(.*['\\\"]/api/auth/session"
    - from: "app/(app)/layout.tsx"
      to: "lib/auth/dal.ts"
      via: "await requireSession() at top"
      pattern: "from \"@/lib/auth/dal\""
    - from: "components/feature/auth/SignOutButton.tsx"
      to: "app/api/auth/logout/route.ts"
      via: "POST /api/auth/logout then hard navigation to /login"
      pattern: "/api/auth/logout"
---

<objective>
**Wire the auth surface from Phase 1's mock-cookie path to real Firebase Auth + the DAL from 02-02.** Replace `signInWithEmailAndPassword` (was: `seedUsers.find`), wire the forgot/set-password flows, swap the `(app)/layout.tsx` role gate, replace SignOutButton with a real logout, delete the POC affordances, and ship `scripts/seed-first-admin.ts` so the developer can bootstrap the first admin user.

Per CONTEXT.md `<specifics>` line 203: "The mock cookie shape (`{uid, displayName, email, role, disabled}`) mirrors Firebase __session decoded shape (Phase 1 D-05). The `(app)/layout.tsx` role-gate logic stays; only the cookie-decoder swaps."

Purpose: The auth UI surface is locked from Phase 1's UI-SPEC.md. This plan does NOT change the rendered HTML/visual contract. It changes ONLY what happens on form submit and what backs the session check. Phase 1 verification gate stays valid after this plan.

Output: 12 files modified, 4 files deleted, 1 new script.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-02/02-CONTEXT.md
@.planning/phases/phase-kayinleong-02/02-RESEARCH.md
@.planning/phases/phase-kayinleong-02/02-PATTERNS.md
@.planning/phases/phase-kayinleong-02/02-01-spike-auth-edge-PLAN.md
@.planning/phases/phase-kayinleong-02/02-02-firebase-clients-and-proxy-PLAN.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-04-auth-shell-role-gate-SUMMARY.md
@app/(auth)/login/_components/login-form.tsx
@app/(auth)/login/page.tsx
@app/(auth)/login/_components/seed-users-disclosure.tsx
@app/(auth)/forgot-password/_components/forgot-password-form.tsx
@app/(auth)/set-password/_components/set-password-form.tsx
@app/(auth)/register/page.tsx
@app/(app)/layout.tsx
@app/(app)/page.tsx
@app/(app)/settings/page.tsx
@components/feature/auth/SignOutButton.tsx
@components/feature/auth/PhaseOnePocRoleSwitcher.tsx
@components/feature/shell/UserMenu.tsx
@lib/auth/mock-session.ts
@lib/auth/dal.ts
@lib/firebase/client.ts
@lib/firebase/admin.ts
@lib/hooks/use-current-user.ts
@lib/mock/cookie.ts
@lib/schemas/auth.ts
@lib/types/session.ts

<interfaces>
<!-- The DAL contract from 02-02 (re-stated for executor convenience): -->

```typescript
// lib/auth/dal.ts
export const verifySession: () => Promise<Session | null>;
export const getSession: () => Promise<Session | null>;  // alias
export const requireSession: () => Promise<Session>;
export const requireAdmin: () => Promise<Session>;
```

```typescript
// lib/firebase/client.ts
export const auth: Auth;  // Firebase Web SDK Auth instance
```

```typescript
// Phase 1 mock-cookie shape (the thing we are replacing):
// {uid, displayName, email, role, disabled}
// Same shape as decoded __session — only the source swaps.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Login form — Firebase signInWithEmailAndPassword + POST /api/auth/session</name>
  <files>
    app/(auth)/login/_components/login-form.tsx,
    app/(auth)/login/page.tsx
  </files>
  <read_first>
    - app/(auth)/login/_components/login-form.tsx (Phase 1 implementation — match the rhf + Zod + Field-primitive shape exactly; only the onSubmit body changes)
    - app/(auth)/login/page.tsx (Phase 1 — uses `<SeedUsersDisclosure/>` which we delete in Task 5)
    - app/(auth)/login/_components/seed-users-disclosure.tsx (will be deleted in Task 5; do not modify here)
    - lib/schemas/auth.ts (LoginSchema — keep unchanged)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §1.8 lines 405-444 (/login page swap)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §3 "lib/mock/cookie.ts (DELETE)" + §1 row "app/(auth)/login/_components/login-form.tsx"
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Primary CTA labels" (Sign in) + error copy section (lines 233-241)
    - lib/firebase/client.ts (the `auth` export from 02-02)
  </read_first>
  <action>
    **Step 1.1 — Rewrite `app/(auth)/login/_components/login-form.tsx`.**

    Keep the rhf form shell + Zod resolver + shadcn v4 `<Field>` primitives EXACTLY as Phase 1 wrote them. The ONLY change is `onSubmit` and the imports it needs. UI-SPEC error copy is preserved.

    Replace `onSubmit` (and its supporting imports) with:

    ```typescript
    "use client";

    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { signInWithEmailAndPassword } from "firebase/auth";
    import { useState } from "react";
    import { auth } from "@/lib/firebase/client";
    import { LoginSchema, type LoginValues } from "@/lib/schemas/auth";
    import { Field, FieldError, FieldLabel } from "@/components/ui/field";  // exact shadcn v4 path
    import { Input } from "@/components/ui/input";
    import { Button } from "@/components/ui/button";

    export function LoginForm() {
      const { register, handleSubmit, setError, formState } = useForm<LoginValues>({
        resolver: zodResolver(LoginSchema),
      });
      const [pending, setPending] = useState(false);

      async function onSubmit(values: LoginValues) {
        setPending(true);
        try {
          const cred = await signInWithEmailAndPassword(auth, values.email, values.password);
          const idToken = await cred.user.getIdToken();
          const res = await fetch("/api/auth/session", {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (!res.ok) throw new Error("session-create-failed");
          // Hard nav so proxy.ts re-evaluates with new cookie (RESEARCH §1.8 line 441).
          window.location.assign("/");
        } catch (err) {
          // Per UI-SPEC error copy section — single generic line regardless of cause
          // (security: don't leak whether email exists)
          setError("root", { message: "Invalid email or password." });
          setPending(false);
        }
      }

      return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* PRESERVE Phase 1 fields verbatim — only the onSubmit body changes.
              Substitute the existing <Field>/<FieldLabel>/<Input>/<FieldError> tree here
              from the original login-form.tsx file. The values registered on rhf
              are still `email` and `password`. */}

          {/* Example structural template — match Phase 1 exact tree: */}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="username" {...register("email")} />
            <FieldError>{formState.errors.email?.message}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            <FieldError>{formState.errors.password?.message}</FieldError>
          </Field>

          {formState.errors.root?.message ? (
            <p role="alert" className="text-sm text-destructive">{formState.errors.root.message}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      );
    }
    ```

    **CRITICAL:** Open the current `app/(auth)/login/_components/login-form.tsx` first. Preserve the EXACT JSX tree (links to /forgot-password, layout, spacing classes, autoComplete attributes). The only diff vs. Phase 1 is:
    - Remove imports: `seedUsers`, `writeMockSessionClient`, `useRouter`, `useTransition` (if used).
    - Add imports: `signInWithEmailAndPassword`, `auth` from `@/lib/firebase/client`.
    - Replace onSubmit body with the Firebase + fetch flow above.
    - Replace `router.push(...)` (or `router.replace(...)`) with `window.location.assign("/")` — hard nav is needed per RESEARCH §1.8 line 441 so proxy.ts sees the new cookie before the next prefetch.

    **Step 1.2 — Update `app/(auth)/login/page.tsx`** to remove the `<SeedUsersDisclosure/>` import + usage.

    Current Phase 1 likely has:
    ```typescript
    import { LoginForm } from "./_components/login-form";
    import { SeedUsersDisclosure } from "./_components/seed-users-disclosure";
    // ...
    <header>...</header>
    <LoginForm />
    <SeedUsersDisclosure />
    ```

    Replace with:
    ```typescript
    import { LoginForm } from "./_components/login-form";
    // ...
    <header>...</header>
    <LoginForm />
    ```

    Delete the import line and the `<SeedUsersDisclosure />` JSX node. NO OTHER CHANGES. The page header text + layout stay.
  </action>
  <acceptance_criteria>
    - `grep -q 'signInWithEmailAndPassword' app/\(auth\)/login/_components/login-form.tsx` succeeds.
    - `grep -q "/api/auth/session" app/\(auth\)/login/_components/login-form.tsx` succeeds.
    - `grep -q 'window.location.assign' app/\(auth\)/login/_components/login-form.tsx` succeeds.
    - `grep -q "@/lib/firebase/client" app/\(auth\)/login/_components/login-form.tsx` succeeds.
    - `grep -q "seedUsers" app/\(auth\)/login/_components/login-form.tsx` FAILS.
    - `grep -q "writeMockSessionClient" app/\(auth\)/login/_components/login-form.tsx` FAILS.
    - `grep -q "SeedUsersDisclosure" app/\(auth\)/login/page.tsx` FAILS (import removed).
    - `grep -q "<LoginForm" app/\(auth\)/login/page.tsx` succeeds (form still rendered).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q 'signInWithEmailAndPassword' "app/(auth)/login/_components/login-form.tsx" && grep -q "/api/auth/session" "app/(auth)/login/_components/login-form.tsx" && ! grep -q "seedUsers" "app/(auth)/login/_components/login-form.tsx" && ! grep -q "SeedUsersDisclosure" "app/(auth)/login/page.tsx" && npx tsc --noEmit</automated>
  </verify>
  <done>Login page calls real Firebase Auth. UI surface unchanged from Phase 1.</done>
</task>

<task type="auto">
  <name>Task 2: Forgot-password + set-password forms</name>
  <files>
    app/(auth)/forgot-password/_components/forgot-password-form.tsx,
    app/(auth)/set-password/_components/set-password-form.tsx,
    app/(auth)/register/page.tsx
  </files>
  <read_first>
    - app/(auth)/forgot-password/_components/forgot-password-form.tsx (Phase 1 implementation — toast-only stub)
    - app/(auth)/set-password/_components/set-password-form.tsx (Phase 1 implementation — toast-only stub)
    - app/(auth)/register/page.tsx (Phase 1 — calls notFound())
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §1.9 lines 447-473 (/forgot-password and /set-password swap)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-08 (auto-sign-in after set-password)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 rows "app/(auth)/forgot-password/page.tsx" + "app/(auth)/set-password/page.tsx" + "app/(auth)/register/page.tsx"
    - lib/schemas/auth.ts (ForgotPasswordSchema, SetPasswordSchema)
    - lib/firebase/client.ts (auth export from 02-02)
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Primary CTA labels" (Send reset link / Set password)
  </read_first>
  <action>
    **Step 2.1 — Rewrite `app/(auth)/forgot-password/_components/forgot-password-form.tsx` onSubmit:**

    Keep the Phase 1 rhf form + Zod + Field primitives shell EXACTLY. Replace the toast-only onSubmit with:

    ```typescript
    "use client";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { sendPasswordResetEmail } from "firebase/auth";
    import { useState } from "react";
    import { toast } from "sonner";
    import { auth } from "@/lib/firebase/client";
    import { ForgotPasswordSchema, type ForgotPasswordValues } from "@/lib/schemas/auth";
    // ... Field/Input/Button imports identical to Phase 1 ...

    export function ForgotPasswordForm() {
      const { register, handleSubmit, formState } = useForm<ForgotPasswordValues>({
        resolver: zodResolver(ForgotPasswordSchema),
      });
      const [pending, setPending] = useState(false);
      const [sent, setSent] = useState(false);

      async function onSubmit(values: ForgotPasswordValues) {
        setPending(true);
        try {
          // Per RESEARCH §1.9: Firebase auto-sends via the default template
          // (Auth Console → Templates → "Password reset"). D-07 confirms.
          await sendPasswordResetEmail(auth, values.email);
        } catch {
          // Security: do NOT differentiate user-not-found from network errors
        }
        // Always show generic success — RESEARCH §1.9 "Generic success copy regardless of email existence"
        setSent(true);
        setPending(false);
        toast.success("Reset link sent if account exists.");
      }

      if (sent) {
        return (
          <div className="space-y-2 text-sm">
            <p>If an account exists for that email, a reset link has been sent.</p>
            <p className="text-muted-foreground">Check your inbox and spam folder.</p>
            <a className="underline" href="/login">Back to sign in</a>
          </div>
        );
      }

      return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* PRESERVE Phase 1 field tree exactly */}
          {/* ... <Field>email</Field> ... */}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      );
    }
    ```

    Preserve all Phase 1 JSX nodes EXCEPT the success branch — the empty-state copy comes from UI-SPEC.

    **Step 2.2 — Rewrite `app/(auth)/set-password/_components/set-password-form.tsx`:**

    Per RESEARCH §1.9 lines 454-471 + D-08 (auto-sign-in):

    ```typescript
    "use client";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import {
      verifyPasswordResetCode,
      confirmPasswordReset,
      signInWithEmailAndPassword,
    } from "firebase/auth";
    import { useState, useEffect } from "react";
    import { useSearchParams } from "next/navigation";
    import { auth } from "@/lib/firebase/client";
    import { SetPasswordSchema, type SetPasswordValues } from "@/lib/schemas/auth";
    // ... Field/Input/Button imports identical to Phase 1 ...

    export function SetPasswordForm() {
      const params = useSearchParams();
      const oobCode = params?.get("oobCode") ?? null;
      const { register, handleSubmit, setError, formState } = useForm<SetPasswordValues>({
        resolver: zodResolver(SetPasswordSchema),
      });
      const [pending, setPending] = useState(false);
      const [codeError, setCodeError] = useState<string | null>(null);

      // Validate the oobCode on mount so we can show "expired link" copy
      useEffect(() => {
        if (!oobCode) {
          setCodeError("This link is invalid. Request a new one.");
          return;
        }
        verifyPasswordResetCode(auth, oobCode).catch(() => {
          setCodeError("This link has expired. Request a new one.");
        });
      }, [oobCode]);

      async function onSubmit(values: SetPasswordValues) {
        if (!oobCode) return;
        setPending(true);
        try {
          // Get the email associated with the oobCode (needed for auto-sign-in)
          const email = await verifyPasswordResetCode(auth, oobCode);
          // Apply the new password
          await confirmPasswordReset(auth, oobCode, values.password);
          // D-08: auto-sign-in + redirect
          const cred = await signInWithEmailAndPassword(auth, email, values.password);
          const idToken = await cred.user.getIdToken();
          const res = await fetch("/api/auth/session", {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (!res.ok) throw new Error("session-create-failed");
          window.location.assign("/");
        } catch {
          setError("root", { message: "Couldn't set your password. Try again or request a new link." });
          setPending(false);
        }
      }

      if (codeError) {
        return (
          <div className="space-y-2 text-sm">
            <p role="alert" className="text-destructive">{codeError}</p>
            <a className="underline" href="/forgot-password">Request a new link</a>
          </div>
        );
      }

      return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* PRESERVE Phase 1 field tree exactly — password + confirm */}
          <Button type="submit" className="w-full" disabled={pending || !oobCode}>
            {pending ? "Setting password…" : "Set password"}
          </Button>
        </form>
      );
    }
    ```

    Preserve the Phase 1 JSX for password/confirm fields.

    **Step 2.3 — `app/(auth)/register/page.tsx`** stays as Phase 1 wrote it: `notFound()` per AUTH-06. No changes needed. If Phase 1 didn't ship this as a 404, ensure it is:

    ```typescript
    import { notFound } from "next/navigation";
    export default function RegisterPage() {
      notFound();
    }
    ```

    Verify the file's current contents first; only modify if it's currently rendering a form.
  </action>
  <acceptance_criteria>
    - `grep -q "sendPasswordResetEmail" app/\(auth\)/forgot-password/_components/forgot-password-form.tsx` succeeds.
    - `grep -q "auth/forgot-password" app/\(auth\)/forgot-password/_components/forgot-password-form.tsx` FAILS (no path-specific copy leaking) — instead the "back to sign in" link is `/login`; `grep -q '"/login"' app/\(auth\)/forgot-password/_components/forgot-password-form.tsx` succeeds.
    - `grep -q "confirmPasswordReset" app/\(auth\)/set-password/_components/set-password-form.tsx` succeeds.
    - `grep -q "verifyPasswordResetCode" app/\(auth\)/set-password/_components/set-password-form.tsx` succeeds.
    - `grep -q "signInWithEmailAndPassword" app/\(auth\)/set-password/_components/set-password-form.tsx` succeeds (D-08 auto-sign-in).
    - `grep -q "window.location.assign" app/\(auth\)/set-password/_components/set-password-form.tsx` succeeds.
    - `grep -q "notFound" app/\(auth\)/register/page.tsx` succeeds (AUTH-06).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "sendPasswordResetEmail" "app/(auth)/forgot-password/_components/forgot-password-form.tsx" && grep -q "confirmPasswordReset" "app/(auth)/set-password/_components/set-password-form.tsx" && grep -q "signInWithEmailAndPassword" "app/(auth)/set-password/_components/set-password-form.tsx" && grep -q "notFound" "app/(auth)/register/page.tsx" && npx tsc --noEmit</automated>
  </verify>
  <done>Forgot + set-password flows live; AUTH-03, AUTH-04, AUTH-06 all wired against real Firebase Auth.</done>
</task>

<task type="auto">
  <name>Task 3: (app)/layout.tsx role gate + use-current-user hook + Server Components swap</name>
  <files>
    app/(app)/layout.tsx,
    app/(app)/page.tsx,
    app/(app)/settings/page.tsx,
    lib/hooks/use-current-user.ts
  </files>
  <read_first>
    - app/(app)/layout.tsx (Phase 1: imports requireSession from lib/auth/mock-session)
    - app/(app)/page.tsx (Phase 1: imports getMockSession; dashboard renders KpiCards + widgets)
    - app/(app)/settings/page.tsx (Phase 1: imports getMockSession)
    - lib/hooks/use-current-user.ts (Phase 1: subscribes to mock cookie via readMockSessionClient + listeners)
    - lib/auth/mock-session.ts (the Phase 1 module; getMockSession / requireSession / requireAdmin exports)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 rows "app/(app)/layout.tsx", "app/(app)/page.tsx", "app/(app)/settings/page.tsx"
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 row "lib/hooks/use-current-user.ts (REPLACE body, KEEP signature)"
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §1.7 lines 384-403 ((app)/layout.tsx role gate)
    - lib/types/session.ts (Session type)
    - lib/firebase/client.ts (auth export)
  </read_first>
  <action>
    **Step 3.1 — `app/(app)/layout.tsx` — swap import only.**

    Open the current file. The body should reference `requireSession()`. Change the import line:

    ```typescript
    // BEFORE (Phase 1):
    import { requireSession } from "@/lib/auth/mock-session";

    // AFTER (Phase 2):
    import { requireSession } from "@/lib/auth/dal";
    ```

    Nothing else changes. The function signature is identical (both return `Promise<Session>`). PATTERNS §1 confirms: "Swap `requireSession` import from `@/lib/auth/mock-session` → `@/lib/auth/dal`. Body unchanged; only the imported helper differs."

    **Step 3.2 — `app/(app)/page.tsx` (dashboard)** — swap `getMockSession` import to `getSession` (or `verifySession`) from DAL.

    The dashboard greeter likely reads `session.displayName`. Keep that exact code; only swap the import:

    ```typescript
    // BEFORE:
    import { getMockSession } from "@/lib/auth/mock-session";
    // AFTER:
    import { getSession } from "@/lib/auth/dal";
    ```

    If the body uses `getMockSession()` directly, rename the call to `getSession()`. Or alias on the import line to avoid touching the body:

    ```typescript
    import { getSession as getMockSession } from "@/lib/auth/dal";
    ```

    The alias is the minimal diff; PATTERNS §1 confirms identical shape.

    NOTE: The dashboard KPI cards switch from `.reduce()` to Firestore `count()` aggregations per D-21 — but that's plan 02-10 (Block G), not this plan. For now the KpiCards still render against mock-store; that gets re-wired in 02-10.

    **Step 3.3 — `app/(app)/settings/page.tsx`** — same pattern. Swap `getMockSession` → `getSession` (with or without alias). No body changes.

    **Step 3.4 — `lib/hooks/use-current-user.ts` — swap body, keep signature.**

    Per PATTERNS §1 row "lib/hooks/use-current-user.ts (REPLACE body, KEEP signature)" + RESEARCH §1 "research/STACK.md line 287 onAuthStateChanged subscription":

    ```typescript
    "use client";
    // lib/hooks/use-current-user.ts
    // Phase 2: swap mock-cookie subscription for onAuthStateChanged.
    // Signature `useCurrentUser(): Session | null` is preserved — all 13 consumers
    // re-render correctly.

    import { useEffect, useState } from "react";
    import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";
    import { auth } from "@/lib/firebase/client";
    import type { Session } from "@/lib/types/session";

    export function useCurrentUser(): Session | null {
      const [session, setSession] = useState<Session | null>(null);

      useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            setSession(null);
            return;
          }
          // Read role from custom claims (set by Cloud Function 1 — plan 02-04).
          // Fresh users whose ID token predates the function execution see role
          // as undefined; the DAL handles that server-side, but the client may
          // briefly see staff-default. Fine for v1.
          const tokenResult = await getIdTokenResult(user);
          const claims = tokenResult.claims as { role?: "admin" | "staff" };
          setSession({
            uid: user.uid,
            email: user.email ?? "",
            displayName: user.displayName ?? user.email ?? "Unknown",
            role: claims.role ?? "staff",
            disabled: false,
          });
        });
        return () => unsubscribe();
      }, []);

      return session;
    }
    ```

    **DO NOT** keep the `useSyncExternalStore` shell here — PATTERNS §1 explicitly mentions that the body changes. The signature stays.

    All 13 callers reference `useCurrentUser(): Session | null` — that's preserved.
  </action>
  <acceptance_criteria>
    - `grep -q "from \"@/lib/auth/dal\"" "app/(app)/layout.tsx"` succeeds.
    - `grep -q "from \"@/lib/auth/mock-session\"" "app/(app)/layout.tsx"` FAILS.
    - `grep -q "from \"@/lib/auth/dal\"" "app/(app)/page.tsx"` succeeds.
    - `grep -q "from \"@/lib/auth/mock-session\"" "app/(app)/page.tsx"` FAILS.
    - `grep -q "from \"@/lib/auth/dal\"" "app/(app)/settings/page.tsx"` succeeds.
    - `grep -q "onAuthStateChanged" lib/hooks/use-current-user.ts` succeeds.
    - `grep -q "readMockSessionClient" lib/hooks/use-current-user.ts` FAILS.
    - `grep -q "export function useCurrentUser" lib/hooks/use-current-user.ts` succeeds (signature preserved).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "from \"@/lib/auth/dal\"" "app/(app)/layout.tsx" && ! grep -q "from \"@/lib/auth/mock-session\"" "app/(app)/layout.tsx" && grep -q "onAuthStateChanged" lib/hooks/use-current-user.ts && ! grep -q "readMockSessionClient" lib/hooks/use-current-user.ts && npx tsc --noEmit</automated>
  </verify>
  <done>(app)/layout.tsx + dashboard + settings + useCurrentUser all backed by real Firebase Auth. UI surface unchanged.</done>
</task>

<task type="auto">
  <name>Task 4: SignOutButton + UserMenu cleanup</name>
  <files>
    components/feature/auth/SignOutButton.tsx,
    components/feature/shell/UserMenu.tsx
  </files>
  <read_first>
    - components/feature/auth/SignOutButton.tsx (Phase 1: calls clearMockSessionClient + router.push)
    - components/feature/shell/UserMenu.tsx (Phase 1: imports PhaseOnePocRoleSwitcher and renders it; about to be deleted in Task 5)
    - components/feature/auth/PhaseOnePocRoleSwitcher.tsx (Phase 1 POC affordance — about to be deleted)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 row "components/feature/auth/SignOutButton.tsx", §3 "components/feature/auth/PhaseOnePocRoleSwitcher.tsx (DELETE)"
  </read_first>
  <action>
    **Step 4.1 — `components/feature/auth/SignOutButton.tsx` — replace mock cookie clear with real logout:**

    ```typescript
    "use client";
    import { useTransition } from "react";
    import { useRouter } from "next/navigation";
    import { signOut } from "firebase/auth";
    import { auth } from "@/lib/firebase/client";
    import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
    import { LogOut } from "lucide-react";

    export function SignOutButton() {
      const router = useRouter();
      const [pending, startTransition] = useTransition();

      function handleClick() {
        startTransition(async () => {
          // 1. Revoke server-side + clear cookie
          await fetch("/api/auth/logout", { method: "POST" });
          // 2. Sign out Web SDK client (clears in-memory user)
          await signOut(auth).catch(() => { /* best-effort */ });
          // 3. Hard nav so proxy.ts re-evaluates with cleared cookie
          window.location.assign("/login");
        });
      }

      return (
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); handleClick(); }}
          variant="destructive"
          disabled={pending}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      );
    }
    ```

    Match the Phase 1 DropdownMenuItem destructive variant pattern; just swap the body. UI-SPEC parity preserved.

    **Step 4.2 — `components/feature/shell/UserMenu.tsx` — remove `<PhaseOnePocRoleSwitcher/>` import + usage.**

    Open the file. Phase 1 has lines like:

    ```typescript
    import { PhaseOnePocRoleSwitcher } from "@/components/feature/auth/PhaseOnePocRoleSwitcher";
    // ...
    <DropdownMenuContent>
      ...
      <PhaseOnePocRoleSwitcher />
      ...
      <SignOutButton />
    </DropdownMenuContent>
    ```

    Delete the import line and the JSX node. Per PATTERNS §3: "Remove both lines. No replacement — role switching is no longer a UI affordance; admins promote/demote via /users page."

    All other items in the UserMenu (avatar, display name, role badge, "Settings" link, "Sign out") stay exactly as Phase 1 wrote them.
  </action>
  <acceptance_criteria>
    - `grep -q "/api/auth/logout" components/feature/auth/SignOutButton.tsx` succeeds.
    - `grep -q "clearMockSessionClient" components/feature/auth/SignOutButton.tsx` FAILS.
    - `grep -q "signOut(auth)" components/feature/auth/SignOutButton.tsx` succeeds.
    - `grep -q "PhaseOnePocRoleSwitcher" components/feature/shell/UserMenu.tsx` FAILS (import + JSX removed).
    - `grep -q "<SignOutButton" components/feature/shell/UserMenu.tsx` succeeds (still rendered).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "/api/auth/logout" components/feature/auth/SignOutButton.tsx && grep -q "signOut(auth)" components/feature/auth/SignOutButton.tsx && ! grep -q "PhaseOnePocRoleSwitcher" components/feature/shell/UserMenu.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Sign-out hits the real logout endpoint. UserMenu cleaned of POC role switcher.</done>
</task>

<task type="auto">
  <name>Task 5: Delete Phase 1 POC affordances + mock auth helpers + scripts/seed-first-admin.ts</name>
  <files>
    scripts/seed-first-admin.ts,
    package.json,
    components/feature/auth/PhaseOnePocRoleSwitcher.tsx,
    app/(auth)/login/_components/seed-users-disclosure.tsx,
    lib/auth/mock-session.ts,
    lib/mock/cookie.ts
  </files>
  <read_first>
    - components/feature/auth/PhaseOnePocRoleSwitcher.tsx (file being deleted — verify it's only imported by UserMenu)
    - app/(auth)/login/_components/seed-users-disclosure.tsx (file being deleted — verify it's only imported by login/page.tsx)
    - lib/auth/mock-session.ts (file being deleted — exports getMockSession/requireSession/requireAdmin)
    - lib/mock/cookie.ts (file being deleted — readMockSessionClient/writeMockSessionClient/clearMockSessionClient)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §3 "Files to DELETE" — full delete list with import-site enumerate
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §2.7 lines 771-832 (scripts/seed-first-admin.ts)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-05 (first admin via seed script)
  </read_first>
  <action>
    **Step 5.1 — Create `scripts/seed-first-admin.ts`** per RESEARCH §2.7:

    ```typescript
    // scripts/seed-first-admin.ts
    // One-time: creates the first admin user after Firebase project provision.
    // Run: npx tsx scripts/seed-first-admin.ts <email> <displayName>
    // Requires FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in env.
    // Reads from .env.local automatically if @next/env is installed; otherwise prefix with `dotenv -e .env.local --`.

    import { initializeApp, cert } from "firebase-admin/app";
    import { getAuth } from "firebase-admin/auth";
    import { getFirestore, FieldValue } from "firebase-admin/firestore";

    const email = process.argv[2];
    const displayName = process.argv[3];

    if (!email || !displayName) {
      console.error("Usage: tsx scripts/seed-first-admin.ts <email> <displayName>");
      process.exit(1);
    }

    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });

    const auth = getAuth(app);
    const db = getFirestore(app);

    async function run() {
      // Safety: refuse to run if any user already exists (prevents accidental re-seed).
      const existingUsersSnap = await db.collection("users").limit(1).get();
      if (!existingUsersSnap.empty) {
        console.error("Refusing to seed: users collection is not empty. Use /users/invite instead.");
        process.exit(2);
      }

      const user = await auth.createUser({ email, displayName });
      await auth.setCustomUserClaims(user.uid, { role: "admin" });
      await db.collection("users").doc(user.uid).set({
        uid: user.uid,
        email,
        displayName,
        role: "admin",
        disabled: false,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "seed-script",
        lastLoginAt: null,
      });

      // Generate password reset link for first sign-in
      const link = await auth.generatePasswordResetLink(email);
      console.log("=== FIRST ADMIN SEEDED ===");
      console.log("UID:", user.uid);
      console.log("Email:", email);
      console.log("Password set link (visit in browser):", link);
    }

    run().catch((err) => { console.error(err); process.exit(1); });
    ```

    **Step 5.2 — Add to `package.json` scripts:**

    ```json
    "scripts": {
      "seed:first-admin": "tsx scripts/seed-first-admin.ts"
    }
    ```

    Usage: `npm run seed:first-admin -- <email> <displayName>` (note the `--` to pass args through).

    **Step 5.3 — Delete the four POC / mock files.**

    Verify their import sites are ALL covered by Tasks 1-4 before deleting:

    Per PATTERNS §3:
    - `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` — only consumer is `components/feature/shell/UserMenu.tsx` (cleaned in Task 4).
    - `app/(auth)/login/_components/seed-users-disclosure.tsx` — only consumer is `app/(auth)/login/page.tsx` (cleaned in Task 1).
    - `lib/auth/mock-session.ts` — 15 consumers (layout, dashboard, settings, every (app) page, etc.); the ones touched by THIS plan are layout, page, settings (Task 3). The other 12 consumers (inventory, events, users, scan, reports, etc.) are touched in subsequent plans 02-04 through 02-10.

    **This is a coordination point:** if we delete `lib/auth/mock-session.ts` now, those 12 unmodified consumers break the build. Two options:
    1. **Option A (recommended):** Keep `lib/auth/mock-session.ts` as a thin re-export shim until 02-10 ships, then delete it in 02-11. The shim is one file:
       ```typescript
       // lib/auth/mock-session.ts (shim — DELETE in plan 02-11 after all consumers swap to @/lib/auth/dal)
       export { getSession as getMockSession, requireSession, requireAdmin, verifySession } from "./dal";
       ```
       This lets the build pass with mixed consumers — those still on `@/lib/auth/mock-session` get the real DAL anyway.
    2. **Option B:** Delete now and break the build until 02-04+ ship. Rejected — violates "every plan leaves the build green" rule.

    **Pick Option A.** Rewrite `lib/auth/mock-session.ts` to the shim above. Plan 02-11 will delete it after all consumers swap.

    Also rewrite `lib/mock/cookie.ts` to a shim:

    ```typescript
    // lib/mock/cookie.ts (shim — DELETE in plan 02-11 after all consumers swap)
    // Phase 1 had: readMockSessionClient, writeMockSessionClient, clearMockSessionClient.
    // In Phase 2 the only remaining consumer is `proxy.ts` via raw cookie read (already
    // self-contained) + use-current-user.ts (already swapped in Task 3).
    // SignOutButton (Task 4) already removed its import.
    // If anything still imports clearMockSessionClient, it's a stale Phase 1 import — fail loudly.
    export function clearMockSessionClient(): never {
      throw new Error(
        "clearMockSessionClient is deleted in Phase 2. Use fetch('/api/auth/logout', {method:'POST'}) + window.location.assign('/login') instead. See components/feature/auth/SignOutButton.tsx.",
      );
    }
    export function readMockSessionClient(): never {
      throw new Error(
        "readMockSessionClient is deleted in Phase 2. Use useCurrentUser() from @/lib/hooks/use-current-user instead.",
      );
    }
    export function writeMockSessionClient(): never {
      throw new Error(
        "writeMockSessionClient is deleted in Phase 2. The login form now POSTs /api/auth/session. See app/(auth)/login/_components/login-form.tsx.",
      );
    }
    ```

    These throw at call time, not import time — so an accidental stale import doesn't break tsc, but the first runtime call surfaces the issue.

    **Delete the two POC files outright** (no consumers remain after Tasks 1+4):

    ```bash
    rm components/feature/auth/PhaseOnePocRoleSwitcher.tsx
    rm app/\(auth\)/login/_components/seed-users-disclosure.tsx
    ```
  </action>
  <acceptance_criteria>
    - `test -f scripts/seed-first-admin.ts` succeeds.
    - `grep -q "setCustomUserClaims" scripts/seed-first-admin.ts` succeeds.
    - `grep -q "Refusing to seed" scripts/seed-first-admin.ts` succeeds (safety rail).
    - `grep -q "seed:first-admin" package.json` succeeds (npm script).
    - `test -f components/feature/auth/PhaseOnePocRoleSwitcher.tsx` FAILS (deleted).
    - `test -f app/\(auth\)/login/_components/seed-users-disclosure.tsx` FAILS (deleted).
    - `test -f lib/auth/mock-session.ts` succeeds (kept as shim).
    - `grep -q "export.*from \"./dal\"" lib/auth/mock-session.ts` succeeds (shim re-exports).
    - `test -f lib/mock/cookie.ts` succeeds (kept as throw-shim).
    - `grep -q "is deleted in Phase 2" lib/mock/cookie.ts` succeeds (throw-shim).
    - No file under `app/` or `components/` or `lib/` imports `PhaseOnePocRoleSwitcher` or `SeedUsersDisclosure`: `grep -r "PhaseOnePocRoleSwitcher\|SeedUsersDisclosure" app/ components/ lib/ 2>/dev/null | wc -l` returns 0.
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>test -f scripts/seed-first-admin.ts && grep -q "setCustomUserClaims" scripts/seed-first-admin.ts && ! test -f components/feature/auth/PhaseOnePocRoleSwitcher.tsx && ! test -f "app/(auth)/login/_components/seed-users-disclosure.tsx" && grep -q "export.*from \"./dal\"" lib/auth/mock-session.ts && [ "$(grep -r 'PhaseOnePocRoleSwitcher\|SeedUsersDisclosure' app/ components/ lib/ 2>/dev/null | wc -l)" = "0" ] && npx tsc --noEmit</automated>
  </verify>
  <done>POC affordances deleted. Mock helpers kept as Phase 2-friendly shims that re-export real DAL (mock-session) or throw at call time (mock/cookie). Seed script ready. Build green.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 6: End-to-end sign-in test + seed the first admin</name>
  <what-built>
    Auth pages call real Firebase. Seed script ready. The developer runs the seed script to create the first admin, then signs in via /login and verifies the full flow.
  </what-built>
  <how-to-verify>
    **Step A — Seed the first admin:**

    ```bash
    npm run seed:first-admin -- you@example.com "Your Name"
    ```

    Replace `you@example.com` with your real email. Expected output:

    ```
    === FIRST ADMIN SEEDED ===
    UID: <some-firebase-uid>
    Email: you@example.com
    Password set link (visit in browser): https://<project>.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=...
    ```

    If output says "Refusing to seed: users collection is not empty" — the spike test user (or a previous admin) already exists. Either:
    - Delete the test user in Firebase Console → Authentication → Users, then `firebase firestore:delete users --all-collections -r --project <proj-id>` (DESTRUCTIVE — confirm prompt).
    - Or skip seeding and use the existing user; promote them to admin manually via Console + Firestore.

    **Step B — Set a password via the link:**

    Copy the password-set link from Step A's output → paste into your browser. Should land on `https://<project>.firebaseapp.com/...` Firebase-hosted page (NOT your app's /set-password yet — the seed script generates a Firebase-hosted link). Set a password.

    **Step C — Sign in via your app:**

    1. `npm run dev`
    2. Open http://localhost:3000 in a private window. Expected: 307 redirect to `/login`.
    3. At `/login`, enter the email + password you just set. Click "Sign in".
    4. **Expected:** Network panel shows POST `/api/auth/session` → 204 or 200. Then page hard-navigates to `/`. Dashboard renders.
    5. DevTools → Application → Cookies → `__session` is present (HttpOnly: ✓, SameSite: Lax).

    **Step D — Sign-out test:**
    1. Click the user menu (top-right) → "Sign out".
    2. **Expected:** Network panel shows POST `/api/auth/logout` → 204. Page navigates to `/login`. Cookie cleared.

    **Step E — Forgot password flow (quick test):**
    1. `/login` → click "Forgot password?" → enter your email → click "Send reset link".
    2. Check your email inbox for "Reset your password" from Firebase (template stock).
    3. Visit the link. Should land on Firebase-hosted reset page; set a new password.
    4. Return to /login, sign in with the new password. Should succeed.

    **PASS:** Steps A–D all green; Step E reaches the email at least.
    **FAIL:** Any step blocks — describe.

    **Step F — UI surface regression check:**
    Visit each of these and confirm they render identical to Phase 1:
    - /login (form layout, "Forgot password?" link, no SeedUsersDisclosure)
    - / (dashboard with KPI cards + widgets — still using mock data behind the scenes; UI unchanged)
    - /inventory (Phase 1 mock data still there for now; Block C in 02-05 swaps it)
    - /events
    - /scan
    - /settings (renders without console errors)
    - User menu in top-right — should NOT show "Switch role" / "Acting as: admin" affordances (those were the PhaseOnePocRoleSwitcher).

    Report: "All auth flows PASS; UI surface unchanged" or describe any regression.
  </how-to-verify>
  <resume-signal>Type "auth E2E PASS, UI unchanged" once first admin seeded, sign-in works, sign-out works, forgot-password email arrives, and no Phase 1 surface regression visible. If anything fails, describe specifically (which step, what happened).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → /login (form post) | Untrusted form values; Zod-validated client-side; final auth check happens via Firebase Web SDK |
| Browser → signInWithEmailAndPassword (Firebase Auth REST) | Untrusted credentials; Firebase API validates |
| Browser → /api/auth/session | Untrusted ID token; verified via Admin SDK before cookie issued |
| Browser → /api/auth/logout | Untrusted (no body required); idempotent — succeeds even if no cookie |
| Browser → /set-password?oobCode=... | Untrusted oobCode; Firebase Auth verifies + consumes |
| Browser → onAuthStateChanged subscription | Trusted (Firebase SDK manages); never accept tampered user object |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-03-01 | Spoofing | Email enumeration via /forgot-password | mitigate | Generic success copy regardless of email existence (Task 2); per RESEARCH §1.9 |
| T-02-03-02 | Spoofing | Stale role claim in onAuthStateChanged | accept | Per RESEARCH §"Token revocation timing" — role changes apply on next ID-token refresh (≤1h) or hard nav; documented UX |
| T-02-03-03 | Tampering | Forged oobCode at /set-password | mitigate | verifyPasswordResetCode + confirmPasswordReset both verify against Firebase Auth; invalid codes surface as "expired" error |
| T-02-03-04 | Repudiation | Sign-out doesn't actually invalidate | mitigate | /api/auth/logout calls revokeRefreshTokens (02-02) so refresh-token can't mint new ID tokens; cookie cleared |
| T-02-03-05 | Information disclosure | Login error reveals email exists | mitigate | "Invalid email or password" copy is identical regardless of root cause (per UI-SPEC + Task 1) |
| T-02-03-06 | Information disclosure | Seed script logs admin email/password | mitigate | Logs only generated reset link, never the password; admin sets password via Firebase-hosted page |
| T-02-03-07 | Elevation of privilege | seed-first-admin.ts run with existing users | mitigate | Hard refusal — "Refusing to seed: users collection is not empty"; sole-developer workflow makes accidental re-seed rare |
| T-02-03-08 | Elevation of privilege | Phase 1 PhaseOnePocRoleSwitcher residual in prod | mitigate | Component DELETED outright; UserMenu cleaned; verified by `grep -r "PhaseOnePocRoleSwitcher" app/ components/ lib/` returning 0 lines |
| T-02-03-09 | Denial of service | Excessive /api/auth/session requests during failed sign-ins | accept | Firebase Auth rate-limits client-side; brute-force is Firebase's problem |
| T-02-03-10 | DoS | Forgot-password spam | accept | Firebase rate-limits sendPasswordResetEmail by source IP + email; generic success copy doesn't differentiate, so no oracle |
</threat_model>

<verification>
- `app/(auth)/login/_components/login-form.tsx` calls `signInWithEmailAndPassword` and POSTs `/api/auth/session`.
- `app/(auth)/login/page.tsx` no longer imports or renders `SeedUsersDisclosure`.
- `app/(auth)/forgot-password/_components/forgot-password-form.tsx` calls `sendPasswordResetEmail`.
- `app/(auth)/set-password/_components/set-password-form.tsx` calls `verifyPasswordResetCode`, `confirmPasswordReset`, `signInWithEmailAndPassword` (auto-sign-in per D-08), and POSTs `/api/auth/session`.
- `app/(auth)/register/page.tsx` calls `notFound()` (AUTH-06).
- `app/(app)/layout.tsx` + `page.tsx` + `settings/page.tsx` import from `@/lib/auth/dal`.
- `lib/hooks/use-current-user.ts` body uses `onAuthStateChanged` while preserving the same `useCurrentUser(): Session | null` signature.
- `components/feature/auth/SignOutButton.tsx` POSTs `/api/auth/logout` and calls `signOut(auth)`.
- `components/feature/shell/UserMenu.tsx` no longer imports `PhaseOnePocRoleSwitcher`.
- `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` deleted.
- `app/(auth)/login/_components/seed-users-disclosure.tsx` deleted.
- `lib/auth/mock-session.ts` is a re-export shim of `./dal`.
- `lib/mock/cookie.ts` is a throw-on-call shim.
- `scripts/seed-first-admin.ts` exists; runs only against an empty `users` collection; logs reset link.
- `package.json` has `seed:first-admin` script.
- `npm run build` exits 0; `npx tsc --noEmit` exits 0; `npm run lint` exits 0.
- First admin successfully seeded and signed in end-to-end (Task 6 manual verification).
- Phase 1 UI surface visually unchanged (Task 6 step F).
</verification>

<success_criteria>
- AUTH-01 (sign in), AUTH-03 (forgot password), AUTH-04 (set password), AUTH-05 (sign out), AUTH-06 (no register), AUTH-10 (admin nav gate continues to work via DAL) all wired against real Firebase Auth.
- INT-04 partially satisfied (DAL is called in layout; Server Actions in 02-04+ extend the pattern).
- NFR-06 partially satisfied (no Server Actions yet — those land 02-04+).
- First admin user created via seed script per D-05.
- POC affordances (PhaseOnePocRoleSwitcher, SeedUsersDisclosure) eliminated per PATTERNS.md §3.
- Build, type-check, and lint all green.
- Manual end-to-end sign-in test recorded in CLAIM.md.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-03-auth-pages-wired-SUMMARY.md` documenting:
- All 12 modified files + 4 deletions/shim conversions.
- Seed-first-admin run command + outcome (UID + email of first admin).
- Manual sign-in / sign-out / forgot-password E2E test outcomes.
- Any Phase 1 UI regression encountered (and how it was resolved or escalated).
- One paragraph on how subsequent plans (02-04+) inherit the DAL via `import { requireSession, requireAdmin } from "@/lib/auth/dal"`.
The summary should be ≤ 120 lines.
</output>
