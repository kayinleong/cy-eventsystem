// Phase 2 — /reports/out client table (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-02 — items currently checked out across active events.
//   - REP-06 — sort/page/filter state is URL-synced (eventId filter key).
//   - REP-07 — cursor window = 50 rows.
//
// Open-line derivation (quick-kayinleong-020):
//   - `initialCheckouts` is ALREADY open-only — /reports/out/page.tsx fetches
//     the checkout cursor page and subtracts checkouts that have a matching
//     checkin (server-side, via getOpenCheckoutIdsForCheckouts).
//   - The old client onSnapshot listeners (checkout + checkin) were dropped:
//     they clobbered the cursor seed (broke Next) and doubled Firestore reads.
//     This table now renders the SSR seed directly, mirroring /users.
//
// D-11 sortable-columns rule: sortable = at (chronological axis). Non-sortable:
// itemName, qty, eventName, actorName.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  const { state: url, setGlobalFilter } = useUrlTableState(["eventId"]);

  // quick-kayinleong-020: `initialCheckouts` is already open-only (derived
  // server-side in /reports/out/page.tsx). Render the SSR seed directly — no
  // client onSnapshot listener.
  const openCheckouts = useMemo(
    () => [...initialCheckouts],
    [initialCheckouts],
  );

  // quick-kayinleong-020: build the Next href from the current params so
  // active filter/sort/search survive (REP-06 shareable URLs).
  const nextHref = useMemo(() => {
    if (!nextCursor) return null;
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    next.set("cursor", nextCursor);
    return `/reports/out?${next.toString()}`;
  }, [searchParams, nextCursor]);

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
          {nextHref ? (
            <Button asChild variant="outline" size="sm" aria-label="Next page">
              <Link href={nextHref}>
                Next <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              aria-label="Next page"
            >
              Next <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
