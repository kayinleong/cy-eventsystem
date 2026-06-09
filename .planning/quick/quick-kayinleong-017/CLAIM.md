# Claim: quick-kayinleong-017
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: in-progress
- summary: On /inventory + item detail, hide the misleading Available/Checked-out lifecycle status (keep Damaged/Retired); also fix check-in so an item stays checked_out while units are still out.

## Problem
The lifecycle status badge shows Available / Checked out / Damaged / Retired. For
partial quantities it lies: check-in marks an item "available" as soon as any
qty is returned, even while `outQty > 0`. The Available/Out quantity columns are
the accurate truth. User wants the Available/Checked-out status removed from
display (keep Damaged/Retired), and the underlying check-in lifecycle logic
fixed.

## What will change (user-confirmed)
1. **Hide Available/Checked-out (keep Damaged/Retired):**
   - `components/feature/inventory/InventoryTable.tsx`: Status column renders a
     badge only for `damaged`/`retired` (muted "—" otherwise); the status filter
     `LIFECYCLES` list reduced to `["damaged","retired"]`.
   - `components/feature/inventory/ItemDetail.tsx`: the header `StatusBadge`
     renders only for `damaged`/`retired`.
2. **Fix check-in lifecycle logic:**
   - `app/(app)/events/[eventId]/checkin/actions.ts`: derive
     `newOut > 0 → "checked_out"`, else `newAvailable > 0 → "available"`, else
     `newDamaged > 0 → "damaged"` (else leave as-is). Previously set "available"
     whenever `newAvailable > 0`, ignoring still-out units. Checkout logic
     already marks `checked_out` when qty is out — unchanged.

Scope: only the two requested surfaces for display. Reports/stock + aggregations
read the now-more-accurate `lifecycleState`; checkout validation uses
`availableQty` (not lifecycle), so the flow is unaffected.

## What has changed
_To be filled during execution._

## Verification
_To be filled before marking done._
