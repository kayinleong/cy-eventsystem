# Claim: quick-kayinleong-013
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: done (display layer superseded by quick-kayinleong-015 — see Status note)
- completed: 2026-06-09
- summary: Group-barcode Location scan should set a per-group "current location" (logged + shown on DO/Event/item views) WITHOUT changing each item's master inventory home location.

## What will change

### Reframed after clarification (NOT a wrong-target bug — a feature)
Research initially hypothesized a wrong-target bug. Clarifying questions
revealed there is no "master item" vs "item in group" at the data layer
(every item is one `inventory/{id}` doc with one `location` field). The user's
intent, confirmed:
- **Master item** = the item's permanent/home location (`inventory/{id}.location`)
  → must stay "one utama" (unchanged) when a group barcode is scanned.
- **Item in group** = where the item currently is *as part of this group*
  → should become "klcc" when the group barcode is scanned in Location mode.
- Scope: group scan applies the new location to **all** items in the group.
- History: the group location move **should be logged** (per quick-012 rows).
- Show the current location on: **Delivery-order detail**, **Event → Assigned
  items**, and the **Inventory item page** (alongside, not replacing, home).

### Design (transaction-derived current location)
"Current location" of an item = the location value of its latest
`type:"location"` transaction. (Consistent with the app's "inventory fields are
projections of the transaction stream" philosophy; transactions are reliably
signed-in-readable, avoiding the quick-012 deployed-`checkoutGroups`-rule trap.)

1. `lib/types/transaction.ts` — add `location: string | null` (the new value;
   set on location txs, null elsewhere). Map in all 3 `toTx` builders
   (`use-transactions-live.ts`, `transactions.server.ts`, `events.server.ts`).
2. `app/(app)/scan/actions.ts` `updateItemsLocationAction`:
   - `locationTxFields()` now carries `location`.
   - **Group branch (Step 3): STOP updating `inventory/{itemId}.location`**
     (remove the inventory write + its revalidates). Keep one location tx per
     item, stamped eventId/eventName/deliveryOrderId. ← the behavior reversal.
   - Item branches (Step 1/2): unchanged — still set `inventory.location` (home)
     and now also stamp the tx `location` value.
3. Displays — "current location" = latest location tx value per item:
   - Event Assigned-items tab: derive from already-subscribed txs (client).
   - DO detail page: server-fetch latest location tx per item (deliveryOrderId
     scope), add a "Current location" column.
   - Inventory item page: server-fetch latest location tx for the item, show
     "Current location" when it differs from the home `location`.
No new Firestore index (reuse `transactions(itemId, at)` /
`transactions(deliveryOrderId, at)`); no rules change; no client checkoutGroups
reads.

Direct follow-up to quick-kayinleong-012 (`updateItemsLocationAction`,
group-barcode resolution, location transactions).

## What has changed

Two atomic commits on `main`:

- **Commit dd57f63** (T1 — data + write-path reversal, 5 files):
  - `lib/types/transaction.ts`: added `location: string | null` to `TransactionDoc`
    (the new per-group current-location value; null on non-location txs and cleared
    locations) — additive, mirrors quick-012's `deliveryOrderId`.
  - `lib/hooks/use-transactions-live.ts`, `lib/data/transactions.server.ts`,
    `lib/data/events.server.ts`: mapped `location: … ?? null` in all three
    `TransactionDoc`-shaping sites (the third is the inline mapper inside
    `getOpenCheckoutsForEventServer`, not a named `toTx`).
  - `app/(app)/scan/actions.ts` `updateItemsLocationAction`: `locationTxFields()`
    now carries `location`. **GROUP branch reversal** — removed the per-member
    `batch.update(inventory/{itemId}, {location, updatedAt, updatedBy})` write and
    the bare `revalidatePath("/inventory")`; the batch now holds ONLY the per-member
    location-tx writes, still one atomic `batch.commit()`. Kept the per-item
    `/inventory/{itemId}` revalidate loop (the item-detail Current-location row reads
    a tx server-side) and added `/delivery-orders` (+ the specific DO when resolved).
    **Item branches (Step 1/2) unchanged** except they now auto-carry the tx
    `location` value via the shared helper.
