// Phase 2 — /reports/history client table (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-04 — global transaction log with filters: type, event, item, actor.
//   - REP-06 — every filter / sort / page state is URL-synced via
//     useUrlTableState (4 keys: type, eventId, itemId, actorUid).
//   - REP-07 — cursor window = 50 rows.
//
// Phase 2 swap from Phase 1:
//   - useMockStore → SSR-seeded `initial` rendered directly. The route handler
//     applies all URL filters to the seed; quick-kayinleong-020 dropped the
//     client live listener (mirrors /users).
//   - Filter dropdowns drive URL state. Each filter axis maps onto one of
//     the composite indexes pre-declared in 02-02 firestore.indexes.json.
//   - Cursor pagination via SSR-seeded nextCursor + Next/Prev buttons.
//
// Note on multi-axis filters: the live listener only applies ONE filter at
// a time (the URL's active filter). Multi-axis filters require a server
// re-fetch via URL cursor refresh — the SSR seed in the route handler
// applies all filters together.
//
// D-11 sortable-columns rule: sortable = at (chronological axis). Non-sortable:
// type, itemName, qty, eventName, actorName.

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
  Activity,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import type {
  TransactionDoc,
  TransactionType,
} from "@/lib/types/transaction";
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

const TX_TYPES: TransactionType[] = [
  "checkout",
  "checkin",
  "adjustment",
  "missing",
];

export function HistoryTable({
  initial,
  nextCursor,
}: {
  initial: TransactionDoc[];
  nextCursor: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state: url, setGlobalFilter, setFilter } = useUrlTableState(
    ["type", "eventId", "itemId", "actorUid"],
  );

  // quick-kayinleong-020: render the SSR-paginated seed directly (no client
  // onSnapshot listener) — mirrors /users. The SSR seed in the route handler
  // applies all URL filters together; the client `filtered` below re-applies
  // them over the seed so multi-axis filtering still works within the window.
  const txs = useMemo(() => [...initial], [initial]);

  // quick-kayinleong-020: build the Next href from the current params so
  // active filter/sort/search survive (REP-06 shareable URLs).
  const nextHref = useMemo(() => {
    if (!nextCursor) return null;
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    next.set("cursor", nextCursor);
    return `/reports/history?${next.toString()}`;
  }, [searchParams, nextCursor]);

  // Client-side filter inside the 50-row cursor window. Defensive — when
  // multiple filters apply, re-apply them all here over the seed.
  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (url.filters.type && t.type !== url.filters.type) return false;
      if (url.filters.eventId && t.eventId !== url.filters.eventId)
        return false;
      if (url.filters.itemId && t.itemId !== url.filters.itemId) return false;
      if (url.filters.actorUid && t.actorUid !== url.filters.actorUid)
        return false;
      if (url.q) {
        const q = url.q.toLowerCase();
        if (
          ![
            t.itemName,
            t.itemSku,
            t.eventName ?? "",
            t.actorName,
            t.notes,
          ].some((s) => s.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [txs, url.filters, url.q]);

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
            When <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => new Date(row.original.at).toLocaleString(),
        sortingFn: (a, b) => a.original.at.localeCompare(b.original.at),
      },
      {
        accessorKey: "type",
        // D-11: type is NOT sortable (status text isn't a chronological axis).
        header: "Type",
        cell: ({ row }) => (
          <StatusBadge tone={statusToTone(row.original.type)}>
            {statusToLabel(row.original.type)}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "itemName",
        // D-11: itemName is NOT sortable.
        header: "Item",
        cell: ({ row }) => (
          <Link
            href={`/inventory/${row.original.itemId}`}
            className="hover:underline"
          >
            {row.original.itemName}
          </Link>
        ),
      },
      {
        accessorKey: "qty",
        // D-11: qty in history is NOT sortable (the chronology axis is `at`).
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
        // D-11: actor display name is NOT sortable.
        header: "Actor",
        cell: ({ row }) => (
          <span>
            {row.original.actorName}{" "}
            <span className="text-xs text-muted-foreground">
              ({row.original.actorRoleAtTimeOfAction})
            </span>
          </span>
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
  const isEmpty = txs.length === 0;

  function goPrev() {
    router.back();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search history…"
          value={url.q}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={url.filters.type ?? "_all"}
          onValueChange={(v) =>
            setFilter("type", v === "_all" ? null : v)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All types</SelectItem>
            {TX_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {statusToLabel(t)}
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
                    icon={Activity}
                    heading="No activity yet"
                    body="Transactions will appear here."
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
          Showing {filtered.length}{" "}
          {filtered.length === 1 ? "transaction" : "transactions"}
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
