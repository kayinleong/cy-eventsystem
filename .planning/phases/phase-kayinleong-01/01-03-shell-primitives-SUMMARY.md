---
phase: phase-kayinleong-01
plan: 03
subsystem: ui-primitives
tags: [shell, theme-provider, status-badge, qty-stepper, data-table, url-state-sync, react-19, tanstack-v8, accessibility]

# Dependency graph
requires:
  - phase: phase-kayinleong-01 plan 01
    provides: shadcn UI components (button, input, table, dropdown-menu, sonner, etc.) + StatusTone-friendly cn util
provides:
  - Wired root layout (app/layout.tsx) with ThemeProvider (next-themes) + Sonner Toaster + Geist fonts + min-h-svh body
  - Theme provider client wrapper (components/ui/theme-provider.tsx) so root layout stays a Server Component
  - Theme toggle dropdown (components/ui/theme-toggle.tsx) with Sun/Moon/Monitor lucide icons
  - EmptyState + PageHeader UI-SPEC primitives (components/ui/empty-state.tsx, page-header.tsx)
  - StatusBadge cva component + statusToTone + statusToLabel central mapping (components/feature/status/)
  - QtyStepper meeting 44px WCAG 2.5.5 AAA touch-target floor (components/feature/inventory/QtyStepper.tsx)
  - URL-state hooks (lib/hooks/use-debounced-value.ts, use-url-table-state.ts) — D-09/D-10/D-11/D-12 contracts
  - DataTable system (components/feature/table/) — generic TanStack v8 wrapper consuming useUrlTableState with REP-07 default 50 rows/page
affects:
  - phase-kayinleong-01 plan 04 (auth-shell + role-gate): app/(app)/layout.tsx will compose against the root layout's ThemeProvider — no provider duplication
  - phase-kayinleong-01 plan 05 (app shell — sidebar/topbar): TopBar imports ThemeToggle; UserMenu imports useCurrentUser
  - phase-kayinleong-01 plan 06 (inventory list + detail): inventory page composes DataTable with name/SKU/availableQty/lifecycleState sortable columns per D-11
  - phase-kayinleong-01 plan 07 (events list + detail): events page composes DataTable with name/startDate/endDate/status sortable columns per D-11
  - phase-kayinleong-01 plan 08 (item form + create/edit): item create/edit forms compose QtyStepper for qty fields
  - phase-kayinleong-01 plan 09 (check-out flow): scan-cart UI composes QtyStepper for line-item qty
  - phase-kayinleong-01 plan 10 (check-in flow): check-in lines compose QtyStepper for returned/damaged/missing qty
  - phase-kayinleong-01 plan 11 (reports): every report page composes DataTable with whitelist-only sort affordances per D-11
  - phase-kayinleong-01 plan 12 (users + settings): users list composes DataTable; user-management actions compose StatusBadge for active/disabled
  - phase-kayinleong-02 entirely (Phase 2): every Wave 3 plan's UI surface stays unchanged — only the data source below the DataTable swaps from mock store to Firestore

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-wrapper-around-server-context pattern: components/ui/theme-provider.tsx is the canonical 'use client' wrapper that lets app/layout.tsx remain a Server Component while still mounting next-themes"
    - "suppressHydrationWarning on <html>: required by next-themes per its README — server renders without class, client hydrates with light/dark"
    - "cva variant pattern for StatusBadge: dot color carried in the data-dot child via [&_[data-dot]]:bg-* selectors so the badge container can compose multiple tones cleanly"
    - "44px touch-target via size-11: locked at the QtyStepper level per UI-SPEC density exception (WCAG 2.5.5 AAA); plans 09/10 inherit this floor automatically"
    - "URL grammar: ?page=2&q=mic&sort=name:asc&category=Audio — 1-based for URLs, 0-based for TanStack. router.replace + scroll:false keeps history clean per D-09"
    - "React 19 'previous value' pattern in DataTableToolbar: re-syncing local input state from prop changes happens during render via a sentinel useState, NOT inside useEffect — avoids the set-state-in-effect cascading render rule (same anti-pattern that Plan 02's useCurrentUser hit)"
    - "D-11 selective-sort whitelist enforced at the consumer's ColumnDef level: DataTable wrapper is column-agnostic; the rule lives in the column definitions of Plans 06/07/10/11"

