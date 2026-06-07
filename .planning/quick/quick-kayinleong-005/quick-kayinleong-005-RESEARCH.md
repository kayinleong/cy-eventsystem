# quick-kayinleong-005: externalBarcode — Research

**Researched:** 2026-06-07
**Domain:** Inventory item type extension, form UX, label generation, scan-page lookup
**Confidence:** HIGH (all findings verified from codebase — no speculative library claims)

---

## Summary

This task threads a new optional string field (`externalBarcode`) through the full inventory stack. The
codebase is well-factored: the type, schema, two mappers (server + hook), two Server Action schemas, and
the form/actions are each in isolated files, so the change chain is mechanical and low-risk.

The two non-trivial decisions are (1) how to surface scan-to-capture on `ItemForm` without a full camera
pipeline, and (2) how to make the scan page resolve items by `externalBarcode` without a new Firestore
index.

**Primary recommendation:** Store `externalBarcode` as a plain string (empty-string default, trimmed on
write). For scan-to-capture on the form, add an inline `<BarcodeFieldInput>` component that wraps
`@yudiel/react-qr-scanner` in a sheet/popover — the same library already used on the scan page, so no
new dependency. For scan-page resolution, do a client-side fallback: try SKU match first, then
`externalBarcode` match against the live snapshot already held in memory by `useInventoryLive` — no new
Firestore index needed.

---

## 1. Full Change Chain

### 1.1 Type (`lib/types/item.ts`)

Add one field after `sku`:

```typescript
/** Manufacturer / physical barcode value. Empty string when not set.
 *  Used as label payload (falling back to sku) and as a secondary
 *  scan-resolution key alongside sku. */
externalBarcode: string;
```

No new imports. `InventoryItem` gains the field; no other type changes needed.
[VERIFIED: lib/types/item.ts]

### 1.2 Full-doc schema (`lib/schemas/item.ts — ItemSchema`)

Add after the `sku` field:

```typescript
externalBarcode: z.string().max(100).default(""),
```

Max 100 keeps it in line with `location` and `brand` caps. Empty-string default means existing Firestore
docs that lack the field parse cleanly — the `default("")` in Zod 4 fills it in on parse.
[VERIFIED: lib/schemas/item.ts — existing string fields use `.default("")` pattern]

### 1.3 Form-input schema (`ItemFormSchema`)

Add same field:

```typescript
externalBarcode: z.string().max(100).default(""),
```

`ItemFormSchema` is consumed by `ItemForm` via `zodResolver`. Adding the field here makes RHF include it in
the form values and apply max-100 validation. [VERIFIED: lib/schemas/item.ts lines 67-82]

### 1.4 Create / Update Server Action schemas

**`CreateItemSchema`** — add:
```typescript
externalBarcode: z.string().max(100).optional(),
```

Optional (not required for creation). Server Action writes `data.externalBarcode ?? ""` to Firestore.

**`UpdateItemSchema`** — add:
```typescript
externalBarcode: z.string().max(100).optional(),
```

`updateItem` action's `tx.update` already merges optional fields with `?? current.field` fallback; same
pattern applies here. [VERIFIED: lib/schemas/item.ts lines 110-137, actions.ts lines 135-146]

### 1.5 Server-side mapper (`lib/data/inventory.server.ts — toItem`)

Add one line in `toItem`:

```typescript
externalBarcode: d.externalBarcode ?? "",
```

Existing pattern: every optional Firestore field falls back to `""` or `0`. [VERIFIED: inventory.server.ts lines 45-71]

### 1.6 Client-side mapper (`lib/hooks/use-inventory-live.ts — toItem`)

Same addition — the hook has its own `toItem` function that mirrors the server mapper shape.
[VERIFIED: use-inventory-live.ts lines 45-73]

### 1.7 `createItem` Server Action (`app/(app)/inventory/actions.ts`)

In `tx.set(docRef, { ... })`, add:

```typescript
externalBarcode: data.externalBarcode ?? "",
```

[VERIFIED: actions.ts lines 65-88]

### 1.8 `updateItem` Server Action

In `tx.update(itemRef, { ... })`, add:

```typescript
externalBarcode: data.externalBarcode ?? current.externalBarcode ?? "",
```

[VERIFIED: actions.ts lines 135-146]

### 1.9 `ItemForm` (`components/feature/inventory/ItemForm.tsx`)

Three changes:
1. Add `externalBarcode` to the `defaultValues` object (empty string).
2. Add `externalBarcode` to both the `createItem` and `updateItem` call-sites in `onSubmit`.
3. Add a new `<BarcodeFieldInput>` field to the form JSX (see §2 below for the component design).

