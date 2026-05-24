---
phase: 01-ui-poc
plan: 04
type: execute
wave: 2
depends_on: [01, 02, 03]
files_modified:
  - app/page.tsx
  - app/(auth)/layout.tsx
  - app/(auth)/login/page.tsx
  - app/(auth)/login/_components/login-form.tsx
  - app/(auth)/login/_components/seed-users-disclosure.tsx
  - app/(auth)/forgot-password/page.tsx
  - app/(auth)/forgot-password/_components/forgot-password-form.tsx
  - app/(auth)/set-password/page.tsx
  - app/(auth)/set-password/_components/set-password-form.tsx
  - app/(auth)/register/page.tsx
  - app/(app)/layout.tsx
  - app/(app)/unauthorized/page.tsx
  - components/feature/auth/PhaseOnePocRoleSwitcher.tsx
  - components/feature/auth/SignOutButton.tsx
  - components/feature/shell/AppSidebar.tsx
  - components/feature/shell/TopBar.tsx
  - components/feature/shell/UserMenu.tsx
  - components/feature/shell/MobileNavSheet.tsx
  - components/feature/shell/Breadcrumbs.tsx
autonomous: true
requirements:
  - AUTH-01
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - AUTH-10
  - NFR-05
  - NFR-08

must_haves:
  truths:
    - "Unauthenticated user hitting any /(app)/* route is redirected to /login."
    - "Submitting /login with a valid seed email + password 'password' writes mock_session cookie and redirects to /."
    - "/login renders a 'POC seed users' disclosure listing the 5 emails with one-click fill."
    - "Submitting /forgot-password shows a sonner toast and routes back to /login."
    - "Submitting /set-password shows a sonner toast and routes back to /login."
    - "/register returns 404 (AUTH-06)."
    - "Staff hitting /users, /users/invite, /inventory/new, /inventory/[id]/edit, or /events/new is redirected to /unauthorized (D-07)."
    - "Admin can see all sidebar items; staff cannot see Users."
    - "Switching roles via PhaseOnePocRoleSwitcher writes the cookie, calls router.refresh(), and the sidebar re-renders accordingly."
    - "Sign-out clears the cookie and redirects to /login."
    - "Disabled users (seedUsers casey.ramirez) cannot sign in — login form shows 'Wrong email or password.'"
  artifacts:
    - path: "app/page.tsx"
      provides: "Root redirect — to / dashboard if session, else /login"
      contains: "redirect"
    - path: "app/(auth)/layout.tsx"
      provides: "Centered card auth shell"
      contains: "min-h-svh"
    - path: "app/(app)/layout.tsx"
      provides: "Role-gated app shell: reads mock_session, redirects to /login if absent, renders sidebar + top bar + main"
      contains: "await cookies()"
      min_lines: 30
    - path: "app/(app)/unauthorized/page.tsx"
      provides: "/unauthorized — empty-state pattern with 'Back to dashboard' link"
      contains: "EmptyState"
    - path: "app/(auth)/register/page.tsx"
      provides: "notFound() trigger — AUTH-06"
      contains: "notFound"
    - path: "components/feature/auth/PhaseOnePocRoleSwitcher.tsx"
      provides: "POC-only role switcher; filename intentional"
      contains: "PHASE 1"
    - path: "components/feature/shell/AppSidebar.tsx"
      provides: "Role-aware sidebar with active-link styling, lg+ only"
      contains: "usePathname"
  key_links:
    - from: "app/(app)/layout.tsx"
      to: "lib/auth/mock-session.ts"
      via: "requireSession() — redirects to /login if cookie missing or session disabled"
      pattern: "requireSession"
    - from: "app/(auth)/login/_components/login-form.tsx"
      to: "lib/mock/cookie.ts + lib/mock/users.ts"
      via: "Form submit: validate via Zod, lookup against seedUsers, writeMockSessionClient, router.push('/')"
      pattern: "writeMockSessionClient|seedUsers"
    - from: "components/feature/auth/PhaseOnePocRoleSwitcher.tsx"
      to: "lib/mock/cookie.ts"
      via: "writeMockSessionClient + router.refresh()"
      pattern: "router.refresh"
---

