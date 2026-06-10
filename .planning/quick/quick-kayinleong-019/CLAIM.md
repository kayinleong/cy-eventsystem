# Claim: quick-kayinleong-019
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-10
- status: done
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

**New tooling** (`scripts/import-docs/`): `extract.py` (stdlib xlsx parse + embedded-image
extraction + Drive download via curl → `manifest.json`), `import.ts` (Storage upload +
`inventory/{sku}` create, `--dry-run` default / `--live`), `verify.ts` (read-only check).
`package.json` +3 scripts. `.gitignore` ignores `scripts/import-docs/.work/`.

**Schema/UI:** `Merchandise` + `Fragrance` added to `ItemCategoryEnum` (`lib/schemas/item.ts`)
and `ItemCategory` (`lib/types/item.ts`); both added to the hardcoded `CATEGORIES` filter
arrays in `InventoryTable.tsx` + `StockReportTable.tsx` (`ItemForm` derives from the enum).

**Live data written:** 86 `inventory/BB-001..BB-086` (Merchandise) + 23 `inventory/{numericSKU}`
(Fragrance) + 109 `items/{sku}/photo.jpg` in Storage. `createdBy/updatedBy = import-script`.

## Verification

**Regression surface:** the additive enum change touches shared schema/type used by inventory
create/edit/list, stock report, and `use-inventory-live`. The import writes only new docs.

**Tested / passed:**
- tsc PASS; lint PASS (0 errors, 12 pre-existing warnings); `next build` PASS (full route table intact).
- Dry-run pre-flight: 109 would-create, **0 collisions** with existing inventory.
- Post-import live read-back (`verify.ts`): 86 Merchandise + 23 Fragrance, all `createdBy=import-script`;
  BB-001 & 186465 sample docs correct; both `photoUrl` HEAD → 200 `image/jpeg`; BB-024 apparel qty=31 with notes preserved.

**Ruled out:**
- *Existing inventory corruption* — writes are create-only (`ref.set` after `get().exists` skip) on brand-new
  SKUs; dry-run proved 0 pre-existing collisions. No update/delete path touched.
- *Enum break* — change is purely additive; all prior category values (`Audio`/`Lighting`/`Display`/`Marketing`)
  remain valid; no existing doc needs migration.
- *Rules/index regressions* — no `firestore.rules` / `firestore.indexes.json` / `storage.rules` changes;
  `category` is already indexed and new enum values need no new index; Admin SDK writes bypass rules.
- *Photo path collision* — `items/{sku}/photo.jpg` uses the new SKUs only; no existing item photo overwritten.
