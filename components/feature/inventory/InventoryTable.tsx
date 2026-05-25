// Phase 2 — InventoryTable client island (Block C UI swap, plan 02-06).
//
// REQUIREMENTS:
//   - INV-06 — filter by category, lifecycle, low-stock
//   - INV-07 — free-text search across name + SKU (filtered client-side
//     within the 50-row cursor window)
//   - REP-06 — every filter URL state is shareable (cursor + filters)
//   - REP-07 — cursor window = 50 rows
//
// Phase 2 swap from Phase 1:
//   - mock-store hook → SSR-seeded `initialItems` + `useInventoryLive(initial)`
//     for live updates (D-20 listener scope: 50-row visible window).
//   - URL contract `?page=N` → `?cursor=xxx` per D-17. TanStack table runs
//     with `manualPagination: true` (server-driven slice), pageCount: -1
//     because Firestore cannot return a total count. "Page N of M" UI is
//     replaced with "Showing N items" + Prev/Next buttons.
//   - Filter changes clear the cursor automatically via useUrlTableState
//     (RESEARCH P9). The bypass of the generic <DataTable> wrapper is
//     deliberate — that wrapper retains client-side pagination for the
//     not-yet-migrated tables; cursor consumers drive useReactTable
//     directly.
//
// D-11 sortable-columns rule (from Phase 1): sortable columns are name,
// sku, availableQty, lifecycleState. category and outQty render plain
// string headers — NO toggleSorting button, NO ArrowUpDown icon. The
// non-sortable columns carry a `// D-11: <col> is NOT sortable` audit
// comment so the rule is greppable.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Package } from "lucide-react";

import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import type {
  InventoryItem,
  ItemCategory,
  ItemLifecycleState,
} from "@/lib/types/item";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import {
  statusToTone,
  statusToLabel,
} from "@/components/feature/status/status-to-tone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";

const CATEGORIES: ItemCategory[] = ["Audio", "Lighting", "Display", "Marketing"];
const LIFECYCLES: ItemLifecycleState[] = [
  "available",
  "checked_out",
  "damaged",
  "retired",
];

export function InventoryTable({
  initialItems,
  nextCursor,
}: {
  initialItems: InventoryItem[];
  nextCursor: string | null;
}) {
  const router = useRouter();
  // D-20: page-scoped live data, 50-row window. The hook seeds from SSR
  // and takes over via onSnapshot for the same query slice.
  const itemsLive = useInventoryLive(initialItems);
  // Memoize to give TanStack a stable identity for sort/filter perf.
  const items = useMemo(() => [...itemsLive], [itemsLive]);

  const { state: url, setGlobalFilter, setFilter, setCursor } = useUrlTableState(
    ["category", "lifecycleState", "isLowStock"],
  );

  // Client-side filter within the 50-row cursor window per D-20. Server
  // already applied category / lifecycleState / isLowStock filters in
  // getInventoryPage, but the live listener may include rows that don't
  // match the URL state during the brief window between filter change and
  // route navigation. Defensive client-side filter keeps the UI consistent.
  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (url.filters.category && i.category !== url.filters.category)
        return false;
      if (
        url.filters.lifecycleState &&
        i.lifecycleState !== url.filters.lifecycleState
      )
        return false;
      if (url.filters.isLowStock === "true" && !i.isLowStock) return false;
      if (url.q) {
        const q = url.q.toLowerCase();
        if (
          !i.name.toLowerCase().includes(q) &&
          !i.sku.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [items, url.filters, url.q]);

  const columns: ColumnDef<InventoryItem>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Name <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/inventory/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "sku",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            SKU <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.sku}</span>
        ),
      },
      {
        accessorKey: "category",
        // D-11: category is NOT sortable.
        header: "Category",
      },
      {
        accessorKey: "availableQty",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Available <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span>
            {row.original.availableQty}{" "}
            <span className="text-muted-foreground text-xs">
              / {row.original.totalQty}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "outQty",
        // D-11: outQty is NOT sortable.
        header: "Out",
        cell: ({ row }) => row.original.outQty,
      },
      {
        accessorKey: "lifecycleState",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Status <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <StatusBadge tone={statusToTone(row.original.lifecycleState)}>
            {statusToLabel(row.original.lifecycleState)}
          </StatusBadge>
        ),
      },
    ],
    [],
  );

  const sorting: SortingState = useMemo(() => {
    if (!url.sort) return [];
    const [id, dir] = url.sort.split(":");
    return id ? [{ id, desc: dir === "desc" }] : [];
  }, [url.sort]);

  // D-17: manualPagination — the 50-row window is server-driven via the
  // cursor URL contract. pageCount: -1 because Firestore can't return a
  // total. TanStack won't try to paginate the slice further; we just
  // surface a Next/Prev button driven by the SSR-seeded nextCursor.
  const table = useReactTable({
    data: filtered,
    columns,
    manualPagination: true,
    pageCount: -1,
    state: {
      sorting,
      pagination: { pageIndex: 0, pageSize: 50 },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = items.length === 0;

  function goPrev() {
    // Cursors are forward-only; rely on browser back to pop the cursor stack.
    router.back();
  }
  function goNext() {
    if (nextCursor) setCursor(nextCursor);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search name or SKU…"
          value={url.q}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={url.filters.category ?? "_all"}
          onValueChange={(v) =>
            setFilter("category", v === "_all" ? null : v)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={url.filters.lifecycleState ?? "_all"}
          onValueChange={(v) =>
            setFilter("lifecycleState", v === "_all" ? null : v)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All statuses</SelectItem>
            {LIFECYCLES.map((l) => (
              <SelectItem key={l} value={l}>
                {statusToLabel(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={url.filters.isLowStock === "true" ? "default" : "outline"}
          size="sm"
          onClick={() =>
            setFilter(
              "isLowStock",
              url.filters.isLowStock === "true" ? null : "true",
            )
          }
        >
          Low stock only
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isEmpty ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState
                    icon={Package}
                    heading="No items yet"
                    body="Add your first inventory item to get started."
                    action={
                      <Button asChild>
                        <Link href="/inventory/new">Add item</Link>
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* D-17 pagination chrome: prev/next-only, no total count. */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          Showing {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={!url.cursor}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={!nextCursor}
            aria-label="Next page"
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
