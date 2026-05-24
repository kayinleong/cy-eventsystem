"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * UrlTableState — the URL-synced slice of every list-page table.
 *
 * Locked contracts (D-09 / D-10 / D-11 / D-12):
 *  - D-09: pagination/filter/sort changes update the URL via `router.replace`
 *          with `scroll: false` so the browser back stack is sane and the
 *          viewport doesn't jump to top on every keystroke.
 *  - D-10: pagination chrome ("Page N of M · K rows") always renders.
 *  - D-11: only whitelisted columns expose a sort affordance (the consumer
 *          enforces this in its `ColumnDef[]`; the hook is column-agnostic).
 *  - D-12: the global filter is debounced 250ms before reaching this hook.
 *
 * URL grammar:
 *   ?page=2&q=mic&sort=name:asc&category=Audio&status=available
 * `page` is 1-based for humans / URL clarity; the DataTable wrapper subtracts
 * 1 before handing to TanStack (which is 0-based).
 *
 * Phase 2 swap: the URL contract stays verbatim. Only the data source layer
 * below the hook changes (selectors → Firestore query helpers).
 */
export type UrlTableState = {
  /** 1-based for URL; the DataTable converts to 0-based for TanStack. */
  page: number;
  /** Global filter text. */
  q: string;
  /** Sort spec: empty string or `"<columnId>:asc" | "<columnId>:desc"`. */
  sort: string;
  /** Custom filter keys (e.g. category, status) the consumer opts in to. */
  filters: Record<string, string>;
};

export function useUrlTableState(filterKeys: string[] = []): {
  state: UrlTableState;
  setPage: (p: number) => void;
  setGlobalFilter: (q: string) => void;
  setSort: (sort: string) => void;
  setFilter: (key: string, value: string | undefined) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Serialize filterKeys so the useMemo deps are stable across renders even
  // when the consumer passes a literal array.
  const filterKeysSerialized = useMemo(
    () => filterKeys.join("|"),
    [filterKeys],
  );

  const state = useMemo<UrlTableState>(() => {
    const filters: Record<string, string> = {};
    for (const key of filterKeysSerialized.split("|").filter(Boolean)) {
      const v = searchParams.get(key);
      if (v) filters[key] = v;
    }
    return {
      page: Math.max(1, Number(searchParams.get("page") ?? "1")),
      q: searchParams.get("q") ?? "",
      sort: searchParams.get("sort") ?? "",
      filters,
    };
  }, [searchParams, filterKeysSerialized]);

  const push = useCallback(
    (updater: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(Array.from(searchParams.entries()));
      updater(next);
      // D-09: replace (not push) so the URL doesn't pollute browser history
      // on every keystroke or page click. scroll:false keeps the viewport stable.
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setPage = useCallback(
    (p: number) =>
      push((n) => {
        if (p <= 1) n.delete("page");
        else n.set("page", String(p));
      }),
    [push],
  );

  const setGlobalFilter = useCallback(
    (q: string) =>
      push((n) => {
        if (!q) n.delete("q");
        else n.set("q", q);
        // Reset to page 1 when the global filter changes.
        n.delete("page");
      }),
    [push],
  );

  const setSort = useCallback(
    (sort: string) =>
      push((n) => {
        if (!sort) n.delete("sort");
        else n.set("sort", sort);
      }),
    [push],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined) =>
      push((n) => {
        if (!value) n.delete(key);
        else n.set(key, value);
        // Reset to page 1 when a column filter changes.
        n.delete("page");
      }),
    [push],
  );

  return { state, setPage, setGlobalFilter, setSort, setFilter };
}
