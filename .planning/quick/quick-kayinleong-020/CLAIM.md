# Claim: quick-kayinleong-020
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-11
- status: done
- summary: Fix broken pagination across all list pages (Next does not advance page) and investigate excessive Firestore reads

## Call-site audit

Re-ran the caller grep fresh (Task 1). All live-hook call sites classified below.

```
grep -rn "useInventoryLive\|useEventsLive\|useTransactionsLive" --include="*.ts" --include="*.tsx" .
```

### CHANGE — the six LIST TABLES (Task 2 fixes these)

| File:line | Call | Route |
|-----------|------|-------|
| components/feature/inventory/InventoryTable.tsx:99 | `useInventoryLive(initialItems)` | /inventory |
| components/feature/events/EventsTable.tsx:106 | `useEventsLive(initialEvents, {session, status})` | /events |
| components/feature/reports/StockReportTable.tsx:90 | `useInventoryLive(initialItems)` | /reports/stock |
| components/feature/reports/RepurchaseTable.tsx:70 | `useInventoryLive(initial, {isLowStock, limit})` | /reports/repurchase |
| components/feature/reports/HistoryTable.tsx:103 | `useTransactionsLive({...liveFilter, limit, initial})` | /reports/history |
| components/feature/reports/ItemsOutTable.tsx:70,76 | TWO `useTransactionsLive` (checkout seed + checkin derive) | /reports/out |

### LEAVE UNTOUCHED — non-list callers (legitimately want live data) + the shared hook bodies + /users

| File:line | Call | Why it stays live |
|-----------|------|-------------------|
| components/feature/scan/scan-session.tsx:301 | `useInventoryLive([], {limit:500})` | checkout stock guard |
| components/feature/scan/LocationPanel.tsx:66 | `useInventoryLive([], {limit:500})` | scan location preview |
| components/layout/Nav.tsx:27 | `useInventoryLive([], {isLowStock, limit})` | low-stock nav badge |
| components/feature/settings/LowStockThresholdsCard.tsx:49 | `useInventoryLive([])` | settings threshold list |
| components/feature/dashboard/LowStockWidget.tsx:42 | `useInventoryLive(initialItems, {isLowStock, limit})` | dashboard widget |
| components/feature/dashboard/ActiveEventsWidget.tsx:37 | `useEventsLive(initial, {...})` | dashboard widget |
| components/feature/dashboard/OverdueReturnsWidget.tsx:79 | `useEventsLive(initial, {...})` | dashboard widget |
| components/feature/dashboard/RecentActivityFeed.tsx:49 | `useTransactionsLive({limit:20})` | dashboard feed |
| components/feature/scan/EventPickerDialog.tsx:56 | `useEventsLive(...)` | scan event picker |
| components/feature/inventory/ItemHistoryTab.tsx:49 | `useTransactionsLive({itemId, limit:50})` | item detail tab |
| components/feature/events/EventAssignedItemsTab.tsx:99 | `useTransactionsLive({eventId, limit:100})` | event detail tab |
| components/feature/events/EventHistoryTab.tsx:47 | `useTransactionsLive({eventId, limit:100})` | event detail tab |
| components/feature/events/CancelEventDialog.tsx:73 | `useTransactionsLive({eventId, limit:100})` | event flow dialog |
| components/feature/delivery-orders/DOHistoryTab.tsx:41 | `useTransactionsLive({deliveryOrderId, limit:100})` | DO detail tab |
| app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx:102,108,113 | 3 × `useTransactionsLive` | CI-07 live re-read |
| components/feature/users/UsersTable.tsx:50 + lib/hooks/use-users-live.ts | `useUsersLive(initialUsers)` | **reference impl — DO NOT TOUCH** |

(The remaining grep hits in `app/(app)/page.tsx`, `app/(app)/inventory/[itemId]/page.tsx`, `app/(app)/events/[eventId]/checkin/page.tsx`, `app/(app)/reports/{history,stock}/page.tsx`, and `lib/hooks/use-missing-live.ts` are comments only — no live-hook invocations.)

### Chosen technique (confirmed)

The six list tables will simply NOT consume the live array — they render the SSR `initial*` prop directly (mirroring `useUsersLive` at use-users-live.ts:29-31, which returns `initial`). This requires **NO change** to `useInventoryLive` / `useEventsLive` / `useTransactionsLive` bodies — the imports just get removed from the six list components. The four shared hook files (`use-inventory-live.ts`, `use-events-live.ts`, `use-transactions-live.ts`, `use-users-live.ts`) MUST be byte-identical after the change.

### EVT-08 SSR proof

Confirmed `getEventsPage` (lib/data/events.server.ts) enforces staff scoping at the SSR layer **before** the listener is dropped:

```
lib/data/events.server.ts:110-111
  if (opts.session.role !== "admin") {
    q = q.where("allowedStaff", "array-contains", opts.session.uid);
  }
```

