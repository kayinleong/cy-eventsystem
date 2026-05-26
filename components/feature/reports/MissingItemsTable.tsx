// Phase 2 — /reports/missing client table (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - MIS-02 / REP-03 — list missing-item records (default status=open)
//     with admin "Resolve" action; resolution dispatches the resolveMissing
//     Server Action (Plan 02-09).
//   - REP-06 — every filter / sort / page state is URL-synced via
//     useUrlTableState (2 keys: status, eventId).
//   - REP-07 — cursor window = 50 rows.
//
// Phase 2 swap from Phase 1:
//   - useMockStore → useMissingLive (Plan 02-09; D-20 50-row window).
//   - SSR-seeded `initial` from getMissingPage; live takeover via onSnapshot.
//   - Cursor pagination with Prev (router.back) / Next (?cursor=) chrome.
//   - ResolveMissingSheet preserved — already calls resolveMissing Server
//     Action from 02-09; no further changes needed.
//
// D-11 sortable-columns rule preserved: sortable = reportedAt (date axis).
// Non-sortable: itemName, qty, eventName, reason, status, reportedByName,
// actions.

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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useMissingLive } from "@/lib/hooks/use-missing-live";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import type {
  MissingItemDoc,
  MissingStatus,
} from "@/lib/types/missing-item";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ResolveMissingSheet } from "@/components/feature/missing/ResolveMissingSheet";

const STATUSES: MissingStatus[] = ["open", "found", "writtenOff"];

export function MissingItemsTable({
  initial,
  nextCursor,
  initialStatus,
}: {
  initial: MissingItemDoc[];
  nextCursor: string | null;
  initialStatus: MissingStatus;
}) {
  const router = useRouter();
  const { state: url, setGlobalFilter, setFilter, setCursor } = useUrlTableState(
    ["status", "eventId"],
  );

  // The page's default is `open`; URL status overrides if present.
  const status: MissingStatus =
    (url.filters.status as MissingStatus | undefined) ?? initialStatus;

  const records = useMissingLive(initial, {
    status,
    eventId: url.filters.eventId || undefined,
    limit: 50,
  });

  const filtered = useMemo(() => {
    return records.filter((m) => {
      if (m.status !== status) return false;
      if (url.filters.eventId && m.eventId !== url.filters.eventId)
        return false;
      if (url.q) {
        const q = url.q.toLowerCase();
        if (
          ![m.itemName, m.eventName, m.reportedByName].some((s) =>
            s.toLowerCase().includes(q),
          )
        ) {
          return false;
        }
      }
      return true;
    });
  }, [records, status, url.filters.eventId, url.q]);

  const columns: ColumnDef<MissingItemDoc>[] = useMemo(
    () => [
      {
        accessorKey: "reportedAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Reported <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) =>
          new Date(row.original.reportedAt).toLocaleDateString(),
        sortingFn: (a, b) =>
          a.original.reportedAt.localeCompare(b.original.reportedAt),
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
        // D-11: qty is NOT sortable.
        header: "Qty",
      },
      {
        accessorKey: "eventName",
        // D-11: eventName is NOT sortable.
        header: "Event",
        cell: ({ row }) => (
          <Link
            href={`/events/${row.original.eventId}`}
            className="hover:underline"
          >
            {row.original.eventName}
          </Link>
        ),
      },
      {
        accessorKey: "reason",
        // D-11: reason is NOT sortable.
        header: "Reason",
      },
      {
        accessorKey: "status",
        // D-11: status is NOT sortable for this table (filter axis only).
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status;
          if (s === "open") {
            return <StatusBadge tone="destructive">Open</StatusBadge>;
          }
          if (s === "found") {
            return <StatusBadge tone="muted">Found</StatusBadge>;
          }
          return <StatusBadge tone="muted">Written off</StatusBadge>;
        },
      },
      {
        accessorKey: "reportedByName",
        // D-11: reporter display name is NOT sortable.
        header: "Reporter",
      },
      {
        id: "actions",
        // D-11: actions is NOT sortable.
        header: "",
        cell: ({ row }) =>
          row.original.status === "open" ? (
            <ResolveMissingSheet
              missingId={row.original.id}
              itemName={row.original.itemName}
            />
          ) : null,
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
  const isEmpty = records.length === 0;

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
          placeholder="Search missing items…"
          value={url.q}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(v) =>
            // "open" is the default — drop it from the URL when selected.
            setFilter("status", v === "open" ? null : v)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "writtenOff"
                  ? "Written off"
                  : s.charAt(0).toUpperCase() + s.slice(1)}
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
                    icon={CheckCircle2}
                    heading="Nothing missing"
                    body="All checked-out items are accounted for."
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
          {filtered.length === 1 ? "record" : "records"}
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