key-files:
  created:
    - components/ui/theme-provider.tsx
    - components/ui/theme-toggle.tsx
    - components/ui/empty-state.tsx
    - components/ui/page-header.tsx
    - components/feature/status/StatusBadge.tsx
    - components/feature/status/status-to-tone.ts
    - components/feature/inventory/QtyStepper.tsx
    - lib/hooks/use-debounced-value.ts
    - lib/hooks/use-url-table-state.ts
    - components/feature/table/DataTable.tsx
    - components/feature/table/DataTableToolbar.tsx
    - components/feature/table/DataTablePagination.tsx
    - components/feature/table/DataTableViewOptions.tsx
  modified:
    - app/layout.tsx

key-decisions:
  - "Use the 'previous value' render-time sync pattern in DataTableToolbar instead of useEffect+setState. React 19's react-hooks/set-state-in-effect rule flags synchronous setState inside useEffect as a cascading-render anti-pattern (same flag Plan 02 hit on useCurrentUser). The canonical fix is to compare the prop to a stored 'last synced' sentinel during render and reset local state inline — no effect needed for the prop→state sync path."
  - "filterKeys array gets serialized to a string before useMemo deps so a literal array passed at the call site doesn't trigger re-renders on every parent render. Avoids a subtle bug where the consumer passes filterKeys={['category','status']} inline and the hook's useMemo would never memo."
  - "Pagination chrome always renders (D-10) — even when data is empty or filtered to zero rows. The empty-state slot is rendered inside the table body (colSpan) so the pagination + toolbar stay in their canonical positions."
  - "DomainStatus enum includes the missing-status value 'open' mapped to destructive tone. UI-SPEC marks 'missing' as destructive; the corresponding MissingItemDoc.status='open' is by definition the destructive case at the row level. Once resolved (found / writtenOff) the row collapses to muted."
  - "Column visibility state lives in component state (NOT the URL). Toggling columns is an ephemeral user preference; URL-syncing it would pollute the back stack with every checkbox toggle."

requirements-completed: [NFR-01, NFR-05, REP-06, REP-07, CO-07, SCN-02]

# Metrics
duration: 7 min
completed: 2026-05-24
---

# Phase 1 Plan 03: Shell Primitives Summary

**Root layout wired with `next-themes` ThemeProvider + Sonner Toaster + Geist fonts + min-h-svh body, plus 13 reusable UI primitives — theme toggle, EmptyState, PageHeader, cva-based StatusBadge with 5 UI-SPEC tones, statusToTone central mapping, 44px-touch-target QtyStepper, URL-synced TanStack v8 DataTable with debounced toolbar, view options, and always-on pagination chrome — the visual + behavior contracts every Wave 3 plan composes against.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-24T14:23:52Z
- **Completed:** 2026-05-24T14:30:29Z
- **Tasks:** 2
- **Files modified:** 14 (13 created + 1 modified)

## Accomplishments

