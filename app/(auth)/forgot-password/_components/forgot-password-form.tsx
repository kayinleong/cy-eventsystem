// /forgot-password client form — react-hook-form + Zod 4 + shadcn v4 <Field>.
//
// AUTH-03 — Firebase sendPasswordResetEmail (Web SDK). Firebase auto-sends
// the password reset email via the default template (Auth Console →
// Templates → "Password reset") per D-07. We never differentiate between
// "user not found" and other errors — the success branch always renders
// the same generic copy (T-02-03-01 — anti-enumeration per RESEARCH §1.9).

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";

import { auth } from "@/lib/firebase/client";
import {
  ForgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/schemas/auth";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    mode: "onBlur",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    // T-02-03-01: do NOT differentiate user-not-found from network errors.
    // Always advance to the generic-success branch regardless of outcome.
    try {
      await sendPasswordResetEmail(auth, values.email);
    } catch {
      // Swallow — Firebase rate-limits + spam protection live at the API.
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3 text-sm">
        <p>If an account exists for that email, a reset link has been sent.</p>
        <p className="text-muted-foreground">
          Check your inbox and spam folder. The link expires in 1 hour.
        </p>
        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={errors.email ? [{ message: errors.email.message }] : undefined} />
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
