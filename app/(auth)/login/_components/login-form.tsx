// /login client form — react-hook-form + Zod 4 + shadcn v4 <Field> primitives.
//
// AUTH-01 — sign-in. CONTEXT.md D-08 — look up against seedUsers; the literal
// password is "password". Disabled users cannot sign in (AUTH-09).
//
// IMPORTANT (Plan 01 deviation D-01-01-A): shadcn v4 ships the canonical
// `<Field>` / `<FieldLabel>` / `<FieldError>` primitives — the legacy v3
// `<Form>` / `<FormField>` Context wrapper was removed. We bind
// react-hook-form's `register` directly here.

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { LoginSchema, type LoginInput } from "@/lib/schemas/auth";
import { seedUsers } from "@/lib/mock/users";
import { writeMockSessionClient } from "@/lib/mock/cookie";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
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

  function onSubmit(values: LoginInput) {
    // CONTEXT.md D-08 — Phase 1 lookup against seed array; Phase 2 swaps
    // to Firebase signInWithEmailAndPassword.
    const user = seedUsers.find(
      (u) => u.email.toLowerCase() === values.email.toLowerCase()
    );
    if (!user || values.password !== "password" || user.disabled) {
      // UI-SPEC error copy: "Wrong email or password." attached to the
      // password field so the error string anchors below the input.
      setError("password", { message: "Wrong email or password." });
      return;
    }
    writeMockSessionClient({
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      disabled: user.disabled,
    });
    toast.success("Signed in");
    router.push("/");
    router.refresh();
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
        Sign in
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
