---
id: quick-kayinleong-019
type: quick
status: complete
date: 2026-06-10
---

# Summary: Import .docs spreadsheets into the inventory module

Imported two supplier spreadsheets from `.docs/` into the live `inventory`
Firestore collection (109 items) with product photos uploaded to Firebase
Storage. Ran dry-run first, then the live write on user confirmation.

## Result (verified against live Firebase)
- **86** B&B Inventory items → `inventory/BB-001..BB-086`, category **Merchandise**.
- **23** Sankito items → `inventory/{numericSKU}` (e.g. `186465`), category **Fragrance**.
- **109 / 109** photos at `items/{sku}/photo.jpg`; both sampled `photoUrl`s return HTTP 200 `image/jpeg`.
- `createdBy = updatedBy = import-script`; all 109 confirmed by `count()` query.

## How
- `scripts/import-docs/extract.py` (stdlib only) — parses both `.xlsx`, extracts
  the 86 embedded B&B images and downloads the 23 Sankito Google Drive images
  (via `curl`, sidestepping Python 3.13's missing CA bundle), emits
  `manifest.json` + image files to a git-ignored `.work/` dir.
- `scripts/import-docs/import.ts` (`tsx --env-file=.env.local`) — uploads each
  image to Storage with a `firebaseStorageDownloadTokens` metadata token (so the
  `photoUrl` matches the Web SDK's `getDownloadURL` format), then creates
  `inventory/{sku}` docs matching the `createItem` Server Action shape. Idempotent
  (doc id = SKU, create-only, skips existing). Defaults to dry-run; `--live` writes.
- `scripts/import-docs/verify.ts` — read-only post-import check.
- npm scripts: `import:docs:extract`, `import:docs:dry`, `import:docs:live`.

## Field mapping
**B&B** (`Inventory List.xlsx`): Description→`name`, Location→`location`,
col E (B&B/AMD/Zus/Loreal)→`brand`, Quantity→`totalQty`, embedded image→`photoUrl`.
SKU generated `BB-###` from the "No" column (no SKU in source). No barcode column.

**Sankito** (`KL Autoshow Sankito Stock List.xlsx`): SKU Name→`name`, SKU Code→
`sku`/doc-id, Product Barcode (EAN, coerced from scientific notation)→
`externalBarcode` (per user: keep current mapping), Total(Unit)→`totalQty`, name
prefix→`brand` (Sankito / Aster & Peony), Drive image→`photoUrl`.

## Notable handling
- **Apparel/sets** whose Quantity cell is free text (e.g. `"S-2, M-5, L-18, XL-5,
  2XL-1"`, `"12 sets"`, `"90+"`) — `totalQty` recovered by summing per-size counts
  (BB-024 = 31), original text preserved in `notes`. Only `BB-065` (empty source
  cell) is `totalQty = 0`.
- **Photo→row drift**: 4 B&B rows showed 2 images with the next row showing 0
  (anchors landed one row early). Since image count == row count (86), images were
  assigned positionally in anchor order → all 86 items got the correct photo.

## Schema change (per user decision)
Added `Merchandise` + `Fragrance` to `ItemCategoryEnum` (`lib/schemas/item.ts`) and
the `ItemCategory` union (`lib/types/item.ts`); added both to the hardcoded
`CATEGORIES` filter arrays in `InventoryTable.tsx` and `StockReportTable.tsx`
(`ItemForm` derives its dropdown from the enum automatically).

## Verification
- tsc: PASS. lint: PASS (0 errors, 12 pre-existing warnings). build: PASS.
- Live read-back: 86 Merchandise + 23 Fragrance, photo URLs reachable (200), apparel
  qty + notes correct.

## Not done / follow-ups
- Imported photos are uploaded at source resolution (~96 MB total); the app's own
  upload path compresses to ~0.3 MB. Optional follow-up: compress on import or
  re-save via the UI.
