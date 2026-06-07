---
phase: quick-kayinleong-005
plan: "01"
subsystem: inventory
tags: [externalBarcode, barcode, scan, label, form]
dependency_graph:
  requires: []
  provides: [externalBarcode field on InventoryItem, BarcodeFieldInput component, PrintLabelButton externalBarcode payload, scan-session externalBarcode fallback]
  affects: [lib/types/item.ts, lib/schemas/item.ts, lib/data/inventory.server.ts, lib/hooks/use-inventory-live.ts, app/(app)/inventory/actions.ts, app/(app)/inventory/[itemId]/edit/page.tsx, components/feature/inventory/BarcodeFieldInput.tsx, components/feature/inventory/ItemForm.tsx, components/feature/inventory/PrintLabelButton.tsx, components/feature/inventory/ItemDetail.tsx, components/feature/scan/scan-session.tsx]
tech_stack:
  added: []
  patterns: [scan-to-capture Sheet with @yudiel/react-qr-scanner, RHF setValue for scan callback, barcodePayload fallback chain]
key_files:
  created:
    - components/feature/inventory/BarcodeFieldInput.tsx
  modified:
    - lib/types/item.ts
    - lib/schemas/item.ts
    - lib/data/inventory.server.ts
    - lib/hooks/use-inventory-live.ts
    - app/(app)/inventory/actions.ts
    - app/(app)/inventory/[itemId]/edit/page.tsx
    - components/feature/inventory/ItemForm.tsx
    - components/feature/inventory/PrintLabelButton.tsx
    - components/feature/inventory/ItemDetail.tsx
    - components/feature/scan/scan-session.tsx
decisions:
  - externalBarcode stored as empty string (not null/undefined) — consistent with location and brand defaults; safe for pre-existing Firestore docs
  - BarcodeFieldInput uses Sheet (bottom, 70dvh) matching ScannerWidget patterns; camera paused when Sheet closed
  - barcodePayload = externalBarcode?.trim() || sku — fallback to SKU ensures PrintLabelButton always has a valid payload
metrics:
  duration: "~3 minutes"
  completed: "2026-06-07"
  tasks: 2
  files_created: 1
  files_modified: 10
  commits: 2
---

# Quick Task quick-kayinleong-005: externalBarcode Full Vertical Slice Summary

**One-liner:** externalBarcode field threaded through type + Zod schemas + Firestore mappers + Server Actions + scan-to-capture form field + PrintLabelButton payload + scan-page third-fallback lookup.

## What Was Built

Full vertical slice for externalBarcode on InventoryItem:

1. **Type layer** — `externalBarcode: string` added to `InventoryItem` after `sku` with JSDoc comment.
2. **Schema layer** — `externalBarcode: z.string().max(100).default("")` in `ItemSchema` and `ItemFormSchema`; `optional()` variant in `CreateItemSchema` and `UpdateItemSchema`. T-005-01 mitigated (max(100) on all four schemas).
3. **Mapper layer** — Both `toItem` functions (`inventory.server.ts` and `use-inventory-live.ts`) default to `""` via `?? ""` — safe for pre-existing Firestore docs without the field.
4. **Server Actions** — `createItem` writes `externalBarcode: data.externalBarcode ?? ""` to Firestore. `updateItem` writes `externalBarcode: data.externalBarcode ?? current.externalBarcode ?? ""`.
5. **BarcodeFieldInput component** — New client component: `Input` for manual entry + `Button(size="icon")` with `ScanLine` icon that opens a `Sheet` containing a live `Scanner` from `@yudiel/react-qr-scanner`. 1500ms debounce via `useRef`, `navigator.vibrate?.(50)` on successful capture. Camera (`paused={!open}`) activates only when Sheet is open.
6. **ItemForm** — `externalBarcode` field after Brand; `BarcodeFieldInput` wired via `watch("externalBarcode")` + `setValue("externalBarcode", v, { shouldValidate: true })`; included in both create and update `onSubmit` branches; added to `defaultValues`.
7. **Edit page** — `externalBarcode: item.externalBarcode` passed in `initial` prop.
8. **PrintLabelButton** — Optional `externalBarcode` prop; `barcodePayload = externalBarcode?.trim() || sku`; both `LabelPreview` value and human-readable text below barcode use `barcodePayload`.
9. **ItemDetail** — Passes `externalBarcode={item.externalBarcode}` to `PrintLabelButton`.
10. **scan-session.tsx** — `addLine` lookup extended: `items.find((i) => i.externalBarcode !== "" && i.externalBarcode === trimmed)` as third fallback after SKU and id.

## Deviations from Plan

None — plan executed exactly as written.

## Automated Gate Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` (Task 1) | PASS — 0 errors |
| `npx tsc --noEmit` (Task 2) | PASS — 0 errors |
| `npm run lint` (Task 2) | PASS — 0 errors, 12 pre-existing TanStack/RHF warnings (out of scope per scope boundary) |
| `npm run build` | PASS — 32 routes, 0 errors |

## Known Stubs

None — all externalBarcode paths are fully wired.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. T-005-01 (Tampering via form input) mitigated by Zod max(100) on all four schemas. T-005-02 (duplicate externalBarcode first-match-wins) and T-005-03 (camera Sheet) accepted per plan threat register.

## Self-Check: PASSED

- `components/feature/inventory/BarcodeFieldInput.tsx` — created
- `lib/types/item.ts` — externalBarcode: string present
- `lib/schemas/item.ts` — externalBarcode in all 4 schemas
- `lib/data/inventory.server.ts` — externalBarcode ?? "" in toItem
- `lib/hooks/use-inventory-live.ts` — externalBarcode ?? "" in toItem
- `app/(app)/inventory/actions.ts` — externalBarcode written in createItem and updateItem
- Task 1 commit: 10a617a
- Task 2 commit: 591f174
