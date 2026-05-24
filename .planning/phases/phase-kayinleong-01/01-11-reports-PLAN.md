---
phase: 01-ui-poc
plan: 11
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - app/(app)/reports/stock/page.tsx
  - app/(app)/reports/out/page.tsx
  - app/(app)/reports/history/page.tsx
  - app/(app)/reports/missing/page.tsx
  - app/(app)/reports/repurchase/page.tsx
  - components/feature/reports/StockReportTable.tsx
  - components/feature/reports/ItemsOutTable.tsx
  - components/feature/reports/HistoryTable.tsx
  - components/feature/reports/MissingItemsTable.tsx
  - components/feature/reports/RepurchaseTable.tsx
  - components/feature/missing/ResolveMissingSheet.tsx
autonomous: true
requirements:
  - REP-01
  - REP-02
  - REP-03
  - REP-04
  - REP-05
  - REP-06
  - REP-07
  - MIS-02
  - MIS-03
  - MIS-04
  - RP-01
  - RP-02
  - RP-04
  - NFR-05

must_haves:
  truths:
    - "/reports/stock lists every active item with availableQty, outQty, damagedQty, totalQty, threshold, and low-stock badge."
    - "/reports/out lists items currently checked out at active events (joins via selectItemsOut)."
    - "/reports/history shows the global transaction log with filters: date range, event, item, actor, action type — URL-synced (REP-06), 50/page (REP-07)."
    - "/reports/missing lists open missing-item records with admin 'Resolve' action; resolve modal calls store.resolveMissing."
    - "/reports/repurchase lists items below their lowStockThreshold plus items frequently flagged missing/damaged."
    - "Every report uses the DataTable wrapper from Plan 03 for URL sync + pagination chrome."
    - "Resolve missing modal uses shadcn Sheet per UI-SPEC, with Zod-validated form."
    - "Export CSV button is rendered but no-ops (per UI-SPEC out-of-scope for Phase 1)."
  artifacts:
    - path: "app/(app)/reports/stock/page.tsx"
      provides: "Stock report route"
      contains: "StockReportTable"
    - path: "components/feature/reports/HistoryTable.tsx"
      provides: "Global transaction log with type + event + item filters"
      contains: "DataTable"
      min_lines: 80
    - path: "components/feature/missing/ResolveMissingSheet.tsx"
      provides: "Sheet with rhf form calling resolveMissing"
      contains: "ResolveMissingSchema"
  key_links:
    - from: "components/feature/missing/ResolveMissingSheet.tsx"
      to: "lib/mock/store.ts resolveMissing"
      via: "rhf submit dispatches resolveMissing(missingId, resolution)"
      pattern: "resolveMissing"
    - from: "components/feature/reports/RepurchaseTable.tsx"
      to: "lib/mock/store.ts markLowStockOrdered"
      via: "Inline 'Mark as ordered' button"
      pattern: "markLowStockOrdered"
---

<objective>
Build all 5 report pages + their tables + the missing-items resolve sheet.

Output: 5 route files + 5 table components + 1 sheet component.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@lib/types/item.ts
@lib/types/event.ts
@lib/types/transaction.ts
@lib/types/missing-item.ts
@lib/schemas/missing-item.ts
@lib/mock/store.ts
@lib/mock/selectors.ts
@lib/mock/users.ts
@lib/auth/mock-session.ts
@lib/hooks/use-mock-store.ts
@lib/hooks/use-current-user.ts
@components/feature/table/DataTable.tsx
@components/feature/status/StatusBadge.tsx
@components/feature/status/status-to-tone.ts
@components/ui/page-header.tsx
@components/ui/sheet.tsx
@components/ui/form.tsx
@components/ui/button.tsx
@components/ui/select.tsx
@components/ui/empty-state.tsx
@components/ui/badge.tsx
@components/ui/textarea.tsx

<interfaces>
```tsx
export function StockReportTable(): React.ReactElement;
export function ItemsOutTable(): React.ReactElement;
export function HistoryTable(): React.ReactElement;
export function MissingItemsTable(): React.ReactElement;
export function RepurchaseTable(): React.ReactElement;
export function ResolveMissingSheet(props: { missingId: string; itemName: string }): React.ReactElement;
```
</interfaces>
</context>

<tasks>

