---
phase: phase-kayinleong-02
plan: 12
type: execute
wave: 11
depends_on:
  - 02
files_modified:
  - app/(app)/error.tsx
  - app/(app)/loading.tsx
  - app/(app)/not-found.tsx
  - app/(app)/inventory/[itemId]/not-found.tsx
  - app/(app)/events/[eventId]/not-found.tsx
  - app/unauthorized.tsx
  - app/(app)/inventory/loading.tsx
  - app/(app)/events/loading.tsx
  - app/(app)/reports/loading.tsx
autonomous: true
requirements:
  - NFR-05
  - NFR-09
  - AUTH-10

must_haves:
  truths:
    - "Each major route segment ships error.tsx, loading.tsx, not-found.tsx where appropriate per ROADMAP Block H."
    - "error.tsx surfaces friendly copy; never displays raw Firebase error codes or admin SDK stack traces."
    - "loading.tsx renders a skeleton during DAL fetch — no blank flash."
    - "not-found.tsx renders for missing items/events with route-specific copy."
    - "unauthorized.tsx exists and renders for requireAdmin() rejections (AUTH-10)."
  artifacts:
    - path: "app/(app)/error.tsx"
      provides: "App-wide error boundary"
      contains: "use client"
    - path: "app/unauthorized.tsx"
      provides: "Unauthorized page paired with Next 16 unauthorized() navigation function"
      contains: "Not authorized"
  key_links:
    - from: "lib/auth/dal.ts requireAdmin"
      to: "app/unauthorized.tsx"
      via: "unauthorized() → renders this page"
      pattern: "unauthorized"
---

<objective>
**Block H — Error / loading / not-found boundaries per ROADMAP.** Per RESEARCH §8.2 + Next.js 16 docs. Friendly error copy; no Firebase code leaks; skeleton during fetch.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-02/02-RESEARCH.md
@.planning/phases/phase-kayinleong-02/02-CONTEXT.md
@app/(app)/layout.tsx
@components/ui/skeleton.tsx
@components/ui/empty-state.tsx
@components/ui/button.tsx
@lib/auth/dal.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: App-wide error / loading / not-found</name>
  <files>
    app/(app)/error.tsx,
    app/(app)/loading.tsx,
    app/(app)/not-found.tsx,
    app/unauthorized.tsx
  </files>
  <read_first>
    - Existing Phase 1 versions if any (Phase 1 may not have shipped these; create if absent)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §8.2 lines 1639-1646 (segment list)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md (Next 16 error.tsx — MUST be Client Component with 'use client')
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md (Next 16 not-found.tsx — Server Component, exports default)
    - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unauthorized.md (Next 16 unauthorized() pair)
  </read_first>
  <action>
    **1.1 — `app/(app)/error.tsx`** (per Next 16 Client Component requirement):

    ```typescript
    "use client";
    import { useEffect } from "react";
    import { Button } from "@/components/ui/button";

    export default function AppError({
      error,
      reset,
    }: {
      error: Error & { digest?: string };
      reset: () => void;
    }) {
      useEffect(() => {
        // Log to Firebase Functions Logs / server console; client-side just renders friendly UI
        console.error("[app/(app)/error]", error.message, error.digest);
      }, [error]);

      return (
        <main className="min-h-svh grid place-items-center px-4 py-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground">
              We couldn't load this page. Try again or come back later.
            </p>
            {error.digest ? (
              <p className="text-xs text-muted-foreground font-mono">Reference: {error.digest}</p>
            ) : null}
            <div className="flex gap-2 justify-center">
              <Button onClick={() => reset()}>Try again</Button>
              <Button variant="outline" onClick={() => window.location.assign("/")}>Go to dashboard</Button>
            </div>
          </div>
        </main>
      );
    }
    ```

    CRITICAL: `error.message` may contain Firebase internals. Do NOT render it. Only the digest is safe.

    **1.2 — `app/(app)/loading.tsx`** (Server Component, full-page skeleton):

    ```typescript
    import { Skeleton } from "@/components/ui/skeleton";

    export default function AppLoading() {
      return (
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      );
    }
    ```

    **1.3 — `app/(app)/not-found.tsx`:**

    ```typescript
    import Link from "next/link";
    import { Button } from "@/components/ui/button";

    export default function NotFound() {
      return (
        <main className="min-h-svh grid place-items-center px-4 py-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold">Page not found</h1>
            <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
            <Button asChild><Link href="/">Back to dashboard</Link></Button>
          </div>
        </main>
      );
    }
    ```

    **1.4 — `app/unauthorized.tsx`** (Next 16 `unauthorized()` pair — AUTH-10):

    Check if Phase 1 shipped this. If not, create:

    ```typescript
    import Link from "next/link";
    import { Button } from "@/components/ui/button";

    export default function Unauthorized() {
      return (
        <main className="min-h-svh grid place-items-center px-4 py-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold">Not authorized</h1>
            <p className="text-muted-foreground">You don't have access to this page. Contact an admin if you think this is a mistake.</p>
            <Button asChild><Link href="/">Back to dashboard</Link></Button>
          </div>
        </main>
      );
    }
    ```

    NOTE: `unauthorized.tsx` lives at `app/unauthorized.tsx` (top-level, NOT inside `(app)/`). This is per Next 16's `unauthorized()` navigation function pattern — it renders the nearest unauthorized.tsx going up the tree.
  </action>
  <acceptance_criteria>
    - `test -f app/\(app\)/error.tsx` succeeds.
    - `head -3 app/\(app\)/error.tsx | grep -q '"use client"'` succeeds.
    - `grep -q "error.digest" app/\(app\)/error.tsx` succeeds (digest is the safe-to-show identifier).
    - `grep -q "error.message" app/\(app\)/error.tsx` may exist (in console.error only; verify NOT in JSX).
    - `test -f app/\(app\)/loading.tsx` succeeds.
    - `test -f app/\(app\)/not-found.tsx` succeeds.
    - `test -f app/unauthorized.tsx` succeeds.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>test -f "app/(app)/error.tsx" && head -3 "app/(app)/error.tsx" | grep -q '"use client"' && test -f "app/(app)/loading.tsx" && test -f "app/(app)/not-found.tsx" && test -f app/unauthorized.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>App-wide boundaries in place.</done>
