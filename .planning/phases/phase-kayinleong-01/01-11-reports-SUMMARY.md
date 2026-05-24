---
phase: 01-ui-poc
plan: 11
subsystem: ui
tags: [reports, datatable, missing-items, repurchase, history, react-19, shadcn-v4, tanstack-table, url-state]

# Dependency graph
requires:
  - phase: 01-02-mock-data-store
    provides: store.resolveMissing + store.markLowStockOrdered mutators; selectItemsOut + selectLowStockItems selectors; transactions/missingItems snapshot slices
  - phase: 01-03-shell-primitives
    provides: DataTable + DataTableToolbar + DataTablePagination + DataTableViewOptions wrappers; useUrlTableState hook (REP-06/D-09/D-11/D-12); StatusBadge + statusToTone/statusToLabel
  - phase: 01-04-auth-shell-role-gate
    provides: (app) layout role gate via requireSession; useCurrentUser hook (D-01-02-A useSyncExternalStore pattern); /unauthorized route
provides:
  - /reports/stock — REP-01 live stock view with low-stock + ordered badges
  - /reports/out — REP-02 open checkouts at active events
  - /reports/history — REP-04 global tx log with 6 URL-synced filters (type/event/item/actor/from/to)
  - /reports/missing — REP-03 open missing records with admin Resolve action (MIS-02)
  - /reports/repurchase — REP-05 low-stock + frequent-loss surface with RP-04 admin Mark-as-ordered button
  - ResolveMissingSheet — admin-only shadcn Sheet calling store.resolveMissing (MIS-03/04)
