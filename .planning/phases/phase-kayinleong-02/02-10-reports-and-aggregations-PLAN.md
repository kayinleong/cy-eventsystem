---
phase: phase-kayinleong-02
plan: 10
type: execute
wave: 10
depends_on:
  - 05
  - 07
  - 09
files_modified:
  - lib/data/transactions.server.ts
  - lib/data/aggregations.server.ts
  - lib/hooks/use-transactions-live.ts
  - app/(app)/page.tsx
  - app/(app)/reports/stock/page.tsx
  - app/(app)/reports/out/page.tsx
  - app/(app)/reports/history/page.tsx
  - app/(app)/reports/missing/page.tsx
  - app/(app)/reports/repurchase/page.tsx
  - components/feature/dashboard/KpiCards.tsx
  - components/feature/dashboard/LowStockWidget.tsx
  - components/feature/dashboard/RecentActivityFeed.tsx
  - components/feature/reports/StockReportTable.tsx
  - components/feature/reports/ItemsOutTable.tsx
  - components/feature/reports/HistoryTable.tsx
  - components/feature/reports/MissingItemsTable.tsx
  - components/feature/reports/RepurchaseTable.tsx
  - components/layout/Nav.tsx
autonomous: false
requirements:
  - REP-01
  - REP-02
  - REP-03
  - REP-04
  - REP-05
  - REP-06
  - REP-07
  - RP-01
  - RP-02
  - RP-03
  - RP-04
  - EVT-07
  - INT-04
  - NFR-06

must_haves:
  truths:
    - "Dashboard KPI cards use Firestore count() aggregations per D-21 — NOT real-time, NOT reduce()."
    - "Five report pages (/reports/stock, /reports/out, /reports/history, /reports/missing, /reports/repurchase) each backed by an Admin SDK cursor-paged Server Component fetch."
    - "Filter URL params per REP-06 preserved. Cursor params per D-17. 50/page per REP-07."
    - "Nav low-stock badge live count via Firestore count() on isLowStock==true, refetched on path change per RP-03."
    - "lib/data/transactions.server.ts ships getTransactionsPage with filter + cursor (REP-04)."
    - "lib/data/aggregations.server.ts ships 4 count() queries for KPIs."
    - "LowStockWidget consumes useInventoryLive({isLowStock: true, limit: 50})."
    - "OverdueReturnsWidget consumes useEventsLive + client-side filter endDate < now()."
    - "Manual rules audit covers cross-collection reads."
  artifacts:
    - path: "lib/data/aggregations.server.ts"
      provides: "4 KPI count() helpers"
      contains: "getCountFromServer\\|\\.count\\(\\)"
    - path: "lib/data/transactions.server.ts"
      provides: "getTransactionsPage cursor-paged Admin SDK reader"
      contains: "transactions"
    - path: "components/feature/dashboard/KpiCards.tsx"
      provides: "Server Component using count() aggregations (NOT reduce)"
      contains: "totalItems"
  key_links:
    - from: "components/feature/dashboard/KpiCards.tsx"
      to: "lib/data/aggregations.server.ts"
      via: "Admin SDK count() aggregations on each load + after revalidatePath('/')"
      pattern: "count\\(\\)"
    - from: "components/layout/Nav.tsx"
      to: "Firestore count() on isLowStock==true"
      via: "Re-query on path change per RP-03"
      pattern: "isLowStock"
---

