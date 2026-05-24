// Phase 1 — /reports/history client table.
//
// REQUIREMENTS:
//   - REP-04 — global transaction log with filters: date range (from + to),
//     event, item, actor, action type.
//   - REP-06 — every filter / sort / page state is URL-synced via
//     useUrlTableState (6 keys: type, eventId, itemId, actorUid, from, to).
//   - REP-07 — 50 rows per page (DataTable default).
//
// D-11 sortable-columns rule (Plan 03 Task 2): sortable columns in this table
// are `at` (serverTimestamp axis). Non-sortable columns (`type`, `itemName`,
// `qty`, `eventName`, `actorName`) render plain string headers — NO
// toggleSorting button, NO ArrowUpDown icon. Each non-sortable column carries
// a `// D-11: <col> is NOT sortable` audit comment so the rule is greppable.
//
// Note on serialization: filter state is read by URL via useUrlTableState, but
// the filtering predicate runs in this component over the full transactions
// array (no need for a dedicated selector — the filter logic is
// surface-specific and lives here).

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Activity, ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { useMockStore } from "@/lib/hooks/use-mock-store";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import type {
  TransactionDoc,
  TransactionType,
} from "@/lib/types/transaction";
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

const TX_TYPES: TransactionType[] = [
  "checkout",
  "checkin",
  "adjustment",
  "missing",
];

export function HistoryTable() {
  const allTxs = useMockStore((s) => s.transactions);
  const events = useMockStore((s) => s.events);
  const users = useMockStore((s) => s.users);
  const { state: url, setFilter } = useUrlTableState([
    "type",
    "eventId",
    "itemId",
    "actorUid",
    "from",
    "to",
  ]);

  const filtered = useMemo(() => {
    return allTxs
      .filter((t) => {
        if (url.filters.type && t.type !== url.filters.type) return false;
        if (url.filters.eventId && t.eventId !== url.filters.eventId) return false;
        if (url.filters.itemId && t.itemId !== url.filters.itemId) return false;
        if (url.filters.actorUid && t.actorUid !== url.filters.actorUid)
          return false;
        if (url.filters.from && t.at < url.filters.from) return false;
        if (url.filters.to && t.at > url.filters.to) return false;
        if (url.q) {
          const q = url.q.toLowerCase();
          if (
            ![t.itemName, t.eventName ?? "", t.actorName, t.notes].some((s) =>
              s.toLowerCase().includes(q),
            )
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [allTxs, url.filters, url.q]);

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

  return (
    <DataTable<TransactionDoc>
      columns={columns}
      data={filtered}
      filterKeys={["type", "eventId", "itemId", "actorUid", "from", "to"]}
      globalFilterPlaceholder="Search history…"
      toolbarExtras={
        <>
          <Select
            value={url.filters.type ?? "_all"}
            onValueChange={(v) =>
              setFilter("type", v === "_all" ? undefined : v)
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
          <Select
            value={url.filters.eventId ?? "_all"}
            onValueChange={(v) =>
              setFilter("eventId", v === "_all" ? undefined : v)
            }
          >
            <SelectTrigger className="w-44">
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
          <Select
            value={url.filters.actorUid ?? "_all"}
            onValueChange={(v) =>
              setFilter("actorUid", v === "_all" ? undefined : v)
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All actors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All actors</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.uid} value={u.uid}>
                  {u.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      emptyState={
        <EmptyState
          icon={Activity}
          heading="No activity yet"
          body="Transactions will appear here."
        />
      }
    />
  );
}
