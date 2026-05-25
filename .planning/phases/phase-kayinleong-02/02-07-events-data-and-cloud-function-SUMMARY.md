---
phase: phase-kayinleong-02
plan: 07
subsystem: events
tags: [block-d, events, evt-08, allowed-staff, server-actions, cursor]
requires:
  - phase-kayinleong-02/04 (users actions + recomputeAllowedStaffForAllEvents helper)
  - phase-kayinleong-02/06 (use-transactions-live for event tabs)
provides:
  - events Server Actions (createEvent, updateEvent, cancelEvent)
  - lib/data/events.server.ts (getEventsPage, getEventServer, getOpenCheckoutsForEventServer) with EVT-08 access projection
  - lib/hooks/use-events-live.ts (Web SDK onSnapshot with EVT-08 filter)
  - 4 Server Component pages swapped + 5 Client Components + 2 dashboard widgets
affects:
  - /events, /events/new, /events/[eventId], /events/[eventId]/edit
  - / (dashboard widgets)
tech-stack:
  patterns:
    - "SSR seed via Admin SDK → onSnapshot handoff (mirrors plan 02-06 inventory + 02-04 users)"
    - "EVT-08 access projection at 3 layers: server (array-contains in getEventsPage), client (array-contains in useEventsLive), database (firestore.rules isMember)"
    - "Inlined allowedStaff sync via recomputeAllowedStaffForEvent — no Cloud Function 2"
    - "Cancel reconciliation in a single runTransaction (read all open-checkout txs + inventory docs up-front, then per-item writes)"
    - "useSyncExternalStore for nowMs in OverdueReturnsWidget (React 19 purity rule compliance)"
key-files:
  created:
    - lib/data/events.server.ts
    - lib/hooks/use-events-live.ts
    - app/(app)/events/actions.ts
  modified:
    - lib/schemas/event.ts (added CreateEventSchema, UpdateEventSchema, CancelEventReconciliationSchema)
    - app/(app)/events/page.tsx
    - app/(app)/events/new/page.tsx
    - app/(app)/events/[eventId]/page.tsx
    - app/(app)/events/[eventId]/edit/page.tsx
    - app/(app)/page.tsx
    - components/feature/events/EventsTable.tsx
    - components/feature/events/EventForm.tsx
    - components/feature/events/TeamLeadCombobox.tsx (Rule 3 deviation)
    - components/feature/events/BackupTeamCombobox.tsx (Rule 3 deviation)
    - components/feature/events/CancelEventDialog.tsx
    - components/feature/events/EventDetail.tsx
    - components/feature/events/EventAssignedItemsTab.tsx
    - components/feature/events/EventHistoryTab.tsx
    - components/feature/dashboard/ActiveEventsWidget.tsx
    - components/feature/dashboard/OverdueReturnsWidget.tsx
decisions:
  - "EVT-08 projection — staff sees only events with uid ∈ allowedStaff, enforced at 3 layers (SSR Admin SDK, client onSnapshot, firestore.rules isMember)"
  - "CancelEvent reconciliation map keyed by transaction id (not itemId) so the Server Action can read the canonical open-checkout document and reconcile exact qty per line"
  - "Inlined Function 2: createEvent seeds allowedStaff = admins ∪ teamLeads ∪ backupTeams then calls recomputeAllowedStaffForEvent for idempotent re-canonicalization; updateEvent calls it only when team membership changed (sorted-array diff)"
  - "OverdueReturnsWidget uses useSyncExternalStore for nowMs to comply with React 19 purity rules — Date.now() inside render or synchronous setState in useEffect both fail lint"
  - "TeamLeadCombobox + BackupTeamCombobox accept users as a prop instead of useMockStore (Rule 3 — required so EventForm callers stop importing mock state)"
metrics:
  duration: "~45 min (manual estimate; system clock crossed the day boundary mid-execution making the raw git diff ~512 min)"
  tasks_completed: 6
  files_created: 3
  files_modified: 13
  commits: 6
  completed_date: 2026-05-26
