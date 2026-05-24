import { z } from "zod";

// /login sign-in form. CONTEXT.md D-08 — match against lib/mock/users.ts in
// Phase 1; Phase 2 swaps to Firebase signInWithEmailAndPassword.
export const LoginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

// /forgot-password — Phase 1 only shows a sonner toast; Phase 2 fires a
// Firebase password-reset email (PROJECT.md key decision #2).
export const ForgotPasswordSchema = z.object({
  email: z.email("Enter a valid email."),
});

// /set-password — completes invite or reset. Same Firebase signed link in Phase 2.
export const SetPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.input<typeof LoginSchema>;
export type ForgotPasswordInput = z.input<typeof ForgotPasswordSchema>;
export type SetPasswordInput = z.input<typeof SetPasswordSchema>;