Dropping the client-side `useEventsLive` listener from EventsTable does NOT weaken EVT-08 — the SSR seed is already staff-scoped, and `getEventServer` (events.server.ts:156-159) applies the same check on detail reads.

### ItemsOutTable open-only flag

Confirmed `getTransactionsPage({filters:{type:"checkout"}})` (transactions.server.ts:108-147) seeds RAW checkout transactions — it does NOT subtract checkins. Today ItemsOutTable derives open-only by subtracting the `checkinsLive` listener (ItemsOutTable.tsx:82-90). Therefore rendering `initialCheckouts` raw would REGRESS by resurrecting already-returned checkouts. **ItemsOutTable is the one table needing a paired server-side adjustment** in /reports/out/page.tsx (covered in Task 2, EDIT C).

## What changed

Commit `db2029a` — 8 files, code only (Option B from RESEARCH.md):

**The six list tables** (`InventoryTable`, `EventsTable`, `StockReportTable`, `RepurchaseTable`, `HistoryTable`, `ItemsOutTable`):
- Removed the live-hook import + consumption; each now renders its SSR `initial*` prop directly via the existing `useMemo` (stable TanStack identity preserved). EventsTable keeps the `session` prop (`void session;` — EVT-08 contract / prop shape) but no longer reads it client-side. HistoryTable's now-dead `liveFilter` useMemo was removed.
- Next is now `<Button asChild><Link href=…>` built from the current `useSearchParams()` params with `cursor` set (preserves active filter/sort/search — REP-06). When `nextCursor` is null, a disabled Next button renders. `goNext`/`setCursor` removed (`setCursor` was only used by `goNext`). Prev unchanged (`router.back()`, `disabled={!url.cursor}`).
- Stale Phase-2 header comments that described the dropped live hook were updated to match the code (Documentation Gate).

**`/reports/out` open-only derivation** (the one table needing a paired server edit):
- Chose the page-level `in`-clause subtraction approach (smallest surface; reuses the exact set-logic the client previously used). New server helper `getOpenCheckoutIdsForCheckouts(checkoutIds)` in `lib/data/transactions.server.ts` queries `transactions where type==checkin and parentTxId in [chunk]` (chunked at Firestore's 30-id `in` limit), returning the set of CLOSED checkout ids. `app/(app)/reports/out/page.tsx` subtracts that set from the checkout cursor page and passes the open-only array as `initialCheckouts`; `nextCursor` stays the checkout page cursor. `ItemsOutTable` dropped both `useTransactionsLive` calls + the listener-based open derivation; it renders the (already open-only) seed.
- This requires a new composite query on `transactions(type, parentTxId)`. The pre-declared index `transactions(eventId, type, parentTxId, at desc)` does not cover a `type ==` + `parentTxId in` query without an `eventId` equality. **Possible follow-up: a Firestore index may be required** — to be confirmed during human verification (Firestore will surface a "create index" error link if so). Flagged in SUMMARY.

**Scope guardrails verified (git diff):**
- `lib/hooks/use-inventory-live.ts`, `use-events-live.ts`, `use-transactions-live.ts`, `use-users-live.ts` — ZERO diff (byte-identical).
- `components/feature/users/` + `app/(app)/users/` — ZERO diff.
- 13 non-list live callers untouched.

## Verification

**Automated (PASS):**
- `npx tsc --noEmit` → exit 0 (TSC PASS).
- `npm run lint` → 0 errors, 12 warnings (the 12 pre-existing TanStack `react-hooks/incompatible-library` warnings; no NEW warnings).
- Done-criteria grep `useInventoryLive|useEventsLive|useTransactionsLive` across the six list tables → 0 matches.
- Scope guardrail diffs (four shared hooks + `/users`) → empty.

**Regression surface ruled out:**
- Shared hooks byte-identical → non-list live consumers (scan stock guard, location preview, nav badge, dashboard widgets, detail/flow tabs, checkin form CI-07) unaffected.
- EVT-08: `getEventsPage` enforces `allowedStaff array-contains uid` for non-admins at the SSR layer (events.server.ts:110-111) — dropping the EventsTable listener does not weaken staff scoping.
- `/reports/out`: open-only now derived server-side, so already-returned checkouts stay hidden (no regression from dropping `checkinsLive`).
- `getTransactionsPage` signature + other callers (HistoryTable seed) unchanged.

**Manual (APPROVED — Task 3 checkpoint, 2026-06-11):**
User ran the browser walkthrough against the live Firebase env and approved: Next advances on all six list pages, filter/search params survive in the URL, EVT-08 staff scoping holds on /events, /reports/out stays open-only, non-list pages still update live, and /users is unchanged. No Firestore "create index" error was reported for the new `type==checkin && parentTxId in […]` query — single-field indexes cover the equality + `in` (no orderBy/range), so no composite index was needed.

Status: done.
