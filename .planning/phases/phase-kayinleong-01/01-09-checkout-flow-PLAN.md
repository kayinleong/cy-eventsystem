---
phase: 01-ui-poc
plan: 09
type: execute
wave: 3
depends_on: [01, 02, 03, 04, 08]
files_modified:
  - app/(app)/events/[eventId]/checkout/page.tsx
autonomous: true
requirements:
  - CO-01
  - CO-02
  - CO-03
  - CO-04
  - CO-05
  - CO-06
  - CO-07
  - CO-08
  - CO-09
  - CO-10
  - SCN-01
  - SCN-04

must_haves:
  truths:
    - "/events/[eventId]/checkout renders the scan-session UI pre-scoped to the event (no event picker needed)."
    - "Only users with access to the event (admin OR uid in event.allowedStaff) can reach the page."
    - "Cart commit calls store.checkout — atomically; on stock failure, surfaces the offending lines and does NOT mutate the store (CO-05)."
    - "Scanner + manual entry + cart panel all reused from Plan 08."
    - "After successful commit, redirect to /events/[eventId] and show success toast."
    - "Page only allows checkout for events in 'planned' or 'active' status (silently rejects completed/cancelled)."
  artifacts:
    - path: "app/(app)/events/[eventId]/checkout/page.tsx"
      provides: "Per-event checkout flow — pre-selects event, fixes mode to checkout, reuses scan-session"
      contains: "ScanSessionProvider"
      min_lines: 50
  key_links:
    - from: "app/(app)/events/[eventId]/checkout/page.tsx"
      to: "components/feature/scan/scan-session.tsx + ScannerWidget + ScanCartPanel + ScanHeader + ManualEntryInput"
      via: "Server shell awaits params, fetches event, hands to ScanSessionProvider as initialEvent"
      pattern: "ScanSessionProvider"
---

<objective>
Wire the per-event checkout route by composing the scan-session substrate built in Plan 08 — pre-selected event, fixed checkout mode, role gate enforced by EVT-08.

Output: 1 new route file. Heavy lifting already done in Plan 08.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@.planning/REQUIREMENTS.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@lib/types/event.ts
@lib/auth/mock-session.ts
@lib/mock/store.ts
@lib/mock/selectors.ts
@components/ui/page-header.tsx
@components/ui/button.tsx
@components/feature/scan/scan-session.tsx
@components/feature/scan/ScannerWidget.tsx
@components/feature/scan/ScanCartPanel.tsx
@components/feature/scan/ScanHeader.tsx
@components/feature/scan/ManualEntryInput.tsx