- Wired the **root layout** (`app/layout.tsx`) with the canonical next-themes pattern: client-component `ThemeProvider` wrapper, `suppressHydrationWarning` on `<html>`, `min-h-svh bg-background text-foreground` body, Geist Sans + Geist Mono font variables, and the Sonner Toaster mounted inside the provider so it inherits theme.
- Updated **metadata** to use the title template `"%s · cy-eventsystem"` so every route gets a consistent suffix without each page repeating the project name.
- Built the **theme system** as two files: `theme-provider.tsx` (re-export wrapper that lets the root layout stay a Server Component) + `theme-toggle.tsx` (Sun/Moon/Monitor dropdown in the user-menu region, locked to the UI-SPEC icon mapping).
- Built `EmptyState` and `PageHeader` UI-SPEC primitives — `py-16` centered vertical stack with `size-6` muted icon, 18px heading, 14px muted body, optional action slot for the empty state; `text-lg font-semibold` title with optional description + action slot and `border-b` separator for the page header. Both match the UI-SPEC contract verbatim.
- Built `StatusBadge` as a cva component with 5 tones (`green` / `blue` / `amber` / `muted` / `destructive`) using `[&_[data-dot]]` variant selectors so the dot color travels with the tone via a single class lookup. Tones match the UI-SPEC Status Palette (Q4) table exactly.
- Built `statusToTone(status)` + `statusToLabel(status)` central mapping in `components/feature/status/status-to-tone.ts` so the conversion logic is testable and reusable. Phase 2 retains this contract verbatim — only the data source changes.
- Built `QtyStepper` with `size-11` (44px) minus / plus buttons meeting the UI-SPEC density exception for WCAG 2.5.5 AAA. Clamps + floors every input internally so consumers never see a non-integer or out-of-range value.
- Built `useDebouncedValue<T>(value, delay=250)` as a generic hook colocated with its primary consumer (DataTableToolbar) — D-12 contract.
- Built `useUrlTableState(filterKeys?)` for D-09/D-10/D-11/D-12 URL-state sync — 1-based pages in the URL, `router.replace` with `scroll:false`, `q`/`sort`/`filters` round-trip through `URLSearchParams`. Page resets to 1 on filter changes.
- Built the **DataTable system** as four files: the generic wrapper consumes URL state + builds a TanStack table with sorting/filtering/pagination/columnVisibility row models; the toolbar mounts the debounced global filter + a children slot for custom column filters; the pagination chrome renders "Page N of M · K rows" + Prev/Next per D-10; the view options dropdown lists every hideable column with a checkbox.
- Verified across the board: `npx tsc --noEmit` exits 0, `npm run build` (Next 16 Turbopack) exits 0, `npm run lint` exits 0 (1 informational warning about TanStack Table being React Compiler-incompatible — known, no action required).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire root layout + create theme provider + theme toggle + EmptyState + PageHeader** — `0ed298d` (feat)
2. **Task 2: Create StatusBadge + statusToTone + QtyStepper + DataTable wrappers** — `491ec34` (feat)

## Files Created/Modified

### Created — UI shell primitives (4 files)
- `components/ui/theme-provider.tsx` — `'use client'` wrapper around `next-themes` `ThemeProvider` so the root layout stays a Server Component
- `components/ui/theme-toggle.tsx` — Sun/Moon/Monitor dropdown using `useTheme` from next-themes
- `components/ui/empty-state.tsx` — centered `py-16` vertical stack with `size-6` muted icon + 18px heading + 14px muted body + optional action
- `components/ui/page-header.tsx` — `text-lg font-semibold` title + optional description + action slot with `border-b` separator

### Created — feature primitives (3 files)
- `components/feature/status/StatusBadge.tsx` — cva component with 5 tones (green/blue/amber/muted/destructive); `data-dot` child element carries the dot color
- `components/feature/status/status-to-tone.ts` — `DomainStatus` union + `statusToTone(status)` + `statusToLabel(status)` central mapping for every domain status string in the system
- `components/feature/inventory/QtyStepper.tsx` — `size-11` (44px) +/- stepper with min/max bounds, integer clamping, and accessible labels

### Created — URL-state hooks (2 files)
- `lib/hooks/use-debounced-value.ts` — generic `useDebouncedValue<T>(value, delay=250)` — D-12
- `lib/hooks/use-url-table-state.ts` — `useUrlTableState(filterKeys?)` exposing `state` + `setPage` / `setGlobalFilter` / `setSort` / `setFilter` per D-09/D-10/D-11/D-12

