// Phase 1 — EventsTable client island wrapping the generic DataTable.
//
// REQUIREMENTS:
//   - EVT-03 — sortable by startDate; default status filter = "active"
//   - EVT-08 — staff sees only events where uid ∈ allowedStaff
//             (admin sees all). Enforced via selectAccessibleEvents.
//   - REP-06 — every filter / sort / page state lives in the URL
//   - REP-07 — DataTable default pageSize = 50
//
// D-11 sortable-columns rule (Plan 03 Task 2): sortable columns in this table
// are `name`, `startDate`, `endDate`, `status`. Non-sortable columns
// (`location`) render a plain string header — NO toggleSorting button, NO
// ArrowUpDown icon. Each non-sortable column carries a `// D-11: <col> is NOT
// sortable` audit comment so the rule is greppable.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Calendar, ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { useMockStore } from "@/lib/hooks/use-mock-store";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import { selectAccessibleEvents } from "@/lib/mock/selectors";
import type { EventDoc, EventStatus } from "@/lib/types/event";
import type { UserRole } from "@/lib/types/user";
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

const STATUSES: EventStatus[] = ["planned", "active", "completed", "cancelled"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Session uid + role are passed in from the Server Component shell (the page
// reads the cookie server-side via getMockSession()). Passing the slice in as
// props — rather than reading useCurrentUser() inside the table — keeps the
// SSR render in sync with the client render (no empty-then-fill flash) and
// keeps the EVT-08 access projection server-truthful.
export function EventsTable({
  uid,
  role,
}: {
  uid: string;
  role: UserRole;
}) {
  const events = useMockStore((s) =>
    selectAccessibleEvents(s, uid, role),
  );
  const { state: url, setFilter } = useUrlTableState(["status"]);

  const filtered = useMemo(() => {
    // EVT-03 — default to "active" when no status filter specified.
    const statusFilter = url.filters.status ?? "active";
    return events.filter((e) => {
      if (statusFilter !== "_all" && e.status !== statusFilter) return false;
      if (url.q) {
        const q = url.q.toLowerCase();
        if (
          !e.name.toLowerCase().includes(q) &&
          !e.location.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [events, url.filters.status, url.q]);

  const columns: ColumnDef<EventDoc>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Name <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/events/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "startDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Start <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => formatDate(row.original.startDate),
        sortingFn: (a, b) =>
          a.original.startDate.localeCompare(b.original.startDate),
      },
      {
        accessorKey: "endDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            End <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => formatDate(row.original.endDate),
        sortingFn: (a, b) =>
          a.original.endDate.localeCompare(b.original.endDate),
      },
      {
        accessorKey: "location",
        // D-11: location is NOT sortable.
        header: "Location",
        cell: ({ row }) => row.original.location || "—",
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Status <ArrowUpDown className="ml-2 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <StatusBadge tone={statusToTone(row.original.status)}>
            {statusToLabel(row.original.status)}
          </StatusBadge>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable<EventDoc>
      columns={columns}
      data={filtered}
      filterKeys={["status"]}
      globalFilterPlaceholder="Search events…"
      emptyState={
        <EmptyState
          icon={Calendar}
          heading="No events scheduled"
          body="Create an event to begin checking items out."
          action={
            <Button asChild>
              <Link href="/events/new">Create event</Link>
            </Button>
          }
        />
      }
      toolbarExtras={
        <Select
          value={url.filters.status ?? "active"}
          onValueChange={(v) =>
            setFilter("status", v === "active" ? undefined : v)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusToLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
