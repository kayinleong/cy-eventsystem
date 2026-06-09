# Claim: quick-kayinleong-014
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: in-progress
- summary: Scan → Location group-barcode preview shows distinct-SKU count (1) instead of total quantity (5); surface the quantity in the preview + success toast.

## What will change
Reported: a checkout group with one `itemLines` entry (`SHURE-001`, qty: 5)
shows "Group barcode — 1 item will be updated" / "All 1 items..." in the Scan →
Location preview. The user expects "5" (the quantity). Root cause: the preview
counts distinct items (`state.items.length`), ignoring each line's `qty`.

Location is stored per-SKU, so the WRITE (one update per distinct SKU) is correct
and unchanged. Only the DISPLAYED count is wrong. Fix:
- `app/(app)/scan/actions.ts` `resolveLocationBarcodeAction`: add `qty: number`
  to `ResolveLocationBarcodeItem`; the group branch sums `itemLines[].qty` per
  itemId (instead of bare dedup); individual-item branches return qty 1.
- `components/feature/scan/LocationPanel.tsx`: carry `qty` on `PreviewItem`;
  the group header + warning use the total quantity (fallback to distinct count
  when qty is missing/0 for older group docs); each group row shows `× {qty}`;
  the success toast reports total quantity for groups.

No change to `updateItemsLocationAction` (write path) — quick-013's group-scan
behavior is untouched.

## What has changed
_To be filled during execution._

## Verification
_To be filled before marking done._