</task>

<task type="auto">
  <name>Task 2: Route-specific not-founds + section loadings</name>
  <files>
    app/(app)/inventory/[itemId]/not-found.tsx,
    app/(app)/events/[eventId]/not-found.tsx,
    app/(app)/inventory/loading.tsx,
    app/(app)/events/loading.tsx,
    app/(app)/reports/loading.tsx
  </files>
  <read_first>
    - components/ui/empty-state.tsx (Phase 1 EmptyState component — use for route-specific not-founds)
    - app/(app)/inventory/[itemId]/page.tsx + edit/page.tsx (the consumers of notFound())
  </read_first>
  <action>
    **2.1 — `app/(app)/inventory/[itemId]/not-found.tsx`:**

    ```typescript
    import Link from "next/link";
    import { Button } from "@/components/ui/button";

    export default function ItemNotFound() {
      return (
        <main className="grid place-items-center min-h-[60vh] px-4">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold">Item not found</h1>
            <p className="text-muted-foreground">This item doesn't exist or has been removed.</p>
            <Button asChild><Link href="/inventory">Back to inventory</Link></Button>
          </div>
        </main>
      );
    }
    ```

    **2.2 — `app/(app)/events/[eventId]/not-found.tsx`** (similar, with EVT-08 hint):

    ```typescript
    import Link from "next/link";
    import { Button } from "@/components/ui/button";

    export default function EventNotFound() {
      return (
        <main className="grid place-items-center min-h-[60vh] px-4">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold">Event not found</h1>
            <p className="text-muted-foreground">
              This event doesn't exist, or you don't have access to it. Contact an admin if this is a mistake.
            </p>
            <Button asChild><Link href="/events">Back to events</Link></Button>
          </div>
        </main>
      );
    }
    ```

    NOTE: The copy is intentionally ambiguous between "doesn't exist" and "you lack access" — this is the standard pattern to avoid enumeration (a staff user shouldn't learn from the error whether an event with that ID exists in the system).

    **2.3 — Section loading skeletons** (`/inventory`, `/events`, `/reports`):

    Each renders a skeleton matching the page's layout. Example for `/inventory`:

    ```typescript
    // app/(app)/inventory/loading.tsx
    import { Skeleton } from "@/components/ui/skeleton";

    export default function InventoryLoading() {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      );
    }
    ```

    Do similar for `events/loading.tsx` and `reports/loading.tsx` (any layout-matching shape works; keep light).
  </action>
  <acceptance_criteria>
    - `test -f "app/(app)/inventory/[itemId]/not-found.tsx"` succeeds.
    - `test -f "app/(app)/events/[eventId]/not-found.tsx"` succeeds.
    - `test -f "app/(app)/inventory/loading.tsx"` succeeds.
    - `test -f "app/(app)/events/loading.tsx"` succeeds.
    - `test -f "app/(app)/reports/loading.tsx"` succeeds.
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>test -f "app/(app)/inventory/[itemId]/not-found.tsx" && test -f "app/(app)/events/[eventId]/not-found.tsx" && test -f "app/(app)/inventory/loading.tsx" && test -f "app/(app)/events/loading.tsx" && test -f "app/(app)/reports/loading.tsx" && npm run build</automated>
  </verify>
  <done>Route segment boundaries shipped.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation |
|---|---|---|---|---|
| T-02-12-01 | Information disclosure | error.tsx leaks Firebase stack traces to user | mitigate | console.error logs the error object server-side; JSX renders only friendly copy + error.digest (a safe opaque id) |
| T-02-12-02 | Information disclosure | not-found.tsx for events leaks event existence | mitigate | event not-found copy is intentionally ambiguous between "doesn't exist" and "you lack access" to avoid enumeration |
</threat_model>

<verification>
- All required segments shipped: error / loading / not-found / unauthorized.
- error.tsx is Client Component with 'use client'.
- Route-specific not-founds exist for /inventory/[itemId] and /events/[eventId].
- Error UI never renders raw Firebase error messages (console.error only).
- npm run build green.
</verification>

<success_criteria>
- NFR-05 (no console errors in next dev) inherited.
- NFR-09 (no cacheComponents — still verified in next.config.ts).
- AUTH-10 (unauthorized page) functional.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-12-error-loading-not-found-segments-SUMMARY.md` listing the 9 files. <= 40 lines.
</output>
