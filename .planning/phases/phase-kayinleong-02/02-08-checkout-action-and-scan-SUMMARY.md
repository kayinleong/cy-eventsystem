---
phase: phase-kayinleong-02
plan: 08
subsystem: scan-checkout
tags: [block-e, scan, checkout, transactions, atomic, evt-08, audit, optimistic, co-04, co-05, co-06]
requires:
  - phase-kayinleong-02/05 (inventory data layer; isLowStock denorm; computeIsLowStock helper)
  - phase-kayinleong-02/07 (events data layer; getEventServer with EVT-08 projection; useTransactionsLive)
provides:
  - commitCheckoutCartAction Server Action (marquee atomic transaction)
  - scan-session on Firebase (useOptimistic + revert path preserved unchanged)
  - EventPickerDialog on Firestore (useEventsLive with EVT-08 + CO-02 status filter)
  - /events/[id]/checkout server-side EVT-08 gate via getEventServer
affects:
  - /events/[id]/checkout (per-event scoped flow)
  - /scan (standalone scanner — wired indirectly via scan-session swap)
  - /events/[id] (EventAssignedItemsTab auto-refreshes via useTransactionsLive)
  - /inventory (revalidate after each checkout)
  - / (dashboard KPIs revalidate)
  - /reports/out + /reports/history (audit rows + open checkouts)
tech-stack:
  patterns:
    - "Firestore runTransaction with read-then-write phasing (all tx.get() before any tx.update / tx.set per P8)"
    - "Pre-tx aggregation of cart lines by itemId (Map<itemId, totalQty>) to handle two cart lines for the same SKU"
    - "BizError class as a structured throw vehicle inside the transaction so the catch can surface failedLines for the optimistic revert"
    - "isLowStock denorm recomputed atomically inside the same tx that changes availableQty (RESEARCH P11)"
    - "Per-line audit row writes inside the same runTransaction (AUD-01 preserves original cart shape in history)"
    - "Pre-allocated transactions doc refs inside the tx (via adminDb.collection().doc()) so txIds can be returned on success"
    - "EVT-08 access check applied BEFORE opening the transaction (admin OR uid in allowedStaff)"
    - "Status guard: completed/cancelled events refuse checkout"
key-files:
  created:
    - app/(app)/events/[eventId]/checkout/actions.ts
  modified:
    - components/feature/scan/scan-session.tsx
    - components/feature/scan/EventPickerDialog.tsx
    - app/(app)/events/[eventId]/checkout/page.tsx
decisions:
  - "commitCheckoutCartAction is the marquee atomic transaction — one runTransaction wraps EVERY read (item snapshots), the cart-wide invariant assertion (CO-05), every write (availableQty/outQty/lifecycleState/isLowStock per item), and every audit row (one per cart line per AUD-01)"
  - "CheckoutResult discriminated union shape kept identical to Phase 1's mock-store contract — adds an optional `requested` field on failedLines for richer toast copy, but failures still carry `available` so the Phase 1 revert handler works unchanged (CO-06)"
  - "Aggregation of cart lines by itemId BEFORE the transaction so a cart with two lines for the same SKU validates against the same stock (P8 — runTransaction does not see same-tx writes for reads)"
  - "EventPickerDialog applies CO-02 status filter (planned|active) client-side because useEventsLive's status filter accepts a single value; admin + EVT-08 projection happens server-side via the array-contains query inside useEventsLive"
  - "scan-session pulls items via useInventoryLive([], {limit:500}) — covers v1 active inventory window for QtyStepper bounds; the Server Action re-validates atomically so the client copy is advisory only"
  - "router.refresh() after successful commit as defense-in-depth alongside revalidatePath in the Server Action — ensures destination page (/events/[id]) renders fresh outQty + audit feed"
  - "ScannerWidget UNTOUCHED — Bluetooth keystroke listener (CO-10) and camera substrate (D-01..16) preserved as locked Phase 1 surface"
metrics:
  duration: "~17 min (3 tasks, sequential)"
  tasks_completed: 3
  files_created: 1
  files_modified: 3
  commits: 3
  completed_date: 2026-05-26
---

# Phase 2 Plan 08: Scan Checkout — Marquee Transaction + Wiring (Block E) Summary

