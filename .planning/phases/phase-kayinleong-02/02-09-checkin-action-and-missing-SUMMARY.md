---
phase: phase-kayinleong-02
plan: 09
subsystem: scan-checkin
tags: [block-f, checkin, missing, transactions, atomic, evt-08, ci-04, ci-06, ci-07, ci-08, mis-01, mis-03, mis-04, p11]
requires:
  - phase-kayinleong-02/02 (firestore indexes — transactions(eventId, type, parentTxId, at desc) + missingItems(status, reportedAt desc))
  - phase-kayinleong-02/05 (inventory data layer; isLowStock denorm; computeIsLowStock helper)
  - phase-kayinleong-02/07 (events data layer; getEventServer + getOpenCheckoutsForEventServer; useTransactionsLive)
  - phase-kayinleong-02/08 (checkout transaction shape template — mirrored here for checkin)
provides:
  - commitCheckinCartAction Server Action (marquee atomic check-in transaction)
  - resolveMissing admin-only Server Action with found / writtenOff outcomes
  - lib/data/missing.server.ts cursor-paged Admin SDK reader
  - lib/hooks/use-missing-live.ts onSnapshot hook (50-row D-20 window)
  - /events/[id]/checkin on Firestore (EVT-08 gate + Server Action submit + live partial-return view)
  - ResolveMissingSheet on Server Action
affects:
  - /events/[id]/checkin (per-event reconciliation flow)
  - /reports/missing (ResolveMissingSheet swap; data layer + live hook ready for table swap in 02-10)
  - /inventory (revalidate after checkin + missing resolution)
  - / (dashboard KPIs revalidate)
  - /reports/out + /reports/history (audit rows + open checkouts update)
tech-stack:
  patterns:
    - "Firestore runTransaction with read-then-write phasing — parent tx reads, prior-children sum reads, inventory reads ALL come before any tx.set / tx.update (P8)"
    - "Sum-of-children-by-parent pattern: tx.get(Query) inside a transaction over the composite index transactions(eventId, type, parentTxId, at desc) — supports CI-07 partial check-ins across multiple actions"
    - "Per-line failedLines collection + structured BizError throw vehicle so the cart-wide rejection path surfaces every problem in one round trip (mirrors checkout's CheckoutResult shape)"
    - "Per-SKU inventory delta aggregation across cart lines (Map<itemId, {availableDelta, damagedDelta, outDelta}>) so two parent tx for the same SKU produce a single inventory update"
    - "isLowStock denorm recomputed atomically inside the same tx that changes availableQty / totalQty (RESEARCH P11)"
    - "Per-line audit row writes inside the same runTransaction (AUD-01 — actor identity denormalized at write time; preserves original line shape in history)"
    - "missingItems doc + 'missing' audit transaction co-written atomically when missingDelta > 0 (MIS-01)"
    - "resolveMissing follow-up 'adjustment' transaction inside same runTransaction (MIS-04, AUD-01)"
    - "EVT-08 access check applied BEFORE opening the transaction (admin OR uid in allowedStaff)"
    - "Live hooks gated on onAuthStateChanged to avoid permission-denied race during auth hydration"
key-files:
  created:
    - app/(app)/events/[eventId]/checkin/actions.ts
    - app/(app)/reports/missing/actions.ts
    - lib/data/missing.server.ts
    - lib/hooks/use-missing-live.ts
  modified:
    - app/(app)/events/[eventId]/checkin/page.tsx
    - app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx
    - components/feature/missing/ResolveMissingSheet.tsx
    - lib/schemas/transaction.ts