<objective>
**Block G — Reports + aggregations.** Migrate all 5 report pages from mock store to Firestore. Replace dashboard KPI `reduce()` with Firestore `count()` aggregations per D-21. Preserve filter URL params per REP-06. Cursor pagination per D-17. Wire nav low-stock badge per RP-03.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-02/02-CONTEXT.md
@.planning/phases/phase-kayinleong-02/02-RESEARCH.md
@.planning/phases/phase-kayinleong-02/02-PATTERNS.md
@.planning/phases/phase-kayinleong-02/02-05-inventory-data-layer-and-actions-PLAN.md
@.planning/phases/phase-kayinleong-02/02-07-events-data-and-cloud-function-PLAN.md
@.planning/phases/phase-kayinleong-02/02-09-checkin-action-and-missing-PLAN.md
@.planning/phases/phase-kayinleong-01/01-05-dashboard-SUMMARY.md
@.planning/phases/phase-kayinleong-01/01-11-reports-SUMMARY.md
@firestore.indexes.json
@firestore.rules
@lib/firebase/admin.ts
@lib/firebase/client.ts
@lib/auth/dal.ts
@lib/data/inventory.server.ts
@lib/data/events.server.ts
@lib/data/missing.server.ts
@lib/hooks/use-inventory-live.ts
@lib/hooks/use-events-live.ts
@lib/hooks/use-missing-live.ts
@lib/hooks/use-transactions-live.ts
@lib/hooks/use-url-table-state.ts
@app/(app)/page.tsx
@app/(app)/reports/stock/page.tsx
@app/(app)/reports/out/page.tsx
@app/(app)/reports/history/page.tsx
@app/(app)/reports/missing/page.tsx
@app/(app)/reports/repurchase/page.tsx
@components/feature/dashboard/KpiCards.tsx
@components/feature/dashboard/LowStockWidget.tsx
@components/feature/dashboard/RecentActivityFeed.tsx
@components/feature/reports/StockReportTable.tsx
@components/feature/reports/ItemsOutTable.tsx
@components/feature/reports/HistoryTable.tsx
@components/feature/reports/MissingItemsTable.tsx
@components/feature/reports/RepurchaseTable.tsx
@components/layout/Nav.tsx

