---
phase: quick-kayinleong-013
plan: 01
subsystem: scan / inventory / events / delivery-orders
tags: [transactions, location, server-action, current-location, revalidate]
requires:
  - quick-kayinleong-012 (location TransactionType + deliveryOrderId field + per-item location tx writes)
provides:
  - "location: string | null on TransactionDoc (derived current-location source)"
  - "group-scan write reversal: GROUP location scans no longer mutate inventory.location"
  - "current-location display on DO detail, Event Assigned-items tab, Inventory item detail"
affects:
  - app/(app)/scan/actions.ts
  - app/(app)/delivery-orders/[doId]/page.tsx
  - app/(app)/inventory/[itemId]/page.tsx
  - components/feature/events/EventAssignedItemsTab.tsx
  - components/feature/inventory/ItemDetail.tsx
tech-stack:
  added: []
  patterns:
    - "Derived field: current location = latest type:'location' tx value (projection of the tx stream, no new record)"
    - "Index reuse + in-code type filter: orderBy('at','desc') over transactions(itemId|deliveryOrderId, at) then filter type==='location' in code (no new composite index)"
key-files:
  created: []
  modified:
    - lib/types/transaction.ts
    - lib/hooks/use-transactions-live.ts
    - lib/data/transactions.server.ts
    - lib/data/events.server.ts
    - app/(app)/scan/actions.ts
    - app/(app)/delivery-orders/[doId]/page.tsx
    - app/(app)/inventory/[itemId]/page.tsx
    - components/feature/events/EventAssignedItemsTab.tsx
    - components/feature/inventory/ItemDetail.tsx
decisions:
  - "GROUP scans write ONLY transactions (no inventory.location write); home location stays the master. Item scans unchanged (still set home location)."
  - "Store the location value verbatim on the tx (empty string = cleared); displays skip empty + (item detail) skip when equal to home, so no '' coercion needed."
  - "Reuse existing transactions(itemId, at) and transactions(deliveryOrderId, at) indexes; filter type==='location' in code to avoid a new composite index."
  - "Event tab: replace the home-location inventory subscription with a current-location useMemo over the already-subscribed tx stream — removes the where(documentId(),'in',ids) 30-item footgun and the quick-012 client-read trap."
metrics:
  duration: ~12 min
  completed: 2026-06-09
  tasks: 2
  files: 9
  commits: 2
---

# Quick Task quick-kayinleong-013: Per-group current location (separate from home location) Summary

GROUP-barcode Location scans now record the move only in the transaction stream (a `location` value on each per-member `type:"location"` tx) and STOP mutating each item's home `inventory.location`; the move surfaces as a derived "current location" on the DO detail page, the Event → Assigned items tab, and the Inventory item detail page. Individual-item Location scans are unchanged (still set the home location and now also carry the tx `location` value).

## What was built

### Task 1 — data + write-path reversal (commit dd57f63)
- **lib/types/transaction.ts** — added `location: string | null` as the last field of `TransactionDoc` (mirrors how quick-012 added `deliveryOrderId`).
- **3 tx builders** mapped the field with `?? null`: client `toTx` (use-transactions-live.ts), server `toTx` (transactions.server.ts), and the inline mapper in `getOpenCheckoutsForEventServer` (events.server.ts). tsc exit 0 proves no construction site was missed.
- **app/(app)/scan/actions.ts**:
  - `locationTxFields()` now returns `location` (carried by every location tx — item AND group branches).
  - GROUP branch: removed the `batch.update(inventory/{itemId}, {location, updatedAt, updatedBy})` write; kept the per-member `batch.set(transactions, …)` writes in a single atomic `batch.commit()`.
  - GROUP revalidation: removed the bare `revalidatePath("/inventory")`; kept the per-item `revalidatePath('/inventory/{itemId}')` loop (Current location row needs it); added `revalidatePath("/delivery-orders")` and `revalidatePath('/delivery-orders/{deliveryOrderId}')` when the DO was resolved.
  - Item branches (Step 1/2) left unchanged except they now auto-carry the tx `location` via the shared helper.