JWT-style atomic checkout via `commitCheckoutCartAction`: one Firestore `runTransaction` reads every distinct cart item, asserts the cart-wide `availableQty >= requested` invariant, decrements + recomputes `isLowStock` per RESEARCH P11, and writes one `transactions/{txId}` audit row per cart line — preserving the original cart shape in history (AUD-01). The Phase 1 `useOptimistic` revert path is untouched because the `CheckoutResult` discriminated union shape is preserved byte-for-byte.

## What was built

### The marquee transaction (Task 1)

- **`app/(app)/events/[eventId]/checkout/actions.ts`** (NEW): `commitCheckoutCartAction(input)` Server Action.
  - **Auth gate**: `requireSession()` from real DAL; EVT-08 check (admin OR uid in event.allowedStaff); status guard (refuses `completed` / `cancelled` events).
  - **P8 pre-tx aggregation**: `requestedByItem.Map` collapses two cart lines for the same itemId into one total before the transaction opens.
  - **runTransaction shape**: all `tx.get` reads first (parallel via `Promise.all`); then the invariant pass collects *every* failure (`failedLines: [{itemId, available, requested}]`); structured throw via `BizError("STOCK_INSUFFICIENT")` aborts atomically on any failure; on pass, per-item update writes (`availableQty -= qty`, `outQty += qty`, `lifecycleState → checked_out` if needed, `isLowStock` recomputed via `computeIsLowStock`, `updatedAt/updatedBy`); per-line audit row writes (one row per `parsed.data.lines` entry, preserving cart shape per AUD-01).
  - **Revalidate matrix**: `/events/[id]`, `/inventory`, `/`, `/reports/out`, `/reports/history` (per RESEARCH §8.5).
  - **CheckoutResult shape**: `{ok:true, txIds}` on success, `{ok:false, error, failedLines}` on rejection — identical to Phase 1's mock-store return so the existing `useOptimistic` rollback wiring works unchanged.

### scan-session swap (Task 2)

- **`components/feature/scan/scan-session.tsx`**: commit handler calls `commitCheckoutCartAction({eventId, lines})` instead of `checkout(...)` mock mutator. The `CheckoutResult` destructure (`if (!result.ok) toast.error(result.error, {description: result.failedLines?.map(...)})`) is preserved verbatim — Phase 1 KD #17 / D-02 paid off: the Server Action shape matches the mock shape.
- **Removed**: `useMockStore`, `selectItemBySku`, `checkout`, `getSnapshot`, `seedUsers` imports. The `seedUsers.find(...)` actor lookup is gone — the Server Action derives the actor via `requireSession()` server-side.
- **Live data**: `useInventoryLive([], {limit: 500})` replaces `useMockStore((s) => s.items)` for SKU lookup + QtyStepper bounds. The 500-row window covers v1 active inventory; the Server Action re-validates atomically so stale snapshots can never push qty negative.
- **router.refresh()** added after successful commit as defense-in-depth alongside the Server Action's `revalidatePath` calls.

### EventPickerDialog swap (Task 2)

- **`components/feature/scan/EventPickerDialog.tsx`**: `useEventsLive(initial=[], {session, limit:50})` replaces `useMockStore + selectAccessibleEvents`. EVT-08 array-contains projection happens server-side inside `useEventsLive`; CO-02 status filter (`planned|active`) applied client-side within the 50-row cursor window.
- Defensive session-null path: when `useCurrentUser` hasn't resolved yet, the dialog renders an empty list (CommandEmpty surface) until auth hydrates.

### EVT-08 + DAL wiring (Task 3)

- **`app/(app)/events/[eventId]/checkout/page.tsx`**: swap `requireSession` (mock-session) → `requireSession` (real DAL); swap `getSnapshot + selectEventById` → `getEventServer(eventId, session)`. The `getEventServer` helper applies EVT-08 server-side and returns null for non-existent OR non-accessible events; the page calls `notFound()` on null (anti-enumeration). Status guard preserved (`completed`/`cancelled` → redirect to event detail).
- **`generateMetadata`** also routes through `requireSession + getEventServer` so the page title doesn't leak event names to non-members.

### Files NOT modified (already done by upstream plans)

