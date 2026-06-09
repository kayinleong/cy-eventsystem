# Claim: quick-kayinleong-016
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: done
- completed: 2026-06-09
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

**Commit 95459e6** (feat, 1 file — `app/(app)/scan/actions.ts`):
- Group branch of `updateItemsLocationAction`:
  - `itemMeta` now also sums per-item `qty` from `group.itemLines`; captured
    `group.label`.
  - The existing DO array-contains lookup now also reads `vendor`
    (`deliveryOrderVendor`).
  - New `noteFor(qty)` builds the per-item notes string:
    `Location set to "X" · {qty} unit(s) · Group: {label} · Barcode: {groupId} · DO: {vendor}`
    (each segment omitted when its data is absent); written as the tx `notes`,
    overriding the generic `txNote`.
- Item branches (Step 1/2) and the structured tx `qty` (0, display-suppressed)
  are unchanged.

## Verification

**Automated**
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors, 12 warnings (all pre-existing).
- `npm run build` → exit 0, all routes compiled.

**Regression surface audited**
- Change is confined to the GROUP branch's notes construction; the
  `checkoutGroups.location` write (quick-015), the per-member tx writes, the
  atomic batch, and event/DO stamping are unchanged.
- Individual-item Location scans still use the plain `Location set to "X"` note.
- No schema/type change, no display-component change (history already renders
  `notes`), no index/rules change. Structured tx `qty` stays 0 so no qty
  aggregation is affected — the count is shown via notes only.
- Best-effort DO/event lookup still wrapped in try/catch — a miss leaves
  vendor/DO out of the note, never blocks the location update.

**Manual UI confirmation (recommended, needs Firebase env):** scan a group
barcode (e.g. Group 1 of a DO holding SHURE-001 × 5) → set "AAA". The Location
history row (Item/Event/DO) should read:
`Location set to "AAA" · 5 units · Group: Group 1 of 2 — ADA 2026 · Barcode: peUu… · DO: <vendor>`.
