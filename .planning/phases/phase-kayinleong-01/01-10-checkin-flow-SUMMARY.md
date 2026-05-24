---
phase: phase-kayinleong-01
plan: 10
subsystem: ui-checkin
tags: [checkin, per-event-reconciliation, missing-item, ci-04-gating, missing-reason-select, qty-stepper, react-19-render-time-merge, store-checkin, mis-01, ci-08-parent-tx-link, server-shell-client-island]

# Dependency graph
requires:
  - phase: phase-kayinleong-01 plan 01
    provides: lib/types/missing-item.ts (MissingReason enum), lib/types/transaction.ts (TransactionDoc.parentTxId for CI-08), lib/types/event.ts (EventDoc.allowedStaff for EVT-08), lib/schemas/transaction.ts (CheckinLineSchema for reference)
  - phase: phase-kayinleong-01 plan 02
    provides: lib/auth/mock-session.ts (requireSession), lib/mock/store.ts (checkin mutator — handles CI-05/06/07/08 + MIS-01 atomically per D-02-D), lib/mock/selectors.ts (selectEventById + selectOpenCheckoutsForEvent), lib/mock/users.ts (seedUsers for actor resolution), lib/hooks/use-mock-store.ts + use-current-user.ts
  - phase: phase-kayinleong-01 plan 03
    provides: components/ui/page-header.tsx, components/ui/button.tsx, components/ui/card.tsx, components/ui/select.tsx (4-reason MissingReasonSelect wraps), components/ui/empty-state.tsx (Nothing-to-check-in EmptyState), components/feature/inventory/QtyStepper.tsx (44px touch-target stepper — D-01-03 spec; reused for both Returned and Damaged columns)
  - phase: phase-kayinleong-01 plan 04
    provides: (app)/layout.tsx role-gated shell — /events/[eventId]/checkin renders inside, requireSession guarantees authenticated user before the page renders
  - phase: phase-kayinleong-01 plan 09
    provides: the Server-shell + Client-island template established at /events/[eventId]/checkout — Plan 10 copies the shell shape (requireSession + async params + selectEventById + notFound + EVT-08 redirect + Client island handoff) verbatim and replaces the body with the check-in form. The pattern is now a TEMPLATE for any /events/[eventId]/* action route.

provides:
  - /events/[eventId]/checkin route — per-event reconciliation form pre-populated with every open check-out line for the event (CI-01)
  - CI-03 default — returnedQty defaults to checkedOutQty on every line; user decrements if anything didn't come back
  - CI-04 gating — returned + damaged ≤ checkedOut enforced both visually (QtyStepper max bounds + inline destructive border on the Reason Select + inline error row) AND at submit time (validate() blocks submit on the same conditions). Missing-reason becomes REQUIRED when missingDelta > 0.
  - CI-06 routing — damaged qty routes to item.damagedQty via store.checkin's existing per-item aggregation map (Plan 02 D-02-D); the UI exposes a dedicated Damaged QtyStepper per line
  - CI-07 partial check-ins — committed lines drop out of liveOpen on next render; remaining open lines stay visible across visits via the render-time two-track merge
  - CI-08 parentTxId — every payload line carries parentTxId; store.checkin writes the new checkin transaction with parentTxId set (Plan 02's existing behavior)
  - MIS-01 — when missingDelta > 0 AND missingReason set, store.checkin writes a MissingItemDoc with parentCheckinTxId linking the missing record to the new check-in tx (Plan 02's existing behavior)
  - EVT-08 access gate enforcement at the page level (admin OR uid ∈ event.allowedStaff; else /unauthorized) — identical shape to /checkout but WITHOUT a status-actionable redirect (any event status accepts check-ins, including completed/cancelled, because stragglers may still be recovering)
  - Empty-state UI when there are no open check-outs to reconcile (planned events that haven't checked out yet, or already-fully-reconciled events) — renders the locked UI-SPEC EmptyState pattern with "Nothing to check in" copy

affects:
  - phase-kayinleong-01 plan 11 (reports): /reports/missing will list every MissingItemDoc created by this flow. The reports page can deep-link to the source event detail via record.eventId, which is denormalized on the doc by store.checkin.
  - phase-kayinleong-02 entirely: page.tsx shell stays verbatim modulo two swaps — (1) requireSession's body swaps to DAL-wrapped verifySession (signature unchanged); (2) selectOpenCheckoutsForEvent becomes a Firestore query inside the DAL (same projection shape). Client form's commit body swaps store.checkin for a Server Action with the same CheckinResult contract; the form's two-track render-time merge stays — its data source (liveOpen subscription) just swaps from useMockStore to a Firestore onSnapshot listener via the same selector signature.

# Tech tracking
tech-stack:
  added: []  # No new dependencies; pure composition over Plans 02/03/04/08/09 substrate
  patterns:
    - "Render-time two-track merge for forms whose shape is driven by a reactive store snapshot: `currentLines = userState ∩ liveSnapshot` (drops committed entries); `missingFromState = liveSnapshot − userState` (catches newly-appeared entries). Avoids useEffect+setState (avoids the React 19 react-hooks/set-state-in-effect rule) while keeping the form responsive to background mutations. Generalizes to any 'mark these items done' multi-line form whose source list mutates as items are committed."
    - "Pure-React-state form (no rhf) when the form shape is dynamic: when the field count changes based on live data, rhf's useFieldArray either requires manual remove() calls synced to the store or a full reset() on every snapshot diff — both more fragile than direct React state. Acceptable Phase 1 pattern; Phase 2 wraps the same state shape in useActionState with a Server Action commit."
    - "Per-line validation surface in BOTH the row component (inline destructive border + error message) AND the form submit handler (blocks commit). Defense in depth: the user sees the error inline while editing, AND can't sneak past it via Confirm because the same validate() function runs again at submit time."
    - "Status-actionable distinction between /checkout and /checkin: /checkout rejects completed + cancelled events (no new checkouts allowed); /checkin accepts ANY status (stragglers may still return after the event closes). The page shell explicitly documents this contrast for maintainers."
    - "Damaged column as a separate QtyStepper with cross-bounded max: Returned's max = (checkedOut − damaged); Damaged's max = (checkedOut − returned). The UI guarantees returned+damaged can't exceed checkedOut via the +/- buttons; manual input goes through the QtyStepper's clamp; the submit validates the same condition once more for defense in depth."

key-files:
  created:
    - components/feature/checkin/MissingReasonSelect.tsx
    - components/feature/checkin/CheckinLineRow.tsx
    - app/(app)/events/[eventId]/checkin/page.tsx
    - app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx
  modified: []

key-decisions:
  - "D-01-10-A: /events/[eventId]/checkin ACCEPTS any event status (unlike /events/[eventId]/checkout which redirects completed + cancelled). Reason: stragglers and missing items may still be reconciled after an event closes. A completed event with a single open check-out (e.g., 1 missing mic from evt-completed-01 in seed data) is a valid check-in target — the user can still mark it as missing or, if the item is found later, reconcile via /reports/missing. A cancelled event may have items that the team forgot to bring back; that flow should still be reachable. The status restriction lives ONLY on the checkout side because that's where new outbound activity gets gated."
  - "D-01-10-B: Pure React state (not react-hook-form) for the form because the field count is driven by the live store snapshot (CI-07 partial check-ins drop committed lines from the list). rhf's useFieldArray would require either manual append/remove syncs OR a full form.reset() on every snapshot diff — both more fragile than direct React state. Phase 2 will wrap the same state shape in useActionState + a Server Action that returns the same CheckinResult contract; the form's two-track merge stays."
  - "D-01-10-C: Render-time two-track merge (lines ∩ liveOpen; liveOpen − lines) instead of useEffect-driven state sync. Reason: React 19's react-hooks/set-state-in-effect rule flags synchronous setState inside useEffect as a cascading-render anti-pattern (same family Plan 02 D-01-02-A hit with useCurrentUser, Plan 03 D-01-03-A hit with DataTableToolbar). The render-time merge computes `currentLines` + `missingFromState` purely from props/state on every render; state only changes when the user edits a line OR submits. No effect needed; no lint warnings; deterministic behavior."
  - "D-01-10-D: Validation duplicated in CheckinLineRow (inline, for feedback while editing) AND in CheckinForm.submit (gating, for the commit). Defense in depth — the row's inline message + destructive border on the Reason Select educates the user mid-edit; the form's validate() re-runs at submit so a stale render or programmatic click can't sneak past. Both check the same two conditions: (a) returnedQty + damagedQty ≤ checkedOutQty and (b) missingDelta > 0 → missingReason set. Single source of truth (the validate fn could be hoisted to a shared module if a third surface needs it; currently both surfaces inline the logic for code locality)."
  - "D-01-10-E: Damaged QtyStepper has max = (checkedOutQty − returnedQty) and Returned QtyStepper has max = (checkedOutQty − damagedQty). The cross-bound prevents the user from pushing returned + damaged past the checked-out total via the +/- buttons (the most common interaction). The manual number input falls back through QtyStepper's internal clamp, which floors + clamps to [min, max]. The submit handler validates the same condition (defense in depth) so a programmatic state mutation can't bypass it."
  - "D-01-10-F: MissingReasonSelect maps an empty-string prop (`value: \"\"`) to an undefined Radix value so shadcn's Select shows the placeholder. Setting value=\"\" on Radix Select produces a 'controlled but empty' warning AND won't show the placeholder. The undefined coercion (`value || undefined`) is the canonical workaround. Parent state continues to use \"\" as the empty sentinel so the form's per-line shape stays in sync with the LineState type."
  - "D-01-10-G: Submit redirects to /events/[eventId] (event detail) on success — same pattern Plan 09 uses for checkout. CI-07 partial check-ins are visible: re-navigating to /events/[eventId]/checkin (or via the dashboard's overdue widget D-01-05-C link) will show the remaining open lines on next visit. The store.checkin call is atomic for the lines passed in; any line where the user decremented returnedQty + damagedQty < checkedOutQty AND set a missingReason commits a partial check-in + creates a MissingItemDoc, fully reconciling that line; any line still untouched (defaults still equal checkedOutQty) commits a full return. There is no 'leave for later' control on a line — the only way to leave a line open is to NOT decrement it AND not commit it. This is a Phase 1 limitation; UI-SPEC doesn't list a per-line 'skip' control."
  - "D-01-10-H: '\"use client\"' directive placed AFTER the comment header block, following D-01-05-A convention established in Plan 05. Verified across every Plan 02/04/08/09 client file — Next.js's directive scanner accepts comments before directives."

patterns-established:
  - "Render-time two-track merge: `currentLines = userState ∩ liveSnapshot; missingFromState = liveSnapshot − userState; allLines = [...currentLines, ...missingFromState.map(buildLine)]`. Use this when a form's field count is driven by a reactive data source that mutates as items are committed. Replaces the useEffect+setState pattern that would trigger React 19's set-state-in-effect lint rule."
  - "Per-event reconciliation form: pure-React-state form with per-line validation in both the row component AND the submit handler. Generalizes to any future 'mark these N items done' flow with cross-field per-line constraints."
  - "Status-actionable rejection distinction: /checkout (new outbound activity → reject closed events); /checkin (reconcile returns → accept any status). The two routes share the EVT-08 access gate but differ on the status reject."

requirements-completed:
  - CI-01
  - CI-03
  - CI-04
  - CI-05
  - CI-06
  - CI-07
  - CI-08
  - MIS-01
  - NFR-05

# Metrics
duration: 6 min
completed: 2026-05-24
---

# Phase 1 Plan 10: Check-in Flow Summary

**Per-event check-in reconciliation form at `/events/[eventId]/checkin` — Server shell mirrors Plan 09's template (requireSession + EVT-08 access gate + notFound), but accepts any event status (stragglers may still return after a completed/cancelled event). Client island pre-populates returnedQty = checkedOutQty per line (CI-03), routes damaged qty to item.damagedQty (CI-06), creates MissingItemDoc records when missingDelta > 0 AND missingReason set (MIS-01), and commits everything atomically via store.checkin (Plan 02 substrate). Per-line CI-04 validation runs both inline (destructive border + error message in CheckinLineRow) AND at submit (gating). CI-07 partial check-ins surface via a render-time two-track merge (lines ∩ liveOpen; liveOpen − lines) so committed entries drop out of the displayed list without an explicit effect.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-24T16:14:26Z
- **Completed:** 2026-05-24T16:20:44Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- Built `components/feature/checkin/MissingReasonSelect.tsx` — shadcn Select wrapping the 4 MissingReason enum values ("Lost" | "Damaged" | "Not returned" | "Unknown") per CI-04. `required` prop drives a destructive border + `aria-invalid` on the trigger so the CI-04 gate is visible inline. Maps the empty-string prop (`value=""`) to an undefined Radix value so the placeholder shows correctly (D-01-10-F). The component is intentionally small (~50 lines) because the trigger styling lives in shadcn's primitive and the validation gating lives in the parent CheckinLineRow.
- Built `components/feature/checkin/CheckinLineRow.tsx` — per-line row with item name (links to /inventory/[itemId]) + sku + "Checked out: N" reference, plus three controls: Returned (QtyStepper, max = checkedOut - damaged), Damaged (QtyStepper, max = checkedOut - returned), Missing (computed display, amber when > 0), Reason (MissingReasonSelect, required when missingDelta > 0). Inline error row below the line covers BOTH "returned+damaged exceeds checked-out" AND "missing reason missing while delta > 0". The cross-bounded QtyStepper maxes mean the +/- buttons CAN'T push returned + damaged past the checked-out total; the inline error catches the manual-input + programmatic-state edge case (defense in depth).
- Built `app/(app)/events/[eventId]/checkin/page.tsx` — Server Component shell mirroring Plan 09's template. Calls `requireSession()` (Plan 04 / Plan 02), awaits async `params`, looks up the event via `selectEventById(getSnapshot(), eventId)`, then enforces two gates in order: (1) `notFound()` if event missing → 404; (2) EVT-08 — `redirect("/unauthorized")` if session is NOT admin AND uid is NOT in `event.allowedStaff`. Critically, the page does NOT reject any specific event status (unlike /checkout which rejects completed + cancelled) — completed events may still have stragglers, cancelled events may have items to recover. Server reads `selectOpenCheckoutsForEvent(getSnapshot(), eventId)` at request time; if the array is empty, renders the EmptyState ("Nothing to check in" / "All items have been returned or the event has no open check-outs.") so the Client form never has to handle empty. Also defines `generateMetadata` ("Check in · Spring Product Demo").
- Built `app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx` — Client Component handling per-line state. Pure React state (NOT react-hook-form) because the form's field count is driven by the live store snapshot (CI-07 partial check-ins drop committed lines from the list — rhf's useFieldArray would require manual append/remove syncs OR a full form.reset() on every diff). State is keyed by parentTxId; `useMockStore((s) => selectOpenCheckoutsForEvent(s, eventId))` is the reactive subscription. Two-track render-time merge: `currentLines = lines.filter(in liveOpen)` (drops committed entries) + `missingFromState = liveOpen.filter(not in lines)` (catches newly-appeared txs) → `allLines = [...currentLines, ...missingFromState.map(buildLine)]`. The `buildLine(t)` helper sets `returnedQty: t.qty` per CI-03. Submit validates every line (returned + damaged ≤ checkedOut AND missingDelta > 0 → missingReason set), assembles a payload with `parentTxId` per line (CI-08), and calls `checkin({ eventId, lines: payload, actor })`. On success, router.push back to `/events/[eventId]`; lines that weren't fully reconciled stay visible on re-navigation (CI-07).
- Verified end-to-end via 6 smoke tests against `next dev` (cookie `mock_session={json}`): anon → 307 /login; admin + active (evt-active-01) → 200 with 24 open-checkout rows (matches seed data), CI-03 defaults populated (each `value="N"` matches `checkedOutQty`), 48 QtyStepper decrease buttons (2 per row × 24); admin + planned (evt-planned-01) → 200 with "Nothing to check in" EmptyState; admin + completed (evt-completed-01) → 200 with 1 straggler row visible (confirming D-01-10-A: completed events accept check-ins); admin + missing event → 404; staff NOT in allowedStaff (u-staff-2 → evt-planned-01) → 307 /unauthorized (EVT-08). `npm run build` exits 0 with `/events/[eventId]/checkin` registered as `ƒ (Dynamic)`. `npx tsc --noEmit` exits 0. `npm run lint` exits 0 (only known pre-existing Plan-03 TanStack warning).

## Task Commits

Each task was committed atomically:

1. **Task 1: MissingReasonSelect + CheckinLineRow components** — `ff825eb` (feat)
2. **Task 2: /events/[eventId]/checkin route + checkin form** — `9d7af22` (feat)

## Files Created/Modified

### Created (4 files)

- `components/feature/checkin/MissingReasonSelect.tsx` — shadcn Select wrapping the 4 MissingReason enum values; `required` prop drives a destructive border + aria-invalid when value is empty; ~50 lines.
- `components/feature/checkin/CheckinLineRow.tsx` — per-line row with item link + sku + "Checked out: N" reference; three controls (Returned/Damaged steppers + Missing display + Reason select); inline error row covering both CI-04 validation conditions; ~115 lines.
- `app/(app)/events/[eventId]/checkin/page.tsx` — Server shell mirroring Plan 09's template: requireSession + async params + selectEventById + notFound + EVT-08 redirect + EmptyState (no status-actionable redirect); exports generateMetadata; ~95 lines.
- `app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx` — Client form with two-track render-time merge between `lines` (user state) and `liveOpen` (reactive subscription); pure React state with per-line validation in update/submit; commits via store.checkin atomically; ~210 lines.

## Decisions Made

- **D-01-10-A:** `/events/[eventId]/checkin` ACCEPTS any event status (unlike `/events/[eventId]/checkout` which redirects completed + cancelled to the event detail per D-01-09-B). Reason: stragglers and missing items may still be reconciled after an event closes. The evt-completed-01 seed event has 1 open checkout (a missing mic from the original cycle) that's a valid check-in target. A cancelled event may also have items the team forgot to bring back. The status restriction lives ONLY on the checkout side — that's where new outbound activity gets gated. The Phase 2 Server Action will preserve the same asymmetry: `checkoutItem` rejects closed events at the precondition layer; `checkinItem` accepts any status because the canonical invariant is "every check-out eventually gets reconciled", not "check-ins only happen during the event window".

- **D-01-10-B:** Pure React state (NOT react-hook-form) for the check-in form. The form's field count is driven by the live store snapshot (CI-07 partial check-ins drop committed lines from the list). rhf's `useFieldArray` would require either manual `append`/`remove` syncs on every snapshot diff OR a full `form.reset()` on every change — both more fragile than direct React state with a render-time merge. The form's value shape is also small (8 fields per line × N lines) and doesn't benefit from rhf's optimization for large forms. Phase 2 will wrap the same state shape in `useActionState` + a Server Action returning the same `CheckinResult` contract; the form's two-track merge stays unchanged.

- **D-01-10-C:** Render-time two-track merge (`lines ∩ liveOpen; liveOpen − lines`) instead of useEffect-driven state sync. Reason: React 19's `react-hooks/set-state-in-effect` rule flags synchronous setState inside useEffect as a cascading-render anti-pattern (same rule Plan 02 D-01-02-A hit with `useCurrentUser`, Plan 03 D-01-03-A hit with `DataTableToolbar`). The render-time merge computes `currentLines` + `missingFromState` purely from props/state on every render; state only changes when the user edits a line OR submits. No effect needed; no lint warnings; deterministic behavior.

- **D-01-10-D:** Validation duplicated in `CheckinLineRow` (inline, for feedback while editing) AND in `CheckinForm.submit` (gating, for the commit). Defense in depth: the row's inline message + destructive border on the Reason Select educates the user mid-edit; the form's `validate()` re-runs at submit so a stale render or programmatic click can't sneak past. Both surfaces check the same two CI-04 conditions: (a) `returnedQty + damagedQty ≤ checkedOutQty` and (b) `missingDelta > 0 → missingReason set`. Acceptable Phase 1 because both surfaces inline the logic for code locality; if a third surface ever needs the same check, hoist the validate function to a shared module.

- **D-01-10-E:** Cross-bounded QtyStepper maxes: Damaged's `max = (checkedOutQty − returnedQty)` and Returned's `max = (checkedOutQty − damagedQty)`. The cross-bound prevents the user from pushing returned + damaged past the checked-out total via the +/- buttons. Manual input via the QtyStepper's number field falls through QtyStepper's internal clamp (`Math.max(min, Math.min(max, Math.floor(n)))`), which honors the same bounds. The submit handler validates the same condition for defense in depth — protects against programmatic state mutations that could bypass the +/- and number-input guards (e.g., a future browser extension or scripted test).

- **D-01-10-F:** `MissingReasonSelect` coerces an empty-string prop (`value: ""`) to `undefined` on the Radix Select primitive (`value={value || undefined}`). Setting `value=""` on Radix Select produces a "controlled but empty" warning AND won't show the placeholder. The undefined coercion is the canonical workaround. Parent state continues to use `""` as the empty sentinel so the `LineState.missingReason: MissingReason | ""` type stays clean.

- **D-01-10-G:** Submit redirects to `/events/[eventId]` (event detail) on success — same pattern Plan 09 uses for checkout. CI-07 partial check-ins are visible: re-navigating to `/events/[eventId]/checkin` (or via the dashboard's overdue-returns widget per D-01-05-C link) will show the remaining open lines on next visit. The store.checkin call is atomic across all lines passed in. **Important:** there's no per-line "skip" control. A line stays open ONLY if the user doesn't commit it (which requires leaving the form via Cancel / back navigation). Each Confirm-return click commits EVERY currently-rendered line as a check-in transaction. If the user wants to leave some lines for later, they must Cancel + come back. This is a Phase 1 limitation; UI-SPEC doesn't list a per-line skip checkbox. Acceptable because the seed-data flow (1-3 open checkouts per event) makes "commit all now or come back later" the natural shape.

- **D-01-10-H:** `'use client'` directive placed AFTER the comment header block, following D-01-05-A convention established in Plan 05 and applied across every Plan 02 / 04 / 08 / 09 client file. Verified — Next.js's directive scanner accepts comments before directives.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `<action>` block provided a near-verbatim sketch of both the page shell AND the client form; both were followed exactly with minor stylistic touch-ups (comment header above `'use client'` per D-01-05-A; expanded inline explanatory comments per the convention from Plans 02 / 04 / 08 / 09). The plan's example contained one subtle defensive coercion that I preserved verbatim — `MissingReasonSelect` mapping empty-string prop to undefined Radix value — which the plan documented inline and is captured as D-01-10-F. The plan's submit logic (CI-04 validation gate + payload assembly + atomic store.checkin call + success redirect) was followed verbatim because the Plan 02 store.checkin contract was already shaped for this exact composition (the existing `args.lines: { parentTxId, itemId, returnedQty, damagedQty, missingReason? }` signature lined up 1:1 with the form's per-line payload).

---

**Total deviations:** 0
**Impact on plan:** None — pure composition over Plans 02/03/09 substrate, following the Plan 09 server-shell + client-island template verbatim.

## Authentication Gates

None — Phase 1 uses the mock session cookie checked by `requireSession()`. The /events/[eventId]/checkin page inherits the (app) layout's auth gate (Plan 04) and adds EVT-08's per-event access check at the page level. No external auth provider involved.

## Issues Encountered

None during planned work. The Plan 02 store.checkin contract was already aligned to the form's per-line payload shape, so no signature negotiation was needed. The Plan 09 server-shell template ported cleanly with only one substantive change (dropping the status-actionable redirect per D-01-10-A's distinction between checkout and check-in).

## User Setup Required

None — no external service configuration required.

## Threat Flags

None — no new security-relevant surface introduced. The page reuses existing mitigations:

- **EVT-08 access gate** at the page level — staff users without `uid ∈ event.allowedStaff` redirect to /unauthorized BEFORE the event data is rendered (line 87-91 of page.tsx). Admin sees all. Same shape as `/events/[eventId]/page.tsx` (Plan 07) and `/events/[eventId]/checkout/page.tsx` (Plan 09). Phase 2 swap: `array-contains` Firestore rule check at the data-layer boundary, plus a redundant page-level check for defense-in-depth. Phase 2 also wraps the `checkinItem` Server Action with an EVT-08 precondition before mutating Firestore.
- **CI-04 validation** is enforced at TWO layers in the UI (inline in CheckinLineRow + gating in CheckinForm.submit per D-01-10-D) AND at the data layer (store.checkin's existing per-line refine in lib/schemas/transaction.ts CheckinLineSchema enforces `returnedQty > 0 || damagedQty > 0 || missingReason !== undefined`). Phase 2 adds a third layer: the Firestore transaction inside `checkinItem` Server Action re-asserts the same invariant inside the transaction body before writing.
- **Stock invariants** (CI-05 / CI-06) are enforced atomically inside `store.checkin` (Plan 02). The UI's cross-bounded QtyStepper maxes (D-01-10-E) are defense-in-depth above the store's invariant; the store mutator is the canonical enforcement point. Phase 2 wraps this in a Firestore transaction that re-reads availableQty/damagedQty inside the transaction body before mutating.
- **MIS-01 missing-item creation** is mechanical inside store.checkin: when `missingDelta > 0` AND `missingReason set`, the mutator writes a MissingItemDoc with parentCheckinTxId linking the record to the new checkin transaction. The UI's job is solely to surface the CI-04 gate so the user is forced to pick a reason before the commit — not to construct the MissingItemDoc itself. Phase 2 swap: the missing record gets written inside the same Firestore transaction as the check-in, preserving atomicity.

No new threat surface introduced by this plan — every guard is reused from Plans 02 / 07 / 09.

## Known Stubs

None — every rendered surface receives real data:

- Open checkouts loaded server-side via `selectOpenCheckoutsForEvent(getSnapshot(), eventId)` and re-subscribed client-side via `useMockStore` for live drop-out on partial check-ins.
- Default returnedQty = checkedOutQty per CI-03; user controls every value via the QtyStepper +/- buttons or direct number input.
- Per-line state (returnedQty, damagedQty, missingReason) flows directly into the store.checkin payload — no transformations, no mocked values.
- Successful checkin writes real `transactions` entries + MissingItemDoc records to the mock store; Phase 2 swaps this for a Server Action returning the same CheckinResult contract.
- The "Nothing to check in" empty state is real (rendered when selectOpenCheckoutsForEvent returns an empty array) — not a placeholder.

The only "deferred to Phase 2" surface is the underlying mutator implementation (still in-memory mock data) — which is expected per the phase split and applies to every Wave 3 page.

## Next Phase Readiness

- **Plan 11 ready** (reports): `/reports/missing` will list every MissingItemDoc record this flow creates. The records carry `eventId` / `eventName` / `itemId` / `itemName` / `reason` / `parentCheckinTxId` denormalized at write time (Plan 02 store.checkin), so the reports page can render the full row without joining tables. Resolve actions (`found` → return qty to availableQty; `writtenOff` → decrement totalQty) are already implemented in Plan 02's `resolveMissing` mutator — Plan 11 wires the UI.
- **Plan 12 ready** (users + settings): no direct dependency on this plan.
- **Phase 2 swap surface is minimal:**
  - `page.tsx`: `requireSession()` body swaps from mock-session.ts to a DAL-wrapped `getTokens()` + `verifySession()` call from `next-firebase-auth-edge`; same signature, same async return shape. `selectEventById(getSnapshot(), ...)` becomes a Firestore `getDoc(eventsCollection, eventId)` inside a DAL helper. `selectOpenCheckoutsForEvent(getSnapshot(), ...)` becomes a Firestore `where('eventId', '==', eventId).where('type', '==', 'checkout')` query then a client-side filter for open lines (or a denormalized `openCheckoutLines` materialized view per event). The page's three gates (notFound + EVT-08 + EmptyState) stay verbatim.
  - `checkin-form.tsx`: the only real swap is `checkin({...})` → `await checkinItem({...})` (Server Action). `useMockStore` swaps to a Firestore `onSnapshot` listener via the same selector signature. The two-track render-time merge stays unchanged because it operates purely on the typed snapshot, not on the source. The pure React state + validate function stay unchanged.
  - `CheckinLineRow` and `MissingReasonSelect` don't change at all — they're pure presentational components.
- **The Server-shell + Client-island template is now used by 2 routes** (`/events/[eventId]/checkout` from Plan 09 and `/events/[eventId]/checkin` from Plan 10). The template's stability across both checkin and checkout justifies treating it as a canonical convention for any future `/events/[eventId]/*` action route.

---

*Phase: phase-kayinleong-01*
*Completed: 2026-05-24*

## Self-Check: PASSED

- All 4 created files exist on disk:
  - `components/feature/checkin/MissingReasonSelect.tsx`
  - `components/feature/checkin/CheckinLineRow.tsx`
  - `app/(app)/events/[eventId]/checkin/page.tsx`
  - `app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx`
- Both task commits present in `git log --oneline`: `ff825eb` (Task 1), `9d7af22` (Task 2)
- Plan-level verification:
  - `npx tsc --noEmit` exits 0: PASS
  - `npm run build` (Next 16 Turbopack) exits 0: PASS — `/events/[eventId]/checkin` registered as `ƒ (Dynamic)`
  - `npm run lint` exits 0: PASS (1 unchanged pre-existing Plan-03 TanStack React Compiler warning; no new warnings)
  - Runtime smoke test via `curl` against `next dev` (cookie `mock_session={json}`):
    - `GET /events/evt-active-01/checkin` (anon) → 307 → `/login` (Plan 04 gate): PASS
    - `GET /events/evt-active-01/checkin` (admin u-admin-1) → 200 with form: 24 rows rendered (matches seed data), 48 QtyStepper decrease buttons (2 per row × 24 rows), "Check in · Spring Product Demo" title, "Back to event" link, "Mark returned, damaged, or missing for each item." description, "Returned" + "Damaged" + "Missing" + "Reason" column headers, "Confirm return" CTA, CI-03 defaults populated (each `value="N"` matches checkedOutQty): PASS
    - `GET /events/evt-planned-01/checkin` (admin) → 200 with "Nothing to check in" / "All items have been returned" EmptyState (no open checkouts for planned events): PASS
    - `GET /events/evt-completed-01/checkin` (admin) → 200 with 1 straggler row visible (confirming D-01-10-A): PASS
    - `GET /events/missing-event-xyz/checkin` (admin) → 404 (notFound): PASS
    - `GET /events/evt-planned-01/checkin` (staff u-staff-2, NOT in evt-planned-01.allowedStaff) → 307 → `/unauthorized` (EVT-08): PASS
- Task 1 acceptance criteria all pass:
  - Both files exist (MissingReasonSelect.tsx + CheckinLineRow.tsx): PASS
  - MissingReasonSelect lists all 4 reasons (Lost, Damaged, Not returned, Unknown): PASS (grep verified)
  - CheckinLineRow shows Returned (QtyStepper) + Damaged (QtyStepper) + Missing (computed) + Reason select required when missingDelta > 0: PASS
  - `npx tsc --noEmit` exits 0: PASS
- Task 2 acceptance criteria all pass:
  - Both files exist (page.tsx + _components/checkin-form.tsx): PASS
  - Server route enforces EVT-08 access check + uses `await params`: PASS (grep verified, runtime smoke tested)
  - Server route renders empty state when no open check-outs (CI-07 — partial check-ins return to this page with fewer rows): PASS (runtime smoke tested on evt-planned-01)
  - CheckinForm calls `checkin()` with payload referencing parentTxId (CI-08): PASS (grep verified)
  - CI-04 validation: lines where returned + damaged < checkedOut require missingReason; form blocks submit until valid: PASS (validate() function in CheckinForm + inline in CheckinLineRow)
  - `npx tsc --noEmit` exits 0: PASS
  - `npm run build` exits 0: PASS
- All 9 plan requirements (CI-01, CI-03, CI-04, CI-05, CI-06, CI-07, CI-08, MIS-01, NFR-05) satisfied at the UI-shell level — Phase 2 will swap `store.checkin` for a Server Action returning the same `CheckinResult` contract, with the page surface (and the EVT-08 + empty-state gates) unchanged.