<interfaces>
```tsx
// Component contract: this page is a thin shell that:
// 1) Awaits params to extract eventId
// 2) requireSession() + access check (admin OR uid in allowedStaff)
// 3) Loads event from store; redirects /unauthorized if not allowed; notFound() if missing
// 4) Renders a ScanSessionProvider with initialMode="checkout" and initialEvent=event
// 5) Embeds Scanner + ManualEntry + Cart + Header from Plan 08
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: /events/[eventId]/checkout route</name>
  <files>app/(app)/events/[eventId]/checkout/page.tsx</files>
  <read_first>
    - .planning/REQUIREMENTS.md CO-01, CO-02, CO-04, CO-05, EVT-08
    - lib/auth/mock-session.ts (requireSession)
    - lib/mock/selectors.ts (selectEventById)
    - components/feature/scan/scan-session.tsx (ScanSessionProvider props)
    - All 4 scan-feature components from Plan 08
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md (await params)
  </read_first>
  <action>
    **app/(app)/events/[eventId]/checkout/page.tsx**:

    The route must be a Server shell that performs access checks before handing data to the ScanSessionProvider client island.

    Because ScanSessionProvider is `'use client'` and the surrounding shell is Server, we structure this as: Server `page.tsx` (auth + event lookup) → renders a small client component that wraps everything in ScanSessionProvider.

    Create a small co-located client component for the inner client tree:

    ```tsx
    // app/(app)/events/[eventId]/checkout/page.tsx (Server Component)
    import type { Metadata } from "next";
    import { notFound, redirect } from "next/navigation";
    import { requireSession } from "@/lib/auth/mock-session";
    import { getSnapshot } from "@/lib/mock/store";
    import { selectEventById } from "@/lib/mock/selectors";
    import { CheckoutClient } from "./_components/checkout-client";

    type RouteProps = { params: Promise<{ eventId: string }> };

    export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
      const { eventId } = await params;
      const ev = selectEventById(getSnapshot(), eventId);
      return { title: ev ? `Check out · ${ev.name}` : "Check out" };
    }

    export default async function CheckoutPage({ params }: RouteProps) {
      const session = await requireSession();
      const { eventId } = await params;
      const event = selectEventById(getSnapshot(), eventId);
      if (!event) notFound();

      // EVT-08: access guard
      if (session.role !== "admin" && !event.allowedStaff.includes(session.uid)) {
        redirect("/unauthorized");
      }
      // Reject non-actionable statuses
      if (event.status !== "planned" && event.status !== "active") {
        redirect(`/events/${eventId}`);
      }

      return <CheckoutClient event={event} />;
    }
    ```

    Then create the client wrapper at `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx`:

    ```tsx
    "use client";
    import Link from "next/link";
    import { ChevronLeft } from "lucide-react";
    import { Button } from "@/components/ui/button";
    import { PageHeader } from "@/components/ui/page-header";
    import { ScanSessionProvider } from "@/components/feature/scan/scan-session";
    import { ScannerWidget } from "@/components/feature/scan/ScannerWidget";
    import { ScanCartPanel } from "@/components/feature/scan/ScanCartPanel";
    import { ScanHeader } from "@/components/feature/scan/ScanHeader";
    import { ManualEntryInput } from "@/components/feature/scan/ManualEntryInput";
    import { useScanSession } from "@/components/feature/scan/scan-session";
    import type { EventDoc } from "@/lib/types/event";

    function CheckoutBody() {
      const { addLine } = useScanSession();
      return (
        <div className="space-y-6">
          <ScanHeader />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <ScannerWidget />
              <ManualEntryInput onSubmit={(sku) => addLine(sku)} />
            </div>
            <ScanCartPanel />
          </div>
        </div>
      );
    }

    export function CheckoutClient({ event }: { event: EventDoc }) {
      return (
        <ScanSessionProvider initialMode="checkout" initialEvent={event}>
          <div className="space-y-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href={`/events/${event.id}`}><ChevronLeft className="mr-1 size-4" /> Back to event</Link>
            </Button>
            <PageHeader
              title={`Check out · ${event.name}`}
              description="Scan items to add them to this event's check-out cart."
            />
            <CheckoutBody />
          </div>
        </ScanSessionProvider>
      );
    }
    ```

    Update `files_modified` mentally to include the `_components/checkout-client.tsx` — the executor must create this file too. (The frontmatter only lists the page.tsx; the colocated _components file is created as part of the same task since route-relative private folders are conventional in Next 16 and don't pollute routes.)

    Critical:
    - The Server Component `page.tsx` does access checks via `requireSession()` + role + allowedStaff. Phase 2 will move this to a real DAL but the check shape is identical.
    - When the user commits the cart, the existing `commit()` in scan-session redirects to `/events/${eventId}` — which the user came from. No additional logic needed here.
    - `_components/checkout-client.tsx` is a Client Component; it CANNOT call requireSession (server-only).
  </action>
  <verify>
    <automated>ls app/(app)/events/[eventId]/checkout/page.tsx app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx; grep -q "ScanSessionProvider" app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx; grep -q "initialMode=\"checkout\"" app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx; grep -q "initialEvent={event}" app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx; grep -q "allowedStaff.includes" app/(app)/events/[eventId]/checkout/page.tsx; grep -q "redirect(\`/events" app/(app)/events/[eventId]/checkout/page.tsx; grep -q "await params" app/(app)/events/[eventId]/checkout/page.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist (page.tsx + _components/checkout-client.tsx).
    - Page enforces EVT-08 access check + rejects completed/cancelled events.
    - ScanSessionProvider receives initialMode="checkout" and initialEvent={event}.
    - npm run build passes; tsc passes.
  </acceptance_criteria>
  <done>Per-event checkout route works: opens scoped to the event, user scans (or types), cart commits via store.checkout, redirects to event detail.</done>
</task>

</tasks>

<verification>
- Visiting /events/evt-planned-01/checkout as admin opens the page with the event preselected.
- Visiting same route as staff who's NOT in allowedStaff redirects to /unauthorized.
- Visiting /events/evt-completed-01/checkout redirects to /events/evt-completed-01 (cannot check out completed event).
- Manual entry of a valid SKU + Confirm CTA reduces availableQty on the inventory list (verified via cross-page navigation; store mutation re-renders dashboards too).
- npm run build passes.
</verification>

<success_criteria>CO-01, CO-04 (atomic cart commit via store.checkout), CO-05 (failed cart shows error without partial mutation), CO-06 (optimistic — instant since store mutates synchronously; pattern mirrors Phase 2 useOptimistic), CO-08 (manual entry), CO-09 (5 formats), CO-10 (manual entry handler accepts Bluetooth keyboard input) all satisfied at Phase 1 mock level.</success_criteria>

<output>After completion, create `.planning/phases/phase-kayinleong-01/01-09-checkout-flow-SUMMARY.md` documenting the route + colocated client + the end-to-end test path (admin login → /events/evt-active-01/checkout → manual entry SKU → confirm → see KPI on dashboard update).</output>