### Created — DataTable system (4 files)
- `components/feature/table/DataTable.tsx` — generic TanStack v8 wrapper consuming `useUrlTableState`; default `pageSize = 50` (REP-07); always-on pagination chrome (D-10); two-tier empty-state precedence (no-data vs no-results-after-filter)
- `components/feature/table/DataTableToolbar.tsx` — debounced global filter (250ms per D-12) with render-time previous-value sync pattern (React 19 canonical); `children` slot for column-specific filters
- `components/feature/table/DataTablePagination.tsx` — "Page N of M · K rows" copy + Prev/Next buttons with ChevronLeft/Right icons
- `components/feature/table/DataTableViewOptions.tsx` — shadcn DropdownMenuCheckboxItem list of hideable columns

### Modified (1 file)
- `app/layout.tsx` — replaced default body content with the `ThemeProvider` + `Toaster` wrapper; added `suppressHydrationWarning` on `<html>`; switched body to `min-h-svh bg-background text-foreground`; updated metadata with title template

## Decisions Made

- **D-03-A: Use the React 19 "previous value" render-time sync pattern in DataTableToolbar instead of `useEffect` + `setState`.** React 19's `react-hooks/set-state-in-effect` ESLint rule flags synchronous `setState` inside `useEffect` as a cascading-render anti-pattern. The original plan example used `useEffect(() => setLocal(globalFilter), [globalFilter])` to re-sync local input state when the URL value changes — same anti-pattern that Plan 02's `useCurrentUser` hit. The canonical React 19 fix is to compare the prop to a stored "last synced" sentinel during render and reset local state inline. No effect needed for the prop→state sync path. The outward push (`onGlobalFilterChange(debounced)`) stays in an effect because that's "updating an external system from React state" which the rule explicitly allows.

- **D-03-B: Serialize `filterKeys` for the `useMemo` dependency array in `useUrlTableState`.** If the consumer passes `filterKeys={['category', 'status']}` inline, the array identity changes every render and `useMemo` would never memo. Serializing to a `|`-joined string and depending on the string keeps the dependency stable across renders. Filter keys are static per call site by contract — Plans 06/07/10/11 each pass a fixed list.

- **D-03-C: Pagination chrome always renders (D-10), even on empty data or filtered-to-zero rows.** The empty state is rendered inside the table body via `<TableCell colSpan={columns.length}>`, so the toolbar above and pagination chrome below stay in their canonical positions. This keeps the visual rhythm consistent across populated, filtered-empty, and source-empty states.

- **D-03-D: `DomainStatus` includes the missing-status value `'open'` → destructive tone.** UI-SPEC marks `missing` as destructive; a `MissingItemDoc.status='open'` row is by definition the destructive case at the row level. Once resolved (`found` / `writtenOff`) the row collapses to muted tone. This means the status-to-tone mapping covers the lifecycle from "open missing" (destructive) → "resolved" (muted) without a separate code path.

