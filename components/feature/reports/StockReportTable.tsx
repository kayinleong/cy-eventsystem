// Phase 1 — /reports/stock client table.
//
// REQUIREMENTS:
//   - REP-01 — every active item: name + sku + category + availableQty +
//     outQty + damagedQty + totalQty + threshold + low-stock badge.
//   - REP-06 — sort/page/filter state is URL-synced (via DataTable wrapper).
//   - REP-07 — 50 rows per page (DataTable default).
//
// D-11 sortable-columns rule (Plan 03 Task 2): sortable columns in this table
// are `name`, `availableQty`. Non-sortable columns (`sku`, `category`, `outQty`,
// `damagedQty`, `totalQty`, `lowStockThreshold`, `lowStockFlag`) render plain
// string headers — NO toggleSorting button, NO ArrowUpDown icon. Each
// non-sortable column carries a `// D-11: <col> is NOT sortable` audit comment
// so the rule is greppable.

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
  // Read raw slice (reference-stable across snapshots) and project inside
  // useMemo so useSyncExternalStore's identity check stays happy. Mirrors
  // InventoryTable's pattern; avoids the "cache getServerSnapshot" infinite-
  // loop warning that the inline-filter shape triggers.
  const allItems = useMockStore((s) => s.items);

  // REP-01 — exclude retired items from the live stock view.
  const items = useMemo(
    () => allItems.filter((i) => i.lifecycleState !== "retired"),
    [allItems],
  );

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
          // Mirror selectLowStockItems predicate so the badge matches the
          // dashboard widget (RP-01 / RP-02 / RP-04).
          const isLowStock =
            i.lowStockThreshold > 0 &&
            i.availableQty <= i.lowStockThreshold &&
            !i.lowStockOrderedAt;
          if (isLowStock) {
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

  return (
    <DataTable<InventoryItem>
      columns={columns}
      data={items}
      globalFilterPlaceholder="Search name or SKU…"
      emptyState={
        <EmptyState
          icon={Package}
          heading="No items yet"
          body="Add inventory items to see them here."
        />
      }
    />
  );
}