<objective>
Build the auth shell and role-gate spine: 4 auth routes + (app) layout + role gate + sidebar/topbar/usermenu/breadcrumbs. After this plan, the app has a working login → dashboard flow with role switching, even though every (app)/* page is still a placeholder.

Purpose: Establishes the role gate that every Wave 3 plan composes against. Wave 3 admin-only pages call `requireAdmin()` from Plan 02; Wave 3 sidebar consumers expect the role-aware AppSidebar to already exist.

Output: 1 modified root page, 8 new auth-route files, 2 modified or new app shell files (app layout + unauthorized), 6 new shell components + auth components (Sidebar, TopBar, UserMenu, MobileNavSheet, Breadcrumbs, role switcher, sign-out).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-PATTERNS.md
@app/page.tsx
@lib/types/session.ts
@lib/mock/cookie.ts
@lib/mock/users.ts
@lib/mock/store.ts
@lib/auth/mock-session.ts
@lib/hooks/use-current-user.ts
@lib/schemas/auth.ts
@components/ui/button.tsx
@components/ui/form.tsx
@components/ui/input.tsx
@components/ui/dropdown-menu.tsx
@components/ui/sheet.tsx
@components/ui/avatar.tsx
@components/ui/breadcrumb.tsx
@components/ui/separator.tsx
@components/ui/empty-state.tsx
@components/ui/page-header.tsx
@components/ui/theme-toggle.tsx

<interfaces>
<!-- Shell contract — Wave 3 plans expect these components in these paths. -->

```tsx
// app/(app)/layout.tsx — Server Component
export default async function AppLayout({ children }: { children: React.ReactNode }): Promise<React.ReactElement>;
// Side-effects: redirects to /login if no session; otherwise renders <AppSidebar role/> + <TopBar session/> + children.

// components/feature/shell/AppSidebar.tsx
export function AppSidebar(props: { role: "admin" | "staff" }): React.ReactElement;

// components/feature/shell/TopBar.tsx
export function TopBar(props: { session: Session }): React.ReactElement;

// components/feature/shell/UserMenu.tsx
export function UserMenu(props: { session: Session }): React.ReactElement;

// components/feature/shell/MobileNavSheet.tsx
export function MobileNavSheet(props: { role: "admin" | "staff" }): React.ReactElement;

// components/feature/shell/Breadcrumbs.tsx — Client; reads usePathname()
export function Breadcrumbs(): React.ReactElement;

// components/feature/auth/PhaseOnePocRoleSwitcher.tsx
export function PhaseOnePocRoleSwitcher(): React.ReactElement | null;

// components/feature/auth/SignOutButton.tsx
export function SignOutButton(): React.ReactElement;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auth routes + (auth) layout + register 404 + root redirect</name>
  <files>
    app/page.tsx,
    app/(auth)/layout.tsx,
    app/(auth)/login/page.tsx,
    app/(auth)/login/_components/login-form.tsx,
    app/(auth)/login/_components/seed-users-disclosure.tsx,
    app/(auth)/forgot-password/page.tsx,
    app/(auth)/forgot-password/_components/forgot-password-form.tsx,
    app/(auth)/set-password/page.tsx,
    app/(auth)/set-password/_components/set-password-form.tsx,
    app/(auth)/register/page.tsx
  </files>
  <read_first>
    - app/page.tsx (current — `create-next-app` landing; must be replaced)
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md sections "app/page.tsx" (lines 227-244), "(auth) layout" (lines 246-263), "Sign-in form" (lines 518-585), "Shared #9 POC seed users disclosure" (lines 1184-1186)
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-05 (mock cookie), D-08 (sign-in lookup against seedUsers, password literal "password")
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Primary CTA labels" (Sign in / Send reset link / Create account), error copy section (lines 233-241)
    - lib/schemas/auth.ts (LoginSchema, ForgotPasswordSchema, SetPasswordSchema)
    - lib/mock/cookie.ts (writeMockSessionClient)
    - lib/mock/users.ts (seedUsers)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
    - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md
    - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md
  </read_first>
  <action>
    **app/page.tsx** (replace with session-aware redirect; Next 16 async cookies):
    ```tsx
    import { redirect } from "next/navigation";
    import { cookies } from "next/headers";

    export default async function RootPage() {
      const jar = await cookies();
      const hasSession = jar.has("mock_session");
      redirect(hasSession ? "/inventory" : "/login");
    }
    ```
    Note: `/inventory` is the post-login landing — the dashboard at `/` lives inside `(app)/`. Plan 05 wires the dashboard at `(app)/page.tsx`; the root redirect goes to `/inventory` to avoid an infinite-recursion-looking edge during dev. Once `(app)/page.tsx` exists in Plan 05, executor can change this to `/` if preferred — keep `/inventory` for safety until then.

    Actually correction: `(app)/` is a route group and does NOT add a URL segment. So `(app)/page.tsx` IS at URL `/`. To avoid the redirect-loop concern, root `app/page.tsx` and `(app)/page.tsx` can't both exist at `/`. The cleanest layout: DELETE `app/page.tsx` entirely so the `(app)/page.tsx` dashboard owns `/`. The root redirect for unauth users happens in the `(app)/layout.tsx` (Task 2).

    **REVISED `app/page.tsx`**: DELETE this file. Use `rm app/page.tsx`. The (app) layout's redirect will handle unauth users hitting `/`.

    Verification step: After deletion, `ls app/page.tsx 2>&1 | grep -q "No such"`.

    **app/(auth)/layout.tsx** (centered card shell; Server Component):
    ```tsx
    export default function AuthLayout({ children }: { children: React.ReactNode }) {
      return (
        <main className="min-h-svh flex flex-col items-center justify-center px-4 py-12 bg-background">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      );
    }
    ```

    **app/(auth)/login/page.tsx** (Server shell; metadata + form import):
    ```tsx
    import type { Metadata } from "next";
    import { LoginForm } from "./_components/login-form";
    import { SeedUsersDisclosure } from "./_components/seed-users-disclosure";

    export const metadata: Metadata = { title: "Sign in" };

    export default function LoginPage() {
      return (
        <div className="space-y-6">
          <header className="space-y-1.5 text-center">
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">Use your work email and password.</p>
          </header>
          <LoginForm />
          <SeedUsersDisclosure />
        </div>
      );
    }
    ```

    **app/(auth)/login/_components/login-form.tsx** (Client; rhf + zodResolver + writeMockSessionClient):
    ```tsx
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
      Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
    } from "@/components/ui/form";
    import { Input } from "@/components/ui/input";
    import { Button } from "@/components/ui/button";

    export function LoginForm() {
      const router = useRouter();
      const form = useForm<LoginInput>({
        resolver: zodResolver(LoginSchema),
        mode: "onBlur",
        defaultValues: { email: "", password: "" },
      });

      function onSubmit(values: LoginInput) {
        const user = seedUsers.find((u) => u.email.toLowerCase() === values.email.toLowerCase());
        if (!user || values.password !== "password" || user.disabled) {
          // UI-SPEC error copy
          form.setError("password", { message: "Wrong email or password." });
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="login-form">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">Sign in</Button>
            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>
          </form>
        </Form>
      );
    }
    ```

    **app/(auth)/login/_components/seed-users-disclosure.tsx** (POC-only — comment marker per CLAUDE.md):
    ```tsx
    // PHASE 1 ONLY — REMOVE IN PHASE 2 (CONTEXT.md D-08 disclosure)
    "use client";
    import { seedUsers } from "@/lib/mock/users";

    export function SeedUsersDisclosure() {
      // Hover-fill via clicking pre-fills the form via simple DOM access (no rhf coupling for POC simplicity)
      const fill = (email: string) => {
        const form = document.getElementById("login-form") as HTMLFormElement | null;
        if (!form) return;
        const emailInput = form.elements.namedItem("email") as HTMLInputElement | null;
        const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
        if (emailInput) {
          emailInput.value = email;
          emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (passwordInput) {
          passwordInput.value = "password";
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
              <li key={u.uid} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-muted-foreground">{u.email}</span>
                <span className="text-muted-foreground">{u.role}{u.disabled ? " · disabled" : ""}</span>
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
          <p className="mt-2 text-xs text-muted-foreground">Password for all: <code>password</code></p>
        </details>
      );
    }
    ```

    **app/(auth)/forgot-password/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { ForgotPasswordForm } from "./_components/forgot-password-form";

    export const metadata: Metadata = { title: "Forgot password" };

    export default function ForgotPasswordPage() {
      return (
        <div className="space-y-6">
          <header className="space-y-1.5 text-center">
            <h1 className="text-lg font-semibold">Forgot password</h1>
            <p className="text-sm text-muted-foreground">Enter your email and we'll send a reset link.</p>
          </header>
          <ForgotPasswordForm />
        </div>
      );
    }
    ```

    **app/(auth)/forgot-password/_components/forgot-password-form.tsx**:
    ```tsx
    "use client";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { useRouter } from "next/navigation";
    import Link from "next/link";
    import { toast } from "sonner";
    import { ForgotPasswordSchema, type ForgotPasswordInput } from "@/lib/schemas/auth";
    import {
      Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
    } from "@/components/ui/form";
    import { Input } from "@/components/ui/input";
    import { Button } from "@/components/ui/button";

    export function ForgotPasswordForm() {
      const router = useRouter();
      const form = useForm<ForgotPasswordInput>({
        resolver: zodResolver(ForgotPasswordSchema),
        mode: "onBlur",
        defaultValues: { email: "" },
      });
      function onSubmit(_values: ForgotPasswordInput) {
        // Phase 1: no-op; Phase 2 calls Firebase generatePasswordResetLink
        toast.success("Reset link sent");
        router.push("/login");
      }
      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">Send reset link</Button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        </Form>
      );
    }
    ```

    **app/(auth)/set-password/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { SetPasswordForm } from "./_components/set-password-form";

    export const metadata: Metadata = { title: "Set password" };

    export default function SetPasswordPage() {
      return (
        <div className="space-y-6">
          <header className="space-y-1.5 text-center">
            <h1 className="text-lg font-semibold">Set password</h1>
            <p className="text-sm text-muted-foreground">Choose a new password (at least 8 characters).</p>
          </header>
          <SetPasswordForm />
        </div>
      );
    }
    ```

    **app/(auth)/set-password/_components/set-password-form.tsx**:
    ```tsx
    "use client";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { useRouter } from "next/navigation";
    import { toast } from "sonner";
    import { SetPasswordSchema, type SetPasswordInput } from "@/lib/schemas/auth";
    import {
      Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
    } from "@/components/ui/form";
    import { Input } from "@/components/ui/input";
    import { Button } from "@/components/ui/button";

    export function SetPasswordForm() {
      const router = useRouter();
      const form = useForm<SetPasswordInput>({
        resolver: zodResolver(SetPasswordSchema),
        mode: "onBlur",
        defaultValues: { password: "", confirmPassword: "" },
      });
      function onSubmit(_values: SetPasswordInput) {
        toast.success("Password updated");
        router.push("/login");
      }
      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">Update password</Button>
          </form>
        </Form>
      );
    }
    ```

    **app/(auth)/register/page.tsx** (AUTH-06 — admin-invite-only):
    ```tsx
    import { notFound } from "next/navigation";

    export default function RegisterPage(): never {
      notFound();
    }
    ```
  </action>
  <verify>
    <automated>test ! -f app/page.tsx; ls app/(auth)/layout.tsx app/(auth)/login/page.tsx app/(auth)/login/_components/login-form.tsx app/(auth)/login/_components/seed-users-disclosure.tsx app/(auth)/forgot-password/page.tsx app/(auth)/set-password/page.tsx app/(auth)/register/page.tsx | wc -l | grep -q "^7$"; grep -q "writeMockSessionClient" app/(auth)/login/_components/login-form.tsx; grep -q "seedUsers" app/(auth)/login/_components/login-form.tsx; grep -q "Wrong email or password" app/(auth)/login/_components/login-form.tsx; grep -q "PHASE 1 ONLY" app/(auth)/login/_components/seed-users-disclosure.tsx; grep -q "notFound" app/(auth)/register/page.tsx; grep -q "min-h-svh" app/(auth)/layout.tsx; grep -q "Reset link sent" app/(auth)/forgot-password/_components/forgot-password-form.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `app/page.tsx` does NOT exist (deleted).
    - `app/(auth)/layout.tsx` exists with `min-h-svh` centered shell.
    - `app/(auth)/login/page.tsx` exists and imports LoginForm + SeedUsersDisclosure.
    - `app/(auth)/login/_components/login-form.tsx` references `writeMockSessionClient` AND `seedUsers` AND error string `"Wrong email or password."`.
    - `app/(auth)/login/_components/seed-users-disclosure.tsx` contains the comment `PHASE 1 ONLY`.
    - `app/(auth)/forgot-password/page.tsx` + `_components/forgot-password-form.tsx` exist.
    - `app/(auth)/set-password/page.tsx` + `_components/set-password-form.tsx` exist.
    - `app/(auth)/register/page.tsx` calls `notFound()` (AUTH-06).
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <done>All 7 auth route files exist, login form looks up seedUsers + writes mock_session client cookie, /register triggers notFound, build passes.</done>
</task>

<task type="auto">
  <name>Task 2: (app) layout + role gate + shell components + unauthorized page</name>
  <files>
    app/(app)/layout.tsx,
    app/(app)/unauthorized/page.tsx,
    components/feature/shell/AppSidebar.tsx,
    components/feature/shell/TopBar.tsx,
    components/feature/shell/UserMenu.tsx,
    components/feature/shell/MobileNavSheet.tsx,
    components/feature/shell/Breadcrumbs.tsx,
    components/feature/auth/PhaseOnePocRoleSwitcher.tsx,
    components/feature/auth/SignOutButton.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md sections "(app) layout" (lines 266-310), "Per-route role gate" (lines 314-342), "Active-nav sidebar" (lines 856-903), "Breadcrumbs" (lines 907-912), "Role switcher (POC)" (lines 915-950)
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-05, D-06, D-07
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "App shell" (lines 158-164) and "Iconography Standard mapping" (lines 131-143)
    - lib/auth/mock-session.ts (requireSession is the entry point)
    - lib/mock/cookie.ts (client cookie functions)
    - lib/hooks/use-current-user.ts
    - lib/types/session.ts
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md (`usePathname` example for active links)
    - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
    - components/ui/theme-toggle.tsx (created in Plan 03)
  </read_first>
  <action>
    **app/(app)/layout.tsx** (Server Component; role gate spine):
    ```tsx
    import { requireSession } from "@/lib/auth/mock-session";
    import { AppSidebar } from "@/components/feature/shell/AppSidebar";
    import { TopBar } from "@/components/feature/shell/TopBar";

    export default async function AppLayout({ children }: { children: React.ReactNode }) {
      const session = await requireSession();
      return (
        <div className="flex min-h-svh">
          <AppSidebar role={session.role} />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar session={session} />
            <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-6">
              {children}
            </main>
          </div>
        </div>
      );
    }
    ```
    Critical: this file must remain a Server Component (no `'use client'`). `requireSession()` calls async `cookies()` per Next 16.

    **app/(app)/unauthorized/page.tsx** (D-07):
    ```tsx
    import type { Metadata } from "next";
    import Link from "next/link";
    import { ShieldAlert } from "lucide-react";
    import { EmptyState } from "@/components/ui/empty-state";
    import { Button } from "@/components/ui/button";

    export const metadata: Metadata = { title: "Unauthorized" };

    export default function UnauthorizedPage() {
      return (
        <EmptyState
          icon={ShieldAlert}
          heading="Unauthorized"
          body="You don't have permission to view this page. Switch to an admin role or contact your administrator."
          action={
            <Button asChild variant="outline">
              <Link href="/">Back to dashboard</Link>
            </Button>
          }
        />
      );
    }
    ```

    **components/feature/shell/AppSidebar.tsx** (role-aware, md+ only, active-link styling):
    ```tsx
    "use client";
    import Link from "next/link";
    import { usePathname } from "next/navigation";
    import {
      LayoutDashboard, Package, Calendar, ScanLine, BarChart3, Users, Settings,
    } from "lucide-react";
    import { cn } from "@/lib/utils";
    import type { UserRole } from "@/lib/types/user";

    const items: Array<{ href: string; label: string; icon: typeof Package; roles: UserRole[] }> = [
      { href: "/",             label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "staff"] },
      { href: "/inventory",    label: "Inventory", icon: Package,        roles: ["admin", "staff"] },
      { href: "/scan",         label: "Scan",      icon: ScanLine,       roles: ["admin", "staff"] },
      { href: "/events",       label: "Events",    icon: Calendar,       roles: ["admin", "staff"] },
      { href: "/reports/stock",label: "Reports",   icon: BarChart3,      roles: ["admin", "staff"] },
      { href: "/users",        label: "Users",     icon: Users,          roles: ["admin"] },          // AUTH-10
      { href: "/settings",     label: "Settings",  icon: Settings,       roles: ["admin", "staff"] },
    ];

    export function AppSidebar({ role }: { role: UserRole }) {
      const pathname = usePathname();
      return (
        <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar shrink-0">
          <div className="px-4 py-5 border-b">
            <Link href="/" className="text-base font-semibold">cy-eventsystem</Link>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {items.filter((i) => i.roles.includes(role)).map((i) => {
              const active = i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`);
              const Icon = i.icon;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" />
                  {i.label}
                </Link>
              );
            })}
          </nav>
        </aside>
      );
    }
    ```

    **components/feature/shell/MobileNavSheet.tsx** (Sheet drawer for <md viewport):
    ```tsx
    "use client";
    import { useState } from "react";
    import Link from "next/link";
    import { usePathname } from "next/navigation";
    import { Menu, LayoutDashboard, Package, Calendar, ScanLine, BarChart3, Users, Settings } from "lucide-react";
    import {
      Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
    } from "@/components/ui/sheet";
    import { Button } from "@/components/ui/button";
    import { cn } from "@/lib/utils";
    import type { UserRole } from "@/lib/types/user";

    const items = [
      { href: "/",             label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "staff"] as UserRole[] },
      { href: "/inventory",    label: "Inventory", icon: Package,        roles: ["admin", "staff"] as UserRole[] },
      { href: "/scan",         label: "Scan",      icon: ScanLine,       roles: ["admin", "staff"] as UserRole[] },
      { href: "/events",       label: "Events",    icon: Calendar,       roles: ["admin", "staff"] as UserRole[] },
      { href: "/reports/stock",label: "Reports",   icon: BarChart3,      roles: ["admin", "staff"] as UserRole[] },
      { href: "/users",        label: "Users",     icon: Users,          roles: ["admin"] as UserRole[] },
      { href: "/settings",     label: "Settings",  icon: Settings,       roles: ["admin", "staff"] as UserRole[] },
    ];

    export function MobileNavSheet({ role }: { role: UserRole }) {
      const [open, setOpen] = useState(false);
      const pathname = usePathname();
      return (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <SheetHeader className="px-4 py-5 border-b">
              <SheetTitle>cy-eventsystem</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-3">
              {items.filter((i) => i.roles.includes(role)).map((i) => {
                const active = i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`);
                const Icon = i.icon;
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {i.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      );
    }
    ```

    **components/feature/shell/Breadcrumbs.tsx** (Client; usePathname → segments using shadcn breadcrumb):
    ```tsx
    "use client";
    import Link from "next/link";
    import { usePathname } from "next/navigation";
    import {
      Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
      BreadcrumbPage, BreadcrumbSeparator,
    } from "@/components/ui/breadcrumb";

    function humanize(seg: string): string {
      return seg
        .replace(/^\[(.+)\]$/, "$1")
        .replace(/-/g, " ")
        .replace(/^./, (c) => c.toUpperCase());
    }

    export function Breadcrumbs() {
      const pathname = usePathname();
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length === 0) return null;

      return (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/">Dashboard</Link></BreadcrumbLink>
            </BreadcrumbItem>
            {segments.map((seg, idx) => {
              const href = "/" + segments.slice(0, idx + 1).join("/");
              const isLast = idx === segments.length - 1;
              return (
                <span key={href} className="flex items-center">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{humanize(seg)}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild><Link href={href}>{humanize(seg)}</Link></BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      );
    }
    ```

    **components/feature/auth/PhaseOnePocRoleSwitcher.tsx** (D-06; filename intentional):
    ```tsx
    // PHASE 1 ONLY — REMOVE IN PHASE 2 (CONTEXT.md D-06)
    "use client";
    import { useRouter } from "next/navigation";
    import { readMockSessionClient, writeMockSessionClient } from "@/lib/mock/cookie";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import {
      DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator,
    } from "@/components/ui/dropdown-menu";
    import type { UserRole } from "@/lib/types/user";

    export function PhaseOnePocRoleSwitcher() {
      const router = useRouter();
      const session = useCurrentUser();
      if (!session) return null;

      const flip = (role: UserRole) => {
        const current = readMockSessionClient();
        if (!current) return;
        writeMockSessionClient({ ...current, role });
        router.refresh();
      };

      return (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch role (POC only)
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={session.role} onValueChange={(v) => flip(v as UserRole)}>
            <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="staff">Staff</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </>
      );
    }
    ```

    **components/feature/auth/SignOutButton.tsx** (AUTH-05):
    ```tsx
    "use client";
    import { useRouter } from "next/navigation";
    import { LogOut } from "lucide-react";
    import { clearMockSessionClient } from "@/lib/mock/cookie";
    import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

    export function SignOutButton() {
      const router = useRouter();
      function signOut() {
        clearMockSessionClient();
        router.push("/login");
        router.refresh();
      }
      return (
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 size-4" /> Sign out
        </DropdownMenuItem>
      );
    }
    ```

    **components/feature/shell/UserMenu.tsx** (avatar + dropdown holding ThemeToggle items + PhaseOnePocRoleSwitcher + SignOut):
    ```tsx
    "use client";
    import { Sun, Moon, Monitor } from "lucide-react";
    import { useTheme } from "next-themes";
    import {
      DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
      DropdownMenuSeparator, DropdownMenuTrigger,
    } from "@/components/ui/dropdown-menu";
    import { Avatar, AvatarFallback } from "@/components/ui/avatar";
    import { Button } from "@/components/ui/button";
    import { PhaseOnePocRoleSwitcher } from "@/components/feature/auth/PhaseOnePocRoleSwitcher";
    import { SignOutButton } from "@/components/feature/auth/SignOutButton";
    import type { Session } from "@/lib/types/session";

    function initials(name: string): string {
      return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
    }

    export function UserMenu({ session }: { session: Session }) {
      const { setTheme } = useTheme();
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="User menu" className="rounded-full">
              <Avatar className="size-8">
                <AvatarFallback>{initials(session.displayName)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{session.displayName}</span>
              <span className="text-xs text-muted-foreground">{session.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 size-4" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 size-4" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 size-4" /> System
            </DropdownMenuItem>
            <PhaseOnePocRoleSwitcher />
            <DropdownMenuSeparator />
            <SignOutButton />
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    ```

    **components/feature/shell/TopBar.tsx** (Server-friendly except for the small mobile-nav and breadcrumbs islands):
    ```tsx
    import { Breadcrumbs } from "./Breadcrumbs";
    import { MobileNavSheet } from "./MobileNavSheet";
    import { UserMenu } from "./UserMenu";
    import type { Session } from "@/lib/types/session";

    export function TopBar({ session }: { session: Session }) {
      return (
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-3 max-w-[1400px] mx-auto px-4 md:px-6">
            <MobileNavSheet role={session.role} />
            <div className="flex-1 min-w-0">
              <Breadcrumbs />
            </div>
            <UserMenu session={session} />
          </div>
        </header>
      );
    }
    ```
    Note: TopBar is rendered server-side because its parent layout is a Server Component, but its children Breadcrumbs/MobileNavSheet/UserMenu are Client Components — that boundary is fine.

    Critical:
    - All `'use client'` files have the directive on line 1 (above comment markers if any).
    - Breadcrumbs always renders at least the "Dashboard" segment (avoids empty bar on `/`).
    - Sidebar uses `aria-current="page"` on active link for accessibility.
    - PhaseOnePocRoleSwitcher reads via useCurrentUser hook (NOT through props) so it can re-render on cookie change without server prop staleness.
  </action>
  <verify>
    <automated>ls app/(app)/layout.tsx app/(app)/unauthorized/page.tsx components/feature/shell/AppSidebar.tsx components/feature/shell/TopBar.tsx components/feature/shell/UserMenu.tsx components/feature/shell/MobileNavSheet.tsx components/feature/shell/Breadcrumbs.tsx components/feature/auth/PhaseOnePocRoleSwitcher.tsx components/feature/auth/SignOutButton.tsx | wc -l | grep -q "^9$"; grep -q "requireSession" app/(app)/layout.tsx; grep -q "AppSidebar" app/(app)/layout.tsx; grep -q "TopBar" app/(app)/layout.tsx; grep -q "max-w-\[1400px\]" app/(app)/layout.tsx; grep -q "EmptyState" app/(app)/unauthorized/page.tsx; grep -q "usePathname" components/feature/shell/AppSidebar.tsx; grep -q "roles: \[\"admin\"\]" components/feature/shell/AppSidebar.tsx; grep -q "hidden md:flex" components/feature/shell/AppSidebar.tsx; grep -q "PHASE 1 ONLY" components/feature/auth/PhaseOnePocRoleSwitcher.tsx; grep -q "router.refresh" components/feature/auth/PhaseOnePocRoleSwitcher.tsx; grep -q "clearMockSessionClient" components/feature/auth/SignOutButton.tsx; grep -q "MobileNavSheet" components/feature/shell/TopBar.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - All 9 new files exist (verify via ls | wc -l).
    - `app/(app)/layout.tsx` is a Server Component (no `'use client'`), imports `requireSession` AND renders `<AppSidebar role={session.role}/>` + `<TopBar session={session}/>`.
    - `app/(app)/unauthorized/page.tsx` uses `<EmptyState/>` from `@/components/ui/empty-state`.
    - `components/feature/shell/AppSidebar.tsx` references `usePathname` AND includes `roles: ["admin"]` for the Users nav item (AUTH-10 gating).
    - `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` includes `PHASE 1 ONLY` comment AND calls `router.refresh()` after cookie write.
    - `components/feature/auth/SignOutButton.tsx` calls `clearMockSessionClient` and redirects to `/login`.
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <done>App layout role-gates correctly, unauthorized renders for staff hitting admin routes (verified per-route in later plans), role switcher works via cookie + refresh, sign-out clears cookie, build passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| mock_session cookie ↔ (app) layout | Layout reads cookie via async `cookies()`. Phase 1 trusts the cookie's JSON shape; Phase 2 verifies signature. |
| Client cookie write (login form) | Browser-side document.cookie write — non-httpOnly per D-05. |
| Role gate in (app) layout + per-route `requireAdmin()` | Two-layer defense even in Phase 1; sets the pattern for Phase 2's DAL. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Spoofing | Forged mock_session via DevTools could grant admin access | accept | DELIBERATE for Phase 1 POC — documented in CONTEXT.md D-05. Mock auth has zero real privileges (no Firebase calls, no data persistence). Pattern intentionally mirrors Phase 2 `__session` shape; in Phase 2 the cookie becomes httpOnly + signed and the layout helper swaps from JSON.parse to verifySessionCookie. |
| T-04-02 | Elevation of privilege | Staff URL-types into `/users` to access admin UI | mitigate | D-07 strict gate: page-level `requireAdmin()` redirects to `/unauthorized`. Sidebar also hides Users nav item for staff (defense in depth). |
| T-04-03 | Information disclosure | Seed users disclosure on /login lists 5 real-looking emails | accept | All seed emails use @example.com (synthetic per CLAUDE.md secrets policy). POC component is namespaced `seed-users-disclosure.tsx` and removed in Phase 2 (comment marker). |
| T-04-04 | Tampering | Disabled flag on session lets disabled users bypass login | mitigate | LoginForm checks `user.disabled` and refuses; `requireSession` also redirects to /login if `session.disabled` is true. |
| T-04-05 | Repudiation | No audit log for sign-in/sign-out in Phase 1 | accept | Mock store does not log session events. Phase 2 writes user.lastLoginAt + Cloud Function audit. |

Phase 1 specific deliberate-acceptance summary: the mock_session cookie is non-httpOnly because Phase 1 has no secrets; the pattern mirrors Phase 2 __session shape so the swap is transparent.
</threat_model>

<verification>
- Root `/` redirects: unauth → /login; auth → /(app)/page.tsx (Plan 05 will render the dashboard there).
- All 4 auth routes render the appropriate form. /register triggers notFound.
- (app) layout enforces session presence; redirects to /login otherwise.
- AppSidebar hides "Users" for staff role.
- PhaseOnePocRoleSwitcher visible in user menu for any logged-in user.
- Sign-out clears cookie + redirects to /login.
- `npm run build` passes.
- `npx tsc --noEmit` passes.
</verification>

<success_criteria>
- Auth shell + role gate spine complete.
- AUTH-01 (sign in), AUTH-03 (forgot), AUTH-04 (set), AUTH-05 (sign out), AUTH-06 (no register), AUTH-10 (admin-only nav + unauthorized page) all satisfied at Phase 1 mock level.
- Wave 3 plans can rely on `(app)/layout.tsx` + `requireSession` + `requireAdmin` + AppSidebar all working.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-01/01-04-auth-shell-role-gate-SUMMARY.md` documenting: all 17 new/modified files, the role-gate flow, the Phase 1→Phase 2 swap surface (which helper/decoder swaps where), and any console warnings encountered during `next dev`.
</output>
