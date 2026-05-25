// Phase 2 — EventsTable client island (Block D UI swap, plan 02-07).
//
// REQUIREMENTS:
//   - EVT-03 — sortable by startDate; default status filter = "active"
//   - EVT-08 — staff sees only events where uid ∈ allowedStaff. Enforced at
//             3 layers:
//               (a) firestore.rules `isMember(resource)` — db gate
//               (b) lib/data/events.server.ts getEventsPage SSR seed
//               (c) lib/hooks/use-events-live.ts onSnapshot filter
//   - REP-06 — every filter / sort / cursor state lives in the URL
//   - REP-07 — cursor window = 50 rows
//
// Phase 2 swap from Phase 1:
//   - mock-store hook → SSR-seeded `initialEvents` + `useEventsLive(initial,
//     {session, status})` for live updates (D-20 listener scope).
//   - URL contract `?page=N` → `?cursor=xxx` per D-17. TanStack table runs
//     with `manualPagination: true`. "Page N of M" UI replaced with prev/next.
//   - Filter changes clear the cursor automatically via useUrlTableState.
//
// D-11 sortable-columns rule (from Phase 1): sortable columns are `name`,
// `startDate`, `endDate`, `status`. `location` renders a plain string header
// — NO toggleSorting button, NO ArrowUpDown icon. The non-sortable column
// carries a `// D-11: <col> is NOT sortable` audit comment so the rule is
// greppable.

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
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useEventsLive } from "@/lib/hooks/use-events-live";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
import type { EventDoc, EventStatus } from "@/lib/types/event";
import type { Session } from "@/lib/types/session";
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

const STATUSES: EventStatus[] = ["planned", "active", "completed", "cancelled"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventsTable({
  initialEvents,
  nextCursor,
  session,
}: {
  initialEvents: EventDoc[];
  nextCursor: string | null;
  session: Session;
}) {
  const router = useRouter();
  const { state: url, setGlobalFilter, setFilter, setCursor } = useUrlTableState(
    ["status"],
  );

  // EVT-03 default = "active" — match the SSR seed so the listener doesn't
  // briefly disagree with the server-rendered first paint.
  const statusFilter = url.filters.status ?? "active";
  const liveStatus = statusFilter === "_all" ? undefined : statusFilter;

  // D-20: page-scoped live data, 50-row window. EVT-08 baked in via session.
  const eventsLive = useEventsLive(initialEvents, {
    session,
    status: liveStatus,
  });
  // Memoize so TanStack sees a stable reference.
  const events = useMemo(() => [...eventsLive], [eventsLive]);

  // Client-side global-filter pass (name + location) within the 50-row
  // cursor window. The server query already applied status; q is local.
  const filtered = useMemo(() => {
    if (!url.q) return events;
    const q = url.q.toLowerCase();
    return events.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q),
    );
  }, [events, url.q]);

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

  const sorting: SortingState = useMemo(() => {
    if (!url.sort) return [];
    const [id, dir] = url.sort.split(":");
    return id ? [{ id, desc: dir === "desc" }] : [];
  }, [url.sort]);

  // D-17: manualPagination — the 50-row window is server-driven via the
  // cursor URL contract. pageCount: -1 because Firestore can't return a
  // total. TanStack won't try to paginate the slice further; we drive
  // Next/Prev via the SSR-seeded nextCursor + router.back().
  const table = useReactTable({
    data: filtered,
    columns,
    manualPagination: true,
    pageCount: -1,
    state: {
      sorting,
      pagination: { pageIndex: 0, pageSize: 50 },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = events.length === 0;

  function goPrev() {
    // Cursors are forward-only; rely on browser back to pop the cursor stack.
    router.back();
  }
  function goNext() {
    if (nextCursor) setCursor(nextCursor);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search events…"
          value={url.q}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            // EVT-03 default = active. The "_all" sentinel clears the filter
            // explicitly without colliding with the no-value (default) path.
            setFilter("status", v === "active" ? null : v)
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
                    icon={Calendar}
                    heading="No events scheduled"
                    body="Create an event to begin checking items out."
                    action={
                      <Button asChild>
                        <Link href="/events/new">Create event</Link>
                      </Button>
                    }
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
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* D-17 pagination chrome: prev/next-only, no total count. */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          Showing {filtered.length} {filtered.length === 1 ? "event" : "events"}
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
