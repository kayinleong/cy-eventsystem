// /forgot-password client form — react-hook-form + Zod 4 + shadcn v4 <Field>.
//
// AUTH-03 — Phase 1 no-op submit (toast + redirect to /login).
// Phase 2: calls Firebase generatePasswordResetLink with the form email.

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

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
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    mode: "onBlur",
    defaultValues: { email: "" },
  });

  function onSubmit(values: ForgotPasswordInput) {
    // Phase 1: no-op; Phase 2 calls Firebase generatePasswordResetLink with
    // `values.email`. We reference `values` here to document the Phase 2 swap
    // surface and to avoid the no-unused-vars lint rule.
    void values;
    toast.success("Reset link sent");
    router.push("/login");
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
        Send reset link
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
