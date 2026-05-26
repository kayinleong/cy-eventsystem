// Phase 2 — /reports/out client table (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-02 — items currently checked out across active events.
//   - REP-06 — sort/page/filter state is URL-synced (eventId filter key).
//   - REP-07 — cursor window = 50 rows.
//
// Open-line derivation:
//   - Subscribe to checkout transactions (initialCheckouts from SSR).
//   - Subscribe to checkin transactions matching the visible event window.
//   - Open = checkout.id NOT in any checkin.parentTxId.
//
// Same pattern as EventAssignedItemsTab (02-08): the listener scope is
// 50-row windowed per D-20, the filter happens in JS over that slice.
//
// D-11 sortable-columns rule: sortable = at (chronological axis). Non-sortable:
// itemName, qty, eventName, actorName.

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
  PackageOpen,
} from "lucide-react";

import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import type { TransactionDoc } from "@/lib/types/transaction";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

export function ItemsOutTable({
  initialCheckouts,
  nextCursor,
}: {
  initialCheckouts: TransactionDoc[];
  nextCursor: string | null;
}) {
  const router = useRouter();

  const { state: url, setGlobalFilter, setCursor } = useUrlTableState([
    "eventId",
  ]);

  // Two listeners scoped to the visible 50-row window per D-20. SSR seed
  // for checkouts gives the first paint; the listener takes over once
  // auth resolves.
  const checkoutsLive = useTransactionsLive({
    type: "checkout",
    eventId: url.filters.eventId || undefined,
    limit: 50,
    initial: initialCheckouts,
  });
  const checkinsLive = useTransactionsLive({
    type: "checkin",
    eventId: url.filters.eventId || undefined,
    limit: 50,
  });

  // Open-line derivation: checkout.id not referenced by any checkin.parentTxId.
  const openCheckouts = useMemo(() => {
    const closedParents = new Set(
      checkinsLive
        .map((t) => t.parentTxId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );
    return checkoutsLive.filter((t) => !closedParents.has(t.id));
  }, [checkoutsLive, checkinsLive]);

  const filtered = useMemo(() => {
    if (!url.q) return openCheckouts;
    const q = url.q.toLowerCase();
    return openCheckouts.filter((t) =>
      [t.itemName, t.itemSku, t.eventName ?? "", t.actorName].some((s) =>
        s.toLowerCase().includes(q),
      ),
    );
  }, [openCheckouts, url.q]);

  const columns: ColumnDef<TransactionDoc>[] = useMemo(
    () => [
      {
        accessorKey: "at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Checked out <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => new Date(row.original.at).toLocaleString(),
        sortingFn: (a, b) => a.original.at.localeCompare(b.original.at),
      },
      {
        accessorKey: "itemName",
        // D-11: itemName is NOT sortable.
        header: "Item",
        cell: ({ row }) => (
          <Link
            href={`/inventory/${row.original.itemId}`}
            className="font-medium hover:underline"
          >
            {row.original.itemName}
          </Link>
        ),
      },
      {
        accessorKey: "itemSku",
        // D-11: itemSku is NOT sortable.
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.itemSku}</span>
        ),
      },
      {
        accessorKey: "qty",
        // D-11: qty is NOT sortable.
        header: "Qty",
      },
      {
        accessorKey: "eventName",
        // D-11: eventName is NOT sortable.
        header: "Event",
        cell: ({ row }) =>
          row.original.eventId ? (
            <Link
              href={`/events/${row.original.eventId}`}
              className="hover:underline"
            >
              {row.original.eventName}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "actorName",
        // D-11: actorName is NOT sortable.
        header: "Checked out by",
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
    state: { sorting, pagination: { pageIndex: 0, pageSize: 50 } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = openCheckouts.length === 0;

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
          placeholder="Search item or event…"
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
                    icon={PackageOpen}
                    heading="Nothing checked out"
                    body="No items are currently at events."
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
          Showing {filtered.length} open{" "}
          {filtered.length === 1 ? "checkout" : "checkouts"}
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