- **Commit 1b9211a** (T2 — current-location displays on 3 surfaces, 4 files):
  - `app/(app)/delivery-orders/[doId]/page.tsx`: new `fetchCurrentLocationsForDO`
    (query `transactions where deliveryOrderId == doId order by at desc`, filter
    `type=="location"` in code, latest-per-item) + a new "Current location" column
    alongside the unchanged home "Location" column.
  - `app/(app)/inventory/[itemId]/page.tsx`: new `fetchCurrentLocation` (query
    `transactions where itemId == X order by at desc limit 20`, in-code type filter,
    latest match) passed as `currentLocation` prop.
  - `components/feature/inventory/ItemDetail.tsx`: new "Current location" `<dl>` row,
    rendered only when present AND `!== item.location` (home).
  - `components/feature/events/EventAssignedItemsTab.tsx`: replaced the
    quick-010 client inventory subscription (`useItemLocations`) with a `useMemo`
    that derives current location from the already-subscribed event tx stream
    (latest `type:"location"` tx per item). Removed now-unused
    `firebase/firestore` + `firebase/auth` imports. No client `checkoutGroups`/
    inventory reads.

No change to `firestore.indexes.json` (reuses existing `transactions(itemId, at)`
and `transactions(deliveryOrderId, at)` indexes) or `firestore.rules`.

## Verification

**Automated** (run independently after both commits)
- `npx tsc --noEmit` → exit 0. (The `TransactionDoc` field add forces every
  construction site to map `location`; a miss would fail here — proves all sites
  covered.)
- `npm run lint` → 0 errors, 12 warnings (all pre-existing TanStack/React-Compiler
  warnings in untouched report/table files; zero new warnings in changed files).
- `npm run build` → exit 0, all 33 route lines compiled.

**Regression surface audited (per diff hunk)**
- **Individual-item Location scan (Step 1/2):** confirmed via `git diff` that exactly
  ONE `batch.update(inventory…)` was removed (the group branch); Step 1 (:78-100) and
  Step 2 (:103-130) home-location writes + their revalidates are untouched. They now
  also stamp the tx `location` value automatically (same helper). Behavior preserved.
- **quick-012 history additivity:** the new `location` field is additive; all
  non-location tx writers (checkout/checkin/missing/adjustment) build plain objects
  (not typed `TransactionDoc`), so they were not forced to change — their rows read
  back `location: null` via the `?? null` mappers. tsc confirms no construction site
  broke. Location history rows (label/tone/verb, DO history card) are unchanged.
- **Atomic batch:** group branch still a single `batch.commit()` (T-013-01).
- **DO detail home "Location" column** retained; "Current location" is an added
  column, not a replacement. **Event tab** intentionally switched from home →
  current (group) location per the user's "item in group" intent; removal of
  `useItemLocations` left no dangling imports (lint clean) and removes the prior
  `where(documentId(),"in",ids)` 30-item limit footgun.
- **No client `checkoutGroups`/inventory reads reintroduced** (the quick-012
  production trap): grep of `EventAssignedItemsTab.tsx` shows only a comment match.
- **No new Firestore index / no rules change:** confirmed via `git diff` — both
  derived-location queries reuse existing composite indexes with in-code type
  filtering.
- **Quantity invariant not engaged:** location txs stay `qty: 0`; no
  availableQty/outQty/totalQty touched.

**Requires a Firebase env + auth — NOT runnable from this session (Plan Task 3, blocking human-verify):**
The 7-step manual UI walkthrough is pending the user:
1. Group-barcode Location scan → item's home `inventory.location` stays unchanged;
   a "Current location" row/column shows the new value.
2. Individual-item Location scan → home location still updates (no separate Current row).
3. DO detail shows both "Location" (home) and "Current location" columns.
4. Event → Assigned items shows the current (group) location.
5. quick-012 history rows still render in Item/Event/DO.
6. No `checkoutGroups` permission-denied error in the browser console.

No `firebase deploy` required (no new index, no rules change). quick-012's prior
index/rules deploy requirement is unaffected by this claim.

**Status:** Code complete; all automated gates PASS.

**SUPERSEDED (display layer) by quick-kayinleong-015:** runtime testing revealed
the per-item current-location model breaks when a SKU is split across multiple
groups (scanning one group bled its location across every group sharing the SKU).
quick-015 pivots to a **group-scoped** current location (stored on
`checkoutGroups.location`, shown per-group on the DO detail) and REMOVES this
claim's three per-item displays (item page / Event tab / DO items column). This
claim's CORE behavior — a group scan never changes the home `inventory.location` —
is retained and built upon by quick-015. The 6-step manual verify above is moot
(displays removed); see quick-015's verification instead. Marking done.