- **D-03-E: Column visibility state lives in component state, not the URL.** Toggling columns is an ephemeral user preference; URL-syncing it would pollute the back stack with every checkbox toggle and make the URL unnecessarily verbose. Pagination / sort / filters DO sync (they're the canonical "shareable view" axes per REP-06); column visibility is intentionally not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React 19 `react-hooks/set-state-in-effect` lint rule failed on DataTableToolbar.tsx**
- **Found during:** Task 2 (running `npm run lint` after creating the toolbar)
- **Issue:** Plan's example code used `useEffect(() => setLocal(globalFilter), [globalFilter])` to re-sync the toolbar's local input state when the parent's `globalFilter` prop changed (URL nav, clear filters, etc.). React 19's `react-hooks/set-state-in-effect` ESLint rule flags this as a cascading-render anti-pattern — the same flag that Plan 02 hit on `useCurrentUser`. Lint exit code went non-zero; plan-level verification blocked.
- **Fix:** Replaced the effect with the React 19 canonical "previous value" pattern: store `lastSyncedGlobal` in `useState`, and inside the render body (not an effect) compare `globalFilter !== lastSyncedGlobal` — if they differ, call `setLastSyncedGlobal(globalFilter)` + `setLocal(globalFilter)` directly in render. React's reconciler treats this as a render-time update (it bails the current render and re-renders with the new state immediately) without triggering the set-state-in-effect rule. The outward push effect (`onGlobalFilterChange(debounced)`) is kept because writing to a parent's prop callback is "updating an external system" which the rule explicitly allows.
- **Files modified:** components/feature/table/DataTableToolbar.tsx
- **Verification:** `npm run lint` exits 0 (only an informational warning remains about TanStack Table being React Compiler-incompatible — known, not actionable); `npx tsc --noEmit` exits 0; `npm run build` exits 0
- **Committed in:** `491ec34` (Task 2 commit)

**2. [Rule 2 - Missing Critical] `useUrlTableState` `useMemo` deps used the raw `filterKeys` array reference**
- **Found during:** Task 2 (reviewing the plan's example code before writing)
- **Issue:** Plan example used `useMemo(..., [searchParams, filterKeys])`. If a consumer passes `filterKeys={['category', 'status']}` as an inline literal, the array identity changes every render and the `useMemo` cache never hits — the state object is rebuilt on every render, breaking React's reference-equality optimizations downstream (e.g., `useEffect`s depending on `state.filters` would fire on every render).
- **Fix:** Serialize `filterKeys` to a `|`-joined string via an outer `useMemo`, then depend on the serialized string in the state `useMemo`. Strings are interned, so identical content always reaches the same dependency identity. Filter keys are static per call site by contract (Plans 06/07/10/11 each pass a fixed list), so the serialization cost is one-time per consumer.
- **Files modified:** lib/hooks/use-url-table-state.ts
- **Verification:** `npx tsc --noEmit` exits 0; the useMemo deps are now stable across re-renders when an inline-literal array is passed
- **Committed in:** `491ec34` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing-critical)
**Impact on plan:** Both fixes preserve the plan's interface contracts (every `<interfaces>` export is unchanged) while making the implementation correct against React 19 + reference-stable hook deps. Deviation 1 is a direct continuation of the Plan 02 `useCurrentUser` deviation — React 19's set-state-in-effect rule applies to any synchronous setState inside any effect, not just to cookie reads. Plans 06/07/10/11 should be aware of this rule when wiring local form/table state. No scope creep.

## Authentication Gates

None — Plan 03 introduces no external service dependencies (no Firebase, no email, no scanner). Plan 03's surface is entirely client-side UI primitives + URL state.

## Issues Encountered

None during planned work. The single lint failure was resolved automatically via the React 19 canonical pattern (Deviation 1).

## User Setup Required

None — no external service configuration required. The theme system persists to localStorage via next-themes default behavior (D-05-style cookie-driven persistence is reserved for the auth session in Plan 04).

## Threat Flags

None — no new security-relevant surface introduced beyond the plan's `<threat_model>` already documented (T-03-01 URL search params, T-03-02 suppressHydrationWarning, T-03-03 status tone mapping). All three threats were dispositioned `accept` with the same mitigations the plan specified.

## Known Stubs

None — every component is functionally complete for Phase 1 + Phase 2 reuse:
- `ThemeProvider` is the canonical pattern; no Phase 2 swap needed.
- `StatusBadge` + `statusToTone` cover every status string emitted by the Phase 1 type system (and the union enum is named `DomainStatus` so Phase 2 additions can extend it without consumers changing).
- `QtyStepper` is fully functional; consumers in Plans 08/09/10 pass it the parent's qty state.
- `DataTable` is fully functional; consumers in Plans 06/07/10/11 pass `columns: ColumnDef<T>[]` and `data: T[]` (typically derived from `useMockStore(selectFoo)`).

## Next Phase Readiness

- **Wave 1 complete.** Plans 01 (stack + types + schemas), 02 (mock data + store), and 03 (shell primitives) are the parallel-safe foundation. Wave 2 (auth-shell + role-gate in Plan 04, app shell in Plan 05) can now consume:
  - `ThemeProvider` mounted at root (no provider duplication in `(app)/layout.tsx`)
  - `ThemeToggle` for the user menu
  - `EmptyState` + `PageHeader` for shell-level fallbacks
  - `StatusBadge` + `statusToTone` for any status pill in TopBar / UserMenu (e.g., disabled user)
- **Ready for Plan 04** (auth-shell + role-gate): `app/(app)/layout.tsx` will read `mock_session` via `lib/auth/mock-session.ts` (already in place from Plan 02) and compose under the root ThemeProvider — no provider wrapping required.
- **Ready for Plan 05** (app shell — sidebar/topbar): TopBar imports `ThemeToggle` + uses `useCurrentUser` for the user menu; the shell can pass `<PageHeader />` slots to each `(app)/<route>/page.tsx` child.
- **Ready for Plans 06/07/10/11** (DataTable consumers): every consumer passes `columns: ColumnDef<T>[]` honoring D-11 (sort affordance only on name/SKU, qty/availableQty, date/startDate/endDate/serverTimestamp, status/lifecycleState — every non-sortable column header is plain text, NOT a `<Button onClick={column.toggleSorting}>` with ArrowUpDown). A one-line `// D-11: <col> is NOT sortable` comment on each excluded column is the audit convention.
- **Ready for Plans 08/09/10** (QtyStepper consumers): pass `value` + `onChange` from `react-hook-form` `useFieldValue` / `useFormContext` or local cart state. The 44px floor is automatic.

---

*Phase: phase-kayinleong-01*
*Completed: 2026-05-24*

## Self-Check: PASSED

- All 13 created files exist on disk: components/ui/{theme-provider,theme-toggle,empty-state,page-header}.tsx + components/feature/status/{StatusBadge.tsx,status-to-tone.ts} + components/feature/inventory/QtyStepper.tsx + lib/hooks/{use-debounced-value,use-url-table-state}.ts + components/feature/table/{DataTable,DataTableToolbar,DataTablePagination,DataTableViewOptions}.tsx
- 1 modified file: app/layout.tsx (verified via `git diff`)
- Both task commits found in git log: `0ed298d` (Task 1) + `491ec34` (Task 2)
- Plan-level verification:
  - Root layout has ThemeProvider + Toaster: PASS
  - suppressHydrationWarning on `<html>`: PASS
  - body uses min-h-svh: PASS
  - All 5 StatusBadge tones present (green/blue/amber/muted/destructive): PASS
  - QtyStepper size-11 (44px touch-target): PASS
  - DataTable defaults to pageSize = 50 (REP-07): PASS
  - DataTable uses useReactTable + useUrlTableState: PASS
  - DataTableToolbar uses useDebouncedValue: PASS
  - `npx tsc --noEmit` exits 0: PASS
  - `npm run build` (Next 16 Turbopack) exits 0: PASS
  - `npm run lint` exits 0: PASS (1 informational warning about TanStack Table React Compiler incompatibility — known, not actionable)
- All Task 1 acceptance criteria pass (4 UI shell files + layout modifications + grep checks + tsc + build).
- All Task 2 acceptance criteria pass (9 feature files + StatusBadge tones + 44px touch-target + DataTable defaults + tsc + build).
- All 6 requirements (NFR-01, NFR-05, REP-06, REP-07, CO-07, SCN-02) satisfied at the primitive-contract level — feature plans in Wave 3 compose these primitives without re-implementing the contracts.
