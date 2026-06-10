---
id: quick-kayinleong-019
type: quick
status: in-progress
mode: research
---

# Plan: Import .docs spreadsheets into the inventory module

Import two supplier spreadsheets from `.docs/` into the live `inventory` Firestore
collection, including product photos uploaded to Firebase Storage.

## Source analysis (verified)

### `Inventory List.xlsx` — "B&B Inventory" (86 rows)
| Excel col | Header      | Maps to            | Notes |
|-----------|-------------|--------------------|-------|
| A | No          | (→ SKU `BB-###`)   | zero-padded sequence |
| B | Location    | `location`         | e.g. `A2.1` |
| C | Items       | **86 embedded images** | anchored to col C; first image per row, null if none |
| D | Description | `name`             | 1 dup name ("Jacket") — fine, SKUs differ |
| E | Category    | `brand`            | B&B(47)/AMD(32)/Zus(4)/Loreal(2)/AMD (Sally)(1) — these are clients/brands |
| F | Quantity    | `totalQty`         | |
- `category` = `Merchandise` (fixed). No barcode column → `externalBarcode = ""`.
- Image anchoring: 86 images, 82 distinct rows (≤2 imgs/row, a few rows none).

### `KL Autoshow Sankito Stock List.xlsx` (23 rows)
| Excel col | Header          | Maps to          | Notes |
|-----------|-----------------|------------------|-------|
| A | No              | —                | |
| B | SKU Name        | `name` + **Drive image link** | hyperlink per row |
| C | SKU Code        | `sku`            | float-formatted → int string (`186465`) |
| D | Product Barcode | `externalBarcode`| scientific → int string (EAN) |
| I | Total (Unit)    | `totalQty`       | |
- `category` = `Fragrance` (fixed). `brand` derived from name prefix (Sankito / Aster & Peony). `unit = "pcs"`.
- 23 Google Drive `file/d/{id}/view` links — download via `uc?export=download&id=` (confirmed public).

## Tasks
1. **Extend enum** — add `Merchandise`, `Fragrance` to `ItemCategoryEnum` (schema) + `ItemCategory` (type). Verify UI surfaces.
2. **`extract.py`** (stdlib) — parse both xlsx, extract/download images to work dir, emit `manifest.json`.
3. **`import.ts`** (`tsx --env-file=.env.local`) — upload images → Storage `items/{sku}/photo.jpg` (download token), write `inventory/{sku}` docs (idempotent create-only) matching `createItem` doc shape. `--dry-run` reports without writing.
4. **Dry-run + sign-off** — report counts/sample/anomalies; STOP for confirmation.
5. **Live import + verify** — run, verify Firestore + Storage, SUMMARY + Regression Report, STATE.md, commit.

## must_haves
- truths: doc id = SKU; photoUrl = Storage download-token URL; writes idempotent (create-only).
- artifacts: `scripts/import-docs/extract.py`, `scripts/import-docs/import.ts`, enum edits, manifest.
- key_links: `lib/firebase/admin.ts`, `lib/schemas/item.ts`, `app/(app)/inventory/actions.ts` (doc shape parity).
