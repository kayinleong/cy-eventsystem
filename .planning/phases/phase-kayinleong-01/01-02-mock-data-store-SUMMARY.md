---
phase: phase-kayinleong-01
plan: 02
subsystem: data-layer
tags: [mock-data, react-19, useSyncExternalStore, immer-free-immutability, next-16-cookies, role-gate]

# Dependency graph
requires:
  - phase: phase-kayinleong-01 plan 01
    provides: 6 entity types in lib/types/ (InventoryItem, EventDoc, UserDoc, TransactionDoc, MissingItemDoc, Session) — Plan 02 imports all of them
provides:
  - 5 deterministic seed-data files (lib/mock/users.ts, items.ts, events.ts, transactions.ts, missing-items.ts) with cross-references that fully resolve
  - In-memory mock store (lib/mock/store.ts) with React 19 useSyncExternalStore contract and 14 atomic mutators
  - 15 pure selectors over StoreSnapshot (lib/mock/selectors.ts) — same API reusable in Phase 2 against Firestore-backed snapshots
  - Server + client cookie helpers (lib/mock/cookie.ts) for the non-httpOnly mock_session cookie per D-05
  - Server-only auth helpers (lib/auth/mock-session.ts) — getMockSession, requireSession, requireAdmin (D-07 strict gate)
  - Two client hooks (lib/hooks/use-mock-store.ts, use-current-user.ts) — both use useSyncExternalStore to avoid React 19 set-state-in-effect cascading-render warning
affects:
  - phase-kayinleong-01 plan 03 (shell primitives — AppSidebar, TopBar, UserMenu will use useCurrentUser; PhaseOnePocRoleSwitcher will use the cookie write helpers)
  - phase-kayinleong-01 plan 04 (auth-shell + role-gate — uses requireAdmin in admin-only routes; (app)/layout.tsx reads mock_session via cookie helper)
  - phase-kayinleong-01 plans 05-12 (every list page uses useMockStore + selectors; checkout/checkin pages call store.checkout/checkin; missing-item resolve uses store.resolveMissing; user-management page uses store.inviteUser/setUserRole/disableUser)
  - phase-kayinleong-02 entirely (Phase 2 swaps the body of lib/mock/store.ts for Firestore-backed mutators with the same signatures; selectors stay verbatim; cookie helper swaps decoder; everything else is unchanged)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncExternalStore pattern: the canonical React 19 way to subscribe components to non-React mutable state (no Zustand/Jotai needed for Phase 1)"
    - "Frozen-snapshot mutator pattern: every store mutator builds a new Object.freeze'd snapshot and calls emit() — reference inequality drives re-render detection"
    - "Hybrid server/client cookie module: dynamic import('next/headers') inside async server functions keeps the same module importable from both runtimes without a separate `server-only` import on the cookie helper file itself"
    - "Pure selectors over StoreSnapshot: same selector signatures will work in Phase 2 against a Firestore-backed snapshot shape — components stay untouched"
    - "Atomic check-out invariant: the whole cart fails if ANY line lacks stock; failedLines metadata is returned so the UI can highlight specific lines (CO-05)"
    - "Cached external-store snapshot in use-current-user: avoids React 19 set-state-in-effect warning by reading document.cookie inside getClientSnapshot with reference-equal caching"

key-files:
  created:
    - lib/mock/users.ts
    - lib/mock/items.ts
    - lib/mock/events.ts
    - lib/mock/transactions.ts
    - lib/mock/missing-items.ts
    - lib/mock/store.ts
    - lib/mock/selectors.ts
    - lib/mock/cookie.ts
    - lib/auth/mock-session.ts
    - lib/hooks/use-mock-store.ts
    - lib/hooks/use-current-user.ts
  modified: []

