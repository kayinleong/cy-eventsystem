"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUrlTableState } from "@/lib/hooks/use-url-table-state";

import { DataTablePagination } from "./DataTablePagination";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTableViewOptions } from "./DataTableViewOptions";

/**
 * DataTable — generic TanStack v8 + shadcn table wrapper with URL state.
 *
 * Used by list pages NOT yet migrated to cursor pagination per D-17. The
 * inventory list (Phase 2 02-06) drives `useReactTable` directly with
 * `manualPagination: true` + SSR-seeded `nextCursor`. Other tables that
 * still consume this wrapper (EventsTable, HistoryTable, MissingItemsTable,
 * RepurchaseTable, StockReportTable, ItemsOutTable, UsersTable) keep
 * client-side pagination via TanStack's internal `PaginationState` until
 * their respective plans migrate them.
 *
 * Locked contracts:
 *  - REP-07: default `pageSize = 50` rows per page.
 *  - REP-06: filters + sort + global filter URL-synced via `useUrlTableState`.
 *            Page index lives in component state (NOT the URL) until each
 *            consumer migrates to D-17 cursor URLs.
 *  - D-09:   URL writes use `router.replace` with `scroll: false`.
 *  - D-10:   pagination chrome ALWAYS renders (even with 0 rows).
 *  - D-11:   Sortable columns are whitelist-only — name / SKU, qty /
 *            availableQty, date / startDate / endDate / serverTimestamp,
 *            status / lifecycleState. Non-sortable columns (actor display
 *            name, notes, reason text, photoUrl, descriptions) MUST NOT
 *            render a sort affordance — header is plain string, NOT a button
 *            calling `column.toggleSorting()`. The wrapper itself is column
 *            -agnostic; the rule is enforced by the consumer's `ColumnDef[]`.
 *  - D-12:   Global filter input is debounced 250ms (DataTableToolbar).
 *
 * Empty state precedence:
 *  - `data.length === 0` (no rows at source) → render `emptyState` slot
 *  - `data.length > 0 && filtered.rows === 0` (filter excludes all) → "No results."
 *
 * Phase 2 (02-06) note: `useUrlTableState` no longer exposes `setPage` per
 * D-17. This wrapper now drives `pageIndex` internally; consumers that need
 * cursor pagination (e.g. InventoryTable) bypass this wrapper entirely and
 * call `useReactTable({ manualPagination: true })` directly.
 */
export type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  filterKeys?: string[];
  globalFilterPlaceholder?: string;
  pageSize?: number;
  emptyState?: React.ReactNode;
  enableColumnVisibility?: boolean;
  toolbarExtras?: React.ReactNode;
};

export function DataTable<T>({
  columns,
  data,
  filterKeys = [],
  globalFilterPlaceholder,
  pageSize = 50, // REP-07
  emptyState = null,
  enableColumnVisibility = true,
  toolbarExtras,
}: DataTableProps<T>) {
  const { state: url, setGlobalFilter, setSort } = useUrlTableState(filterKeys);

  // Translate the URL's `<col>:<dir>` shape into TanStack's SortingState array.
  const sorting: SortingState = useMemo(() => {
    if (!url.sort) return [];
    const [id, dir] = url.sort.split(":");
    return id ? [{ id, desc: dir === "desc" }] : [];
  }, [url.sort]);

  // Column visibility lives in component state, NOT the URL — the user's
  // column choices shouldn't pollute the URL on every toggle.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Phase 2 02-06: `?page=N` URL contract retired per D-17 (cursor only).
  // Pagination state for non-migrated tables now lives in component state;
  // consumers needing cursor URLs (InventoryTable) bypass this wrapper.
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: url.q,
      pagination,
      columnVisibility,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      setSort(first ? `${first.id}:${first.desc ? "desc" : "asc"}` : "");
    },
    onGlobalFilterChange: (q: string) => setGlobalFilter(q),
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  });

  const rows = table.getRowModel().rows;
  const isEmpty = data.length === 0;

  return (
    <div>
      <div className="flex items-center gap-2 pb-3">
        <DataTableToolbar
          globalFilter={url.q}
          onGlobalFilterChange={setGlobalFilter}
          placeholder={globalFilterPlaceholder ?? "Search…"}
        >
          {toolbarExtras}
        </DataTableToolbar>
        {enableColumnVisibility && <DataTableViewOptions table={table} />}
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
                  {emptyState}
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

      {/* D-10: pagination chrome always renders. Page index lives in TanStack
          internal state; clicking Prev/Next mutates `pagination` via setter. */}
      <DataTablePagination
        table={table}
        onPageChange={(page1Based) =>
          setPagination((p) => ({ ...p, pageIndex: page1Based - 1 }))
        }
      />
    </div>
  );
}
