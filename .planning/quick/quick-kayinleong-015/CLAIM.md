# Claim: quick-kayinleong-015
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: in-progress
- summary: Make Scan → Location current-location GROUP-scoped (was per-SKU in quick-013, which bled one group's location across every group sharing that SKU). Show current location per group on the DO detail; remove the per-item current-location displays.

## Problem
quick-013 derived "current location" per item (SKU) from the latest location tx.
A DO can split one SKU across multiple groups (e.g. SHURE-001 × 10 = Group 1 ×5 +
Group 2 ×5). Scanning Group 1 → "AAA" set SHURE-001's per-item current location to
AAA, and the DO items table (aggregated by SKU) showed AAA for the whole SKU — i.e.
"all items across all barcodes" changed. Location is physically a property of a
GROUP, not a SKU.

## Decisions (user-confirmed)
- Track current location **per checkout group**. Scanning Group 1 sets only
  Group 1's location.
- DO detail: show each group's current location **in the Group Barcodes section**;
  **remove** the per-item "Current location" column from the items table.
- **Remove** the per-item "Current location" from the Inventory item page and the
  Event "Assigned items" tab (a SKU can span groups → ambiguous). Current location
  lives per-group on the DO/group views only.

## What will change
1. `lib/types/checkout-group.ts`: add `location: string` to `CheckoutGroupDoc`
   (denormalized current location, default "").
2. `app/(app)/scan/actions.ts` `updateItemsLocationAction` GROUP branch: also
   `batch.update(checkoutGroups/{barcodeValue}, { location })` in the same atomic
   batch. Keep the per-member location txs (history). Drop the quick-013 per-item
   `/inventory/{itemId}` revalidate (no per-item current-location row anymore);
   keep `/delivery-orders` + the specific DO revalidate.
3. `app/(app)/delivery-orders/[doId]/page.tsx`: remove `fetchCurrentLocationsForDO`
   + the items-table "Current location" column; add `fetchGroupLocations` and pass
   `groupLocations` to `DODetailActions`.
4. `components/feature/delivery-orders/DODetailActions.tsx`: new `groupLocations`
   prop; render "Current location: …" per group in the Group Barcodes list.
5. Revert the remaining quick-013 per-item displays:
   - `app/(app)/inventory/[itemId]/page.tsx`: remove `fetchCurrentLocation` + prop.
   - `components/feature/inventory/ItemDetail.tsx`: remove `currentLocation` prop + row.
   - `components/feature/events/EventAssignedItemsTab.tsx`: restore the quick-010
     home-location display (revert quick-013's current-location swap).

Retained from quick-013: the GROUP-scan-does-not-touch-home-`inventory.location`
behavior (still correct), and the additive `TransactionDoc.location` audit field.

## What has changed
_To be filled during execution._

## Verification
_To be filled before marking done._