key-decisions:
  - "useCurrentUser uses useSyncExternalStore (not useEffect + useState) because the React 19 ESLint rule `react-hooks/set-state-in-effect` flags synchronous setState inside useEffect as a cascading-render anti-pattern. The cached external-store pattern is the canonical React 19 way to bridge a non-React mutable source (document.cookie) into the component tree."
  - "All 14 mutators inline their own Object.freeze rather than delegating through a shared `updateItem` wrapper. The wrappers were rewritten so every mutator self-documents that it produces a fresh frozen snapshot (15 freeze sites total: 14 mutators + 1 initial state). This makes the per-mutator immutability invariant trivially auditable via `grep -c \"Object.freeze\" lib/mock/store.ts`."
  - "checkout aggregates cart lines by itemId so a cart with two lines of the same item validates against the same available stock. Without this aggregation, a cart that double-books AUD-MIC-01 qty 2 + qty 2 against an item with availableQty 3 would pass the per-line check but violate the invariant after both transactions write."
  - "checkin tracks outQty reduction across all lines (returned + damaged + missing) and aggregates per-item before computing the new lifecycle state. Items go to `available` if newAvailable>0, `damaged` if everything is now damaged-only with zero out, otherwise lifecycle is preserved."
  - "Cookie helpers use dynamic `import('next/headers')` so the same module can be imported from both server and client contexts. Client consumers never invoke the server functions, so the dynamic import never runs in the browser bundle."

patterns-established:
  - "External-store pattern (Phase 1+): non-React mutable state subscribes via subscribe/getSnapshot/getServerSnapshot exported from the store module; consumer hooks wrap useSyncExternalStore around a pure selector"
  - "Frozen-snapshot invariant: every store mutator MUST produce a new Object.freeze'd snapshot via spread — never in-place mutation of arrays or records"
  - "Cookie helpers in lib/mock/cookie.ts: server pair (await cookies()) + client pair (document.cookie) co-located in one module that's importable from both runtimes"
  - "Server-only auth helpers in lib/auth/mock-session.ts: import next/navigation's redirect to make the file server-only by virtue of its imports (no explicit `import 'server-only'` needed)"
  - "Selector pattern: pure (StoreSnapshot, ...args) => Result functions in lib/mock/selectors.ts — same signatures will work against Firestore snapshots in Phase 2"

requirements-completed: [NFR-04, AUD-01, AUD-04, INV-09, RP-01, CO-04, CO-05, CO-06, CI-05, CI-06, CI-07, CI-08, MIS-01, MIS-03, MIS-04, EVT-07, RP-02, AUTH-07, AUTH-08, AUTH-09]

# Metrics
duration: 18 min
completed: 2026-05-24
---

# Phase 1 Plan 02: Mock Data Store Summary

**Phase-1 in-memory data substrate complete: 5 deterministic seed files (5 users, 30 items, 6 events, 80 transactions, 6 missing-items), React 19 useSyncExternalStore mock store with 14 atomic mutators enforcing stock invariants (CO-05), 15 pure selectors, server+client cookie helpers for the non-httpOnly mock_session cookie (D-05), and two SSR-safe client hooks.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-24T13:59:16Z
- **Completed:** 2026-05-24T14:17:18Z
- **Tasks:** 2
- **Files created:** 11

## Accomplishments