<interfaces>
```typescript
// lib/data/aggregations.server.ts
export type DashboardKpis = {
  totalItems: number;
  itemsOut: number;
  lowStockCount: number;
  activeEvents: number;
};
export async function getDashboardKpis(): Promise<DashboardKpis>;
export async function getLowStockCount(): Promise<number>;

// lib/data/transactions.server.ts
export async function getTransactionsPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: { eventId?: string; itemId?: string; actorUid?: string; type?: string };
}): Promise<{ transactions: TransactionDoc[]; nextCursor: string | null }>;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: lib/data/aggregations.server.ts + transactions.server.ts</name>
  <files>
    lib/data/aggregations.server.ts,
    lib/data/transactions.server.ts
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §7.2 lines 1552-1585 (KPI count() aggregations)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-21 (count() aggregations replace reduce())
    - .planning/REQUIREMENTS.md REP-04 (transactions history with filters)
    - lib/data/inventory.server.ts (mirror server-only + cursor encoding patterns)
    - firestore.indexes.json (the 4 transactions composite indexes already pre-declared)
  </read_first>
  <action>
    **1.1 — `lib/data/aggregations.server.ts`:**

    ```typescript
    import "server-only";
    import { adminDb } from "@/lib/firebase/admin";

    export type DashboardKpis = {
      totalItems: number;
      itemsOut: number;
      lowStockCount: number;
      activeEvents: number;
    };

    /**
     * D-21: 4 count() aggregations per dashboard load. NOT real-time.
     * Refetch on mount + on revalidatePath('/').
     */
    export async function getDashboardKpis(): Promise<DashboardKpis> {
      const [totalItems, itemsOut, lowStockCount, activeEvents] = await Promise.all([
        // Total active items (excludes retired)
        adminDb.collection("inventory").where("lifecycleState", "!=", "retired").count().get(),
        // Items currently checked out (outQty > 0)
        adminDb.collection("inventory").where("outQty", ">", 0).count().get(),
        // Low-stock items (via isLowStock denorm per P11)
        adminDb.collection("inventory").where("isLowStock", "==", true).count().get(),
        // Active events
        adminDb.collection("events").where("status", "==", "active").count().get(),
      ]);
      return {
        totalItems: totalItems.data().count,
        itemsOut: itemsOut.data().count,
        lowStockCount: lowStockCount.data().count,
        activeEvents: activeEvents.data().count,
      };
    }

    /** RP-03 — single count for nav badge. */
    export async function getLowStockCount(): Promise<number> {
      const snap = await adminDb.collection("inventory").where("isLowStock", "==", true).count().get();
      return snap.data().count;
    }
    ```

    NOTE: `where("lifecycleState", "!=", "retired")` requires an index — but `!=` is a "single-field range" query that uses Firestore's automatic indexing, NOT a composite index. Verify in dev; if FAILED_PRECONDITION fires, add a single-field index for lifecycleState ascending (Firestore auto-creates these by default — usually no manual action needed).

    Alternative: query for explicit lifecycle states: `where("lifecycleState", "in", ["available", "checked_out", "damaged"])` — more verbose but always works.

    **1.2 — `lib/data/transactions.server.ts`** (cursor-paged transactions history per REP-04):

    ```typescript
    import "server-only";
    import { adminDb } from "@/lib/firebase/admin";
    import type { TransactionDoc } from "@/lib/types/transaction";

    type TxCursor = { at: number; id: string };
    function encodeCursor(c: TxCursor): string { return Buffer.from(JSON.stringify(c)).toString("base64"); }
    function decodeCursor(s: string): TxCursor | null {
      try { return JSON.parse(Buffer.from(s, "base64").toString("utf8")); } catch { return null; }
    }

    function toTx(snap: FirebaseFirestore.QueryDocumentSnapshot): TransactionDoc {
      const d = snap.data();
      return {
        id: snap.id,
        type: d.type,
        itemId: d.itemId,
        itemSku: d.itemSku,
        itemName: d.itemName,
        eventId: d.eventId ?? null,
        eventName: d.eventName ?? null,
        qty: d.qty,
        actorUid: d.actorUid,
        actorName: d.actorName,
        actorRoleAtTimeOfAction: d.actorRoleAtTimeOfAction,
        at: d.at?.toMillis?.() ?? 0,
        notes: d.notes ?? "",
        parentTxId: d.parentTxId ?? null,
        clientTxId: d.clientTxId ?? null,
      } as TransactionDoc;
    }

    export async function getTransactionsPage(opts: {
      cursor?: string | null;
      limit?: number;
      filters?: { eventId?: string; itemId?: string; actorUid?: string; type?: string };
    }) {
      const limit = opts.limit ?? 50;
      let q: FirebaseFirestore.Query = adminDb.collection("transactions");
      if (opts.filters?.eventId) q = q.where("eventId", "==", opts.filters.eventId);
      if (opts.filters?.itemId) q = q.where("itemId", "==", opts.filters.itemId);
      if (opts.filters?.actorUid) q = q.where("actorUid", "==", opts.filters.actorUid);
      if (opts.filters?.type) q = q.where("type", "==", opts.filters.type);

      q = q.orderBy("at", "desc").orderBy("__name__").limit(limit + 1);
      const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
      if (cursor) q = q.startAfter(cursor.at, cursor.id);

      const snap = await q.get();
      const docs = snap.docs.slice(0, limit);
      const hasMore = snap.docs.length > limit;
      const transactions = docs.map(toTx);
      const last = docs[docs.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({ at: last.data().at?.toMillis?.() ?? 0, id: last.id })
        : null;
      return { transactions, nextCursor };
    }
    ```
  </action>
  <acceptance_criteria>
    - `head -1 lib/data/aggregations.server.ts | grep -q 'import "server-only"'` succeeds.
    - `grep -q ".count().get()" lib/data/aggregations.server.ts` succeeds (D-21 aggregations).
    - Count of `.count().get()` calls: `[ "$(grep -c '.count().get()' lib/data/aggregations.server.ts)" -ge "4" ]`.
    - `grep -q "isLowStock" lib/data/aggregations.server.ts` succeeds (via P11 denorm).
    - `head -1 lib/data/transactions.server.ts | grep -q 'import "server-only"'` succeeds.
    - `grep -q "getTransactionsPage" lib/data/transactions.server.ts` succeeds.
    - `grep -q "startAfter" lib/data/transactions.server.ts` succeeds (cursor).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>head -1 lib/data/aggregations.server.ts | grep -q 'import "server-only"' && [ "$(grep -c '.count().get()' lib/data/aggregations.server.ts)" -ge "4" ] && grep -q "isLowStock" lib/data/aggregations.server.ts && grep -q "startAfter" lib/data/transactions.server.ts && npx tsc --noEmit</automated>
  </verify>
  <done>KPI aggregations + transactions history reader ready.</done>
</task>

<task type="auto">
  <name>Task 2: Dashboard rewrite (KPIs via count, widgets via live hooks)</name>
  <files>
    app/(app)/page.tsx,
    components/feature/dashboard/KpiCards.tsx,
    components/feature/dashboard/LowStockWidget.tsx,
    components/feature/dashboard/RecentActivityFeed.tsx
  </files>
  <read_first>
    - app/(app)/page.tsx (Phase 1)
    - components/feature/dashboard/KpiCards.tsx (Phase 1: uses reduce() — DIE here per D-21)
    - components/feature/dashboard/LowStockWidget.tsx (Phase 1: uses mock-store selector)
    - components/feature/dashboard/RecentActivityFeed.tsx (Phase 1: uses selectRecentActivity)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §7.2 lines 1550-1605 (Dashboard KPI rewrite + low-stock widget scope)
    - lib/data/aggregations.server.ts (from Task 1)
    - lib/hooks/use-inventory-live.ts (from 02-05)
    - lib/hooks/use-transactions-live.ts (from 02-06)
  </read_first>
  <action>
    **2.1 — `app/(app)/page.tsx` rewrite:**

    Phase 1 dashboard rendered KpiCards + widgets as Client Components reading mock store. Phase 2 makes KpiCards a Server-Component-friendly child that gets pre-computed counts from getDashboardKpis(), then widgets stay Client Components but consume Firebase live hooks.

    ```typescript
    // app/(app)/page.tsx — Server Component
    import { requireSession } from "@/lib/auth/dal";
    import { getDashboardKpis } from "@/lib/data/aggregations.server";
    import { getInventoryPage } from "@/lib/data/inventory.server";
    import { getEventsPage } from "@/lib/data/events.server";
    import { KpiCards } from "@/components/feature/dashboard/KpiCards";
    import { LowStockWidget } from "@/components/feature/dashboard/LowStockWidget";
    import { ActiveEventsWidget } from "@/components/feature/dashboard/ActiveEventsWidget";
    import { OverdueReturnsWidget } from "@/components/feature/dashboard/OverdueReturnsWidget";
    import { RecentActivityFeed } from "@/components/feature/dashboard/RecentActivityFeed";

    export default async function DashboardPage() {
      const session = await requireSession();
      const [kpis, lowStockInit, eventsInit] = await Promise.all([
        getDashboardKpis(),
        getInventoryPage({ filters: { isLowStock: true }, limit: 50 }),
        getEventsPage({ filters: { status: "active" }, limit: 10, session }),
      ]);

      return (
        <>
          {/* PRESERVE Phase 1 greeting / page header / grid layout */}
          <KpiCards {...kpis} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LowStockWidget initialItems={lowStockInit.items} />
            <ActiveEventsWidget initialEvents={eventsInit.events} session={session} />
            <OverdueReturnsWidget initialEvents={eventsInit.events} session={session} />
            <RecentActivityFeed />
          </div>
        </>
      );
    }
    ```

    **2.2 — `components/feature/dashboard/KpiCards.tsx`:**

    Phase 1 used `useMockStore` + `.reduce()`. Phase 2 receives counts as props:

    ```typescript
    // components/feature/dashboard/KpiCards.tsx
    // Per D-21: server-passed counts; NOT real-time. Re-fetched on revalidatePath('/').
    // Optional: convert to Client Component using getCountFromServer to re-query on demand.
    // For v1: simple Server Component child receiving counts as props.

    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    // ... lucide icons ...

    export function KpiCards({
      totalItems,
      itemsOut,
      lowStockCount,
      activeEvents,
    }: {
      totalItems: number;
      itemsOut: number;
      lowStockCount: number;
      activeEvents: number;
    }) {
      // PRESERVE Phase 1 visual layout: 4-card grid, icons, labels
      // Each card just renders the passed number.
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PRESERVE Phase 1 individual card layouts here */}
          <Card><CardHeader><CardTitle>Total items</CardTitle></CardHeader><CardContent>{totalItems}</CardContent></Card>
          <Card><CardHeader><CardTitle>Items out</CardTitle></CardHeader><CardContent>{itemsOut}</CardContent></Card>
          <Card><CardHeader><CardTitle>Low stock</CardTitle></CardHeader><CardContent>{lowStockCount}</CardContent></Card>
          <Card><CardHeader><CardTitle>Active events</CardTitle></CardHeader><CardContent>{activeEvents}</CardContent></Card>
        </div>
      );
    }
    ```

    No `"use client"` directive — this is now a Server Component child rendered from `app/(app)/page.tsx`.

    **2.3 — `components/feature/dashboard/LowStockWidget.tsx`:**

    ```typescript
    "use client";
    import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
    import { useTransition } from "react";
    import { toast } from "sonner";
    import { markLowStockOrdered } from "@/app/(app)/inventory/actions";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    // ... preserve Phase 1 Card/EmptyState chrome imports ...

    export function LowStockWidget({ initialItems }: { initialItems: InventoryItem[] }) {
      const items = useInventoryLive(initialItems, { isLowStock: true, limit: 50 });
      const session = useCurrentUser();
      const isAdmin = session?.role === "admin";
      const [pending, start] = useTransition();

      function onMarkOrdered(itemId: string) {
        if (!isAdmin) return;
        start(async () => {
          const r = await markLowStockOrdered(itemId);
          if (!r.ok) toast.error(r.error);
          else toast.success("Marked as ordered");
        });
      }
      // PRESERVE Phase 1 list rendering + admin-only "Mark as ordered" button + empty state
    }
    ```

    **2.4 — `components/feature/dashboard/RecentActivityFeed.tsx`:**

    ```typescript
    "use client";
    import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";

    export function RecentActivityFeed() {
      const txs = useTransactionsLive({ limit: 20 });
      // PRESERVE Phase 1 timeline UI; render each tx with type/qty/actor/at
    }
    ```
  </action>
  <acceptance_criteria>
    - `grep -q "getDashboardKpis" "app/(app)/page.tsx"` succeeds.
    - `grep -q "useMockStore" components/feature/dashboard/KpiCards.tsx` FAILS.
    - `grep -q "reduce(" components/feature/dashboard/KpiCards.tsx` FAILS (D-21 — no reduce).
    - `grep -q "useInventoryLive" components/feature/dashboard/LowStockWidget.tsx` succeeds.
    - `grep -q "isLowStock: true" components/feature/dashboard/LowStockWidget.tsx` succeeds.
    - `grep -q "useTransactionsLive" components/feature/dashboard/RecentActivityFeed.tsx` succeeds.
    - `[ "$(grep -rE 'from \"@/lib/mock' components/feature/dashboard/ 2>/dev/null | wc -l)" = "0" ]`.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "getDashboardKpis" "app/(app)/page.tsx" && ! grep -q "useMockStore" components/feature/dashboard/KpiCards.tsx && ! grep -q "reduce(" components/feature/dashboard/KpiCards.tsx && grep -q "useInventoryLive" components/feature/dashboard/LowStockWidget.tsx && [ "$(grep -rE 'from \"@/lib/mock' components/feature/dashboard/ 2>/dev/null | wc -l)" = "0" ] && npm run build</automated>
  </verify>
  <done>Dashboard fully Firebase-backed. KPIs via count(), widgets via live hooks.</done>
</task>

<task type="auto">
  <name>Task 3: 5 report pages + tables (Server Component seed + Client live hook)</name>
  <files>
    app/(app)/reports/stock/page.tsx,
    app/(app)/reports/out/page.tsx,
    app/(app)/reports/history/page.tsx,
    app/(app)/reports/missing/page.tsx,
    app/(app)/reports/repurchase/page.tsx,
    components/feature/reports/StockReportTable.tsx,
    components/feature/reports/ItemsOutTable.tsx,
    components/feature/reports/HistoryTable.tsx,
    components/feature/reports/MissingItemsTable.tsx,
    components/feature/reports/RepurchaseTable.tsx
  </files>
  <read_first>
    - Each Phase 1 report page + table component
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 rows for each
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"Index manifest" (which indexes back which report)
    - lib/data/inventory.server.ts, events.server.ts, transactions.server.ts, missing.server.ts
    - lib/hooks/use-*-live.ts (each)
    - .planning/REQUIREMENTS.md REP-01..07, RP-01..04
  </read_first>
  <action>
    Pattern is uniform: Server Component reads via Admin SDK helper → passes initial to Client table → table consumes live hook + cursor pagination.

    **3.1 — `/reports/stock/page.tsx`:**

    ```typescript
    import { requireSession } from "@/lib/auth/dal";
    import { getInventoryPage } from "@/lib/data/inventory.server";
    import { StockReportTable } from "@/components/feature/reports/StockReportTable";

    type RouteProps = { searchParams: Promise<{ cursor?: string; category?: string; lifecycleState?: string }> };

    export default async function StockReportPage({ searchParams }: RouteProps) {
      await requireSession();
      const p = await searchParams;
      const { items, nextCursor } = await getInventoryPage({
        cursor: p.cursor ?? null,
        filters: {
          category: p.category,
          // exclude retired by default per REP-01 "every active item"
          lifecycleState: p.lifecycleState,
        },
        limit: 50,
      });
      return <StockReportTable initialItems={items.filter(i => i.lifecycleState !== "retired" || p.lifecycleState === "retired")} nextCursor={nextCursor} />;
    }
    ```

    Table: swap to `useInventoryLive` + URL-sync filters + manualPagination cursor. (Mirror Task 4 inventory pattern from 02-06.)

    **3.2 — `/reports/out/page.tsx`:**

    Per REQUIREMENTS REP-02: items currently checked-out across active events. Query transactions where type='checkout' and NO matching checkin (parentTxId).

    Strategy: get all open checkouts via cursor-paged transactions query, join with inventory items client-side (or server-side with admin SDK):

    ```typescript
    import { requireSession } from "@/lib/auth/dal";
    import { getTransactionsPage } from "@/lib/data/transactions.server";
    import { ItemsOutTable } from "@/components/feature/reports/ItemsOutTable";

    type RouteProps = { searchParams: Promise<{ cursor?: string; eventId?: string }> };

    export default async function ItemsOutReportPage({ searchParams }: RouteProps) {
      await requireSession();
      const p = await searchParams;
      const { transactions, nextCursor } = await getTransactionsPage({
        cursor: p.cursor ?? null,
        filters: { type: "checkout", eventId: p.eventId },
        limit: 50,
      });
      // Open-only filter happens client-side in the table component (subscribes to checkins too).
      return <ItemsOutTable initial={transactions} nextCursor={nextCursor} />;
    }
    ```

    Table: `useTransactionsLive({type:'checkout'})` + `useTransactionsLive({type:'checkin'})`, filter out checkouts whose `id` is referenced by any checkin's `parentTxId`. (Same pattern as EventAssignedItemsTab in 02-08.)

    **3.3 — `/reports/history/page.tsx`:**

    Per REQUIREMENTS REP-04: global transaction log with filters.

    ```typescript
    import { requireSession } from "@/lib/auth/dal";
    import { getTransactionsPage } from "@/lib/data/transactions.server";
    import { HistoryTable } from "@/components/feature/reports/HistoryTable";

    type RouteProps = { searchParams: Promise<{ cursor?: string; type?: string; eventId?: string; itemId?: string; actorUid?: string }> };

    export default async function HistoryPage({ searchParams }: RouteProps) {
      await requireSession();
      const p = await searchParams;
      const { transactions, nextCursor } = await getTransactionsPage({
        cursor: p.cursor ?? null,
        filters: { type: p.type, eventId: p.eventId, itemId: p.itemId, actorUid: p.actorUid },
        limit: 50,
      });
      return <HistoryTable initial={transactions} nextCursor={nextCursor} />;
    }
    ```

    Table: `useTransactionsLive` consuming the same filters from URL state.

    **3.4 — `/reports/missing/page.tsx`:**

    ```typescript
    import { requireSession } from "@/lib/auth/dal";
    import { getMissingPage } from "@/lib/data/missing.server";
    import { MissingItemsTable } from "@/components/feature/reports/MissingItemsTable";

    type RouteProps = { searchParams: Promise<{ cursor?: string; status?: "open"|"resolved"; eventId?: string }> };

    export default async function MissingReportPage({ searchParams }: RouteProps) {
      await requireSession();
      const p = await searchParams;
      const { missing, nextCursor } = await getMissingPage({
        cursor: p.cursor ?? null,
        filters: { status: p.status ?? "open", eventId: p.eventId },
        limit: 50,
      });
      return <MissingItemsTable initial={missing} nextCursor={nextCursor} />;
    }
    ```

    Table: `useMissingLive(initial, {status, limit: 50})` from 02-09 + ResolveMissingSheet (per-row admin action).

    **3.5 — `/reports/repurchase/page.tsx`:**

    Per REQUIREMENTS REP-05: items below threshold + frequently-flagged-missing items.

    For now (v1 simpler): list items with `isLowStock=true`. Skip the "frequently flagged" calculation (out of scope for v1 — would require aggregating missing-items counts per item).

    ```typescript
    import { requireSession } from "@/lib/auth/dal";
    import { getInventoryPage } from "@/lib/data/inventory.server";
    import { RepurchaseTable } from "@/components/feature/reports/RepurchaseTable";

    type RouteProps = { searchParams: Promise<{ cursor?: string }> };

    export default async function RepurchasePage({ searchParams }: RouteProps) {
      await requireSession();
      const p = await searchParams;
      const { items, nextCursor } = await getInventoryPage({
        cursor: p.cursor ?? null,
        filters: { isLowStock: true },
        limit: 50,
      });
      return <RepurchaseTable initial={items} nextCursor={nextCursor} />;
    }
    ```

    Table: `useInventoryLive(initial, {isLowStock: true})` + `markLowStockOrdered` Server Action per RP-04.

    **All 5 tables** preserve Phase 1 column defs, filter UI, sort logic — only the data source + pagination chrome swaps. NO `useMockStore` imports. NO `seedUsers.find()`.
  </action>
  <acceptance_criteria>
    - `grep -q "getInventoryPage" "app/(app)/reports/stock/page.tsx"` succeeds.
    - `grep -q "getTransactionsPage" "app/(app)/reports/out/page.tsx"` succeeds.
    - `grep -q "getTransactionsPage" "app/(app)/reports/history/page.tsx"` succeeds.
    - `grep -q "getMissingPage" "app/(app)/reports/missing/page.tsx"` succeeds.
    - `grep -q "getInventoryPage" "app/(app)/reports/repurchase/page.tsx"` succeeds.
    - `grep -q "useInventoryLive" components/feature/reports/StockReportTable.tsx` succeeds.
    - `grep -q "useTransactionsLive" components/feature/reports/HistoryTable.tsx` succeeds.
    - `grep -q "useMissingLive" components/feature/reports/MissingItemsTable.tsx` succeeds.
    - `grep -q "useInventoryLive" components/feature/reports/RepurchaseTable.tsx` succeeds.
    - `grep -q "markLowStockOrdered" components/feature/reports/RepurchaseTable.tsx` succeeds (RP-04).
    - `[ "$(grep -rE 'from \"@/lib/mock' components/feature/reports/ 2>/dev/null | wc -l)" = "0" ]`.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "getInventoryPage" "app/(app)/reports/stock/page.tsx" && grep -q "getTransactionsPage" "app/(app)/reports/history/page.tsx" && grep -q "getMissingPage" "app/(app)/reports/missing/page.tsx" && grep -q "useInventoryLive" components/feature/reports/StockReportTable.tsx && grep -q "markLowStockOrdered" components/feature/reports/RepurchaseTable.tsx && [ "$(grep -rE 'from \"@/lib/mock' components/feature/reports/ 2>/dev/null | wc -l)" = "0" ] && npm run build</automated>
  </verify>
  <done>All 5 reports on Firebase. URL filter state per REP-06 preserved.</done>
</task>

<task type="auto">
  <name>Task 4: Nav low-stock badge (RP-03)</name>
  <files>components/layout/Nav.tsx</files>
  <read_first>
    - components/layout/Nav.tsx (Phase 1: badge currently reads from mock store)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §7.4 lines 1610-1618 (Nav badge — re-query on path change)
    - lib/firebase/client.ts
    - lib/hooks/use-inventory-live.ts (alternative: use existing live hook with isLowStock:true filter)
  </read_first>
  <action>
    Phase 1 had a badge somewhere in Nav showing the low-stock count from mock store. Phase 2 options:

    **Option A (simple — recommended for v1):** Use the existing `useInventoryLive({isLowStock: true, limit: 50})` and show `.length` (caps at 50; show "50+" if hit). No extra count() query.

    **Option B (RESEARCH §7.4):** Use `getCountFromServer` from Web SDK on mount + path change.

    Pick Option A — simpler, matches D-20 listener scope:

    ```typescript
    // components/layout/Nav.tsx (excerpt - badge area)
    "use client";
    import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
    // ... preserve Phase 1 nav imports ...

    function LowStockBadge() {
      const items = useInventoryLive([], { isLowStock: true, limit: 50 });
      const count = items.length;
      if (count === 0) return null;
      return (
        <Badge variant="destructive" className="ml-auto">
          {count >= 50 ? "50+" : count}
        </Badge>
      );
    }

    // In the Nav component, render <LowStockBadge/> next to the "Repurchase" or "Low stock" nav item.
    ```
  </action>
  <acceptance_criteria>
    - `grep -q "useInventoryLive" components/layout/Nav.tsx` succeeds.
    - `grep -q "isLowStock: true" components/layout/Nav.tsx` succeeds.
    - `grep -q "useMockStore" components/layout/Nav.tsx` FAILS.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "useInventoryLive" components/layout/Nav.tsx && grep -q "isLowStock: true" components/layout/Nav.tsx && ! grep -q "useMockStore" components/layout/Nav.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>RP-03 wired with live badge.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: E2E reports + dashboard + Block G rules audit</name>
  <what-built>
    5 reports + dashboard fully on Firebase. KPIs use count(). RP-03 badge live.
  </what-built>
  <how-to-verify>
    **A — Dashboard KPIs:**
    1. As admin, visit /. Verify 4 KPI cards show real counts matching Firestore reality.
    2. Open a fresh terminal — `curl http://localhost:3000` while you're on the page. After 2-3 seconds, the response should reflect any change you make to inventory (because revalidatePath('/') is called after every Server Action).
    3. Test a real flow: do a checkout. Refresh /. KPI "Items out" should bump by 1.

    **B — RP-03 badge:**
    1. Create an item with totalQty=5, lowStockThreshold=10 (so isLowStock=true immediately).
    2. Verify nav shows badge with "1".
    3. Mark as ordered or raise threshold to 0 → badge disappears.

    **C — /reports/stock:**
    1. Filter by category="Audio" — URL becomes `?category=Audio`. List re-renders.
    2. Cursor: if >=50 items, "Next →" works. URL contains `?cursor=`.
    3. REP-06: copy the URL into a fresh tab — same filter/cursor state restored.

    **D — /reports/out:**
    1. Should show all items currently checked-out. Match against Firestore: `transactions where type='checkout'` minus checkins.
    2. Filter by eventId — `?eventId=<id>` scopes correctly.

    **E — /reports/history:**
    1. Should show ALL transactions ordered by `at desc`. Filter by `?type=checkout` works (index from D-18).
    2. Open Firebase Console → if you see a "needs index" error in the dev console, copy the index def + add to `firestore.indexes.json` + redeploy (INT-05 ban on console auto-create).

    **F — /reports/missing:**
    1. Should show open missing items from 02-09 testing. Resolve sheet works.
    2. Filter `?status=resolved` shows past resolved items.

    **G — /reports/repurchase:**
    1. Same items as RP-03 badge — `isLowStock: true`. Click "Mark as ordered" → item disappears from list (lowStockOrderedAt set; isLowStock recompute would still be true — let me re-check). Actually per the action `markLowStockOrdered` only sets `lowStockOrderedAt` and does NOT change isLowStock — so the item stays in the list. The "Repurchase" widget should filter to NOT show items where `lowStockOrderedAt !== null`. Verify Phase 1 filter logic — if missing, fix client-side filter in RepurchaseTable. Document any nuance.

    **H — Block G rules audit — `## Rules Audit — Block G` in CLAIM.md:**
    | # | Path | Auth? | Role | Op | Expected |
    |---|------|-------|------|-----|----------|
    | 1 | inventory aggregation count() | Yes | staff via Web SDK | read | ALLOW |
    | 2 | transactions (any read) | Yes | staff | read | ALLOW |
    | 3 | events with status="active" — staff lists across project | Yes | staff | read | DENY for events not in allowedStaff (EVT-08) |
    | 4 | missingItems list | Yes | staff | read | ALLOW |
    | 5 | missingItems update | Yes | staff via Web SDK | update | DENY |

    Report PASS/FAIL each.
  </how-to-verify>
  <resume-signal>Type "reports E2E PASS, rules audit logged" or describe failures.</resume-signal>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation |
