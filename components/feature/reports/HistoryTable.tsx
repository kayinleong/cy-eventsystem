// Phase 2 — /reports/history client table (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - REP-04 — global transaction log with filters: type, event, item, actor.
//   - REP-06 — every filter / sort / page state is URL-synced via
//     useUrlTableState (4 keys: type, eventId, itemId, actorUid).
//   - REP-07 — cursor window = 50 rows.
//
// Phase 2 swap from Phase 1:
//   - useMockStore → useTransactionsLive scoped to the active filter set.
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
  Activity,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";
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
  const { state: url, setGlobalFilter, setFilter, setCursor } = useUrlTableState(
    ["type", "eventId", "itemId", "actorUid"],
  );

  // Pick a single-axis filter for the live listener — composite indexes
  // from 02-02 cover each axis separately. Multi-axis filters fall back
  // to the SSR cursor re-fetch on URL change.
  const liveFilter = useMemo(() => {
    if (url.filters.type) return { type: url.filters.type as TransactionType };
    if (url.filters.eventId) return { eventId: url.filters.eventId };
    if (url.filters.itemId) return { itemId: url.filters.itemId };
    if (url.filters.actorUid) return { actorUid: url.filters.actorUid };
    return {};
  }, [url.filters]);

  const txsLive = useTransactionsLive({
    ...liveFilter,
    limit: 50,
    initial,
  });

  // Client-side filter inside the 50-row cursor window. Defensive — when
  // multiple filters apply but the listener only picks the first axis,
  // re-apply the rest here.
  const filtered = useMemo(() => {
    return txsLive.filter((t) => {
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
  }, [txsLive, url.filters, url.q]);

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
  const isEmpty = txsLive.length === 0;

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