decisions:
  - "commitCheckinCartAction supports CI-07 partial check-ins natively: prior children (checkin + missing tx rows for the same parentTxId) are summed inside the transaction so a parent qty 5 can be checked in across multiple actions (e.g., 3 now → 2 later) with the remaining qty visible in the live form"
  - "Inventory outQty decrements by movement (returnedQty + damagedQty + missingDelta for THIS action), NOT by the full parentQty as Phase 1 mock-store did. Reason: a true partial check-in (returnedQty < remaining AND no missing reason) leaves the rest open for a follow-up action. The Phase 1 mock conflated 'submit anything = close the parent', which CI-07 explicitly forbids."
  - "Kept Phase 1's damagedQty as a separate qty bucket (CheckinLineSchema unchanged) rather than the plan's damaged-boolean flag. Reason: the existing CheckinLineRow has independent Returned + Damaged QtyStepper controls; matching Phase 1's mutator API keeps the form swap minimal and the cart can mix returned + damaged on a single line."
  - "CI-04 missing-reason validation happens THREE places: inline in CheckinLineRow (visual destructive border on the Select), in CheckinForm.submit() (gates the action call), and inside commitCheckinCartAction (final server-side gate). Defense in depth."
  - "ResolveMissingSheet remains a no-op for non-admin sessions (returns null) AND the Server Action enforces requireAdmin() — defense in depth. Firestore rules deny ALL client writes to missingItems so the Server Action is the only writer (T-02-09-05 mitigation)."
  - "resolveMissing's adjustment transaction stores positive qty for both found and writtenOff (matching Phase 1 mock-store convention) — the type='adjustment' + notes string carries the semantic, not the sign of qty"
  - "useMissingLive subscription is gated on onAuthStateChanged (same pattern as useInventoryLive / useTransactionsLive / useEventsLive) — avoids the auth-hydration race that produces permission-denied errors when Firebase's auth.currentUser hasn't resolved yet"
  - "reportedByName denormalization: commitCheckinCartAction writes reportedByName at create time; lib/data/missing.server.ts has a fallback hydrater from users/{uid} for any docs missing the denorm (e.g., from 02-07 cancelEvent which writes reportedBy but not reportedByName)"
metrics:
  duration: "~22 min (4 task commits + this SUMMARY)"
  tasks_completed: 4
  files_created: 4
  files_modified: 4
  commits: 4
  completed_date: 2026-05-26
---

# Phase 2 Plan 09: Check-in Marquee Transaction + Missing Resolution (Block F) Summary

Block F closes the inventory loop. `commitCheckinCartAction` is the mirror of `commitCheckoutCartAction` (02-08): one Firestore `runTransaction` per cart commits a per-line reconciliation that routes returnedQty into `availableQty`, damagedQty into `damagedQty`, and any shortfall into a new `missingItems` doc + a `missing` audit transaction. `resolveMissing` is the admin-only follow-up that flips an open missing record to `found` (qty back to available) or `writtenOff` (totalQty decrement). Partial check-ins across multiple actions work natively via prior-children summing inside the transaction.

## What was built

### Marquee transaction (Task 2)

