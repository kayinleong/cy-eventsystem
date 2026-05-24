// Phase 1 — /reports/missing client table.
//
// REQUIREMENTS:
//   - MIS-02 / REP-03 — list open missing-item records with admin "Resolve"
//     action; resolution dispatches store.resolveMissing.
//   - REP-06 — every filter / sort / page state is URL-synced via
//     useUrlTableState (3 keys: status, reason, eventId).
//   - REP-07 — 50 rows per page (DataTable default).
//
// Default status filter is `open` (the actionable view); user can switch to
// `_all` or another status. The toolbar's status select treats the missing
// `_all` value as a literal filter override; the URL stores no `status` param
// when the user selects "Open" (the default) — matches EventsTable's pattern.
//
// D-11 sortable-columns rule (Plan 03 Task 2): sortable columns in this table
// are `reportedAt` (date axis). Non-sortable columns (`itemName`, `qty`,
// `eventName`, `reason`, `status`, `reportedByName`, `actions`) render plain
// string headers — NO toggleSorting button, NO ArrowUpDown icon. Each
// non-sortable column carries a `// D-11: <col> is NOT sortable` audit comment.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { useMockStore } from "@/lib/hooks/use-mock-store";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import type {
  MissingItemDoc,
  MissingReason,
  MissingStatus,
} from "@/lib/types/missing-item";
import { DataTable } from "@/components/feature/table/DataTable";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ResolveMissingSheet } from "@/components/feature/missing/ResolveMissingSheet";

const REASONS: MissingReason[] = [
  "Lost",
  "Damaged",
  "Not returned",
  "Unknown",
];
const STATUSES: MissingStatus[] = ["open", "found", "writtenOff"];

export function MissingItemsTable() {
  const records = useMockStore((s) => s.missingItems);
  const events = useMockStore((s) => s.events);
  const { state: url, setFilter } = useUrlTableState([
    "status",
    "reason",
    "eventId",
  ]);

  const filtered = useMemo(() => {
    // Default status=open per REP-03 (the actionable view).
    const statusFilter = url.filters.status ?? "open";
    return records.filter((m) => {
      if (statusFilter !== "_all" && m.status !== statusFilter) return false;
      if (url.filters.reason && m.reason !== url.filters.reason) return false;
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
  }, [records, url.filters, url.q]);

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
        cell: ({ row }) => new Date(row.original.reportedAt).toLocaleDateString(),
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

  return (
    <DataTable<MissingItemDoc>
      columns={columns}
      data={filtered}
      filterKeys={["status", "reason", "eventId"]}
      globalFilterPlaceholder="Search missing items…"
      toolbarExtras={
        <>
          <Select
            value={url.filters.status ?? "open"}
            onValueChange={(v) =>
              setFilter("status", v === "open" ? undefined : v)
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "writtenOff"
                    ? "Written off"
                    : s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={url.filters.reason ?? "_all"}
            onValueChange={(v) =>
              setFilter("reason", v === "_all" ? undefined : v)
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All reasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All reasons</SelectItem>
              {REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={url.filters.eventId ?? "_all"}
            onValueChange={(v) =>
              setFilter("eventId", v === "_all" ? undefined : v)
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      emptyState={
        <EmptyState
          icon={CheckCircle2}
          heading="Nothing missing"
          body="All checked-out items are accounted for."
        />
      }
    />
  );
}