---

# Phase 2 Plan 07: Events Data + Server Actions + UI Swap (Block D) Summary

Shipped the events data layer (Admin SDK + EVT-08 projection), 3 Server Actions (createEvent/updateEvent/cancelEvent) with inlined allowedStaff sync, and the full UI swap covering `/events` list + new + detail + edit, the assigned-items + history tabs, the cancel reconciliation dialog, and 2 dashboard widgets.

## What was built

### Data layer (Task 1)

- **`lib/data/events.server.ts`** (NEW): `getEventsPage({cursor, limit, filters, session})` cursor-paged read with EVT-08 access projection — admin sees all events, staff sees only events whose `allowedStaff` array contains their uid. `getEventServer(eventId, session)` single-doc read with the same access check (returns null for non-members, treated as 404 by callers). `getOpenCheckoutsForEventServer(eventId)` lists open checkouts (checkout transactions whose id is not referenced as `parentTxId` by any check-in transaction). Timestamp → ISO conversion preserves Phase 1 `EventDoc` contract.
- **`lib/hooks/use-events-live.ts`** (NEW): Web SDK `onSnapshot` scoped to the 50-row cursor window per D-20. EVT-08 array-contains filter mirrors the server projection. Subscription gated on `onAuthStateChanged` to avoid the auth race that bit `useInventoryLive` / `useTransactionsLive`. Defensive `FirestoreError` console.error.
- **`lib/schemas/event.ts`** (MOD): added `CreateEventSchema`, `UpdateEventSchema`, `CancelEventReconciliationSchema` for Server Action input validation. Preserved `EventFormSchema` for the existing EventForm callers.

### Server Actions (Task 2)

- **`app/(app)/events/actions.ts`** (NEW) — three actions:
  - `createEvent` (EVT-01): `requireSession()` + canEdit check (admin OR self-in-teamLeads). Seeds `allowedStaff = [admins ∪ teamLeads ∪ backupTeams]` before the doc write; calls `recomputeAllowedStaffForEvent` post-write for idempotent re-canonicalization. Status = `"planned"`.
  - `updateEvent` (EVT-05): `requireSession()` + `canEditEvent` (admin OR existing team lead). Does NOT write `allowedStaff` in the tx; if `teamLeads` or `backupTeams` changed (sorted-array diff), calls `recomputeAllowedStaffForEvent` after the tx commits.
  - `cancelEvent` (EVT-06): `requireAdmin()`. Single `runTransaction` reads all open-checkout tx docs + all referenced inventory docs up-front, groups deltas by `itemId`, then writes per-item inventory updates (`availableQty`, `outQty`, `isLowStock` per RESEARCH P11) + per-checkout audit rows (checkin / missing+missingItems doc / adjustment per resolution) + flips event status to `"cancelled"` with `closedAt/closedBy`.
- **Inlined Function 2**: `recomputeAllowedStaffForEvent` from `@/lib/data/allowed-staff.server` (created in plan 02-04 refactor) keeps the canonical union in sync without any Cloud Function trigger. Idempotent — no-op when stored value already matches computed union.

### UI swap (Tasks 3-6)

