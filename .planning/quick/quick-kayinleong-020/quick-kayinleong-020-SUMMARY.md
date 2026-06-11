---
id: quick-kayinleong-020
type: quick
subsystem: list-pagination
status: paused-awaiting-human-verify
tags: [pagination, firestore-reads, cursor, ssr, reports, inventory, events]
requires:
  - lib/data/events.server.ts (EVT-08 SSR enforcement)
  - lib/data/transactions.server.ts (cursor seed)
  - components/feature/users/UsersTable.tsx (reference implementation)
provides:
  - Six list tables render SSR seed directly + href-based Next navigation
  - getOpenCheckoutIdsForCheckouts server helper (open-only derivation)
affects:
  - /inventory, /events, /reports/{stock,out,history,repurchase}
tech-stack:
  added: []
  patterns:
    - "List tables render the SSR-paginated initial* seed directly (no client onSnapshot) — mirrors /users"
    - "Next pagination is an <a href> built from current searchParams + cursor (preserves filter/sort/search)"
    - "Open-only derivation for /reports/out moved server-side via where(parentTxId, in, [...]) chunked at 30"
key-files:
  created: []
  modified:
    - components/feature/inventory/InventoryTable.tsx
    - components/feature/events/EventsTable.tsx
    - components/feature/reports/StockReportTable.tsx
    - components/feature/reports/RepurchaseTable.tsx
    - components/feature/reports/HistoryTable.tsx
    - components/feature/reports/ItemsOutTable.tsx
    - app/(app)/reports/out/page.tsx
    - lib/data/transactions.server.ts
decisions:
  - "Option B (drop list-page live listener, render SSR seed) over Option A (cursor-aware hook) — fixes both symptoms with least surface, matches /users"
  - "/reports/out open-only derived server-side via in-clause subtraction (page-level), not by forcing the event-scoped getOpenCheckoutsForEventServer"
metrics:
  duration: ~25 min
  tasks_completed: 2 of 3 (Task 3 is a blocking human-verify checkpoint)
  files_modified: 8
  completed: paused 2026-06-11
---

# Quick Task quick-kayinleong-020: Fix Broken List Pagination + Read Amplification Summary

Fixed broken "Next" pagination on all six cursor-paginated list pages (the cursor-blind client `onSnapshot` listener clobbered the page-2 SSR seed back to page 1) and the Firestore read amplification it caused, by rendering the SSR seed directly and making Next a real `<a href>` navigation — mirroring the already-correct `/users` page.

## What Was Done

### Task 1 — Call-site audit (read-only)
Re-ran the live-hook caller grep and classified all 51 call sites into CHANGE (the six list tables) vs LEAVE (13 non-list live consumers + the four shared hook bodies + `/users`). Recorded the EVT-08 SSR proof (`events.server.ts:110-111`) and flagged `ItemsOutTable` as the one table needing a paired server edit. Full table in `CLAIM.md ## Call-site audit`. No files edited.

### Task 2 — Apply Option B (commit `db2029a`)
**The six list tables** now render their SSR `initial*` seed directly (live-hook import + consumption removed; existing `useMemo` kept for stable TanStack identity). Next is `<Button asChild><Link href={…}>` built from `useSearchParams()` with `cursor` set, so active filter/sort/search params survive (REP-06); when `nextCursor` is null a disabled Next button renders. Prev unchanged (`router.back()`). `goNext`/`setCursor` removed; HistoryTable's now-dead `liveFilter` useMemo removed; EventsTable keeps `session` via `void session;`.

**`/reports/out` open-only derivation** moved server-side: new `getOpenCheckoutIdsForCheckouts(checkoutIds)` in `transactions.server.ts` queries `transactions where type==checkin && parentTxId in [chunk]` (chunked at Firestore's 30-id `in` limit) and returns the CLOSED checkout id set; the page subtracts it from the checkout cursor page and passes the open-only array as `initialCheckouts`. `ItemsOutTable` dropped both `useTransactionsLive` calls + the listener-based derivation.

Stale Phase-2 header comments describing the dropped live hook were updated to match the code.

### Task 3 — Human-verify checkpoint (BLOCKING) — PAUSED
Browser verification requires a live Firebase env (>50-item dataset) and cannot be self-performed. Execution paused here per the plan; the orchestrator presents the manual steps to the user.

## Deviations from Plan

None. Both auto tasks executed as written. For `/reports/out` EDIT C, the plan offered two equivalent approaches; chose the page-level `in`-clause subtraction (documented in `CLAIM.md`), the lower-risk smaller surface that reuses the same set-logic the client previously used.

## Verification

**Automated (PASS):**
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors, 12 warnings (the 12 pre-existing TanStack `react-hooks/incompatible-library` warnings; no NEW warnings).
- Done-criteria grep across the six list tables → 0 live-hook matches.
- Scope guardrail diffs: `lib/hooks/use-{inventory,events,transactions,users}-live.ts` and `components/feature/users/` + `app/(app)/users/` → all empty (byte-identical, untouched).

**Manual (PENDING — Task 3 blocking checkpoint):** clicking Next advances all six list pages, filter params survive, EVT-08 staff scoping holds, /reports/out stays open-only, non-list pages still update live, /users still works.

## Known Stubs

None.

## Possible Follow-up (flag for human verification)

The new `/reports/out` derivation issues a `transactions where type==checkin && parentTxId in [...]` query. The pre-declared composite index `transactions(eventId, type, parentTxId, at desc)` does not cover a `type ==` + `parentTxId in` query without an `eventId` equality, so **Firestore may require a new composite index** (`transactions(type, parentTxId)`). If the /reports/out page throws a "create index" error during human verification, add the index to `firestore.indexes.json` and run `firebase deploy --only firestore:indexes`. This is the one runtime-dependent unknown that the automated gates (which do not hit live Firestore) cannot confirm.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary schema changes. EVT-08 staff scoping verified intact at the SSR layer.

## Next Steps

1. User performs the Task 3 browser walkthrough against a live Firebase env (steps in PLAN.md `<how-to-verify>`).
2. If a Firestore index error appears on /reports/out, add `transactions(type, parentTxId)` to `firestore.indexes.json` + deploy.
3. On approval: fill the `CLAIM.md ## Verification` manual section, flip `status: in-progress` → `done`, then push to remote and open a PR for human review (per global CLAUDE.md — `main` is protected, Claude never merges its own PR).

## Self-Check: PASSED

- All 8 modified files present on disk.
- SUMMARY.md present.
- Task 2 commit `db2029a` present in git log.
- `getOpenCheckoutIdsForCheckouts` defined in `transactions.server.ts` and wired in `/reports/out/page.tsx`.