The edit-page also pre-populates the field: `EditItemPage` passes `initial` from `getItemServer`; once
`externalBarcode` is in `InventoryItem` and the mapper, the field will come through automatically —
the only change in `edit/page.tsx` is adding `externalBarcode: item.externalBarcode` to the `initial` prop.
[VERIFIED: app/(app)/inventory/[itemId]/edit/page.tsx lines 32-46]

---

## 2. Scan-to-Capture UX on ItemForm

### Context

`ScannerWidget` is tightly coupled to `useScanSession()` — it calls `addLine()` from that context
and reads `selectedEvent`. It cannot be dropped into `ItemForm` without a context re-architecture.
[VERIFIED: ScannerWidget.tsx lines 48, 98-118]

The underlying scanner primitive is `@yudiel/react-qr-scanner`'s `<Scanner>` component, which accepts
an `onScan` callback and a `paused` prop. It is entirely independent of the scan-session context.
[VERIFIED: ScannerWidget.tsx lines 38-39, 149-164]

### Recommended approach: `BarcodeFieldInput` component

Create `components/feature/inventory/BarcodeFieldInput.tsx` — a self-contained component that:

1. Renders an `<Input>` for manual text entry (the primary UX path on desktop).
2. Shows a "Scan" icon button next to the input.
3. When the Scan button is clicked, opens a `<Sheet>` (shadcn) containing an inline `<Scanner>` instance
   wired directly to an `onScan` callback — no `ScanSessionProvider` involved.
4. On a successful scan, closes the sheet and calls an `onChange(value)` prop.
5. Includes the same debounce (1500 ms) and vibration feedback as `ScannerWidget`.

This approach:
- Reuses `@yudiel/react-qr-scanner` (already installed, no new dep).
- Keeps `ScannerWidget` and `scan-session.tsx` unchanged.
- Fits the existing "manage outside RHF" pattern that `ItemPhotoField` already sets (photo URL is managed
  via local state then folded into the payload at submit — `externalBarcode` can use the same pattern, or
  more simply, it can be a plain RHF `register("externalBarcode")` field with the scanner writing into it
  via `setValue("externalBarcode", scannedValue)`).

**Simpler alternative:** skip the sheet — just put a small "Scan" button that activates a collapsible
camera strip below the input (same `active` / `!active` pattern as `ScannerWidget`). Less surface area to
build; tradeoff is it occupies more vertical space in the form. Both are valid; the sheet keeps the form
compact.

**Component signature:**

```typescript
// components/feature/inventory/BarcodeFieldInput.tsx
"use client";
export function BarcodeFieldInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) { ... }
```

`ItemForm` uses `Controller` or `register` + manual `setValue` to wire it in, same as the category
`Select` field already does. [VERIFIED: ItemForm.tsx lines 215-240]

---

## 3. Label Generation (`lib/labels.ts`)

### Current state

`canEncode(sku, fmt)` validates a barcode payload before `bwipjs.toCanvas`. The `value` prop passed to
`LabelPreview` and the text displayed in `PrintLabelButton` are both `sku`.
[VERIFIED: PrintLabelButton.tsx lines 43, 105-106]

### Change

`PrintLabelButton` currently receives `{ sku, name }`. Add an `externalBarcode?: string` prop. The
barcode payload becomes:

```typescript
const barcodePayload = externalBarcode?.trim() || sku;
```

`LabelPreview` receives `value={barcodePayload}`. The human-readable text beneath the barcode can remain
the SKU (since SKU is the internal identifier), or show the external barcode value — either is fine;
the planner should decide. The printed item name line stays as-is.

`canEncode` needs no changes — it validates the payload string against the format, regardless of whether
that string is a SKU or an external barcode value.

`ItemDetail` passes `sku` and `name` to `PrintLabelButton`. The server page `ItemDetailPage` already has
the full `InventoryItem` in scope; passing `externalBarcode` is one additional prop.
[VERIFIED: ItemDetail.tsx, PrintLabelButton.tsx]

**`lib/labels.ts` itself needs no changes** — `canEncode` is payload-agnostic. Only `PrintLabelButton`
and `ItemDetail` change.

---

## 4. Scan Page Resolution

### Current lookup logic (`scan-session.tsx — addLine`)

```typescript
const item =
  items.find((i) => i.sku.toLowerCase() === lower) ??
  items.find((i) => i.id === trimmed);
```

`items` is `useInventoryLive([], { limit: 500 })` — the full live snapshot in client memory.
[VERIFIED: scan-session.tsx lines 274, 292-298]

### Change

Add a third fallback:

