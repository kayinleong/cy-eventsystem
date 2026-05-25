// /set-password client form — react-hook-form + Zod 4 + shadcn v4 <Field>.
//
// AUTH-04 — completes password reset / invite flow via Firebase oobCode.
//
// Flow (D-08 auto-sign-in):
//   1. Page mounts → useEffect verifies the oobCode via verifyPasswordResetCode.
//      If invalid/expired → render "expired link" copy with a link to retry.
//   2. User submits new password → verifyPasswordResetCode again (returns
//      email, which we need for signInWithEmailAndPassword) → confirmPasswordReset
//      → signInWithEmailAndPassword with the just-set credentials → POST
//      ID token to /api/auth/session → hard-nav to "/".
//
// T-02-03-03 (forged oobCode): Firebase Auth verifies the code; invalid
// codes surface via the codeError branch.

"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/firebase/client";
import {
  SetPasswordSchema,
  type SetPasswordInput,
} from "@/lib/schemas/auth";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SetPasswordForm() {
  const searchParams = useSearchParams();
  const oobCode = searchParams?.get("oobCode") ?? null;

  // Derive the initial state from the URL param so we don't set state
  // synchronously inside the effect (react-hooks/set-state-in-effect rule).
  // - oobCode missing → codeError immediately, no need to verify
  // - oobCode present → verifyingCode=true until the async check resolves
  const [codeError, setCodeError] = useState<string | null>(() =>
    oobCode ? null : "This link is invalid. Request a new one.",
  );
  const [verifyingCode, setVerifyingCode] = useState<boolean>(() => !!oobCode);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(SetPasswordSchema),
    mode: "onBlur",
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Verify the oobCode on mount so we can show "expired link" copy if
  // the user followed an invalid/used reset link. Side effects only — all
  // setState calls happen after async resolution (compliant with
  // react-hooks/set-state-in-effect per D-01-02-A).
  useEffect(() => {
    if (!oobCode) return;
    let cancelled = false;
    verifyPasswordResetCode(auth, oobCode)
      .then(() => {
        if (cancelled) return;
        setVerifyingCode(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCodeError(
          "This link has expired or has already been used. Request a new one.",
        );
        setVerifyingCode(false);
      });
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  async function onSubmit(values: SetPasswordInput) {
    if (!oobCode) return;
    try {
      // 1. Re-verify the oobCode to extract the email associated with it.
      //    verifyPasswordResetCode returns the user's email — we need it
      //    for the auto-sign-in step below (D-08).
      const email = await verifyPasswordResetCode(auth, oobCode);

      // 2. Apply the new password. After this point the oobCode is consumed.
      await confirmPasswordReset(auth, oobCode, values.password);

      // 3. D-08 auto-sign-in: sign the user in with the credentials they
      //    just set, then mint the session cookie.
      const cred = await signInWithEmailAndPassword(auth, email, values.password);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("session-create-failed");

      // 4. Hard nav so proxy.ts re-evaluates with the new cookie.
      window.location.assign("/");
    } catch {
      setError("password", {
        message: "Couldn't set your password. Try again or request a new link.",
      });
    }
  }

  if (verifyingCode) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Verifying link…
      </p>
    );
  }

  if (codeError) {
    return (
      <div className="space-y-3 text-sm">
        <p role="alert" className="text-destructive">{codeError}</p>
        <div className="text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Request a new link
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
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError errors={errors.password ? [{ message: errors.password.message }] : undefined} />
        </Field>

        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          <FieldError errors={errors.confirmPassword ? [{ message: errors.confirmPassword.message }] : undefined} />
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={isSubmitting || !oobCode}>
        {isSubmitting ? "Setting password…" : "Set password"}
      </Button>
    </form>
  );
}
