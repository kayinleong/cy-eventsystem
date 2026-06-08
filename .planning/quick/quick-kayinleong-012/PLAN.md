---
id: quick-kayinleong-012
owner: kayinleong
status: planned
mode: quick
---

# Plan: quick-kayinleong-012

Fix group-barcode "not recognised" in Scan → Location mode, and record
location updates as history visible in Item, Event, and DO modules.

## Decisions (confirmed with user)
- Bug fix: **minimal client patch** to `LocationPanel` only.
- Attribution: **group-link** — group-barcode location updates show in Event +
  DO + Item history; individual item-barcode updates show in Item history only.
- DO history: **precise** — stamp `deliveryOrderId` on the location transaction,
  add a `transactions(deliveryOrderId, at)` index, and build a DO history tab.

## Commit 1 — Bug: Location mode no longer false-negatives on group barcodes
File: `components/feature/scan/LocationPanel.tsx`
- Treat `groupSnap.exists()` as **recognised** even when `itemLines` is empty
  (server resolves authoritatively at submit).
- Stop swallowing the `getDoc` error: `console.error` + a distinct "couldn't
  look up barcode, try again" state (NOT "not recognised").
- Distinguish three render states: resolved group / individual item / unknown /
  lookup-error. Enable "Update location" for any recognised group, not only when
  preview items > 0.

## Commit 2 — History data layer
- `lib/types/transaction.ts`: add `"location"` to `TransactionType`; add
  `deliveryOrderId: string | null`.
- `lib/hooks/use-transactions-live.ts`: add `deliveryOrderId?` scope option +
  `where` constraint + map field in `toTx`.
- `app/(app)/scan/actions.ts` (`updateItemsLocationAction`): inside the same
  write batch, write one `location` transaction per updated item:
  - itemId/itemSku/itemName (from item snap or group.itemLines),
  - eventId/eventName (from the group doc + events/{id}; null for item barcodes),
  - deliveryOrderId (resolve via `deliveryOrders where checkoutGroupIds
    array-contains <barcode>`; null for item barcodes),
  - qty 0, actor from `requireSession()`, `notes: 'Location set to "<loc>"'`.
  Best-effort event/DO resolution (a lookup miss → null, never blocks the
  location update). Atomic: tx writes share the inventory-update batch.
- `firestore.indexes.json`: add `transactions(deliveryOrderId ASC, at DESC)`.

## Commit 3 — History display
- `components/feature/status/status-to-tone.ts`: add `"location"` to
  `DomainStatus`, `statusToLabel` ("Location"), `statusToTone` (muted).
- `components/feature/inventory/ItemHistoryTab.tsx` &
  `components/feature/events/EventHistoryTab.tsx`: `actionVerb("location")` →
  "updated location"; suppress the qty span for location rows (location detail
  shows via the existing notes line).
- New `components/feature/delivery-orders/DOHistoryTab.tsx` (client) using
  `useTransactionsLive({ deliveryOrderId })`; render a "History" card on
  `app/(app)/delivery-orders/[doId]/page.tsx`.

## Regression surface
- `transaction.ts` field add: existing tx writers (checkout/checkin/missing/
  adjustment) build plain objects — verify they aren't strictly typed as
  `TransactionDoc` (if they are, add `deliveryOrderId: null`). Reader defaults
  `?? null`.
- Location-update inventory write behavior must stay unchanged; tx writes are
  additive and atomic.
- `array-contains` on `checkoutGroupIds` needs no composite index (single-field
  auto-index).

## Verification
- `npm run build` (tsc) + `npm run lint`.
- Manual: in Scan → Location, scan a DO group barcode → preview resolves (no
  false "not recognised"); submit updates location. Confirm a "Location" row
  appears in Item history, Event history (group barcode), and the new DO history.
- **Data caveat:** if the underlying `checkoutGroups` doc for a printed group
  barcode is genuinely missing/orphaned, the client patch surfaces a clearer
  message but cannot "recognise" it — that would be a separate data-integrity
  finding. Confirm at runtime whether the group doc exists for the reported
  barcode.