<!-- D-11 sortable-columns rule (LOCKED, see Plan 03 Task 2 for verbatim D-11 quote) -->
<!-- Sortable columns across ALL report tables in this plan: name, sku, qty, availableQty, date/startDate/endDate, at, serverTimestamp, status, lifecycleState. -->
<!-- Non-sortable across ALL report tables: actor display name (actorName), notes, reason text, photoUrl, descriptions. -->
<!-- For every non-sortable column carry `// D-11: <col> is NOT sortable` and render a plain string header (no Button, no ArrowUpDown, no toggleSorting call). -->


<task type="auto">
  <name>Task 1: Stock, items-out, repurchase report tables + routes</name>
  <files>
    app/(app)/reports/stock/page.tsx,
    app/(app)/reports/out/page.tsx,
    app/(app)/reports/repurchase/page.tsx,
    components/feature/reports/StockReportTable.tsx,
    components/feature/reports/ItemsOutTable.tsx,
    components/feature/reports/RepurchaseTable.tsx
  </files>
  <read_first>
    - .planning/REQUIREMENTS.md REP-01, REP-02, REP-05, REP-07, RP-02, RP-04
    - lib/mock/selectors.ts (selectItemsOut, selectLowStockItems)
    - components/feature/table/DataTable.tsx
    - components/feature/inventory/InventoryTable.tsx (column-def pattern, in same project)
  </read_first>
  <action>
    Each report page follows the same shell pattern:
    ```tsx
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { Download } from "lucide-react";
    import { <Table> } from "@/components/feature/reports/<Table>";

    export default function ReportPage() {
      return (
        <div className="space-y-6">
          <PageHeader title="<Title>" description="<copy>" action={
            <Button variant="outline" disabled><Download className="mr-2 size-4" />Export CSV</Button>
          } />
          <<Table>/>
        </div>
      );
    }
    ```
    The Export CSV button is `disabled` (UI-SPEC out-of-scope).

    **app/(app)/reports/stock/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { Download } from "lucide-react";
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { StockReportTable } from "@/components/feature/reports/StockReportTable";

    export const metadata: Metadata = { title: "Stock" };

    export default function StockReportPage() {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Current stock"
            description="Live stock levels across all active items."
            action={<Button variant="outline" disabled><Download className="mr-2 size-4" />Export CSV</Button>}
          />
          <StockReportTable />
        </div>
      );
    }
    ```

    **components/feature/reports/StockReportTable.tsx** (REP-01):
    ```tsx
    "use client";
    import { useMemo } from "react";
    import Link from "next/link";
    import { Package, ArrowUpDown } from "lucide-react";
    import type { ColumnDef } from "@tanstack/react-table";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import type { InventoryItem } from "@/lib/types/item";
    import { DataTable } from "@/components/feature/table/DataTable";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { Badge } from "@/components/ui/badge";
    import { Button } from "@/components/ui/button";
    import { EmptyState } from "@/components/ui/empty-state";

    export function StockReportTable() {
      const items = useMockStore((s) => s.items.filter((i) => i.lifecycleState !== "retired"));

      const columns: ColumnDef<InventoryItem>[] = useMemo(() => [
        {
          accessorKey: "name",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Name <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => (
            <Link href={`/inventory/${row.original.id}`} className="font-medium hover:underline">
              {row.original.name}
            </Link>
          ),
        },
        { accessorKey: "sku", header: "SKU", cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span> },
        { accessorKey: "category", header: "Category" },
        {
          accessorKey: "availableQty",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Available <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
        },
        { accessorKey: "outQty", header: "Out" },
        { accessorKey: "damagedQty", header: "Damaged" },
        { accessorKey: "totalQty", header: "Total" },
        {
          accessorKey: "lowStockThreshold",
          header: "Threshold",
          cell: ({ row }) => row.original.lowStockThreshold > 0 ? row.original.lowStockThreshold : "—",
        },
        {
          id: "lowStockFlag",
          header: "Status",
          cell: ({ row }) => {
            const i = row.original;
            if (i.lowStockThreshold > 0 && i.availableQty <= i.lowStockThreshold && !i.lowStockOrderedAt)
              return <StatusBadge tone="amber">Low stock</StatusBadge>;
            if (i.lowStockOrderedAt)
              return <Badge variant="outline" className="text-xs">Ordered</Badge>;
            return null;
          },
        },
      ], []);

      return (
        <DataTable<InventoryItem>
          columns={columns}
          data={items}
          globalFilterPlaceholder="Search name or SKU…"
          emptyState={<EmptyState icon={Package} heading="No items yet" body="Add inventory items to see them here." />}
        />
      );
    }
    ```

    **app/(app)/reports/out/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { Download } from "lucide-react";
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { ItemsOutTable } from "@/components/feature/reports/ItemsOutTable";

    export const metadata: Metadata = { title: "Items out" };

    export default function ItemsOutPage() {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Items out"
            description="Items currently checked out across active events."
            action={<Button variant="outline" disabled><Download className="mr-2 size-4" />Export CSV</Button>}
          />
          <ItemsOutTable />
        </div>
      );
    }
    ```

    **components/feature/reports/ItemsOutTable.tsx** (REP-02 — uses selectItemsOut):
    ```tsx
    "use client";
    import { useMemo } from "react";
    import Link from "next/link";
    import { PackageOpen, ArrowUpDown } from "lucide-react";
    import type { ColumnDef } from "@tanstack/react-table";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectItemsOut } from "@/lib/mock/selectors";
    import { DataTable } from "@/components/feature/table/DataTable";
    import { Button } from "@/components/ui/button";
    import { EmptyState } from "@/components/ui/empty-state";

    type Row = ReturnType<typeof selectItemsOut>[number];

    export function ItemsOutTable() {
      const rows = useMockStore(selectItemsOut);

      const columns: ColumnDef<Row>[] = useMemo(() => [
        {
          id: "name",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Item <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          accessorFn: (r) => r.item.name,
          cell: ({ row }) => (
            <Link href={`/inventory/${row.original.item.id}`} className="font-medium hover:underline">
              {row.original.item.name}
            </Link>
          ),
        },
        { id: "sku", header: "SKU", accessorFn: (r) => r.item.sku, cell: ({ row }) => <span className="font-mono text-xs">{row.original.item.sku}</span> },
        { id: "event", header: "Event", accessorFn: (r) => r.eventName },
        {
          id: "outQty",
          header: "Out (sum)",
          accessorFn: (r) => r.openTxs.reduce((s, t) => s + t.qty, 0),
        },
      ], []);

      return (
        <DataTable<Row>
          columns={columns}
          data={rows}
          globalFilterPlaceholder="Search item or event…"
          emptyState={<EmptyState icon={PackageOpen} heading="Nothing checked out" body="No items are currently at events." />}
        />
      );
    }
    ```

    **app/(app)/reports/repurchase/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { Download } from "lucide-react";
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { RepurchaseTable } from "@/components/feature/reports/RepurchaseTable";

    export const metadata: Metadata = { title: "Repurchase" };

    export default function RepurchasePage() {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Repurchase"
            description="Items below threshold plus items frequently flagged missing or damaged."
            action={<Button variant="outline" disabled><Download className="mr-2 size-4" />Export CSV</Button>}
          />
          <RepurchaseTable />
        </div>
      );
    }
    ```

    **components/feature/reports/RepurchaseTable.tsx** (REP-05, RP-04):
    ```tsx
    "use client";
    import { useMemo } from "react";
    import Link from "next/link";
    import { AlertTriangle, ArrowUpDown } from "lucide-react";
    import type { ColumnDef } from "@tanstack/react-table";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { markLowStockOrdered } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import type { InventoryItem } from "@/lib/types/item";
    import { DataTable } from "@/components/feature/table/DataTable";
    import { Button } from "@/components/ui/button";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { Badge } from "@/components/ui/badge";
    import { EmptyState } from "@/components/ui/empty-state";
    import { toast } from "sonner";

    type Row = { item: InventoryItem; missingCount: number; damagedCount: number; reason: "low-stock" | "frequently-missing" };

    export function RepurchaseTable() {
      const items = useMockStore((s) => s.items);
      const missing = useMockStore((s) => s.missingItems);
      const session = useCurrentUser();

      const rows: Row[] = useMemo(() => {
        const result: Row[] = [];
        for (const i of items) {
          if (i.lifecycleState === "retired") continue;
          // Low-stock
          if (i.lowStockThreshold > 0 && i.availableQty <= i.lowStockThreshold && !i.lowStockOrderedAt) {
            result.push({ item: i, missingCount: 0, damagedCount: i.damagedQty, reason: "low-stock" });
            continue;
          }
          // Frequently flagged missing/damaged (≥2 missing records)
          const missingForItem = missing.filter((m) => m.itemId === i.id && m.status !== "found");
          if (missingForItem.length >= 2 || i.damagedQty >= 2) {
            result.push({ item: i, missingCount: missingForItem.length, damagedCount: i.damagedQty, reason: "frequently-missing" });
          }
        }
        return result;
      }, [items, missing]);

      function markOrdered(itemId: string, name: string) {
        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't mark as ordered"); return; }
        markLowStockOrdered(itemId, actor);
        toast.success(`${name} marked as ordered`);
      }

      const columns: ColumnDef<Row>[] = useMemo(() => [
        {
          id: "name",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Item <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          accessorFn: (r) => r.item.name,
          cell: ({ row }) => (
            <Link href={`/inventory/${row.original.item.id}`} className="font-medium hover:underline">
              {row.original.item.name}
            </Link>
          ),
        },
        { id: "sku", header: "SKU", accessorFn: (r) => r.item.sku, cell: ({ row }) => <span className="font-mono text-xs">{row.original.item.sku}</span> },
        { id: "available", header: "Available", accessorFn: (r) => r.item.availableQty },
        { id: "threshold", header: "Threshold", accessorFn: (r) => r.item.lowStockThreshold || "—" },
        { id: "missing", header: "Missing", accessorFn: (r) => r.missingCount },
        { id: "damaged", header: "Damaged", accessorFn: (r) => r.damagedCount },
        {
          id: "reason",
          header: "Reason",
          cell: ({ row }) => row.original.reason === "low-stock"
            ? <StatusBadge tone="amber">Low stock</StatusBadge>
            : <Badge variant="outline" className="text-xs">Frequent loss</Badge>,
        },
        {
          id: "actions",
          header: "",
          cell: ({ row }) => session?.role === "admin" ? (
            <Button variant="outline" size="sm" onClick={() => markOrdered(row.original.item.id, row.original.item.name)}>
              Mark as ordered
            </Button>
          ) : null,
        },
      ], [session]);

      return (
        <DataTable<Row>
          columns={columns}
          data={rows}
          globalFilterPlaceholder="Search items…"
          emptyState={<EmptyState icon={AlertTriangle} heading="Nothing to repurchase" body="No items currently meet repurchase criteria." />}
        />
      );
    }
    ```
  </action>
  <verify>
    <automated>ls app/(app)/reports/stock/page.tsx app/(app)/reports/out/page.tsx app/(app)/reports/repurchase/page.tsx components/feature/reports/StockReportTable.tsx components/feature/reports/ItemsOutTable.tsx components/feature/reports/RepurchaseTable.tsx | wc -l | grep -q "^6$"; grep -q "selectItemsOut" components/feature/reports/ItemsOutTable.tsx; grep -q "markLowStockOrdered" components/feature/reports/RepurchaseTable.tsx; grep -q "Export CSV" app/(app)/reports/stock/page.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 6 files exist.
    - Each report has Export CSV button DISABLED (Phase 1 out-of-scope).
    - RepurchaseTable surfaces both low-stock AND frequently-missing items.
    - tsc passes.
  </acceptance_criteria>
  <done>Stock, items-out, repurchase reports compile and render seed data via DataTable.</done>
</task>

<task type="auto">
  <name>Task 2: History report + filters</name>
  <files>
    app/(app)/reports/history/page.tsx,
    components/feature/reports/HistoryTable.tsx
  </files>
  <read_first>
    - .planning/REQUIREMENTS.md REP-04 (filters: date range, event, item, actor, action type), REP-06, REP-07
    - components/feature/table/DataTable.tsx (URL sync via useUrlTableState)
    - lib/mock/store.ts snapshot
  </read_first>
  <action>
    **app/(app)/reports/history/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { Download } from "lucide-react";
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { HistoryTable } from "@/components/feature/reports/HistoryTable";

    export const metadata: Metadata = { title: "History" };

    export default function HistoryReportPage() {
      return (
        <div className="space-y-6">
          <PageHeader
            title="History"
            description="Every transaction across the system."
            action={<Button variant="outline" disabled><Download className="mr-2 size-4" />Export CSV</Button>}
          />
          <HistoryTable />
        </div>
      );
    }
    ```

    **components/feature/reports/HistoryTable.tsx**:
    ```tsx
    "use client";
    import { useMemo } from "react";
    import Link from "next/link";
    import { Activity, ArrowUpDown } from "lucide-react";
    import type { ColumnDef } from "@tanstack/react-table";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
    import type { TransactionDoc, TransactionType } from "@/lib/types/transaction";
    import { DataTable } from "@/components/feature/table/DataTable";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import { Button } from "@/components/ui/button";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { EmptyState } from "@/components/ui/empty-state";

    const TX_TYPES: TransactionType[] = ["checkout", "checkin", "adjustment", "missing"];

    export function HistoryTable() {
      const allTxs = useMockStore((s) => s.transactions);
      const events = useMockStore((s) => s.events);
      const items = useMockStore((s) => s.items);
      const users = useMockStore((s) => s.users);
      const { state: url, setFilter } = useUrlTableState(["type", "eventId", "itemId", "actorUid", "from", "to"]);

      const filtered = useMemo(() => {
        return allTxs.filter((t) => {
          if (url.filters.type && t.type !== url.filters.type) return false;
          if (url.filters.eventId && t.eventId !== url.filters.eventId) return false;
          if (url.filters.itemId && t.itemId !== url.filters.itemId) return false;
          if (url.filters.actorUid && t.actorUid !== url.filters.actorUid) return false;
          if (url.filters.from && t.at < url.filters.from) return false;
          if (url.filters.to && t.at > url.filters.to) return false;
          if (url.q) {
            const q = url.q.toLowerCase();
            if (![t.itemName, t.eventName ?? "", t.actorName, t.notes].some((s) => s.toLowerCase().includes(q))) return false;
          }
          return true;
        }).sort((a, b) => b.at.localeCompare(a.at));
      }, [allTxs, url.filters, url.q]);

      const columns: ColumnDef<TransactionDoc>[] = useMemo(() => [
        {
          accessorKey: "at",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              When <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => new Date(row.original.at).toLocaleString(),
        },
        {
          accessorKey: "type",
          header: "Type",
          cell: ({ row }) => <StatusBadge tone={statusToTone(row.original.type)}>{statusToLabel(row.original.type)}</StatusBadge>,
        },
        {
          accessorKey: "itemName",
          header: "Item",
          cell: ({ row }) => (
            <Link href={`/inventory/${row.original.itemId}`} className="hover:underline">{row.original.itemName}</Link>
          ),
        },
        {
          accessorKey: "qty",
          header: "Qty",
        },
        {
          accessorKey: "eventName",
          header: "Event",
          cell: ({ row }) => row.original.eventId ? (
            <Link href={`/events/${row.original.eventId}`} className="hover:underline">{row.original.eventName}</Link>
          ) : <span className="text-muted-foreground">—</span>,
        },
        {
          accessorKey: "actorName",
          header: "Actor",
          cell: ({ row }) => <span>{row.original.actorName} <span className="text-xs text-muted-foreground">({row.original.actorRoleAtTimeOfAction})</span></span>,
        },
      ], []);

      return (
        <DataTable<TransactionDoc>
          columns={columns}
          data={filtered}
          filterKeys={["type", "eventId", "itemId", "actorUid", "from", "to"]}
          globalFilterPlaceholder="Search history…"
          toolbarExtras={
            <>
              <Select value={url.filters.type ?? "_all"} onValueChange={(v) => setFilter("type", v === "_all" ? undefined : v)}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All types</SelectItem>
                  {TX_TYPES.map((t) => <SelectItem key={t} value={t}>{statusToLabel(t)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={url.filters.eventId ?? "_all"} onValueChange={(v) => setFilter("eventId", v === "_all" ? undefined : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All events" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All events</SelectItem>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={url.filters.actorUid ?? "_all"} onValueChange={(v) => setFilter("actorUid", v === "_all" ? undefined : v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All actors" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All actors</SelectItem>
                  {users.map((u) => <SelectItem key={u.uid} value={u.uid}>{u.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          }
          emptyState={<EmptyState icon={Activity} heading="No activity yet" body="Transactions will appear here." />}
        />
      );
    }
    ```
  </action>
  <verify>
    <automated>ls app/(app)/reports/history/page.tsx components/feature/reports/HistoryTable.tsx; grep -q "useUrlTableState" components/feature/reports/HistoryTable.tsx; grep -q "filterKeys=" components/feature/reports/HistoryTable.tsx; grep -q "type" components/feature/reports/HistoryTable.tsx; grep -q "eventId" components/feature/reports/HistoryTable.tsx; grep -q "actorUid" components/feature/reports/HistoryTable.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist.
    - HistoryTable has 6 URL-synced filter keys: type, eventId, itemId, actorUid, from, to.
    - tsc passes.
  </acceptance_criteria>
  <done>History page renders global tx log with multi-filter URL sync.</done>
