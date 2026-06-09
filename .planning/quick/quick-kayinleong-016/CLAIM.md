# Claim: quick-kayinleong-016
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: in-progress
- summary: Location history rows only say `Location set to "AAA"`. Add quantity, which DO, and which group barcode to the group-scan location transaction notes.

## What will change
A group-barcode Location scan writes one `location` transaction per member item
(history feeds: Item/Event/DO). Today the notes are just `Location set to "X"`.
Enrich the notes for GROUP scans to include:
- **quantity** — the unit count for that item in the group (summed across lines),
- **which group barcode** — the group `label` (e.g. "Group 2 of 2 — ADA 2026")
  plus the scanned barcode id,
- **which DO** — the resolved delivery-order vendor.

All data is already available at write time in `updateItemsLocationAction`'s
group branch (`group.label`, `itemLines[].qty`, the DO doc from the existing
array-contains lookup). Single-file change in `app/(app)/scan/actions.ts`:
- capture `group.label` and per-item qty in `itemMeta`;
- capture the DO `vendor` alongside `deliveryOrderId`;
- build per-item notes overriding the generic `txNote` in the group loop.

Individual-item scans keep the simple `Location set to "X"` note (no group/DO).
Structured `qty` on the tx stays 0 (location-move invariant, display-suppressed) —
the human-readable count goes in notes. No display-component or schema change.

## What has changed
_To be filled during execution._

## Verification
_To be filled before marking done._