|---|---|---|---|---|
| T-02-10-01 | Info disclosure | Cross-event report data via /reports/out | accept | All signed-in users can read transactions per firestore.rules; cross-event visibility is an internal-trust scope — not a leak |
| T-02-10-02 | DoS | Listener cost on dashboard | mitigate | D-20 scoped listeners + count() aggregations only on mount/revalidate (D-21) |
| T-02-10-03 | Tampering | Cursor blob crafted to skip rows | accept | Cursor only controls page slice within already-allowed reads; no rules bypass |
| T-02-10-04 | Info disclosure | Indexing exposes denormed isLowStock | accept | isLowStock is a public derived field; the privacy concern (private threshold) is mitigated because rules read on inventory is signed-in-only |
</threat_model>

<verification>
- 5 report pages on real Firestore; cursor + filter URL state preserved.
- Dashboard KPIs via count() aggregations per D-21.
- LowStockWidget consumes useInventoryLive scoped by isLowStock=true.
- RecentActivityFeed consumes useTransactionsLive limit=20.
- Nav low-stock badge live per RP-03.
- npm run build green.
- Block G rules audit logged.
</verification>

<success_criteria>
- REP-01..07 all functional. REP-06 shareable URL preserved.
- RP-01..04 all functional. RP-03 badge live.
- D-21 KPIs via count() (no reduce).
- EVT-07 overdue widget functional via useEventsLive + client-side endDate filter.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-10-reports-and-aggregations-SUMMARY.md` documenting files, the count() vs reduce() swap evidence, E2E report tests with URL examples, and Block G rules audit. <= 100 lines.
</output>
