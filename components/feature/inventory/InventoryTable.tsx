// Phase 1 — InventoryTable client island wrapping the generic DataTable.
//
// REQUIREMENTS:
//   - INV-06 — filter by category, lifecycle, low-stock
//   - INV-07 — free-text search across name + SKU
//   - REP-06 — every filter / sort / page state lives in the URL
//   - REP-07 — DataTable default pageSize = 50
//
// D-11 sortable-columns rule (from Plan 03 / 01-CONTEXT D-11): sortable columns
// in this table are name, sku, availableQty, lifecycleState. category and
// outQty render plain string headers — NO toggleSorting button, NO ArrowUpDown
// icon. The non-sortable columns carry a `// D-11: <col> is NOT sortable`
// audit comment so the rule is greppable.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Package, ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { useMockStore } from "@/lib/hooks/use-mock-store";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import type {
  InventoryItem,
  ItemLifecycleState,
  ItemCategory,
} from "@/lib/types/item";
import { DataTable } from "@/components/feature/table/DataTable";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import {
  statusToTone,
  statusToLabel,
} from "@/components/feature/status/status-to-tone";
import { Button } from "@/components/ui/button";
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

export function InventoryTable() {
  const items = useMockStore((s) => s.items);
  const { state: url, setFilter } = useUrlTableState([
    "category",
    "lifecycle",
    "lowStock",
  ]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (url.filters.category && i.category !== url.filters.category) return false;
      if (url.filters.lifecycle && i.lifecycleState !== url.filters.lifecycle) return false;
      if (url.filters.lowStock === "true") {
        // Mirror selectLowStockItems predicate so the toolbar filter matches the
        // dashboard widget exactly (RP-01 / RP-02 / RP-04).
        if (
          !(
            i.lifecycleState !== "retired" &&
            i.lowStockThreshold > 0 &&
            i.availableQty <= i.lowStockThreshold &&
            !i.lowStockOrderedAt
          )
        ) {
          return false;
        }
      }
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
  }, [items, url.filters.category, url.filters.lifecycle, url.filters.lowStock, url.q]);

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

  return (
    <DataTable<InventoryItem>
      columns={columns}
      data={filtered}
      filterKeys={["category", "lifecycle", "lowStock"]}
      globalFilterPlaceholder="Search name or SKU…"
      emptyState={
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
      }
      toolbarExtras={
        <>
          <Select
            value={url.filters.category ?? "_all"}
            onValueChange={(v) =>
              setFilter("category", v === "_all" ? undefined : v)
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
            value={url.filters.lifecycle ?? "_all"}
            onValueChange={(v) =>
              setFilter("lifecycle", v === "_all" ? undefined : v)
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
            variant={url.filters.lowStock === "true" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setFilter(
                "lowStock",
                url.filters.lowStock === "true" ? undefined : "true",
              )
            }
          >
            Low stock only
          </Button>
        </>
      }
    />
  );
}