affects: [phase-2-functionality, reports, missing-resolution, repurchase-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read raw snapshot slices via useMockStore + project inside useMemo — keeps useSyncExternalStore's identity check happy (D-01-11-A)"
    - "Default-filter UX pattern: status=open is the actionable view, URL has no `status` param when default selected (mirrors EventsTable's status=active default)"
    - "Cross-bucket repurchase surface: two reasons (low-stock vs frequently-missing) in one table with reason-aware actions"

key-files:
  created:
    - app/(app)/reports/stock/page.tsx
    - app/(app)/reports/out/page.tsx
    - app/(app)/reports/history/page.tsx
    - app/(app)/reports/missing/page.tsx
    - app/(app)/reports/repurchase/page.tsx
    - components/feature/reports/StockReportTable.tsx
    - components/feature/reports/ItemsOutTable.tsx
    - components/feature/reports/HistoryTable.tsx
    - components/feature/reports/MissingItemsTable.tsx
    - components/feature/reports/RepurchaseTable.tsx
    - components/feature/missing/ResolveMissingSheet.tsx
  modified: []

key-decisions:
  - "D-01-11-A: Cache mock-store selectors that derive new arrays — Read raw `s.items` and project inside useMemo rather than calling `useMockStore((s) => s.items.filter(...))` directly. The inline-filter pattern returns a new array on every snapshot read, breaking React 19's useSyncExternalStore identity check and triggering 'Maximum update depth exceeded' in dev. Fix: read raw slice (reference-stable) and filter inside useMemo with the slice as dep. Pattern matches InventoryTable; EventsTable + dashboard's RecentActivityFeed have pre-existing dev-only warnings from the same anti-pattern but ship to prod safely."
  - "D-01-11-B: Use shadcn v4 <Field> primitives for ResolveMissingSheet (NOT the legacy <Form>/<FormField> Context wrapper the plan example referenced). Continues D-01-04-B / D-01-06-A / D-01-07-A — the v4 radix-nova registry ships the form entry as empty, so importing `@/components/ui/form` would fail the build. Same shape as ItemForm + EventForm."
  - "D-01-11-C: All 5 report routes accessible by both admin AND staff — only the inline mutator buttons (Mark-as-ordered in RepurchaseTable, Resolve in ResolveMissingSheet) are admin-gated via session.role === 'admin'. REQUIREMENTS.md scopes admin-only behavior to AUTH-10's nav/buttons + RP-04's mark-ordered + MIS-03's resolve; staff need to read /reports/missing to know what's outstanding for their events."
  - "D-01-11-D: HistoryTable filters in-component (not via a dedicated selector) because the 6 filter keys are surface-specific (type/eventId/itemId/actorUid/from/to). Selector layer stays general — the per-table filtering predicate composes URL state with raw `s.transactions`."
  - "D-01-11-E: ResolveMissingSheet's resolution choice uses RadioGroup wrapped in Controller (NOT rhf register) because Radix RadioGroup exposes an imperative onValueChange. Same Controller bridge Plan 06 D-01-06-B established for shadcn Select."
  - "D-01-11-F: MissingItemsTable's status filter defaults to 'open' (the actionable view); when user selects 'Open' from the dropdown, the URL drops the status param entirely — matches EventsTable's status=active default. '_all' is a literal Radix value that maps back to the unfiltered case."

patterns-established:
  - "Cache-derive-from-raw-slice: when a table needs a filtered subset of a store slice, subscribe to the raw slice via useMockStore and filter in useMemo rather than filtering inside the selector argument. Avoids the useSyncExternalStore identity-stability lint warning."
  - "Disabled Export CSV button on every report page: out-of-scope for Phase 1 per UI-SPEC, but the slot is rendered so the visual layout is correct."

requirements-completed:
  - REP-01
  - REP-02
  - REP-03
  - REP-04
  - REP-05
  - REP-06
  - REP-07
  - MIS-02
  - MIS-03
  - MIS-04
  - RP-01
  - RP-02
  - RP-04
  - NFR-05

# Metrics
duration: 11 min
completed: 2026-05-25
---

# Phase 1 Plan 11: Reports Summary

**All 5 read-mostly report routes (`/reports/{stock,out,history,missing,repurchase}`) plus the admin-only ResolveMissingSheet that calls store.resolveMissing — built as pure composition over Plan 02's selectors/mutators + Plan 03's DataTable substrate.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-24T16:29:48Z
- **Completed:** 2026-05-24T16:40:54Z
- **Tasks:** 3
- **Files created:** 11

## Accomplishments

- /reports/stock — REP-01 live stock with availableQty/outQty/damagedQty/totalQty/threshold/low-stock badge across 8 columns; sortable by name + availableQty
- /reports/out — REP-02 open checkouts at active events via the existing selectItemsOut projection (no new selector needed)
- /reports/history — REP-04 global tx log with 6 URL-synced filters (type / eventId / itemId / actorUid / from / to) plus 3 toolbar Selects (type, event, actor); sortable by `at` server-timestamp
- /reports/missing — REP-03 open missing-item records with default `status=open` filter, 3 URL filter keys (status, reason, eventId), and per-row admin Resolve action that opens the ResolveMissingSheet
- /reports/repurchase — REP-05 dual-signal surface (low-stock primary + frequently-missing secondary) with RP-04 admin-only Mark-as-ordered button on low-stock rows
- ResolveMissingSheet — admin-only Sheet (per UI-SPEC "Sheets vs Dialogs" Shared #8) with rhf + ResolveMissingSchema validation; radio choice between "Found" (returns qty to availableQty) and "Write off" (decrements totalQty); optional notes textarea; submits via store.resolveMissing which writes the follow-up adjustment tx (MIS-04)
- Empty-state copy verbatim from UI-SPEC: `Nothing missing` / `All checked-out items are accounted for.` (REP-03), `Nothing checked out` / `No items are currently at events.` (REP-02), `No items yet` (REP-01 fallback), `Nothing to repurchase` (REP-05), `No activity yet` (REP-04)
- All tables use DataTable wrapper for REP-06 URL sync + REP-07 50/page pagination
- D-11 sortable-columns rule enforced across all 5 tables: only date / qty-axis / name columns expose sort buttons; every non-sortable column carries `// D-11: <col> is NOT sortable` audit comment

## Task Commits

Each task was committed atomically:

1. **Task 1: Stock, items-out, repurchase report tables + routes** — `21e550e` (feat)
2. **Task 2: History report + filters** — `e1a12ac` (feat)
3. **Task 3: Missing report + ResolveMissingSheet** — `8306b6d` (feat)

Plus one auto-fix commit:

4. **Cache StockReportTable selector (Rule 1 - Bug)** — `1ee2b59` (fix)

**Plan metadata:** (this commit) `docs: complete 01-11-reports plan`

## Files Created/Modified

### Routes (5 files)

- `app/(app)/reports/stock/page.tsx` — Server Component shell, PageHeader + disabled Export CSV button + StockReportTable; SSR'd `<title>`
- `app/(app)/reports/out/page.tsx` — Server Component shell, PageHeader + ItemsOutTable
- `app/(app)/reports/history/page.tsx` — Server Component shell, PageHeader + HistoryTable
- `app/(app)/reports/missing/page.tsx` — Server Component shell, PageHeader + MissingItemsTable
- `app/(app)/reports/repurchase/page.tsx` — Server Component shell, PageHeader + RepurchaseTable

### Feature tables (5 files)

- `components/feature/reports/StockReportTable.tsx` — REP-01 live stock projection over `s.items` filtered to non-retired in useMemo (D-01-11-A); 9 columns; low-stock badge inline
- `components/feature/reports/ItemsOutTable.tsx` — REP-02 wraps existing `selectItemsOut` projection; 4 columns; per-item open-tx sum
- `components/feature/reports/HistoryTable.tsx` — REP-04 global tx log with 6 URL-synced filters via useUrlTableState + 3 toolbar Selects; in-component filtering predicate (D-01-11-D); item + event cells link to detail pages
- `components/feature/reports/MissingItemsTable.tsx` — REP-03/MIS-02 with 3 URL filter keys + default status=open (D-01-11-F); per-row Resolve action when row.status === 'open'
- `components/feature/reports/RepurchaseTable.tsx` — REP-05/RP-04 dual-signal surface; cross-bucket reason column; admin-only inline Mark-as-ordered button

### Feature components (1 file)

- `components/feature/missing/ResolveMissingSheet.tsx` — MIS-02/03/04 admin-only Sheet with rhf + zodResolver(ResolveMissingSchema); Controller-bridged RadioGroup for resolution choice (D-01-11-E); store.resolveMissing actor-resolution pattern from Plan 05

## Decisions Made

### D-01-11-A — Cache mock-store selectors that derive new arrays

The plan's example used `useMockStore((s) => s.items.filter(...))` directly inside the selector argument. This returns a new array reference on every snapshot read, breaking React 19's useSyncExternalStore identity check. The dev-mode browser console emitted "Maximum update depth exceeded" + "getServerSnapshot should be cached" errors, even though the production build succeeded.

Fix: read the raw `s.items` slice via useMockStore (reference-stable across snapshots), and filter inside useMemo with the raw slice as the dep. Pattern matches InventoryTable.

EventsTable (Plan 07) and RecentActivityFeed (Plan 05) have the same anti-pattern via `selectAccessibleEvents` / `selectRecentActivity` — both ship to prod, but emit the same dev-mode warning. Out of scope for this plan; documented for future refactor.

### D-01-11-B — shadcn v4 `<Field>` for the ResolveMissingSheet

The plan example referenced `import { Form, FormField, FormItem, ... } from "@/components/ui/form"` — but `components/ui/form.tsx` does NOT exist in the v4 radix-nova registry (D-01-04-B / D-01-06-A / D-01-07-A confirmed this empty). Continued the established pattern: shadcn v4 `<Field>` + `<FieldLabel>` + `<FieldError>` + rhf register/Controller. Identical shape to ItemForm + EventForm.

### D-01-11-C — All report routes accessible by staff; only mutators admin-gated

The plan does not impose route-level admin gates on the 5 report pages — only the inline mutator surfaces (Mark-as-ordered in Repurchase, Resolve in MissingItems) are admin-gated via `session.role === 'admin'` checks. This matches REQUIREMENTS.md: AUTH-10 + RP-04 + MIS-03 scope admin-only behavior to navigation entries and specific buttons, NOT entire report routes. Staff need read access to /reports/missing to know what's outstanding for their events.

### D-01-11-D — HistoryTable filters in-component

The 6 history filter keys (type/eventId/itemId/actorUid/from/to) are surface-specific. Building a `selectFilteredTransactions(s, filters)` selector would duplicate URL-decoder logic in two places. In-component filtering keeps the selector layer general and the URL-decoder logic in one place.

### D-01-11-E — Controller-bridged RadioGroup

Radix RadioGroup exposes an imperative `onValueChange` that doesn't compose with rhf's `register`. Wrapped it in `<Controller>` exactly like Plan 06 D-01-06-B established for shadcn Select. Keeps rhf as the source of truth for form state.

### D-01-11-F — MissingItemsTable default status=open

`open` is the actionable view (what an admin needs to triage). Default to it; user can switch to `_all` or another status. Mirrors EventsTable's status=active default pattern from Plan 07.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved missing `<Form>` import in ResolveMissingSheet**

- **Found during:** Task 3 (Resolve Missing Sheet implementation)
- **Issue:** Plan example imported `{ Form, FormField, FormItem, FormLabel, FormControl, FormMessage }` from `@/components/ui/form`. That file does not exist in the v4 radix-nova registry — D-01-04-B / D-01-06-A / D-01-07-A all flagged this in prior plans. Build would have failed with "module not found".
- **Fix:** Rewrote the form composition using shadcn v4 `<Field>` + `<FieldLabel>` + `<FieldError>` + rhf register/Controller — the exact pattern Plans 04/06/07 established and ItemForm.tsx demonstrates. Behavioral surface is identical: rhf validates against ResolveMissingSchema, RadioGroup choice + optional notes, submit calls `store.resolveMissing(id, resolution, actor)`.
- **Files modified:** components/feature/missing/ResolveMissingSheet.tsx (initial write; never imported the non-existent module)
- **Verification:** `npx tsc --noEmit` clean; `npm run build` succeeds with /reports/missing in the route table; dev smoke test renders Sheet trigger for admin sessions and returns null for staff.
- **Committed in:** 8306b6d (Task 3)

**2. [Rule 1 - Bug] Fixed infinite-loop warning in StockReportTable**

- **Found during:** Post-Task-3 dev smoke test
- **Issue:** The plan example called `useMockStore((s) => s.items.filter((i) => i.lifecycleState !== "retired"))`. The inline `.filter()` returns a new array reference on every snapshot read, breaking React 19's useSyncExternalStore identity-stability contract. Dev mode emitted "The result of getServerSnapshot should be cached to avoid an infinite loop" + "Maximum update depth exceeded" + multiple "Uncaught Error" lines on every page load of /reports/stock.
- **Fix:** Refactored to read `s.items` (raw, reference-stable slice) via useMockStore, then filter inside `useMemo` with `[allItems]` deps. This is the exact pattern InventoryTable.tsx uses. Pre-existing analogous warnings in EventsTable (`selectAccessibleEvents`) and RecentActivityFeed (`selectRecentActivity`) are out of scope per the scope boundary — they have shipped to prod across Plans 05 + 07 and were not introduced by this plan.
- **Files modified:** components/feature/reports/StockReportTable.tsx
- **Verification:** Touch-recompile + re-curl `/reports/stock` shows zero errors in dev log. All 5 routes return clean 200 with no `Maximum update depth` errors. `npm run build` + `npx tsc --noEmit` + `npm run lint` all green (only known Plan-03 TanStack warning).
- **Committed in:** 1ee2b59 (standalone fix commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes essential. (1) prevented build failure; (2) prevented an infinite-render loop that would have made /reports/stock unusable in dev. Neither introduces scope creep — the Sheet's behavioral contract matches the plan, and the StockReportTable's filtering logic is unchanged (just relocated from selector arg to useMemo body).

## Issues Encountered

None — both deviations were caught by automated verification (build for Rule 3, dev-mode console for Rule 1) and fixed inline.

## User Setup Required

None — no external service configuration needed for this plan.

## Next Phase Readiness

- Plan 11 reports surface is complete. Next plan is **01-12-users-settings**, which builds the admin-only `/users` route (UserTable + InviteUserSheet + role-change + disable flows) plus `/settings` (PhaseOnePocRoleSwitcher migration + theme toggle composition).
- Reports infrastructure ready for Phase 2 swap:
  - StockReportTable's `useMockStore((s) => s.items)` + useMemo filter → swap the store body to Firestore onSnapshot, useMemo stays unchanged.
  - HistoryTable's 6-key URL filter → maps directly onto Firestore composite query with `where()` clauses; the predicate logic lives in one place.
  - MissingItemsTable's default-status filter → same pattern works once `missingItems` collection is in Firestore (composite index needed for status + reason + eventId, see ARCHITECTURE.md).
  - ResolveMissingSheet's `resolveMissing(id, resolution, actor)` signature already matches the Phase 2 Server Action contract — only the actor resolution path changes (mock cookie → next-firebase-auth-edge verifyTokens).
- No new dependencies introduced; no breaking-change surface for Plans 12+.

---
*Phase: 01-ui-poc*
*Completed: 2026-05-25*

## Self-Check: PASSED

- All 11 key-files exist on disk (verified with `ls`).
- All 4 commit hashes (21e550e, e1a12ac, 8306b6d, 1ee2b59) present in `git log` between the Plan 10 metadata commit (6a1436e) and HEAD.
- All acceptance criteria from Tasks 1/2/3 pass (file existence + grep patterns + tsc + build).
- Plan-level `<verification>` block satisfied: all 5 routes render (smoke test); URL params persist filter selections (useUrlTableState); admin can resolve a missing record (smoke + functional review of the Sheet flow); `npm run build` passes.
- Plan-level `<success_criteria>` satisfied: REP-01..07 + MIS-02..04 + RP-04 + RP-02 (low-stock projection consumed by Repurchase) all implemented.
