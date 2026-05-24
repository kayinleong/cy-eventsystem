"use client";

import { useEffect, useState } from "react";

/**
 * useDebouncedValue — generic debounce hook returning the last-stable value.
 *
 * Default delay: 250ms per D-12 (table global filter debounce window). The
 * DataTableToolbar uses this to avoid pushing a URL update on every keystroke.
 *
 * Phase 1 only — Phase 2 keeps the same signature; the data layer below the
 * debounced value swaps from in-memory `selectorFilter(...)` to a Firestore
 * query, but the toolbar contract never changes.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
