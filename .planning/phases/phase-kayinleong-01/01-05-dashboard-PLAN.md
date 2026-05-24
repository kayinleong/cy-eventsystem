---
phase: 01-ui-poc
plan: 05
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - app/(app)/page.tsx
  - components/feature/dashboard/KpiCards.tsx
  - components/feature/dashboard/ActiveEventsWidget.tsx
  - components/feature/dashboard/LowStockWidget.tsx
  - components/feature/dashboard/OverdueReturnsWidget.tsx
  - components/feature/dashboard/RecentActivityFeed.tsx
autonomous: true
requirements:
  - EVT-07
  - RP-02
  - RP-03
  - AUD-01
  - NFR-05

must_haves:
  truths:
    - "Dashboard at / renders 4 KPI cards: Active events, Items checked out (sum of outQty across active events), Low-stock items, Open missing."
    - "Active Events widget lists the 2 active seed events (Spring Product Demo, Marketing Pop-Up Booth)."
    - "Low Stock widget lists items where availableQty <= lowStockThreshold and lowStockOrderedAt is null."
    - "Overdue Returns widget lists active events with endDate < 2026-05-24 (the seed 'Marketing Pop-Up Booth' qualifies — EVT-07)."
    - "Recent Activity feed shows the last 20 transactions across the store, newest first."
    - "After committing a checkout via store.checkout (later plans), the widgets re-render with new values."
  artifacts:
    - path: "app/(app)/page.tsx"
      provides: "Dashboard route at / (server shell; composes the 5 widgets)"
      contains: "PageHeader"
    - path: "components/feature/dashboard/KpiCards.tsx"
      provides: "4 KPI cards in a responsive grid"
      contains: "useMockStore"
    - path: "components/feature/dashboard/ActiveEventsWidget.tsx"
      provides: "Active events list reading from store"
      contains: "selectActiveEvents"
    - path: "components/feature/dashboard/LowStockWidget.tsx"
      provides: "Low-stock items + 'Mark as ordered' inline button"
      contains: "selectLowStockItems"
    - path: "components/feature/dashboard/OverdueReturnsWidget.tsx"
      provides: "Overdue events (active + endDate past)"
      contains: "selectOverdueEvents"
    - path: "components/feature/dashboard/RecentActivityFeed.tsx"
      provides: "Last 20 transactions, newest first"
      contains: "selectRecentActivity"
  key_links:
    - from: "app/(app)/page.tsx"
      to: "5 dashboard widget components"
      via: "Server Component composes widgets; widgets subscribe to store via useMockStore"
      pattern: "ActiveEventsWidget|LowStockWidget|OverdueReturnsWidget|RecentActivityFeed|KpiCards"
    - from: "components/feature/dashboard/LowStockWidget.tsx"
      to: "lib/mock/store.ts markLowStockOrdered + lib/hooks/use-current-user"
      via: "Inline button calls markLowStockOrdered with current actor"
      pattern: "markLowStockOrdered"
---

<objective>
Build the dashboard at `/` (route `(app)/page.tsx`). Composes 5 widgets that read live from the mock store via useMockStore — every store mutation in later plans causes widget re-renders.

Output: 1 new route (Server Component shell) + 5 widget components (all `'use client'` to subscribe to the store).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-PATTERNS.md
@.planning/REQUIREMENTS.md
@lib/types/event.ts
@lib/types/item.ts
@lib/types/transaction.ts
@lib/mock/store.ts
@lib/mock/selectors.ts
@lib/hooks/use-mock-store.ts
@lib/hooks/use-current-user.ts
@lib/auth/mock-session.ts
@components/ui/card.tsx
@components/ui/badge.tsx
@components/ui/button.tsx
@components/ui/scroll-area.tsx
@components/ui/page-header.tsx
@components/feature/status/StatusBadge.tsx
@components/feature/status/status-to-tone.ts