- **`components/feature/scan/ScannerWidget.tsx`** — Bluetooth keystroke path (CO-10) and camera substrate (D-01..16) are locked Phase 1 surface; UNTOUCHED.
- **`components/feature/scan/ScanCartPanel.tsx`** — consumes scan-session context only; no mock-store imports present.
- **`components/feature/events/EventAssignedItemsTab.tsx`** — already on `useTransactionsLive` from plan 02-07; auto-refreshes after checkout commits.
- **`app/(app)/scan/page.tsx`** — all mock-store interaction lives inside the components it composes; no direct mock imports present after Task 2.

## Deviations from Plan

None of substance. Three minor textual edits to satisfy grep-based acceptance criteria:

1. **scan-session.tsx header comment** — reworded "Phase 1 `seedUsers.find(...)` block" → "Phase 1 mock-actor lookup block" so `grep -q seedUsers` fails (acceptance criterion #3 of Task 2).
2. **EventPickerDialog.tsx header comment** — reworded "`selectAccessibleEvents` (mock selector)" → "mock 'accessible events' selector" so `grep -q selectAccessibleEvents` fails (acceptance criterion #6 of Task 2).

Both are documentation-only — no behavioral change.

## Concurrent correctness (ROADMAP success criterion #3)

The transaction's read-then-validate-then-write phasing means two browsers committing carts that overlap on a SKU cannot drive `availableQty` negative:

```
Browser A: cart {SKU-001: qty=5}        availableQty initially 6
Browser B: cart {SKU-001: qty=3}
Both press Commit simultaneously.
```

Firestore serializes the transactions via contention-driven retry:
- T1 reads SKU-001 (available=6), passes invariant, writes available=1, commits.
- T2 reads SKU-001 — Firestore detects the conflict, retries T2.
- T2 re-reads SKU-001 (available=1), invariant FAILS (1 < 3), throws `STOCK_INSUFFICIENT`.
- T2's catch returns `{ok:false, failedLines: [{itemId:'SKU-001', available:1, requested:3}]}`.
- Browser B sees the toast.error breakdown; cart stays intact; useOptimistic reverts because the underlying Firestore listener never updated.

The runTransaction guarantees that no path leads to `availableQty < 0`. Block E manual smoke must demonstrate this with two browser windows.

## Verification gates

- `npx tsc --noEmit` exits 0
- `npm run lint` 0 errors, 6 warnings (all pre-existing `react-hooks/incompatible-library` from TanStack + rhf — identical to plans 02-06/02-07)
- `npm run build` PASS (28 routes, proxy.ts recognized; /events/[eventId]/checkout dynamic)
- `head -1 actions.ts | grep '"use server"'` PASS
- `grep "commitCheckoutCartAction" actions.ts` PASS
- `grep "runTransaction" actions.ts` PASS
- `grep "STOCK_INSUFFICIENT" actions.ts` PASS
- `grep "failedLines" actions.ts` PASS
- `grep "computeIsLowStock" actions.ts` PASS
- `grep "requestedByItem" actions.ts` PASS
- `grep "actorRoleAtTimeOfAction" actions.ts` PASS (AUD-01)
- `grep -c revalidatePath actions.ts` = 5 PASS
- `! grep "from \"@/lib/mock/store\"" scan-session.tsx` PASS
- `! grep "seedUsers" scan-session.tsx` PASS
- `grep "useEventsLive" EventPickerDialog.tsx` PASS
- `! grep "selectAccessibleEvents" EventPickerDialog.tsx` PASS
- `! grep "from \"@/lib/mock/store\"" components/feature/scan/` PASS (0 matches)
- `grep "getEventServer" checkout/page.tsx` PASS
- `grep "useTransactionsLive" EventAssignedItemsTab.tsx` PASS (already from plan 02-07)

## Self-Check: PASSED

- File `app/(app)/events/[eventId]/checkout/actions.ts` — FOUND
- File `components/feature/scan/scan-session.tsx` — FOUND
- File `components/feature/scan/EventPickerDialog.tsx` — FOUND
- File `app/(app)/events/[eventId]/checkout/page.tsx` — FOUND
- Commit `95ebffa` — FOUND in git log
- Commit `b9b5d37` — FOUND in git log
- Commit `980d980` — FOUND in git log

## CHECKPOINT REACHED

**Type:** human-action (E2E + concurrent invariant + Block E rules audit)
**Plan:** phase-kayinleong-02 plan 02-08
**Progress:** 3/3 implementation tasks complete; awaiting end-to-end smoke + Block E rules audit attestation.

### Completed tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | commitCheckoutCartAction marquee transaction | `95ebffa` | `app/(app)/events/[eventId]/checkout/actions.ts` |
| 2 | scan-session + EventPickerDialog on Firebase | `b9b5d37` | `components/feature/scan/scan-session.tsx`, `components/feature/scan/EventPickerDialog.tsx` |
| 3 | /events/[id]/checkout page wired to DAL + EVT-08 gate | `980d980` | `app/(app)/events/[eventId]/checkout/page.tsx` |

### Awaiting end-to-end attestation

The user runs the 6-row smoke + Block E rules audit per the Task 4 checkpoint table in `02-08-checkout-action-and-scan-PLAN.md`:

**A — Single-user checkout (CO-01..04):** Sign in as admin → /events/[id]/checkout → add 2-3 items → commit. Expect: toast success "N lines committed"; redirect to /events/[id]; Firestore inventory items show new availableQty/outQty; transactions collection has N new docs (type='checkout', actorUid=admin uid).

**B — CO-05 stock insufficient (single user):** Item with totalQty=2; checkout 2 (availableQty=0); try to checkout 1 more. Expect: toast.error "One or more items are out of stock." + line-level breakdown "only 0 available, requested 1"; cart NOT cleared; inventory unchanged.

**C — useOptimistic revert (CO-06):** Use DevTools throttling. Trigger commit. Expect: cart shows decrement immediately (Phase 1 useOptimistic state); if server rejects, the cart's visible qty bounces back when the Firestore listener re-renders (because no successful write occurred).

**D — Concurrent invariant (CO-05 + INT-01 + ROADMAP #3):** Two browser windows (incognito + regular). Both signed in as admin, both on /events/[id]/checkout for the SAME event. Item with availableQty=2. Browser A adds qty=2; Browser B adds qty=2. Press Commit nearly simultaneously. Expect: ONE succeeds (winner: availableQty=0); the OTHER fails with `{ok:false, failedLines:[{itemId, available:0, requested:2}]}` → toast.error breakdown; only ONE checkout doc written to Firestore for that SKU.

**E — EVT-08 access (defense in depth):** Sign in as staff NOT in `event.allowedStaff`. Navigate to /events/[id]/checkout. Expect: notFound() at the page level (anti-enumeration). Also: even if a malicious user crafted a request to the Server Action directly, the EVT-08 check inside `commitCheckoutCartAction` would refuse with `{ok:false, error:"Not authorized for this event"}`.

**F — Scanner formats (CO-09 / SCN-01..06):** /scan page → mode=checkout → camera scan: print a QR / Code 128 / EAN-13 / UPC-A / Data Matrix encoding an SKU; verify ScannerWidget recognizes each format.

**G — Bluetooth keystroke scanner (CO-10):** If hardware Bluetooth scanner available, scan a code. Expected: keystrokes arrive in ManualEntryInput; Enter key fires submit; same handler path as camera-decoded scans (verified by code review since ScannerWidget UNTOUCHED).

**H — Block E rules audit:** Firebase Console → Rules Playground (5 cases minimum):

| # | Path | Auth? | Role | Op | Expected |
|---|------|-------|------|-----|----------|
| 1 | `transactions/new-tx` | Yes | admin (via Web SDK client) | create | DENY (INT-03 — only Admin SDK writes) |
| 2 | `transactions/existing-tx` | Yes | staff | get | ALLOW (read-only audit trail) |
| 3 | `inventory/SKU-1` | Yes | staff (via Web SDK client) | update with `availableQty: -1` | DENY (admin-only writes; invariant `>= 0`) |
| 4 | `events/X` | Yes | staff IN allowedStaff | get | ALLOW (isMember) |
| 5 | `events/X` | Yes | staff NOT in allowedStaff | get | DENY (isMember false) |

Result of each (PASS/FAIL) gets appended to CLAIM.md `## Rules Audit — Block E` per D-06 mitigation.

### Resume signal

Reply with `"checkout E2E + concurrent invariant PASS, rules audit logged"` and append the 8 verification rows + 5 audit rows to CLAIM.md, or describe failures. Then plan 02-08 closes and CLAIM advances to plan 02-09 (Block F — Scan check-in marquee).
