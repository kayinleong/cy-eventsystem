// Phase 2 — /reports/stock client table (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-01 — every active item: name + sku + category + availableQty +
//     outQty + damagedQty + totalQty + threshold + low-stock badge.
//   - REP-06 — sort/page/filter state is URL-synced via useUrlTableState
//     (2 filter keys: category, lifecycleState).
//   - REP-07 — cursor window = 50 rows.
//
// Phase 2 swap from Phase 1:
//   - useMockStore → SSR-seeded `initialItems` + useInventoryLive for live
//     updates (D-20 50-row window).
//   - Inline category + lifecycleState filters mirror /inventory pattern.
//   - Cursor pagination via Next/Prev buttons (cursor URL contract per D-17).
//
// D-11 sortable-columns rule preserved: sortable = name, availableQty.
// Non-sortable: sku, category, outQty, damagedQty, totalQty, threshold, status.

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
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
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

const CATEGORIES: ItemCategory[] = [
  "Audio",
  "Lighting",
  "Display",
  "Marketing",
];
const LIFECYCLES: ItemLifecycleState[] = [
  "available",
  "checked_out",
  "damaged",
  "retired",
];

export function StockReportTable({
  initialItems,
  nextCursor,
}: {
  initialItems: InventoryItem[];
  nextCursor: string | null;
}) {
  const router = useRouter();
  const itemsLive = useInventoryLive(initialItems);
  const items = useMemo(() => [...itemsLive], [itemsLive]);

  const { state: url, setGlobalFilter, setFilter, setCursor } = useUrlTableState(
    ["category", "lifecycleState"],
  );

  // Client-side filter inside the 50-row cursor window. Server already
  // applied category / lifecycleState filters in getInventoryPage; this
  // defensive filter keeps the UI consistent during the brief window
  // between filter change and route navigation.
  const filtered = useMemo(() => {
    return items.filter((i) => {
      // REP-01 default: exclude retired unless explicitly filtered to.
      if (
        url.filters.lifecycleState !== "retired" &&
        i.lifecycleState === "retired"
      ) {
        return false;
      }
      if (url.filters.category && i.category !== url.filters.category)
        return false;
      if (
        url.filters.lifecycleState &&
        i.lifecycleState !== url.filters.lifecycleState
      )
        return false;
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
        // D-11: sku is NOT sortable.
        header: "SKU",
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
      },
      {
        accessorKey: "outQty",
        // D-11: outQty is NOT sortable.
        header: "Out",
      },
      {
        accessorKey: "damagedQty",
        // D-11: damagedQty is NOT sortable.
        header: "Damaged",
      },
      {
        accessorKey: "totalQty",
        // D-11: totalQty is NOT sortable.
        header: "Total",
      },
      {
        accessorKey: "lowStockThreshold",
        // D-11: lowStockThreshold is NOT sortable.
        header: "Threshold",
        cell: ({ row }) =>
          row.original.lowStockThreshold > 0
            ? row.original.lowStockThreshold
            : "—",
      },
      {
        id: "lowStockFlag",
        // D-11: lowStockFlag is NOT sortable.
        header: "Status",
        cell: ({ row }) => {
          const i = row.original;
          if (i.isLowStock && !i.lowStockOrderedAt) {
            return <StatusBadge tone="amber">Low stock</StatusBadge>;
          }
          if (i.lowStockOrderedAt) {
            return (
              <Badge variant="outline" className="text-xs">
                Ordered
              </Badge>
            );
          }
          return null;
        },
      },
    ],
    [],
  );

  const sorting: SortingState = useMemo(() => {
    if (!url.sort) return [];
    const [id, dir] = url.sort.split(":");
    return id ? [{ id, desc: dir === "desc" }] : [];
  }, [url.sort]);

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
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    body="Add inventory items to see them here."
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
