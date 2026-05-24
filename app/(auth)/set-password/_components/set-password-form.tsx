// /set-password client form — react-hook-form + Zod 4 + shadcn v4 <Field>.
//
// AUTH-04 — Phase 1 no-op submit (toast + redirect to /login).
// The schema enforces confirmPassword === password (lib/schemas/auth.ts).
// Phase 2: signed-link verification + Firebase updatePassword.

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(SetPasswordSchema),
    mode: "onBlur",
    defaultValues: { password: "", confirmPassword: "" },
  });

  function onSubmit(values: SetPasswordInput) {
    // Phase 1: no-op; Phase 2 calls Firebase updatePassword via signed-link
    // verification using `values.password`. We reference `values` here to
    // document the Phase 2 swap surface and to avoid no-unused-vars.
    void values;
    toast.success("Password updated");
    router.push("/login");
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}
