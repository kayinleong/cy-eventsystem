"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

/**
 * UrlTableState — the URL-synced slice of every list-page table.
 *
 * Locked contracts (Phase 2 / D-09 / D-12 / D-17 / RESEARCH P9):
 *  - D-09: pagination/filter/sort changes update the URL via `router.replace`
 *          with `scroll: false` so the browser back stack is sane and the
 *          viewport doesn't jump to top on every keystroke.
 *  - D-12: the global filter is debounced 250ms before reaching this hook.
 *  - D-17 (Phase 2): pagination URL contract migrated from `?page=N` to
 *          `?cursor=xxx` (opaque base64-encoded JSON blob produced by
 *          `lib/data/inventory.server.ts`). Total-count UI ("Page N of M")
 *          retired; prev/next-only.
 *  - RESEARCH P9: filter / sort / global-filter changes MUST clear the cursor
 *          atomically — a stale cursor points at filtered-out rows.
 *  - REP-06: filter/sort/search/cursor URL params are shareable (the cursor
 *          IS the URL state).
 *
 * URL grammar (Phase 2):
 *   ?cursor=eyJ...&q=mic&sort=name:asc&category=Audio&lifecycleState=available
 *
 * Phase 2 swap: page-number setter is GONE — consumers that paginated by
 * page-number now drive cursor navigation via the SSR-seeded `nextCursor`
 * prop. Tables that have not yet migrated to cursor URLs (EventsTable et al.)
 * fall through the generic DataTable wrapper which manages its own internal
 * `PaginationState` until those tables migrate in later plans.
 */
export type UrlTableState = {
  /** Opaque base64 cursor blob; null = first page. */
  cursor: string | null;
  /** Global filter text. */
  q: string;
  /** Sort spec: empty string or `"<columnId>:asc" | "<columnId>:desc"`. */
  sort: string;
  /** Custom filter keys (e.g. category, lifecycleState) the consumer opts in to. */
  filters: Record<string, string>;
};

export function useUrlTableState(filterKeys: string[] = []): {
  state: UrlTableState;
  pending: boolean;
  setCursor: (cursor: string | null) => void;
  setGlobalFilter: (q: string) => void;
  setSort: (sort: string) => void;
  setFilter: (key: string, value: string | undefined | null) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

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
      cursor: searchParams.get("cursor"),
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
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  // D-17 — opaque cursor blob; null clears.
  const setCursor = useCallback(
    (cursor: string | null) =>
      push((n) => {
        if (cursor === null || cursor === "") n.delete("cursor");
        else n.set("cursor", cursor);
      }),
    [push],
  );

  const setGlobalFilter = useCallback(
    (q: string) =>
      push((n) => {
        // RESEARCH P9: clear cursor on filter change — a stale cursor points
        // at rows that the new filter excludes.
        n.delete("cursor");
        if (!q) n.delete("q");
        else n.set("q", q);
      }),
    [push],
  );

  const setSort = useCallback(
    (sort: string) =>
      push((n) => {
        n.delete("cursor"); // RESEARCH P9
        if (!sort) n.delete("sort");
        else n.set("sort", sort);
      }),
    [push],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined | null) =>
      push((n) => {
        n.delete("cursor"); // RESEARCH P9
        if (!value) n.delete(key);
        else n.set(key, value);
      }),
    [push],
  );

  return { state, pending, setCursor, setGlobalFilter, setSort, setFilter };
}