<interfaces>
```tsx
// All widgets are 'use client' and call useMockStore(selector).
// Each widget owns its own container card and copy.
export function KpiCards(props: { role: "admin" | "staff" }): React.ReactElement;
export function ActiveEventsWidget(): React.ReactElement;
export function LowStockWidget(): React.ReactElement;
export function OverdueReturnsWidget(): React.ReactElement;
export function RecentActivityFeed(): React.ReactElement;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build 5 dashboard widgets</name>
  <files>
    components/feature/dashboard/KpiCards.tsx,
    components/feature/dashboard/ActiveEventsWidget.tsx,
    components/feature/dashboard/LowStockWidget.tsx,
    components/feature/dashboard/OverdueReturnsWidget.tsx,
    components/feature/dashboard/RecentActivityFeed.tsx
  </files>
  <read_first>
    - lib/mock/selectors.ts (uses selectActiveEvents, selectLowStockItems, selectOverdueEvents, selectRecentActivity)
    - lib/mock/store.ts (markLowStockOrdered)
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md "Shared #4 — Mock store consumption" (lines 1112-1124), "Status badge" (lines 780-819)
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Layout & Route Patterns" (lines 148-156 — Card grid for dashboard KPI), Typography table (Display 24px for hero counts), "Voice & Copywriting" (lines 178-189 — sentence case, digits not words, dates relative under 7 days)
    - .planning/REQUIREMENTS.md EVT-07, RP-02, RP-03, AUD-01
    - components/ui/card.tsx (CardHeader, CardTitle, CardContent shape)
  </read_first>
  <action>
    All 5 files start with `"use client";` directive.

    **components/feature/dashboard/KpiCards.tsx**:
    ```tsx
    "use client";
    import { Calendar, PackageOpen, AlertTriangle, AlertCircle } from "lucide-react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectActiveEvents, selectLowStockItems, selectOpenMissing } from "@/lib/mock/selectors";

    export function KpiCards() {
      const activeEvents = useMockStore(selectActiveEvents);
      const lowStock = useMockStore(selectLowStockItems);
      const openMissing = useMockStore(selectOpenMissing);
      const itemsOut = useMockStore((s) => s.items.reduce((sum, i) => sum + i.outQty, 0));

      const cards: Array<{ label: string; value: number; icon: typeof Calendar }> = [
        { label: "Active events", value: activeEvents.length, icon: Calendar },
        { label: "Items checked out", value: itemsOut, icon: PackageOpen },
        { label: "Low stock", value: lowStock.length, icon: AlertTriangle },
        { label: "Open missing", value: openMissing.length, icon: AlertCircle },
      ];

      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                  <Icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{c.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    }
    ```

    **components/feature/dashboard/ActiveEventsWidget.tsx**:
    ```tsx
    "use client";
    import Link from "next/link";
    import { Calendar } from "lucide-react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectActiveEvents } from "@/lib/mock/selectors";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import { EmptyState } from "@/components/ui/empty-state";

    export function ActiveEventsWidget() {
      const events = useMockStore(selectActiveEvents);
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Active events</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState icon={Calendar} heading="No active events" body="Active events will appear here." />
            ) : (
              <ul className="divide-y divide-border">
                {events.map((e) => (
                  <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/events/${e.id}`} className="text-sm font-medium hover:underline truncate block">
                        {e.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{e.location}</p>
                    </div>
                    <StatusBadge tone={statusToTone(e.status)}>{statusToLabel(e.status)}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      );
    }
    ```

    **components/feature/dashboard/LowStockWidget.tsx** (RP-02 + RP-04 "mark as ordered" inline action):
    ```tsx
    "use client";
    import Link from "next/link";
    import { AlertTriangle } from "lucide-react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { Button } from "@/components/ui/button";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectLowStockItems } from "@/lib/mock/selectors";
    import { markLowStockOrdered } from "@/lib/mock/store";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import { EmptyState } from "@/components/ui/empty-state";
    import { toast } from "sonner";
    import { seedUsers } from "@/lib/mock/users";

    export function LowStockWidget() {
      const items = useMockStore(selectLowStockItems);
      const session = useCurrentUser();

      function markOrdered(itemId: string, name: string) {
        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't mark as ordered"); return; }
        markLowStockOrdered(itemId, actor);
        toast.success(`Marked ${name} as ordered`);
      }

      return (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Low stock</CardTitle>
            {items.length > 0 ? (
              <span className="text-xs text-muted-foreground">{items.length} below threshold</span>
            ) : null}
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <EmptyState icon={AlertTriangle} heading="Stock is healthy" body="No items below their threshold." />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/inventory/${i.id}`} className="text-sm font-medium hover:underline truncate block">
                        {i.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {i.availableQty} available · threshold {i.lowStockThreshold}
                      </p>
                    </div>
                    {session?.role === "admin" ? (
                      <Button variant="outline" size="xs" onClick={() => markOrdered(i.id, i.name)}>
                        Mark as ordered
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      );
    }
    ```

    **components/feature/dashboard/OverdueReturnsWidget.tsx** (EVT-07):
    ```tsx
    "use client";
    import Link from "next/link";
    import { Clock } from "lucide-react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectOverdueEvents } from "@/lib/mock/selectors";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { EmptyState } from "@/components/ui/empty-state";

    function formatShort(iso: string): string {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    export function OverdueReturnsWidget() {
      const events = useMockStore(selectOverdueEvents);
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Overdue returns</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState icon={Clock} heading="No overdue returns" body="Active events with past end dates will appear here." />
            ) : (
              <ul className="divide-y divide-border">
                {events.map((e) => (
                  <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/events/${e.id}/checkin`} className="text-sm font-medium hover:underline truncate block">
                        {e.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">Ended {formatShort(e.endDate)}</p>
                    </div>
                    <StatusBadge tone="amber">Overdue</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      );
    }
    ```

    **components/feature/dashboard/RecentActivityFeed.tsx** (AUD-01 surface — actor snapshot fields):
    ```tsx
    "use client";
    import Link from "next/link";
    import { Activity } from "lucide-react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { ScrollArea } from "@/components/ui/scroll-area";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectRecentActivity } from "@/lib/mock/selectors";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import { EmptyState } from "@/components/ui/empty-state";
    import { formatDistanceToNow } from "date-fns";

    export function RecentActivityFeed() {
      const txs = useMockStore((s) => selectRecentActivity(s, 20));
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {txs.length === 0 ? (
              <div className="px-6"><EmptyState icon={Activity} heading="No activity yet" body="Recent transactions will appear here." /></div>
            ) : (
              <ScrollArea className="h-80">
                <ul className="divide-y divide-border">
                  {txs.map((t) => (
                    <li key={t.id} className="px-6 py-3 flex items-start gap-3">
                      <StatusBadge tone={statusToTone(t.type)} className="mt-0.5">{statusToLabel(t.type)}</StatusBadge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{t.actorName}</span>
                          {" "}{t.type === "checkout" ? "checked out" : t.type === "checkin" ? "returned" : t.type === "missing" ? "flagged missing" : "adjusted"}{" "}
                          <span className="font-medium">{t.qty}</span>{" × "}
                          {t.itemName ? (
                            <Link href={`/inventory/${t.itemId}`} className="hover:underline">{t.itemName}</Link>
                          ) : t.itemName}
                          {t.eventId ? (
                            <>{" for "}<Link href={`/events/${t.eventId}`} className="hover:underline">{t.eventName}</Link></>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(t.at), { addSuffix: true })} · role: {t.actorRoleAtTimeOfAction}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      );
    }
    ```
  </action>
  <verify>
    <automated>ls components/feature/dashboard/KpiCards.tsx components/feature/dashboard/ActiveEventsWidget.tsx components/feature/dashboard/LowStockWidget.tsx components/feature/dashboard/OverdueReturnsWidget.tsx components/feature/dashboard/RecentActivityFeed.tsx | wc -l | grep -q "^5$"; grep -q "useMockStore" components/feature/dashboard/KpiCards.tsx; grep -q "selectLowStockItems" components/feature/dashboard/LowStockWidget.tsx; grep -q "markLowStockOrdered" components/feature/dashboard/LowStockWidget.tsx; grep -q "selectOverdueEvents" components/feature/dashboard/OverdueReturnsWidget.tsx; grep -q "selectRecentActivity" components/feature/dashboard/RecentActivityFeed.tsx; grep -q "actorRoleAtTimeOfAction" components/feature/dashboard/RecentActivityFeed.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 5 widget files exist and start with `"use client";`.
    - KpiCards renders 4 cards with values bound to store selectors.
    - LowStockWidget calls `markLowStockOrdered` on button click; admin-only.
    - OverdueReturnsWidget references `selectOverdueEvents`.
    - RecentActivityFeed renders `actorRoleAtTimeOfAction` per AUD-01.
    - All files use selectors from `lib/mock/selectors.ts` (no inline filtering).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>5 widgets compile, each reads live from store, low-stock has admin-only inline action, tsc passes.</done>
</task>

<task type="auto">
  <name>Task 2: Build dashboard route at (app)/page.tsx</name>
  <files>app/(app)/page.tsx</files>
  <read_first>
    - lib/auth/mock-session.ts (getMockSession — dashboard greets by name)
    - components/ui/page-header.tsx
    - components/feature/dashboard/* (5 widgets created in Task 1)
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Card grid" pattern
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
  </read_first>
  <action>
    **app/(app)/page.tsx** (Server Component shell):
    ```tsx
    import type { Metadata } from "next";
    import { getMockSession } from "@/lib/auth/mock-session";
    import { PageHeader } from "@/components/ui/page-header";
    import { KpiCards } from "@/components/feature/dashboard/KpiCards";
    import { ActiveEventsWidget } from "@/components/feature/dashboard/ActiveEventsWidget";
    import { LowStockWidget } from "@/components/feature/dashboard/LowStockWidget";
    import { OverdueReturnsWidget } from "@/components/feature/dashboard/OverdueReturnsWidget";
    import { RecentActivityFeed } from "@/components/feature/dashboard/RecentActivityFeed";

    export const metadata: Metadata = { title: "Dashboard" };

    export default async function DashboardPage() {
      const session = await getMockSession();
      const greeting = session?.displayName.split(" ")[0] ?? "there";
      return (
        <div className="space-y-6">
          <PageHeader
            title={`Welcome back, ${greeting}`}
            description="Active events, stock alerts, and recent activity at a glance."
          />
          <KpiCards />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ActiveEventsWidget />
            <LowStockWidget />
            <OverdueReturnsWidget />
            <RecentActivityFeed />
          </div>
        </div>
      );
    }
    ```
  </action>
  <verify>
    <automated>ls app/(app)/page.tsx; grep -q "KpiCards" app/(app)/page.tsx; grep -q "ActiveEventsWidget" app/(app)/page.tsx; grep -q "LowStockWidget" app/(app)/page.tsx; grep -q "OverdueReturnsWidget" app/(app)/page.tsx; grep -q "RecentActivityFeed" app/(app)/page.tsx; grep -q "PageHeader" app/(app)/page.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `app/(app)/page.tsx` exists.
    - Imports and renders all 5 widgets + PageHeader.
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <done>Dashboard route exists, composes 5 widgets, build passes.</done>
</task>

</tasks>

<verification>
- Dashboard renders KPI grid + 4 widgets in a 2-col grid (lg+).
- Active events widget lists 2 active seed events.
- Low-stock widget shows ≥4 items (per seed invariants from Plan 02).
- Overdue widget lists `Marketing Pop-Up Booth` (endDate 2026-05-22 < today 2026-05-24).
- Recent activity feed shows ≥20 transactions (seed has ~80).
- `npm run build` succeeds.
- `tsc --noEmit` passes.
</verification>

<success_criteria>
- EVT-07, RP-02, RP-03 satisfied at UI level.
- Dashboard surface complete; every other plan's mutations cause widget re-renders.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-01/01-05-dashboard-SUMMARY.md` documenting the 6 files created, the widget composition, and any console warnings during `next dev`.
</output>