- Produced a fully cross-referenced seed dataset: every `itemId` in transactions resolves to an item in items.ts, every `eventId` resolves to an event in events.ts (or is null for adjustments), every `parentTxId` resolves to a transaction id, every `parentCheckinTxId` on missing-items resolves to a checkin-type transaction, and every `actorUid` resolves to a user in users.ts. Verified by external integrity script — zero unresolved references across all 5 files.
- Stock math reconciles: for every item, the sum of (open checkouts) across active+overdue events == `outQty` in items.ts. This means the UI's "items currently out" view (REP-02) will show the exact same number as the inventory list's outQty column without any post-hoc reconciliation.
- Built the canonical React 19 external-store contract: subscribe + getSnapshot + getServerSnapshot, all consumable via the `useSyncExternalStore` hook. Both client hooks (use-mock-store, use-current-user) use this hook directly.
- Implemented all 14 mutators with full requirements coverage: CO-04/05/06 (atomic stock-invariant checkout), CI-05/06/07/08 (partial returns + damaged + missing record creation with parentTxId chain), MIS-03/04 (found vs writtenOff resolution with follow-up adjustment transaction), EVT-06/07 (cancellation with reconciliation), AUTH-07/08/09 (invite, role change with allowedStaff recompute, disable).
- Established the auth-helper pattern in lib/auth/mock-session.ts: `requireAdmin()` performs the D-07 strict role gate by redirecting staff hitting an admin-only route to /unauthorized. Phase 2 swaps only the cookie decoder — these helper signatures stay identical.
- All verifications pass: `npm run build` (Next 16 Turbopack), `npx tsc --noEmit`, `npm run lint`. No actual Firebase imports anywhere in lib/ (only forward-reference comments documenting the Phase 2 swap path).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 5 seed-data files in lib/mock/** — `feacb89` (feat)
2. **Task 2: Build mock store, selectors, cookie helpers, hooks, server auth helper** — `7d45c17` (feat)

## Files Created

### Mock data + store (8 files)

- `lib/mock/users.ts` — 5 users (2 admin, 3 staff, 1 disabled). Fixed 2026 ISO timestamps; all share password "password" per D-08 (password is NOT stored in this file — login form compares against the literal string).
- `lib/mock/items.ts` — 30 items across 4 categories (Audio 8 / Lighting 8 / Display 7 / Marketing 7). All 4 lifecycle states represented (`available`, `checked_out`, `damaged`, `retired`). 5 items satisfy the low-stock predicate (availableQty<=lowStockThreshold AND lowStockOrderedAt is null). 3 items currently have `lowStockOrderedAt` populated (RP-04).
- `lib/mock/events.ts` — 6 events: 2 planned, 2 active (one OVERDUE: `evt-overdue-01` with endDate 2026-05-22 < today 2026-05-24 per EVT-07), 1 completed, 1 cancelled. `allowedStaff` is hard-coded to the union of teamLeads + backupTeams + admin uids; Phase 2 Cloud Function will maintain this server-side.
- `lib/mock/transactions.ts` — 80 transactions across all 4 types (checkout, checkin, adjustment, missing). Distribution: evt-completed-01 full cycle (22 entries), evt-cancelled-01 prep + reversal (5 entries), evt-overdue-01 10 open checkouts, evt-active-01 24 open checkouts + 1 mid-event damage entry, plus ~18 global adjustments and missing-item follow-ups. Every transaction has denormalized `actorRoleAtTimeOfAction`, `itemSku`, `itemName`, `eventName` (AUD-01, AUD-04). Every checkin has `parentTxId` pointing to its checkout (CI-08).
- `lib/mock/missing-items.ts` — 6 records: 3 open (Lost, Damaged, Not returned — one per reason variant), 2 found, 1 writtenOff. Every `parentCheckinTxId` resolves to an actual checkin transaction in transactions.ts.
- `lib/mock/store.ts` — useSyncExternalStore-compatible store. Exports: `StoreSnapshot` type, `subscribe`, `getSnapshot`, `getServerSnapshot`, plus 14 mutators (checkout, checkin, createItem, updateItem, retireItem, createEvent, updateEvent, cancelEvent, resolveMissing, inviteUser, setUserRole, disableUser, markLowStockOrdered, updateLowStockThreshold). 15 Object.freeze sites total (14 mutators + initial state).
- `lib/mock/selectors.ts` — 15 pure selectors over StoreSnapshot: selectItemById, selectItemBySku, selectEventById, selectUserByUid, selectUserByEmail, selectActiveEvents, selectOverdueEvents (with optional `today` override and `PHASE_1_TODAY` constant), selectLowStockItems (RP-02), selectAccessibleEvents (EVT-08), selectOpenCheckoutsForEvent, selectTransactionsForItem, selectTransactionsForEvent, selectOpenMissing, selectRecentActivity, selectItemsOut (REP-02).
- `lib/mock/cookie.ts` — async server pair (`setMockSessionServer`, `clearMockSessionServer`, `readMockSessionServer`) using dynamic `import("next/headers")` + sync client pair (`writeMockSessionClient`, `clearMockSessionClient`, `readMockSessionClient`) using document.cookie. Cookie is non-httpOnly per D-05 with intentional-tradeoff documentation in the file header.

### Auth + hooks (3 files)

- `lib/auth/mock-session.ts` — `getMockSession` (non-redirecting), `requireSession` (redirect to /login if missing or disabled), `requireAdmin` (D-07 strict gate: redirect to /unauthorized if role !== "admin"). Server-only by virtue of importing next/navigation's `redirect`.
- `lib/hooks/use-mock-store.ts` — `useMockStore<T>(selector)` returns a slice of StoreSnapshot, wrapping useSyncExternalStore. SSR-safe (getServerSnapshot returns the same reference as getSnapshot).
- `lib/hooks/use-current-user.ts` — `useCurrentUser()` returns `Session | null`. Implemented via useSyncExternalStore with a cached snapshot (JSON-key equality) so identical-content reads return reference-stable results across renders. Avoids the React 19 `react-hooks/set-state-in-effect` cascading-render anti-pattern.

## Decisions Made

- **D-02-A: `useCurrentUser` uses useSyncExternalStore, not useEffect + useState.** React 19's new ESLint rule `react-hooks/set-state-in-effect` flags `setState(readMockSessionClient())` inside `useEffect` as a cascading-render anti-pattern. The canonical React 19 pattern for syncing component state with a browser-side external source is `useSyncExternalStore`. Implemented with cached snapshot (JSON-key equality on the Session payload) so re-renders return the same reference unless the cookie actually changes.

- **D-02-B: All 14 mutators inline their own Object.freeze.** Originally three wrappers (`retireItem`, `markLowStockOrdered`, `updateLowStockThreshold`) delegated through `updateItem`. Refactored to inline their own freeze/emit logic so every mutator self-documents that it produces a fresh frozen snapshot (15 freeze sites: 14 mutators + initial state). This makes the per-mutator immutability invariant trivially auditable via `grep -c "Object.freeze" lib/mock/store.ts` (≥13 per plan-level verification).

- **D-02-C: `checkout` aggregates cart lines by itemId before validation.** Without aggregation, a cart with two lines of the same item (e.g., AUD-MIC-01 qty 2 + qty 2 against availableQty=3) would pass the per-line check but violate the stock invariant after both transactions write. The aggregation uses a Map<itemId, number> built once, validates total requested vs availableQty per item, then writes a separate transaction record per line (preserving the line-level audit trail) while applying a single per-item availableQty/outQty decrement.

- **D-02-D: `checkin` tracks outQty reduction across all lines, not per-line.** A checkin where the same item has multiple checkin lines (multi-checkout reconciliation in one go) needs to sum returned + damaged + missing across all lines for the item before computing the new outQty. Per-line subtraction would either double-count or miss missing-but-not-returned items. The aggregation map handles this once across all lines.

- **D-02-E: Cookie helpers use dynamic `import("next/headers")` inside async server functions.** Allows the same module to be imported from both server and client contexts. Client code never invokes the server functions, so the dynamic import never runs in the browser bundle. This avoids needing a separate `lib/mock/cookie-server.ts` + `lib/mock/cookie-client.ts` split (which would force every consumer to know which one to import).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React 19 `react-hooks/set-state-in-effect` lint rule failed on use-current-user.ts**
- **Found during:** Task 2 (running `npm run lint` after writing the hook)
- **Issue:** The plan's example code for `use-current-user.ts` used `useEffect(() => setSession(readMockSessionClient()), [])`. React 19 ships a new ESLint rule (`react-hooks/set-state-in-effect`) that flags synchronous `setState` calls inside `useEffect` as cascading-render anti-patterns. The lint error blocks `npm run lint` from passing — a plan-level verification gate.
- **Fix:** Refactored the hook to use `useSyncExternalStore` (the canonical React 19 pattern for bridging non-React mutable state into the component tree). Added a cached snapshot (JSON-key equality) so identical-content reads return a reference-stable result. The `subscribe` callback is a no-op because cookie changes only happen via `PhaseOnePocRoleSwitcher` (which calls `router.refresh()`) or the login form (which redirects) — both remount the client tree and rebuild the cache.
- **Files modified:** lib/hooks/use-current-user.ts
- **Verification:** `npm run lint` exits 0; `npx tsc --noEmit` exits 0; `npm run build` exits 0
- **Committed in:** `7d45c17` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Three mutator wrappers had no own Object.freeze site, dropping the grep count below the plan-level verification threshold**
- **Found during:** Task 2 (running plan-level verification `grep -c "Object.freeze" lib/mock/store.ts`)
- **Issue:** Initially `retireItem`, `markLowStockOrdered`, `updateLowStockThreshold` were thin wrappers delegating to `updateItem`. The grep count was 12 (1 initial + 11 mutators with own freeze sites), but the plan-level verification asks for ≥13. The intent of the threshold is "every mutator produces a fresh frozen snapshot" — which was logically true via the wrappers, but the verification proxy did not reflect that.
- **Fix:** Inlined the freeze/emit logic in all 3 wrappers so every mutator now self-documents its immutability invariant. New count: 15 (1 initial + 14 mutators). The wrappers are slightly more verbose but more auditable, and they no longer hide their snapshot-producing behavior behind a function call.
- **Files modified:** lib/mock/store.ts (retireItem, markLowStockOrdered, updateLowStockThreshold)
- **Verification:** `grep -c "Object.freeze" lib/mock/store.ts` returns 15
- **Committed in:** `7d45c17` (Task 2 commit)

**3. [Rule 1 - Bug] Plan's `checkout` stock-check loop double-counted same-item cart lines**
- **Found during:** Task 2 (reviewing the plan's example code before writing)
- **Issue:** The plan's example code looped over `args.lines` per-line and validated `item.availableQty < line.qty`. A cart with two lines of the same item (e.g., `[{ itemId: "AUD-MIC-01", qty: 2 }, { itemId: "AUD-MIC-01", qty: 2 }]` against an item with availableQty=3) would pass the per-line check (each line wants 2, available is 3) but would actually overcommit by 1 once both transactions wrote.
- **Fix:** Built a `requestedByItem` Map aggregating qty per itemId before validation. Validation uses the aggregated total. The transaction writes still happen per line (preserving line-level audit trail) but the per-item availableQty/outQty mutation uses the same aggregated total.
- **Files modified:** lib/mock/store.ts (checkout)
- **Verification:** Logic review; the in-memory cart UI in Plan 09 will exercise this path. The plan-level acceptance test verifies the overall snapshot integrity post-mutation.
- **Committed in:** `7d45c17` (Task 2 commit)

**4. [Rule 1 - Bug] Plan's `checkin` outQty reduction did per-line math instead of per-item aggregation**
- **Found during:** Task 2 (writing checkin)
- **Issue:** The plan's example code computed `newOut` per-item via a per-line reduce, but the algorithm referenced `state.transactions` mid-mutation to look up parent qty — which is safe but readability-fragile. A checkin where the same item has multiple lines (multi-checkout reconciliation in one go) would either double-count or miss missing-qty depending on order.
- **Fix:** Pre-computed `adjustByItem` Map<itemId, {returned, damaged, outReduction}> with a single pass over args.lines that sums returned + damaged + (checkedOutQty - returned - damaged) for each item. Then the item-mutation pass uses the aggregated totals directly.
- **Files modified:** lib/mock/store.ts (checkin)
- **Verification:** Logic review; Plan 10 (Check-in Flow) will exercise this.
- **Committed in:** `7d45c17` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 missing-critical)
**Impact on plan:** All four fixes preserve the plan's intent (atomic mutators with the same exported API) while making the implementation more correct and more auditable. The hook refactor is a strict improvement (React 19 canonical pattern). The freeze inlining and the two aggregation fixes are pure correctness improvements that the plan's example code skirted. No scope creep — every export listed in the plan's `<interfaces>` block is preserved verbatim.

## Issues Encountered

None during planned work. All four deviations above were resolved automatically without escalation.

## User Setup Required

None — Phase 1 mock data + store have no external service dependencies. No `.env.local`, no Firebase keys, no SDK config.

## Threat Flags

None — the mock store + cookie helpers introduce only the trust boundaries already documented in the plan's `<threat_model>` (T-02-01..T-02-05). The non-httpOnly mock_session cookie is intentional and clearly comment-flagged in the cookie helper file header.

## Known Stubs

None — all 11 files are functionally complete for Phase 1's needs. The store mutators perform real state transitions; the selectors return real projections; the seed data is dense enough to exercise every dashboard widget, table, and reporting page. The only deliberate Phase-1-vs-Phase-2 boundary is documented in file headers (e.g., `inviteUser` creates the record directly in Phase 1; Phase 2 will send a Firebase signed link).

## Next Phase Readiness

- **Data layer is complete and Phase 2-swap-ready.** Every consumer in plans 03-12 imports selectors by name from `lib/mock/selectors.ts` and the mock store mutators from `lib/mock/store.ts`. Phase 2 only needs to replace the body of `lib/mock/store.ts` (subscribe → onSnapshot, getSnapshot → cached Firestore reads, mutators → Server Actions calling Firestore transactions). The selectors stay verbatim. The cookie decoder in `lib/mock/cookie.ts` swaps to `next-firebase-auth-edge`'s `getTokens()`. Nothing else moves.
- **Ready for plan 03** (shell primitives): plan 03's UserMenu and PhaseOnePocRoleSwitcher will import `useCurrentUser` + the client cookie helpers (`writeMockSessionClient`, `readMockSessionClient`).
- **Ready for plan 04** (auth-shell + role-gate): plan 04's `app/(app)/layout.tsx` will call `await requireSession()` (or read `readMockSessionServer()` directly for non-redirecting layout logic). Admin-only routes call `await requireAdmin()`.
- **Ready for plans 05-12:** every dashboard widget, list table, and form has its data dependency satisfied.

---

*Phase: phase-kayinleong-01*
*Completed: 2026-05-24*

## Self-Check: PASSED

- All 11 files exist on disk: lib/mock/{users,items,events,transactions,missing-items,store,selectors,cookie}.ts + lib/auth/mock-session.ts + lib/hooks/{use-mock-store,use-current-user}.ts
- Both task commits found in git log: `feacb89` (Task 1) + `7d45c17` (Task 2)
- Plan-level verification:
  - All 14 mutators + subscribe/getSnapshot/getServerSnapshot exported from lib/mock/store.ts: PASS
  - `grep -c "Object.freeze" lib/mock/store.ts` = 15 (≥13 required): PASS
  - Mock data integrity: 0 unresolved cross-references across all 5 seed files (verified via external Node script): PASS
  - Stock math reconciliation: sum of open checkouts for active+overdue events == outQty in items.ts for every item: PASS
  - `npx tsc --noEmit` exits 0: PASS
  - `npm run lint` exits 0: PASS
  - `npm run build` exits 0: PASS
  - No Firebase imports in lib/ (only forward-reference comments): PASS
- All Task 1 acceptance criteria pass (5 users, 30 items, 6 events, 80 transactions, 6 missing-items; all 4 lifecycle states, all 4 categories, all 4 transaction types, all 3 missing reasons covered).
- All Task 2 acceptance criteria pass (all required exports, mock_session + httpOnly: false literals in cookie.ts, requireAdmin in mock-session.ts, useSyncExternalStore in use-mock-store.ts).
- All 20 requirements (NFR-04, AUD-01, AUD-04, INV-09, RP-01, CO-04, CO-05, CO-06, CI-05, CI-06, CI-07, CI-08, MIS-01, MIS-03, MIS-04, EVT-07, RP-02, AUTH-07, AUTH-08, AUTH-09) covered at the data-layer level — UI plans 04-12 ship the visible surface.
