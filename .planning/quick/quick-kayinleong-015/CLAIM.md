# Claim: quick-kayinleong-015
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: done
- completed: 2026-06-09
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

**Commit cdacbdb** (fix, 7 files):
- `lib/types/checkout-group.ts`: added optional `location?: string` to
  `CheckoutGroupDoc` (denormalized current location of the group).
- `app/(app)/scan/actions.ts` `updateItemsLocationAction` GROUP branch: added
  `batch.update(checkoutGroups/{barcodeValue}, { location })` to the existing
  atomic batch (alongside the per-member location txs). Removed the quick-013
  per-item `/inventory/{itemId}` revalidate loop (no per-item current-location
  row anymore); kept `/delivery-orders` + the specific-DO revalidate. The
  home-`inventory.location` is still never written by a group scan.
- `app/(app)/delivery-orders/[doId]/page.tsx`: removed `fetchCurrentLocationsForDO`
  + the items-table "Current location" column; added `fetchGroupLocations`
  (reads each linked `checkoutGroups.location`, returns `Record<groupId,loc>`)
  and passes `groupLocations` to `DODetailActions`.
- `components/feature/delivery-orders/DODetailActions.tsx`: new `groupLocations`
  prop; each Group Barcodes row now shows "Current location: …".
- `app/(app)/inventory/[itemId]/page.tsx` + `components/feature/inventory/ItemDetail.tsx`:
  removed the quick-013 per-item current-location fetch, prop, and row.
- `components/feature/events/EventAssignedItemsTab.tsx`: reverted to the
  quick-010 home-location display (via `git checkout dd57f63 -- <file>`).

Retained from quick-013: group scans never write home `inventory.location`
(still correct); the additive `TransactionDoc.location` audit field (written by
location txs, now unread by any display but kept as structured audit data — its
removal would touch the type + 3 mappers for no functional gain).

## Verification

**Automated**
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors, 12 warnings (all pre-existing; none in touched files).
- `npm run build` → exit 0, all routes compiled.

**Regression surface audited**
- **Cross-group bleed fixed:** location now written to the scanned group's
  `checkoutGroups` doc only; a sibling group with the same SKU is untouched.
  Verified the write targets `checkoutGroups/{barcodeValue}` (the scanned id),
  not per-SKU inventory.
- **Atomic batch preserved:** the group-doc update + all member txs commit in one
  `batch.commit()`.
- **No leftover refs:** grep confirms no remaining `currentLocation` /
  `fetchCurrentLocation*` / `currentLocMap` symbols anywhere.
- **DO items table** keeps its original home-location "Location" column (only the
  added "Current location" column was removed). **Inventory item page** keeps its
  home "Location" row. **Event tab** restored to exact pre-013 home-location code.
- **History (quick-012)** untouched: per-member location txs still written/stamped;
  history feeds unaffected.
- **`checkoutGroups` write:** done via Admin SDK (server action) — the rules'
  `allow update: if false` blocks only client writes; Admin SDK bypasses rules.
  No rules/index change.
- Individual-item Location scans unchanged (still set home `inventory.location`).

**Manual UI confirmation (recommended, needs Firebase env):** with a DO whose
SHURE-001 × 10 is split into Group 1 (×5) + Group 2 (×5): scan Group 1 → set
"AAA". On the DO page, the Group Barcodes section shows Group 1 "Current location:
AAA" and Group 2 "—" (unchanged). The items table shows only the home "Location"
(TRX). Item page + Event tab show home location only (no current-location row).

## Supersedes
quick-kayinleong-013's per-item current-location DISPLAYS (item page / Event tab /
DO items column) are replaced by this group-scoped model. quick-013's core
behavior (group scan does not change home `inventory.location`) is retained and
built upon, so quick-013's separate manual-verify is now moot.
