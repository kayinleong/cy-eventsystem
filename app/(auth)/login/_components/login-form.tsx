// /login client form — react-hook-form + Zod 4 + shadcn v4 <Field> primitives.
//
// AUTH-01 — sign-in via Firebase signInWithEmailAndPassword + POST to
// /api/auth/session. The proxy (proxy.ts) intercepts the POST, mints the
// HMAC-signed __session cookie envelope, and the form follows up with a
// HARD navigation to "/" so proxy.ts re-evaluates with the new cookie
// before any prefetch (RESEARCH §1.8 line 441).
//
// Error UX (T-02-03-05 — no email-enumeration oracle): a single generic
// "Wrong email or password." line attached to the password field, regardless
// of root cause (unknown email, bad password, disabled user, network error).
//
// shadcn v4 ships `<Field>` / `<FieldLabel>` / `<FieldError>` primitives
// (legacy v3 `<Form>` Context wrapper was removed); we bind rhf's `register`
// directly here.

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";

import { auth } from "@/lib/firebase/client";
import { LoginSchema, type LoginInput } from "@/lib/schemas/auth";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    try {
      // 1. Authenticate with Firebase Auth (Web SDK).
      const cred = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password,
      );

      // 2. Get fresh ID token (forced refresh to ensure latest custom claims).
      const idToken = await cred.user.getIdToken();

      // 3. POST to /api/auth/session — proxy.ts authMiddleware intercepts
      //    this path (loginPath) and mints the HMAC-signed __session cookie
      //    envelope before the request reaches the route handler.
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("session-create-failed");

      // 4. Hard nav so proxy.ts re-evaluates with the new cookie before any
      //    Next.js prefetch can fire (RESEARCH §1.8 line 441).
      window.location.assign("/");
    } catch {
      // T-02-03-05: single generic error regardless of cause. Do not surface
      // Firebase error codes — they leak whether an email exists.
      setError("password", { message: "Wrong email or password." });
    }
  }

  return (
    <form
      id="login-form"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="login-email">Email</FieldLabel>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={errors.email ? [{ message: errors.email.message }] : undefined} />
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError errors={errors.password ? [{ message: errors.password.message }] : undefined} />
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <div className="text-center">
        <Link
          href="/forgot-password"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
