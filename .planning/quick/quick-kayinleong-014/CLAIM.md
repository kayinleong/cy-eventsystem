# Claim: quick-kayinleong-014
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: done
- completed: 2026-06-09
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

**Commit 46364a1** (fix, 2 files):
- `app/(app)/scan/actions.ts` `resolveLocationBarcodeAction`:
  - `ResolveLocationBarcodeItem` gained `qty: number`.
  - Group branch (Step 3): replaced the dedup `Set` with a `Map<itemId,item>`
    that **sums `itemLines[].qty` per itemId** (handles repeated lines for the
    same SKU), returning `[...byId.values()]`. Distinct items + order preserved.
  - Individual branches (Step 1/2) return `qty: 1`.
- `components/feature/scan/LocationPanel.tsx`:
  - `PreviewItem` gained `qty`; the snapshot-matched individual item sets `qty: 1`.
  - Group preview header + amber warning now use **total units**
    (`Σ items.qty`), with a fallback to the distinct-SKU count when qty is
    missing/0 (older group docs).
  - Each group row shows `× {qty}` when qty > 0.
  - Success toast reports total units for groups (fallback to
    `updatedItemIds.length` when the group's itemLines snapshot was empty).

**No change to `updateItemsLocationAction`** (the write path) — location is stored
per-SKU, so one update per distinct SKU remains correct; quick-013's group-scan
behavior is untouched.

## Verification

**Automated**
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors, 12 warnings (all pre-existing; none in touched files).
- `npm run build` → exit 0, all routes compiled.

**Regression surface audited (per diff hunk)**
- **Only consumer of `resolveLocationBarcodeAction` / `ResolveLocationBarcodeItem`
  is `LocationPanel`** (grep-confirmed). LocationPanel uses its own structurally
  compatible `PreviewItem` (now also has `qty`), so the additive `qty` is safe;
  tsc confirms no other call site broke.
- **Group resolution still returns the same DISTINCT items** (Map keyed by
  itemId, insertion order preserved) — only qty is now aggregated. Preview-only
  data; no write behavior changed.
- **Write path untouched** — `updateItemsLocationAction` not modified;
  quick-013's group-scan-doesn't-touch-home-location behavior intact.
- **Older group docs without `qty`** on itemLines → `qty ?? 0`; the display
  falls back to the distinct-SKU count (never shows "0 items").
- **Individual-item scans** unchanged in UX (preview says "Item to update"; the
  `× qty` is gated on `state.isGroup`).

**Manual UI confirmation (recommended, needs Firebase env):** scan the group
barcode whose `itemLines` is `SHURE-001 × 5` → preview reads "Group barcode — 5
items will be updated" / "All 5 items…" with a "Shure - 001 [SHURE-001] × 5"
row; submit → toast "5 item(s) → …".