```typescript
const item =
  items.find((i) => i.sku.toLowerCase() === lower) ??
  items.find((i) => i.id === trimmed) ??
  items.find((i) => i.externalBarcode !== "" && i.externalBarcode === trimmed);
```

No Firestore query needed — the scan page already holds the live inventory snapshot for up to 500 items.
The lookup is a sequential `Array.find` over in-memory objects; at 500 items this is ~microseconds.

The external barcode match is case-sensitive (unlike SKU which is lowercased). This is correct: physical
barcodes are exact-value — the scanner will return the exact payload the manufacturer encoded. If
case-insensitive matching is desired, normalize both sides to lowercase.

---

## 5. Firestore Index Decision

**No new index needed for this task.** The scan page uses in-memory lookup (§4 above). No server-side
`where("externalBarcode", "==", ...)` query is issued anywhere in this change chain.

If a future task adds server-side search-by-barcode (e.g., for the Admin SDK's `getInventoryPage`), a
simple single-field index on `externalBarcode` would be required. That index would be a new entry in
`firestore.indexes.json`. Not needed here.

---

## 6. Migration: Existing Items

**Firestore documents without `externalBarcode`** read cleanly because:
- `toItem` in both `inventory.server.ts` and `use-inventory-live.ts` will default to `""` via `d.externalBarcode ?? ""`. [VERIFIED: mapper pattern lines 52-70]
- `ItemSchema`'s `.default("")` fills in the field on Zod parse.
- No data migration script needed; the empty-string default is applied at read time.

**Edit form for existing items:** `edit/page.tsx` reads `item.externalBarcode` from `getItemServer` → will
be `""` for pre-existing items → the field renders empty in the form, ready for the user to scan and
populate.

---

## 7. Files That Change

| File | Change |
|------|--------|
| `lib/types/item.ts` | Add `externalBarcode: string` field |
| `lib/schemas/item.ts` | Add to `ItemSchema`, `ItemFormSchema`, `CreateItemSchema`, `UpdateItemSchema` |
| `lib/data/inventory.server.ts` | Add to `toItem` mapper |
| `lib/hooks/use-inventory-live.ts` | Add to `toItem` mapper |
| `app/(app)/inventory/actions.ts` | Add to `createItem` tx.set and `updateItem` tx.update |
| `app/(app)/inventory/new/page.tsx` | No change (form handled by ItemForm) |
| `app/(app)/inventory/[itemId]/edit/page.tsx` | Add `externalBarcode: item.externalBarcode` to `initial` prop |
| `app/(app)/inventory/[itemId]/page.tsx` | Pass `externalBarcode` to `ItemDetail` (no change if detail forwards full item) |
| `components/feature/inventory/ItemForm.tsx` | Add field to default values, onSubmit payloads, and JSX |
| `components/feature/inventory/BarcodeFieldInput.tsx` | **New file** — scan-to-capture field component |
| `components/feature/inventory/PrintLabelButton.tsx` | Add `externalBarcode?` prop, compute payload |
| `components/feature/inventory/ItemDetail.tsx` | Pass `externalBarcode` to `PrintLabelButton` |
| `components/feature/scan/scan-session.tsx` | Add third fallback in `addLine` lookup |

`lib/labels.ts`, `ScannerWidget.tsx`, `scan-session.tsx` (except addLine), `firestore.rules`,
`firestore.indexes.json` — no changes.

---

## 8. Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Duplicate `externalBarcode` values across items (two items, same physical barcode) | Low in v1 | Server Action can add uniqueness check (same tx.get pattern as SKU_EXISTS) or leave as "first match wins" at scan time — decide at planning |
| `canEncode` rejects external barcode for chosen format (e.g., EAN-13 rejects non-numeric) | Medium | `PrintLabelButton` already gates Print button on `canEncode().ok` — no code change, behaviour is correct |
| Scanner on `BarcodeFieldInput` activates in an already-scanning form context | Very low | Sheet/popover isolates the scanner instance; `ScannerWidget` on /scan is never co-mounted with ItemForm |
| 500-item live snapshot misses items beyond the limit on the scan page | Pre-existing | Not introduced by this change; noted for visibility |

---

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | `@yudiel/react-qr-scanner`'s `<Scanner>` can be instantiated standalone outside `ScanSessionProvider` — only `ScannerWidget` depends on that context | Low — the import in ScannerWidget.tsx clearly shows Scanner is from the library; the context hook is used separately |
| A2 | Zod 4 `.default("")` fills in missing fields when parsing existing Firestore data that lacks the key | Low — this is the established pattern for `deliveryOrderIds: z.array(...).default([])` (ItemSchema line 51) |

---

## Sources

- All findings: verified directly from codebase files listed in §7 above — no external sources required for this change chain.