</task>

<task type="auto">
  <name>Task 3: Missing report + ResolveMissingSheet</name>
  <files>
    app/(app)/reports/missing/page.tsx,
    components/feature/reports/MissingItemsTable.tsx,
    components/feature/missing/ResolveMissingSheet.tsx
  </files>
  <read_first>
    - .planning/REQUIREMENTS.md MIS-02, MIS-03, MIS-04, REP-03
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Shared #8 Sheet vs Dialog" (Sheet for resolve missing item)
    - lib/schemas/missing-item.ts (ResolveMissingSchema)
    - lib/mock/store.ts (resolveMissing)
    - components/ui/sheet.tsx
  </read_first>
  <action>
    **components/feature/missing/ResolveMissingSheet.tsx**:
    ```tsx
    "use client";
    import { useState } from "react";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { toast } from "sonner";
    import {
      Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
    } from "@/components/ui/sheet";
    import {
      Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
    } from "@/components/ui/form";
    import { Button } from "@/components/ui/button";
    import { Textarea } from "@/components/ui/textarea";
    import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
    import { ResolveMissingSchema, type ResolveMissingInput } from "@/lib/schemas/missing-item";
    import { resolveMissing } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";

    export function ResolveMissingSheet({ missingId, itemName }: { missingId: string; itemName: string }) {
      const [open, setOpen] = useState(false);
      const session = useCurrentUser();
      const form = useForm<ResolveMissingInput>({
        resolver: zodResolver(ResolveMissingSchema),
        defaultValues: { missingId, resolution: "found", notes: "" },
      });

      if (session?.role !== "admin") return null;

      function onSubmit(values: ResolveMissingInput) {
        const actor = seedUsers.find((u) => u.uid === session?.uid);
        if (!actor) { toast.error("Couldn't resolve"); return; }
        resolveMissing(values.missingId, values.resolution, actor);
        toast.success(values.resolution === "found" ? "Marked as found" : "Written off");
        setOpen(false);
        form.reset({ missingId, resolution: "found", notes: "" });
      }

      return (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">Resolve</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Resolve missing</SheetTitle>
              <SheetDescription>Decide what happens to {itemName}.</SheetDescription>
            </SheetHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="resolution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resolution</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-2">
                          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                            <RadioGroupItem value="found" />
                            <div>
                              <p className="text-sm font-medium">Found</p>
                              <p className="text-xs text-muted-foreground">Return quantity to available stock.</p>
                            </div>
                          </label>
                          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                            <RadioGroupItem value="writtenOff" />
                            <div>
                              <p className="text-sm font-medium">Write off</p>
                              <p className="text-xs text-muted-foreground">Decrement total quantity. Permanent.</p>
                            </div>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl><Textarea rows={3} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <SheetFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Confirm</Button>
                </SheetFooter>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      );
    }
    ```

    **components/feature/reports/MissingItemsTable.tsx** (MIS-02):
    ```tsx
    "use client";
    import { useMemo } from "react";
    import Link from "next/link";
    import { CheckCircle2, ArrowUpDown } from "lucide-react";
    import type { ColumnDef } from "@tanstack/react-table";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
    import type { MissingItemDoc, MissingReason, MissingStatus } from "@/lib/types/missing-item";
    import { DataTable } from "@/components/feature/table/DataTable";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { Button } from "@/components/ui/button";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { EmptyState } from "@/components/ui/empty-state";
    import { ResolveMissingSheet } from "@/components/feature/missing/ResolveMissingSheet";

    const REASONS: MissingReason[] = ["Lost", "Damaged", "Not returned", "Unknown"];
    const STATUSES: MissingStatus[] = ["open", "found", "writtenOff"];

    export function MissingItemsTable() {
      const records = useMockStore((s) => s.missingItems);
      const { state: url, setFilter } = useUrlTableState(["status", "reason", "eventId"]);

      const filtered = useMemo(() => {
        // Default status=open
        const statusFilter = url.filters.status ?? "open";
        return records.filter((m) => {
          if (statusFilter !== "_all" && m.status !== statusFilter) return false;
          if (url.filters.reason && m.reason !== url.filters.reason) return false;
          if (url.filters.eventId && m.eventId !== url.filters.eventId) return false;
          if (url.q) {
            const q = url.q.toLowerCase();
            if (![m.itemName, m.eventName, m.reportedByName].some((s) => s.toLowerCase().includes(q))) return false;
          }
          return true;
        });
      }, [records, url.filters, url.q]);

      const events = useMockStore((s) => s.events);

      const columns: ColumnDef<MissingItemDoc>[] = useMemo(() => [
        {
          accessorKey: "reportedAt",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Reported <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => new Date(row.original.reportedAt).toLocaleDateString(),
        },
        {
          accessorKey: "itemName",
          header: "Item",
          cell: ({ row }) => (
            <Link href={`/inventory/${row.original.itemId}`} className="hover:underline">{row.original.itemName}</Link>
          ),
        },
        { accessorKey: "qty", header: "Qty" },
        {
          accessorKey: "eventName",
          header: "Event",
          cell: ({ row }) => (
            <Link href={`/events/${row.original.eventId}`} className="hover:underline">{row.original.eventName}</Link>
          ),
        },
        { accessorKey: "reason", header: "Reason" },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => {
            const s = row.original.status;
            if (s === "open") return <StatusBadge tone="destructive">Open</StatusBadge>;
            if (s === "found") return <StatusBadge tone="muted">Found</StatusBadge>;
            return <StatusBadge tone="muted">Written off</StatusBadge>;
          },
        },
        { accessorKey: "reportedByName", header: "Reporter" },
        {
          id: "actions",
          header: "",
          cell: ({ row }) => row.original.status === "open"
            ? <ResolveMissingSheet missingId={row.original.id} itemName={row.original.itemName} />
            : null,
        },
      ], []);

      return (
        <DataTable<MissingItemDoc>
          columns={columns}
          data={filtered}
          filterKeys={["status", "reason", "eventId"]}
          globalFilterPlaceholder="Search missing items…"
          toolbarExtras={
            <>
              <Select value={url.filters.status ?? "open"} onValueChange={(v) => setFilter("status", v === "open" ? undefined : v)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All statuses</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "writtenOff" ? "Written off" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={url.filters.reason ?? "_all"} onValueChange={(v) => setFilter("reason", v === "_all" ? undefined : v)}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All reasons" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All reasons</SelectItem>
                  {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={url.filters.eventId ?? "_all"} onValueChange={(v) => setFilter("eventId", v === "_all" ? undefined : v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All events" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All events</SelectItem>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          }
          emptyState={<EmptyState icon={CheckCircle2} heading="Nothing missing" body="All checked-out items are accounted for." />}
        />
      );
    }
    ```

    **app/(app)/reports/missing/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { Download } from "lucide-react";
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { MissingItemsTable } from "@/components/feature/reports/MissingItemsTable";

    export const metadata: Metadata = { title: "Missing" };

    export default function MissingReportPage() {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Missing"
            description="Open missing-item records."
            action={<Button variant="outline" disabled><Download className="mr-2 size-4" />Export CSV</Button>}
          />
          <MissingItemsTable />
        </div>
      );
    }
    ```
  </action>
  <verify>
    <automated>ls app/(app)/reports/missing/page.tsx components/feature/reports/MissingItemsTable.tsx components/feature/missing/ResolveMissingSheet.tsx; grep -q "ResolveMissingSchema" components/feature/missing/ResolveMissingSheet.tsx; grep -q "resolveMissing" components/feature/missing/ResolveMissingSheet.tsx; grep -q "Nothing missing" components/feature/reports/MissingItemsTable.tsx; grep -q "All checked-out items are accounted for" components/feature/reports/MissingItemsTable.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - All 3 files exist.
    - Empty state copy verbatim UI-SPEC: `Nothing missing` / `All checked-out items are accounted for.`
    - Resolve sheet uses Zod schema and calls store.resolveMissing.
    - tsc + build pass.
  </acceptance_criteria>
  <done>Missing report + admin resolve flow complete.</done>
</task>

</tasks>

<verification>
- All 5 report routes render with seed data.
- URL params persist filter selections.
- Admin can resolve a missing record; the row drops out of the open filter.
- npm run build passes.
</verification>

<success_criteria>REP-01..07, MIS-02..04, RP-04, RP-02 satisfied.</success_criteria>

<output>After completion, create `.planning/phases/phase-kayinleong-01/01-11-reports-SUMMARY.md` documenting the 11 files and verifying every UI-SPEC empty-state copy is verbatim.</output>
