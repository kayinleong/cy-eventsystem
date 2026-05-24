// Centered card shell for all (auth)/* routes (login, forgot-password,
// set-password, register). Server Component — no `'use client'`. The forms
// inside the child pages are Client Components, not this layout.
//
// UI-SPEC: 01-UI-SPEC.md "Spacing scale" + "Layout & Route Patterns".
// PATTERNS: 01-PATTERNS.md "(auth) layout" (lines 246-263).

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
