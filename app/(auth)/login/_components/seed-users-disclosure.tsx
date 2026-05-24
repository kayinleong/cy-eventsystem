// PHASE 1 ONLY — REMOVE IN PHASE 2 (CONTEXT.md D-08 disclosure).
//
// Discloses the 5 seed user emails on /login so demos don't require
// remembering credentials. One-click fill bridges into the LoginForm's
// inputs via DOM events that react-hook-form picks up (we don't share rhf
// state across components to keep this POC component fully decoupled).
//
// Phase 2 deletes this file entirely and removes the import from
// app/(auth)/login/page.tsx — no other code touches it.

"use client";

import { seedUsers } from "@/lib/mock/users";

export function SeedUsersDisclosure() {
  // Dispatch native input events so react-hook-form's register() detects the
  // value change. Simpler than wiring an rhf Context across components for
  // a POC-only UI affordance.
  const fill = (email: string) => {
    const form = document.getElementById("login-form") as HTMLFormElement | null;
    if (!form) return;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    if (emailInput) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(emailInput, email);
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (passwordInput) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(passwordInput, "password");
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  return (
    <details className="rounded-md border bg-muted/30 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
        POC seed users (click to fill)
      </summary>
      <ul className="mt-2 space-y-1">
        {seedUsers.map((u) => (
          <li
            key={u.uid}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="font-mono text-muted-foreground">{u.email}</span>
            <span className="text-muted-foreground">
              {u.role}
              {u.disabled ? " · disabled" : ""}
            </span>
            <button
              type="button"
              onClick={() => fill(u.email)}
              className="rounded border bg-background px-2 py-0.5 text-xs hover:bg-muted"
            >
              Fill
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Password for all: <code>password</code>
      </p>
    </details>
  );
}