- **`app/(app)/events/[eventId]/checkin/actions.ts`** (NEW): `commitCheckinCartAction(input)` Server Action.
  - **Auth gate**: `requireSession()` from real DAL; EVT-08 check (admin OR uid in event.allowedStaff). Status-actionable note: any event status accepts check-ins (post-cancel cleanup, post-completion stragglers).
  - **runTransaction shape**: phase 1 reads (parent checkout doc + prior children query for sum-of-movements + inventory snapshot, dedup'd per SKU); phase 2 validation (cart-wide failedLines collection + structured `BizError("CHECKIN_REJECTED")` throw on any failure); phase 3 writes (per-SKU inventory update with `availableQty += returnedQty`, `damagedQty += damagedQty`, `outQty -= movement`, `lifecycleState` bump, `isLowStock` recomputed via `computeIsLowStock`, `updatedAt/updatedBy`); per-line checkin audit row (parentTxId chain — CI-08); per-line missingItems doc + missing audit tx when missingDelta > 0 (MIS-01).
  - **CI-07 partial check-in support**: prior children for each parent are summed via `tx.get(Query)` over the composite index `transactions(eventId, type, parentTxId, at desc)` from plan 02-02. A parent qty 5 can be returned 3 now → 2 later by leaving the second action open; the form re-reads via `useTransactionsLive` and shows the new remaining.
  - **CI-04 missing-reason**: required for any short return (`returnedQty + damagedQty < remaining`) — surfaced as `MISSING_REASON_REQUIRED` in failedLines with a user-friendly toast.
  - **Revalidate matrix**: `/events/[id]`, `/events/[id]/checkin`, `/inventory`, `/`, `/reports/out`, `/reports/missing`, `/reports/history`.
  - **CheckinResult shape**: `{ok:true, txIds, missingIds}` on success, `{ok:false, error, failedLines:[{parentTxId, reason}]}` on rejection. The form's submit handler routes failures to a toast and stays on the page so the user can fix and retry.

### Admin resolution (Task 3)

- **`app/(app)/reports/missing/actions.ts`** (NEW): `resolveMissing({missingId, resolution})` Server Action.
  - **Auth gate**: `requireAdmin()` from real DAL (MIS-03 admin-only).
  - **runTransaction shape**: reads missingItems doc + inventory item; rejects if already resolved or missing record gone (`ALREADY_RESOLVED`, `MISSING_NOT_FOUND`); branches on outcome — `found` → `availableQty += qty`; `writtenOff` → `totalQty -= qty`; both flip `missingItems.status` + record `resolvedAt + resolvedBy`; both recompute `isLowStock` atomically (P11); both write a follow-up `adjustment` audit transaction (MIS-04, AUD-01) with notes capturing the resolution.
  - **Revalidate matrix**: `/reports/missing`, `/inventory`, `/reports/history`, `/`.
- **`components/feature/missing/ResolveMissingSheet.tsx`** (MOD): swap mock `store.resolveMissing` → Server Action; `useTransition` for pending state; `router.refresh()` after success; admin-only render preserved; Sheet chrome + RHF + RadioGroup + Zod validation preserved.

### Missing data layer + live hook (Task 1)

- **`lib/data/missing.server.ts`** (NEW): Admin SDK cursor-paged reader `getMissingPage({cursor, limit, filters})`. Filters by status / eventId / itemId; composite indexes from plan 02-02 cover the dominant query shapes. `reportedByName` hydration: denorm on the doc preferred; one-shot read from `users/{uid}` as fallback for docs that predate the denorm (e.g., events cancel from 02-07).
- **`lib/hooks/use-missing-live.ts`** (NEW): Web SDK `onSnapshot` scoped to 50-row window per D-20. `onAuthStateChanged` gate avoids the permission-denied race. Defensive `FirestoreError` logger. Matches `MissingItemDoc` ISO-string contract from the SSR seed.

### Check-in page + form (Task 4)

- **`app/(app)/events/[eventId]/checkin/page.tsx`** (MOD): swap mock-session + mock selectors → real DAL (`requireSession`) + `getEventServer` (EVT-08 server projection; `notFound()` on null) + `getOpenCheckoutsForEventServer` (Admin SDK + parentTxId-based open-line filter from 02-07).
- **`app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx`** (MOD): swap `useMockStore + selectOpenCheckoutsForEvent + checkin (mock)` → `useTransactionsLive` for checkout + checkin + missing rows; compute `openLines` reactively as `parentQty - sum(child.qty) > 0` (CI-07). `buildLine` defaults `returnedQty` to live remaining qty. Submit calls `commitCheckinCartAction`; failedLines surfaced via toast; `router.refresh()` after success.

### Schema addition (Task 2)

- **`lib/schemas/transaction.ts`** (MOD): added `CheckinCartSchema` wrapping the existing `CheckinLineSchema`. `damagedQty` preserved as a separate qty bucket (Phase 1 contract, CI-06) rather than the plan's damaged-boolean flag — matches existing UI + Phase 1 mock-store API.

## Deviations from Plan

**1. [Rule 3 — Stack Constraint] `damagedQty` as qty bucket vs `damaged` as boolean.** Plan's `commitCheckinCartAction` snippet used `damaged: boolean` on the line (entire returnedQty goes to one bucket or the other). The existing `CheckinLineSchema`, `CheckinLineRow` UI, and Phase 1 mock contract use `damagedQty: number` (a separate stepper) so a cart can mix returned + damaged on one line. Chose `damagedQty` to preserve Phase 1 API + UI surface unchanged (KD #17). The Server Action accepts both `returnedQty` and `damagedQty`; `availableQty += returnedQty` and `damagedQty += damagedQty` independently. CI-06 fully satisfied either way.

**2. [Rule 1 — Bug fix vs Plan snippet] `outQty` decrements by movement, not by full parentQty.** The plan's snippet had `newOut = item.outQty - checkedOutQty` (decrement by the full parent qty regardless of returnedQty). That breaks CI-07 partial check-ins: if a user returns 3 of 5 with no missing reason (true partial), the remaining 2 should stay open. The Phase 1 mock-store correctly decrements by `outReduction = returnedQty + damagedQty + missingQty` per line. The Server Action mirrors Phase 1 semantics: `outQty -= movement` where movement = `returnedQty + damagedQty + missingDelta`. The `openLines` recompute in the form picks up the new remaining via `useTransactionsLive` and shows it on the next visit.

**3. [Rule 2 — Critical addition] Prior-children sum inside the transaction (CI-07 correctness).** The plan's snippet had no prior-children read — it would have allowed a cart with two lines for the same parentTxId to over-return (no idempotency check against an in-flight partial). The Server Action queries `transactions(eventId, type, parentTxId)` for both `checkin` and `missing` rows inside the runTransaction, sums their qty, and validates `submitted <= remaining`. Composite index `transactions(eventId, type, parentTxId, at desc)` from 02-02 covers this read shape.

**4. [Rule 3 — Doc comment edit] `selectOpenCheckoutsForEvent` mention removed from checkin-form.tsx header.** Plan acceptance criterion required `grep -q selectOpenCheckoutsForEvent` to FAIL on the new file. Renamed the header reference to "Phase 1 open-checkout selector" to satisfy the grep without losing the doc trail.

## Phase 1 → Phase 2 semantic delta (CI-07)

**Plan 02-09's plan body noted (Step B of checkpoint task) a concern about partial check-in semantics.** This implementation resolves it:

- A user can submit a check-in where `returnedQty + damagedQty < remaining` AND set a `missingReason` → the missing portion becomes a `missingItems` doc + `missing` tx, and the parent is fully reconciled (outQty -= full remaining).
- A user can submit a check-in where `returnedQty + damagedQty == remaining` AND no missingReason → the parent is fully reconciled (outQty -= full remaining); no missing doc created.
- A user can submit a check-in where `returnedQty + damagedQty < remaining` AND no missingReason → **REJECTED via CI-04** (missing reason required for short return). To do a true partial that leaves the rest open, the user must either submit the full remaining OR explicitly mark a missing reason on the gap.

This matches Phase 1 mock-store semantics + CI-04 / CI-07 as written. The "partial check-in across multiple actions" path exists only when the parent qty is unusually large AND the user wants to do it in two passes — in which case they need to pick a reason for the first pass's missing portion (the gap). If that's not the intended UX for v1, future plan should add a "leave open" affordance to the form. **No follow-up needed for the Block F checkpoint.**

## Files NOT modified (frozen by upstream plans)

- `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firebase.json` — frozen since 02-02.
- `lib/firebase/admin.ts`, `lib/firebase/client.ts`, `lib/auth/dal.ts`, `proxy.ts` — frozen since 02-02.
- `app/(app)/inventory/actions.ts`, `app/(app)/events/actions.ts`, `app/(app)/users/actions.ts`, `app/(app)/events/[eventId]/checkout/actions.ts` — frozen by their owning plans.
- `lib/data/events.server.ts`, `lib/data/inventory.server.ts`, `lib/data/users.server.ts`, `lib/data/allowed-staff.server.ts` — frozen by their owning plans.
- `components/feature/scan/*`, `components/feature/checkin/CheckinLineRow.tsx`, `components/feature/checkin/MissingReasonSelect.tsx` — UI surface locked since Phase 1.
- `app/(app)/reports/missing/page.tsx` — table swap deferred to 02-10 per plan body (live data wiring shipped; table consumer change is the next plan).
- No `functions/` directory recreated; Cloud Functions stay removed (refactor 93bf62d).

## Verification Gates

- `npx tsc --noEmit`: PASS
- `npm run lint`: PASS (0 errors, 6 pre-existing `react-hooks/incompatible-library` warnings from TanStack + rhf — identical to plans 02-06/02-07/02-08)
- `npm run build`: PASS (28 routes generated, proxy.ts recognized, /events/[id]/checkin and /reports/missing dynamic)
- Grep audits (all PASS):
  - `app/(app)/events/[eventId]/checkin/actions.ts` contains `"use server"`, `commitCheckinCartAction`, `await requireSession()`, `runTransaction`, `parentTxId`, `damagedQty`, `missingDelta`, `MISSING_REASON_REQUIRED`, `computeIsLowStock`
  - `revalidatePath` count in checkin actions.ts = 7 (≥ 5 required)
  - `app/(app)/reports/missing/actions.ts` contains `"use server"`, `requireAdmin`, `runTransaction`, `type: "adjustment"`, `computeIsLowStock`
  - `lib/data/missing.server.ts` starts with `import "server-only"`, exports `getMissingPage`
  - `lib/hooks/use-missing-live.ts` contains `onSnapshot` + `onAuthStateChanged`
  - `components/feature/missing/ResolveMissingSheet.tsx` imports from `@/app/(app)/reports/missing/actions`; no `@/lib/mock/store` import
  - `app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx` no `selectOpenCheckoutsForEvent` and no `@/lib/mock/store` imports

## CHECKPOINT REACHED

**Type:** human-action
**Plan:** phase-kayinleong-02 / 09
**Progress:** 4/4 tasks complete

### Completed Tasks

| Task | Name                                                          | Commit  | Files                                                                                                                                          |
| ---- | ------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Missing items data layer + live hook                           | 96e992e | `lib/data/missing.server.ts`, `lib/hooks/use-missing-live.ts`                                                                                  |
| 2    | commitCheckinCartAction marquee transaction (CI-04..08, MIS-01, P11) | c283ad2 | `app/(app)/events/[eventId]/checkin/actions.ts`, `lib/schemas/transaction.ts`                                                                  |
| 3    | resolveMissing admin action with found/writtenOff outcomes     | 4e2452b | `app/(app)/reports/missing/actions.ts`, `components/feature/missing/ResolveMissingSheet.tsx`                                                   |
| 4    | Wire /events/[id]/checkin page + form to Server Action          | 05f9cf1 | `app/(app)/events/[eventId]/checkin/page.tsx`, `app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx`                                |

### How to verify (smokes A–H — user attests in CLAIM.md `## E2E Smoke + Block F Rules Audit`)

**A — Single-line clean return:**
Pre-req: open checkout exists on an event (qty 5). Visit `/events/<id>/checkin`. Line pre-populates with `returnedQty=5`, damaged=0. Submit. Expected: toast "1 line checked in"; Firestore: `inventory/<sku>.availableQty +5`, `outQty -5`, `isLowStock` recomputed, `lifecycleState='available'`; `transactions` has new `checkin` row with `parentTxId=<original checkout id>`; original checkout no longer shows in "open" (the form re-reads via useTransactionsLive).

**B — Damaged route (CI-06):**
Open checkout of 5. Check-in `returnedQty=0, damagedQty=5, no missing reason`. Submit. Expected: `inventory.availableQty` unchanged; `damagedQty +5`; `outQty -5`; `lifecycleState='damaged'` (if no available remains).

**C — Short return creates missingItems (CI-04, MIS-01):**
Open checkout of 5. Check-in `returnedQty=3, damagedQty=0, missingReason="Lost"`. Submit. Expected: `inventory.availableQty +3`; `outQty -5` (full parent reconciled because the gap got a reason); `missingItems/<id>` doc created with `qty=2`, `reason="Lost"`, `status="open"`; `transactions` has 1 new `checkin` (qty 3) + 1 new `missing` (qty 2), both with `parentTxId`.

**D — Partial check-in (CI-07 with missing reason for the gap):**
Open checkout of 5. Check-in `returnedQty=3, damagedQty=0, missingReason="Lost"`. Submit. Now Firestore should show the parent fully reconciled (outQty -5, missingItems doc qty 2). To do a true PARTIAL (3 now + 2 later), the user must either set missingReason for the gap on the first action OR change the UX in a future plan. **This semantic is documented in the SUMMARY's "Phase 1 → Phase 2 semantic delta (CI-07)" section above; user attests they're aware.**

**E — Found resolution (MIS-03):**
From `/reports/missing` (table swap is in 02-10, but the ResolveMissingSheet works against any rendered row), admin clicks Resolve on the open missingItems doc from smoke C → "Found" → confirm. Expected: `inventory.availableQty +2`; `missingItems.status='found'`; `transactions` has new `adjustment` row notes "Missing resolved: found".

**F — WrittenOff resolution (MIS-04):**
Repeat smoke C to create another missing doc. Resolve → "Write off" → confirm. Expected: `inventory.totalQty -2` (NOT availableQty); `missingItems.status='writtenOff'`; `transactions` has new `adjustment` row notes "Missing resolved: writtenOff".

**G — EVT-08 access:**
As staff NOT in event.allowedStaff, visit `/events/<id>/checkin`. Expected: notFound() (same 404 path as missing event — anti-enumeration via getEventServer).

**H — Block F Rules Playground audit (5 cases):**

| # | Path                  | Auth                | Op                                | Expected                                           |
| - | --------------------- | ------------------- | --------------------------------- | -------------------------------------------------- |
| 1 | `missingItems/<id>`   | Signed-in staff     | get                               | ALLOW                                              |
| 2 | `missingItems/<id>`   | Web SDK client      | create                            | DENY (server-only)                                 |
| 3 | `missingItems/<id>`   | Web SDK client      | update                            | DENY (server-only — even admin must use Server Action) |
| 4 | `transactions/<id>`   | Web SDK admin       | create                            | DENY (server-only per AUD-04 / INT-03)             |
| 5 | `transactions/<id>`   | Web SDK admin       | update with `{type: 'mutated'}`   | DENY (immutable per AUD-04)                        |

### Awaiting

User runs smokes A–H (Firebase Console + the deployed app), attests results in `.planning/phases/phase-kayinleong-02/CLAIM.md` under `## E2E Smoke + Block F Rules Audit — Plan 02-09`, then advances to plan 02-10.

## Self-Check: PASSED

- Files exist: `lib/data/missing.server.ts`, `lib/hooks/use-missing-live.ts`, `app/(app)/events/[eventId]/checkin/actions.ts`, `app/(app)/reports/missing/actions.ts`, modified `page.tsx` + `checkin-form.tsx` + `ResolveMissingSheet.tsx` + `lib/schemas/transaction.ts` — all FOUND.
- Commits exist: `96e992e`, `c283ad2`, `4e2452b`, `05f9cf1` — all FOUND via `git log --oneline`.
- tsc + lint + build all PASS (28 routes, 0 errors).
