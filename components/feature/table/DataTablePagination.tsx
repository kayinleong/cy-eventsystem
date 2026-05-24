"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";

/**
 * DataTablePagination — the always-on pagination chrome per D-10.
 *
 * "Page N of M · K rows" copy on the left, Prev / Next buttons on the right.
 * REP-07 default page size (50 rows) is applied at the DataTable level; this
 * component is page-size-agnostic.
 *
 * `onPageChange` receives a 1-based page number (matching the URL grammar);
 * the DataTable wrapper bridges TanStack's 0-based pageIndex to/from the URL.
 */
export function DataTablePagination<T>({
  table,
  onPageChange,
}: {
  table: Table<T>;
  onPageChange: (page1Based: number) => void;
}) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount() || 1;
  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t mt-4">
      <p className="text-sm text-muted-foreground">
        Page {pageIndex + 1} of {pageCount} · {totalRows} rows
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pageIndex)}
          disabled={pageIndex === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pageIndex + 2)}
          disabled={pageIndex + 1 >= pageCount}
          aria-label="Next page"
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
