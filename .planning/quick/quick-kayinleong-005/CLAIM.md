# Claim: quick-kayinleong-005
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-07
- completed: 2026-06-07
- status: done
- summary: Add externalBarcode field to inventory items — scan-to-capture on item form, label generation uses externalBarcode when set, scan page resolves items by either SKU or externalBarcode

## What Changed

- `lib/types/item.ts` — `externalBarcode: string` added to `InventoryItem` after `sku` with JSDoc
- `lib/schemas/item.ts` — `externalBarcode` in all four Zod schemas: `ItemSchema` (.default("")), `ItemFormSchema` (.default("")), `CreateItemSchema` (.optional()), `UpdateItemSchema` (.optional())
- `lib/data/inventory.server.ts` — `externalBarcode: d.externalBarcode ?? ""` in toItem mapper
- `lib/hooks/use-inventory-live.ts` — `externalBarcode: data.externalBarcode ?? ""` in toItem mapper
- `app/(app)/inventory/actions.ts` — `createItem` writes `externalBarcode ?? ""`; `updateItem` writes `externalBarcode ?? current.externalBarcode ?? ""`
- `app/(app)/inventory/[itemId]/edit/page.tsx` — `externalBarcode: item.externalBarcode` in initial prop
- `components/feature/inventory/BarcodeFieldInput.tsx` — NEW: Input + Sheet + Scanner for scan-to-capture; 1500ms debounce; vibrate on capture
- `components/feature/inventory/ItemForm.tsx` — externalBarcode field with BarcodeFieldInput after Brand; wired via RHF watch + setValue; included in create + update onSubmit
- `components/feature/inventory/PrintLabelButton.tsx` — optional externalBarcode prop; barcodePayload = externalBarcode?.trim() || sku; LabelPreview and human-readable text use barcodePayload
- `components/feature/inventory/ItemDetail.tsx` — passes externalBarcode={item.externalBarcode} to PrintLabelButton
- `components/feature/scan/scan-session.tsx` — addLine third fallback: externalBarcode !== "" && externalBarcode === trimmed

## Verification

### What was tested

- `npx tsc --noEmit` after Task 1 (type + schema + mapper + action changes) — exits 0
- `npx tsc --noEmit` after Task 2 (all component + form + label + scan changes) — exits 0
- `npm run lint` after Task 2 — exits 0 (0 errors, 12 pre-existing TanStack/RHF warnings, out of scope per scope boundary)
- `npm run build` after all changes — exits 0, 32 routes generated

### What passed

- TypeScript: zero type errors across all 11 modified/created files
- ESLint: zero new errors; pre-existing warnings unchanged
- Build: all 32 routes compile cleanly; no new TypeScript errors

### What was ruled out

- Firestore migration: externalBarcode defaults to "" via ?? "" in both mappers — pre-existing docs without the field read cleanly with no migration needed
- New dependencies: none added — @yudiel/react-qr-scanner already installed (used in ScannerWidget)
- Schema conflicts: externalBarcode max(100) consistent with location and brand schema shapes
- T-005-02 (duplicate externalBarcode spoofing): accepted per plan threat register — first Array.find match resolves deterministically; documented known limitation
- T-005-03 (camera Sheet): accepted — explicit user gesture required; camera released on Sheet close
