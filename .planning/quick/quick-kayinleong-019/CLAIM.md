# Claim: quick-kayinleong-019
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-10
- status: in-progress
- summary: Import `.docs/` spreadsheets into the inventory module — B&B embedded images + Sankito Google Drive images → Firebase Storage, with `inventory/{sku}` docs in Firestore.

## What will change

**New tooling (not part of app runtime):**
- `scripts/import-docs/extract.py` — stdlib-only parser. Reads both `.docs/*.xlsx`, extracts B&B embedded images (anchor→row mapping), downloads Sankito Google Drive images, emits `manifest.json` + image files to a work dir.
- `scripts/import-docs/import.ts` — run via `tsx --env-file=.env.local`. Uploads images to Storage `items/{sku}/photo.jpg` (download-token URL) and writes `inventory/{sku}` docs via the existing Admin SDK. `--dry-run` validates + reports without writing.
- `package.json` — add `import:docs` / `import:docs:dry` scripts.

**Schema/UI (per user decision — per-source categories):**
- `lib/schemas/item.ts` — add `Merchandise` + `Fragrance` to `ItemCategoryEnum`.
- `lib/types/item.ts` — mirror on the `ItemCategory` union.
- Verify category UI surfaces (ItemForm select, InventoryTable filter, StockReportTable) pick up the new values without breaking.

**Data written to LIVE Firebase (after dry-run sign-off):**
- ~86 `inventory/BB-001..BB-086` docs (category `Merchandise`, brand from source col E) + photos.
- ~23 `inventory/{numericSKU}` docs (category `Fragrance`, EAN → externalBarcode) + photos.

## Decisions (from /gsd-quick --research discussion)
- **Category:** add per-source enum values — `Merchandise` (B&B), `Fragrance` (Sankito).
- **B&B SKU:** sequential `BB-001..BB-086` from the "No" column (zero-padded). Doc id = SKU.
- **Execution:** dry-run first, report, then confirm before live writes.
- Writes are idempotent: deterministic doc ids, create-only (skip if exists). `createdBy`/`updatedBy` = `import-script` (a script cannot carry an admin session).

## What has changed
_(updated as work completes)_

## Verification
_(Regression Report — filled before status: done)_
