"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

/**
 * DataTableToolbar — the top strip of every list-page table.
 *
 * Renders the global filter input (debounced 250ms per D-12) and exposes a
 * `children` slot for column-specific filters (category picker, status
 * select, etc.) injected by the consumer.
 *
 * Implementation note (React 19): the toolbar mirrors the parent's
 * `globalFilter` into local state so typing is instantaneous and the URL is
 * only updated on the debounced value. Because synchronous `setState` calls
 * inside `useEffect` trigger the React 19 `set-state-in-effect` cascading-
 * render warning, the re-sync of `local` from `globalFilter` is handled
 * during render via a "previous value" sentinel (React canonical pattern,
 * https://react.dev/reference/react/useState#storing-information-from-previous-renders).
 * Only the outward push (`onGlobalFilterChange`) lives in an effect — that's
 * "updating external systems with the latest state from React", which is
 * exactly the case the rule explicitly allows.
 */
export function DataTableToolbar({
  globalFilter,
  onGlobalFilterChange,
  placeholder = "Search…",
  children,
}: {
  globalFilter: string;
  onGlobalFilterChange: (v: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  const [local, setLocal] = useState(globalFilter);
  // Track the last globalFilter we synced into `local`. When the parent's
  // value changes externally (URL nav, clear filters), reset `local` during
  // render — this is the React 19 canonical "store previous value" pattern
  // and avoids the `set-state-in-effect` lint rule.
  const [lastSyncedGlobal, setLastSyncedGlobal] = useState(globalFilter);
  if (globalFilter !== lastSyncedGlobal) {
    setLastSyncedGlobal(globalFilter);
    setLocal(globalFilter);
  }

  const debounced = useDebouncedValue(local, 250); // D-12

  // Push the debounced value upward when it differs from the parent's current
  // value. This is "updating an external system from React state" which the
  // `set-state-in-effect` rule explicitly allows (the prop callback is not a
  // React setState — it's a write to the parent's state).
  useEffect(() => {
    if (debounced !== globalFilter) onGlobalFilterChange(debounced);
  }, [debounced, globalFilter, onGlobalFilterChange]);

  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="max-w-xs"
      />
      {children}
    </div>
  );
}
