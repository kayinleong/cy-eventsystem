// Phase 2 — /reports/repurchase client table (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-05 — items below threshold (low-stock primary signal).
//   - RP-04 — admin "Mark as ordered" inline action calls markLowStockOrdered
//     Server Action (from app/(app)/inventory/actions.ts).
//   - REP-06 — sort/page/filter state is URL-synced.
//   - REP-07 — cursor window = 50 rows.
//
// Phase 2 swap from Phase 1:
//   - useMockStore + selectLowStockItems → useInventoryLive scoped to
//     {isLowStock: true, limit: 50} (D-20 listener window).
//   - markLowStockOrdered (mock mutator) → markLowStockOrdered Server Action;
//     useTransition for pending state. seedUsers.find() actor lookup removed
//     — Server Action derives actor via requireAdmin().
//   - Marked-as-ordered items are excluded client-side (lowStockOrderedAt !==
//     null) so the list shrinks the moment the action commits.
//
// D-11 sortable-columns rule: sortable = name. Non-sortable: sku, available,
// threshold, missing, damaged, actions.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { markLowStockOrdered } from "@/app/(app)/inventory/actions";
import type { InventoryItem } from "@/lib/types/item";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

export function RepurchaseTable({
  initial,
  nextCursor,
}: {
  initial: InventoryItem[];
  nextCursor: string | null;
}) {
  const router = useRouter();
  const itemsLive = useInventoryLive(initial, {
    isLowStock: true,
    limit: 50,
  });
  const session = useCurrentUser();
  const [pending, startTransition] = useTransition();

  const { state: url, setGlobalFilter, setCursor } = useUrlTableState();

  // Hide items already marked as ordered (RP-04: lowStockOrderedAt set means
  // a replenishment is in flight — keep them out of the actionable list).
  const filtered = useMemo(() => {
    return itemsLive.filter((i) => {
      if (i.lowStockOrderedAt) return false;
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
  }, [itemsLive, url.q]);

  function markOrdered(itemId: string, name: string) {
    startTransition(async () => {
      const r = await markLowStockOrdered(itemId);
      if (!r.ok) {
        toast.error(r.error || "Couldn't mark as ordered");
        return;
      }
      toast.success(`${name} marked as ordered`);
    });
  }

  const isAdmin = session?.role === "admin";

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
            Item <ArrowUpDown className="ml-2 size-3" />
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
        accessorKey: "availableQty",
        // D-11: available is NOT sortable.
        header: "Available",
      },
      {
        accessorKey: "lowStockThreshold",
        // D-11: threshold is NOT sortable.
        header: "Threshold",
        cell: ({ row }) =>
          row.original.lowStockThreshold > 0
            ? row.original.lowStockThreshold
            : "—",
      },
      {
        accessorKey: "damagedQty",
        // D-11: damaged is NOT sortable.
        header: "Damaged",
      },
      {
        id: "reason",
        // D-11: reason is NOT sortable.
        header: "Reason",
        cell: () => <StatusBadge tone="amber">Low stock</StatusBadge>,
      },
      {
        id: "actions",
        // D-11: actions is NOT sortable.
        header: "",
        cell: ({ row }) =>
          isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => markOrdered(row.original.id, row.original.name)}
            >
              Mark as ordered
            </Button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, pending],
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
    state: { sorting, pagination: { pageIndex: 0, pageSize: 50 } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = itemsLive.length === 0;

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
          placeholder="Search items…"
          value={url.q}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
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
                    icon={AlertTriangle}
                    heading="Nothing to repurchase"
                    body="No items currently below threshold."
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