- **`/events` list page** (`app/(app)/events/page.tsx`): real DAL (`requireSession`); SSR seed via `getEventsPage(searchParams)` with EVT-08 projection; `?cursor=` + `?status=` URL contract per D-17. Default `status=active` matches Phase 1 + EVT-03; `_all` sentinel disables the filter.
- **EventsTable** (`components/feature/events/EventsTable.tsx`): bypasses generic `<DataTable>` wrapper, drives `useReactTable({manualPagination: true, pageCount: -1})` directly; consumes `initialEvents + nextCursor + session` props from SSR; `useEventsLive` for live updates; Prev/Next chrome. All D-11 sortable-column rules preserved.
- **EventForm** + **comboboxes**: `createEvent`/`updateEvent` Server Actions; field-level Zod errors surface via `rhf.setError` → `FieldError` chrome. Comboboxes now take `users` as a prop (SSR-seeded by parent pages).
- **`/events/new` + `/events/[eventId]/edit`**: `requireSession` + `getUsersPage({limit:200})` SSR seed for comboboxes. Edit page enforces EVT-05 with `canEditEvent`; `notFound()` on both missing-event AND access-denied paths.
- **`/events/[eventId]` detail**: `requireSession + getEventServer` (EVT-08 enforced) + `canEditEvent` gate; SSR-seed users for team-member chip resolution.
- **EventDetail**: removed `useMockStore` users subscription; accepts `users` prop. CancelEventDialog only renders for admin + non-terminal status.
- **EventAssignedItemsTab**: `useTransactionsLive({eventId, limit:100})`; client-side derivation of open checkouts.
- **EventHistoryTab**: `useTransactionsLive({eventId, limit:100})`; AUD-03 chronological + AUD-01 actor role display preserved.
- **CancelEventDialog**: `cancelEvent` Server Action; reconciliation map keyed by transaction id (matches the Server Action's `CancelEventReconciliationSchema`). Default `"returned"` for any open checkout the user doesn't explicitly change.
- **Dashboard `/` page**: SSR-seed active events for both event widgets; `requireSession` replaces `getMockSession` alias.
- **ActiveEventsWidget**: `useEventsLive({status:"active", limit:10})`.
- **OverdueReturnsWidget**: `useEventsLive` + client-side filter `endDate < nowMs`. `nowMs` driven by `useSyncExternalStore` with a 60s interval (React 19 purity-rule compliance).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan called for `EventForm.tsx` to consume `useUsersLive` but Phase 1's comboboxes read `useMockStore`**

- **Found during:** Task 4
- **Issue:** The plan said EventForm "consumes useUsersLive" for the multi-select but the actual Phase 1 components (`TeamLeadCombobox` + `BackupTeamCombobox`) read `useMockStore`. Plus `useUsersLive` from plan 02-04 was stubbed to just return its initial data due to the permission-denied fallout.
- **Fix:** Updated both comboboxes to accept `users` as a prop. SSR-seed in parent pages (`/events/new`, `/events/[eventId]/edit`, `/events/[eventId]`) via `getUsersPage({limit:200})`. This makes the SSR/client contract consistent and removes the mock-store dependency cleanly.
- **Files modified:** `TeamLeadCombobox.tsx`, `BackupTeamCombobox.tsx`, `EventForm.tsx`, plus the 3 pages that render `EventForm` or `EventDetail`.
- **Commit:** `1f7a86b`, `b1f0072`.

**2. [Rule 1 - Bug] `Date.now()` inside `useMemo` violates React 19 purity rule**

- **Found during:** Task 6 (lint gate)
- **Issue:** `OverdueReturnsWidget` originally used `Date.now()` inside a `useMemo` callback — `react-hooks/purity` lint rule errors out: "Cannot call impure function during render."
- **First attempted fix:** Hoist `Date.now()` into `useEffect` with `useState`. Triggered a second lint error: `react-hooks/set-state-in-effect` ("Calling setState synchronously within an effect can trigger cascading renders").
- **Final fix:** Refactored to `useSyncExternalStore`. Module-scope mutable `currentNow` updated by a single shared `setInterval` (60s); subscribers schedule a microtask to deliver the initial bump; SSR snapshot returns 0 (matching "nothing overdue yet"). This is the canonical React 19 pattern for time-driven state.
- **Files modified:** `OverdueReturnsWidget.tsx`.
- **Commit:** `a1750c5`.

**3. [Rule 3 - Blocking] Phase 1 cancel reconciliation contract keyed by itemId; Server Action keys by transaction id**

- **Found during:** Task 5
- **Issue:** Phase 1's `cancelEvent` mutator took `{itemId, resolution, qty}[]` because the mock store kept transactions in memory. The Server Action's `CancelEventReconciliationSchema` keys by transaction id so it can read the canonical open-checkout doc by id. The two contracts are incompatible.
- **Fix:** Updated `CancelEventDialog` to:
  - Read open checkouts via `useTransactionsLive` + client-side filter (same logic as the Server Action's `getOpenCheckoutsForEventServer`).
  - Build the resolution map keyed by `tx.id`.
  - Pass `{eventId, reconciliation: Record<txId, resolution>}` to the action.
- **Trade-off:** Phase 1 implicitly allowed "partial returns" (qty could differ from the checkout qty). v1 server contract assumes full-qty returns. Phase 2 plans 02-08 / 02-09 will use full qty per line, so partial returns are out of scope for v1.
- **Files modified:** `CancelEventDialog.tsx`.
- **Commit:** `b1f0072`.

### Architectural choices

- **Dashboard widgets used `useEventsLive` (not count() aggregations):** The plan suggested either approach; I went with the live hook because it parallels the EventsTable swap and avoids a special count()-aggregation code path that would have to be revisited in plan 02-10 anyway. KPI count() aggregations + the full RecentActivity wire-up stay deferred to 02-10 (Block G).
- **Generic AlertDialogAction has `variant="destructive"` + `disabled={submitting}`:** Added a disabled state to both the Cancel and "Keep event" buttons during submit to prevent double-fires while the Server Action runs.

### No deviations / clean swaps

- Server Actions follow the exact pattern from `app/(app)/inventory/actions.ts` and `app/(app)/users/actions.ts` (requireSession/requireAdmin + Zod safeParse + runTransaction where needed + revalidatePath matrix).
- `lib/data/events.server.ts` mirrors the shape of `lib/data/inventory.server.ts` (cursor encode/decode + Timestamp → ISO conversion).
- `lib/hooks/use-events-live.ts` mirrors `lib/hooks/use-inventory-live.ts` (onAuthStateChanged gate + filtered constraints + defensive error handler).

## Architectural notes preserved from Plan amendment

- **No `functions/` directory.** It was deleted in commit `93bf62d`; no files added here. `firebase.json` still has no functions block (verified).
- **No Cloud Function 2.** `recomputeAllowedStaffForEvent` from `@/lib/data/allowed-staff.server` runs inline in `createEvent` (post-write) and `updateEvent` (when team membership changed). `cancelEvent` does NOT call it — cancellation doesn't change team membership; the existing `allowedStaff` is correct for the cancelled event.
- **No self-write loop guard.** Server Actions don't trigger themselves.

## Verification

- `npx tsc --noEmit` — **PASS** (no output, exit 0).
- `npm run lint` — **PASS** (0 errors; 6 pre-existing `react-hooks/incompatible-library` warnings from TanStack `useReactTable` / rhf `watch()` / Date.now() handling in `RecentActivityFeed`, all carried in from plan 02-06 + Phase 1).
- `npm run build` — **PASS** (28 routes generated; proxy middleware recognized).

## Self-Check: PASSED

- All 16 PLAN files_modified present on disk (checked).
- All 6 task commits present in `git log` (`a5c46ec`, `044cd95`, `1618846`, `1f7a86b`, `b1f0072`, `a1750c5`).
- No file deletions across the plan (each `git diff --diff-filter=D HEAD~1 HEAD` returned empty after each commit).
- No new `functions/` files; no functions block re-added to `firebase.json`; no `verifySessionCookie`/`enableIndexedDbPersistence`/`middleware.ts` calls introduced.

## CHECKPOINT REACHED

**Type:** human-action
**Plan:** 02-07 (events data + actions + UI — Wave 7, Block D)
**Progress:** 6/6 tasks complete (all code shipped + 3 verification gates green)

### Awaiting

End-to-end E2E smoke + Block D rules audit per the checkpoint protocol in the plan. See the parent `CLAIM.md` update for the structured 6-row smoke + 8-row rules audit checklist to attest. Type **"events E2E PASS, allowedStaff sync verified inline, rules audit logged"** (or describe failures) to advance to plan 02-08 (Block E — Scan check-out).
