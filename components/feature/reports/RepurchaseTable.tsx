// Phase 1 — /reports/repurchase client table.
//
// REQUIREMENTS:
//   - REP-05 — items below threshold plus items frequently flagged missing/damaged.
//   - RP-04 — admin can mark a low-stock item as "ordered" (inline button).
//   - REP-06 — sort/page/filter state is URL-synced (via DataTable wrapper).
//   - REP-07 — 50 rows per page (DataTable default).
//
// Surfaces two repurchase signals:
//   - low-stock — availableQty <= threshold AND not already marked ordered
//   - frequently-missing — ≥2 open missing records OR ≥2 damaged units
//
// Actor-resolution pattern from Plan 05 D-01-05-E: read useCurrentUser() for
// the role/uid, resolve the full UserDoc from seedUsers at click time, call
// the store mutator with the resolved actor.
//
// D-11 sortable-columns rule (Plan 03 Task 2): sortable columns in this table
// are `name`. Non-sortable columns (`sku`, `available`, `threshold`, `missing`,
// `damaged`, `reason`, `actions`) render plain string headers — NO
// toggleSorting button, NO ArrowUpDown icon. Each non-sortable column carries
// a `// D-11: <col> is NOT sortable` audit comment.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

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

type RepurchaseReason = "low-stock" | "frequently-missing";

type Row = {
  item: InventoryItem;
  missingCount: number;
  damagedCount: number;
  reason: RepurchaseReason;
};

export function RepurchaseTable() {
  const items = useMockStore((s) => s.items);
  const missing = useMockStore((s) => s.missingItems);
  const session = useCurrentUser();

  const rows: Row[] = useMemo(() => {
    const result: Row[] = [];
    for (const i of items) {
      if (i.lifecycleState === "retired") continue;
      // Low-stock — primary repurchase signal.
      const isLowStock =
        i.lowStockThreshold > 0 &&
        i.availableQty <= i.lowStockThreshold &&
        !i.lowStockOrderedAt;
      if (isLowStock) {
        result.push({
          item: i,
          missingCount: 0,
          damagedCount: i.damagedQty,
          reason: "low-stock",
        });
        continue;
      }
      // Frequently-missing — secondary repurchase signal (≥2 open missing or
      // ≥2 damaged units suggests this SKU loses stock regularly).
      const missingForItem = missing.filter(
        (m) => m.itemId === i.id && m.status !== "found",
      );
      if (missingForItem.length >= 2 || i.damagedQty >= 2) {
        result.push({
          item: i,
          missingCount: missingForItem.length,
          damagedCount: i.damagedQty,
          reason: "frequently-missing",
        });
      }
    }
    return result;
  }, [items, missing]);

  function markOrdered(itemId: string, name: string) {
    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't mark as ordered");
      return;
    }
    markLowStockOrdered(itemId, actor);
    toast.success(`${name} marked as ordered`);
  }

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        id: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Item <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        accessorFn: (r) => r.item.name,
        cell: ({ row }) => (
          <Link
            href={`/inventory/${row.original.item.id}`}
            className="font-medium hover:underline"
          >
            {row.original.item.name}
          </Link>
        ),
      },
      {
        id: "sku",
        // D-11: sku is NOT sortable.
        header: "SKU",
        accessorFn: (r) => r.item.sku,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.item.sku}</span>
        ),
      },
      {
        id: "available",
        // D-11: available is NOT sortable.
        header: "Available",
        accessorFn: (r) => r.item.availableQty,
      },
      {
        id: "threshold",
        // D-11: threshold is NOT sortable.
        header: "Threshold",
        accessorFn: (r) => r.item.lowStockThreshold,
        cell: ({ row }) =>
          row.original.item.lowStockThreshold > 0
            ? row.original.item.lowStockThreshold
            : "—",
      },
      {
        id: "missing",
        // D-11: missing is NOT sortable.
        header: "Missing",
        accessorFn: (r) => r.missingCount,
      },
      {
        id: "damaged",
        // D-11: damaged is NOT sortable.
        header: "Damaged",
        accessorFn: (r) => r.damagedCount,
      },
      {
        id: "reason",
        // D-11: reason is NOT sortable.
        header: "Reason",
        cell: ({ row }) =>
          row.original.reason === "low-stock" ? (
            <StatusBadge tone="amber">Low stock</StatusBadge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Frequent loss
            </Badge>
          ),
      },
      {
        id: "actions",
        // D-11: actions is NOT sortable.
        header: "",
        cell: ({ row }) =>
          session?.role === "admin" && row.original.reason === "low-stock" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                markOrdered(row.original.item.id, row.original.item.name)
              }
            >
              Mark as ordered
            </Button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session],
  );

  return (
    <DataTable<Row>
      columns={columns}
      data={rows}
      globalFilterPlaceholder="Search items…"
      emptyState={
        <EmptyState
          icon={AlertTriangle}
          heading="Nothing to repurchase"
          body="No items currently meet repurchase criteria."
        />
      }
    />
  );
}