### Task 2 — current-location displays on 3 surfaces (commit 1b9211a)
- **app/(app)/delivery-orders/[doId]/page.tsx** — `fetchCurrentLocationsForDO(doId)` queries `transactions.where("deliveryOrderId","==",doId).orderBy("at","desc")`, filters `type==="location"` in code, takes the first (latest) per itemId, skips empty. Joined into the existing `Promise.all`; rendered as a new "Current location" `<th>`/`<td>` beside the unchanged home "Location" column.
- **components/feature/events/EventAssignedItemsTab.tsx** — replaced the `useItemLocations` inventory subscription (home location) with a `currentLocationMap` `useMemo` over the already-subscribed `allTxs` (filter `type==="location"`, first-per-itemId, skip empty). Deleted the now-unused hook and its `firebase/firestore` + `firebase/auth` imports.
- **components/feature/inventory/ItemDetail.tsx** — added optional `currentLocation?: string | null` prop; renders a "Current location" `<dl>` row only when truthy AND `!== item.location`.
- **app/(app)/inventory/[itemId]/page.tsx** — `fetchCurrentLocation(itemId)` queries `transactions.where("itemId","==",itemId).orderBy("at","desc").limit(20)`, filters `type==="location"` in code, returns the first match's `location` or null. Joined into a `Promise.all` and passed to `<ItemDetail currentLocation=… />`.

## Deviations from Plan

None — plan executed exactly as written. The regression-critical Task 1 edit (group-branch write reversal: remove inventory write + bare `/inventory` revalidate, keep per-member tx writes + atomic commit + per-item revalidate, add DO revalidate) was applied verbatim, and item branches were left untouched.

## Verification / Regression Report

**Automated gates (all PASS):**
- `npx tsc --noEmit` → exit 0 (after Task 1 and again after Task 2). The type add forces every `TransactionDoc` construction site to map `location`; a miss would fail here.
- `npm run lint` → exit 0, 12 warnings, **0 errors**. All 12 are pre-existing TanStack `useReactTable` / RHF `watch` / one unused-var warning in files NOT touched by this claim (EventsTable, AdjustStockDialog, InventoryTable, ItemForm, reports/*, DataTable). Zero new warnings in any modified file (confirms removing `useItemLocations` left no dangling imports).
- `npm run build` → exit 0, 33 route lines compiled (32 app routes + `_not-found`), matching the prior baseline.

**Diff self-audit against the regression surface:**
- **Individual-item Location scan (Step 1/2)** — untouched in the diff except the auto-carried tx `location` value; home `inventory.location` write + its revalidates preserved. Ruled OUT as a regression.
- **quick-012 history rows** — `location` is additive; the `?? null` mappers read pre-existing rows back as `location: null`. Non-location tx writers (checkout/checkin/missing/adjustment) build plain objects (not typed `TransactionDoc`), so tsc did not force them to add the field; their rows read back `location: null`. History feeds unaffected.
- **DO detail home "Location" column** — preserved; the change ADDS a "Current location" column (does not replace).
- **Event tab** — home-location display replaced with current-location display per user intent; the unused `useItemLocations` hook + its firebase imports removed (lint/tsc confirm no dangling references). Removing the inventory subscription also removes the `where(documentId(),"in",ids)` 30-item limit footgun and avoids any client `checkoutGroups`/inventory read (the quick-012 permission-denied trap).
- **firestore.indexes.json / firestore.rules** — confirmed via `git diff` that NEITHER changed. Both new server queries reuse `transactions(itemId, at desc)` (lines 323-341) and `transactions(deliveryOrderId, at desc)` (lines 254-272) with in-code `type` filtering.
- **Atomicity (T-013-01)** — the group location-tx batch remains a single `batch.commit()` (all member txs or none).
- **Check-out group creation / itemLines schema** — not touched (no edits to `createCheckoutGroupAction` or the `checkoutGroups`/`itemLines` shape).

**Manual UI checks (Task 3 — REQUIRE a live Firebase env + auth; NOT run from this session):** the 7-step human-verify checklist in the PLAN — home location preserved on group scan, individual scan still changes home, DO "Current location" column, Event tab current location, quick-012 history still renders, no `checkoutGroups` permission error in console.

## Deferred / Out of scope

- Task 3 (`checkpoint:human-verify`) was intentionally NOT executed — it requires a running Firebase project + auth that is unavailable in this session. The two `type="auto"` code tasks are complete and committed.

## Self-Check: PASSED
</content>
</invoke>
