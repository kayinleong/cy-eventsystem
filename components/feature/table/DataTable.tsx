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
 * Used by every list page in Wave 3 (inventory, events, users, reports/*).
 * Locked contracts:
 *  - REP-07: default `pageSize = 50` rows per page.
 *  - REP-06: pagination + sort + filters are URL-synced via `useUrlTableState`.
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
  const { state: url, setPage, setGlobalFilter, setSort } =
    useUrlTableState(filterKeys);

  // Translate the URL's `<col>:<dir>` shape into TanStack's SortingState array.
  const sorting: SortingState = useMemo(() => {
    if (!url.sort) return [];
    const [id, dir] = url.sort.split(":");
    return id ? [{ id, desc: dir === "desc" }] : [];
  }, [url.sort]);

  // Column visibility lives in component state, NOT the URL — the user's
  // column choices shouldn't pollute the URL on every toggle.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: url.q,
      pagination: { pageIndex: url.page - 1, pageSize },
      columnVisibility,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      setSort(first ? `${first.id}:${first.desc ? "desc" : "asc"}` : "");
    },
    onGlobalFilterChange: (q: string) => setGlobalFilter(q),
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

      {/* D-10: pagination chrome always renders */}
      <DataTablePagination table={table} onPageChange={setPage} />
    </div>
  );
}
