// Phase 1 — /reports/out client table.
//
// REQUIREMENTS:
//   - REP-02 — items currently checked out across active events.
//   - REP-06 — sort/page/filter state is URL-synced (via DataTable wrapper).
//   - REP-07 — 50 rows per page (DataTable default).
//
// Uses the existing selectItemsOut projection from lib/mock/selectors.ts which
// already filters to active events + open checkouts (matched check-ins
// subtracted).
//
// D-11 sortable-columns rule (Plan 03 Task 2): sortable columns in this table
// are `name`. Non-sortable columns (`sku`, `event`, `outQty`) render plain
// string headers — NO toggleSorting button, NO ArrowUpDown icon. Each
// non-sortable column carries a `// D-11: <col> is NOT sortable` audit comment.

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
        id: "event",
        // D-11: event is NOT sortable.
        header: "Event",
        accessorFn: (r) => r.eventName,
      },
      {
        id: "outQty",
        // D-11: outQty is NOT sortable.
        header: "Out (sum)",
        accessorFn: (r) => r.openTxs.reduce((s, t) => s + t.qty, 0),
      },
    ],
    [],
  );

  return (
    <DataTable<Row>
      columns={columns}
      data={rows}
      globalFilterPlaceholder="Search item or event…"
      emptyState={
        <EmptyState
          icon={PackageOpen}
          heading="Nothing checked out"
          body="No items are currently at events."
        />
      }
    />
  );
}
