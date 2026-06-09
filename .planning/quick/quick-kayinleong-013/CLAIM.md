# Claim: quick-kayinleong-013
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: claimed
- summary: Fix group-barcode Location check-in updating the master item's location instead of the specific item(s) within the group.

## What will change
_To be filled after research/audit._

Reported bug:
- When checking in a Location for a **group barcode**, the location update is
  applied to the **master item** rather than the **specific item(s)** in the group.
- Observed:
  - Before: master item = "one utama", item-in-group = "one utama"
  - After check-in: master item = "klcc", item-in-group = "one utama"  ← wrong
  - Expected: master item = "one utama", item-in-group = "klcc"
- I.e. the group-barcode resolution is resolving to / writing the master item's
  location field, when it should target the member items the group expands to.

Direct follow-up to quick-kayinleong-012 (`updateItemsLocationAction`,
group-barcode resolution, location transactions).

## What has changed
_To be filled during execution._

## Verification
_To be filled before marking done._
