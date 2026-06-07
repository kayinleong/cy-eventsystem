# Quick Task: quick-kayinleong-003 — Add `brand` Field to Inventory Items

**Researched:** 2026-06-07
**Domain:** Inventory item data model, form, list, and detail surfaces
**Confidence:** HIGH — all findings verified from codebase; no external dependencies

---

## Summary

Adding `brand` is a pure data-model extension. The existing `location` field (added in quick-kayinleong-001) is an exact structural precedent: free-text, `string` type with `.default("")`, optional in `ItemFormSchema`, present in both `CreateItemSchema` and `UpdateItemSchema`, rendered in the form as a plain `<Input>` using `register()`, displayed in `ItemDetail`'s `<dl>` grid, and read back cleanly from Firestore with a `?? ""` fallback in the `toItem()` mapper.

`brand` follows the same 7-stop change chain: type → full schema → form schema → server action schemas → form UI → detail UI → list column/filter. The list filter is a free-text client-side substring match (same approach as the existing `?q=` search), NOT a server-side Firestore `where()` — brand cardinality is unbounded and an equality filter would require a Firestore composite index for every brand+category combination.

**Primary recommendation:** Model `brand` exactly like `location`. Omit it from `InventoryTable` filter dropdowns; extend the existing `?q=` text search to also match `brand`.

---

## File Change Order (dependency order)

| Step | File | Change |
|------|------|--------|
| 1 | `lib/types/item.ts` | Add `brand: string` to `InventoryItem` |
| 2 | `lib/schemas/item.ts` | Add to `ItemSchema`, `ItemFormSchema`, `CreateItemSchema`, `UpdateItemSchema` |
| 3 | `lib/data/inventory.server.ts` | Add `brand: d.brand ?? ""` in `toItem()` |
| 4 | `app/(app)/inventory/actions.ts` | Include `brand` in `createItem` `tx.set(...)` and `updateItem` `tx.update(...)` |
| 5 | `components/feature/inventory/ItemForm.tsx` | Add `<Field>` for brand + default value |
| 6 | `app/(app)/inventory/[itemId]/edit/page.tsx` | Pass `brand` to `ItemForm`'s `initial` prop |
| 7 | `components/feature/inventory/ItemDetail.tsx` | Add `<dt>/<dd>` row in the Details `<dl>` |
| 8 | `components/feature/inventory/InventoryTable.tsx` | Extend `?q=` filter to include `brand` in the match |

---

## Detailed Findings

### 1. Type (`lib/types/item.ts`) [VERIFIED: codebase]

Current last field before audit fields: `deliveryOrderIds: string[]`. Add after `notes`:

```typescript
brand: string;
```

No new imported types needed.

### 2. Schemas (`lib/schemas/item.ts`) [VERIFIED: codebase]

Four schemas need touching. Pattern from `location` and `notes`:

**`ItemSchema`** — full doc shape:
```typescript
brand: z.string().max(100).default(""),
```

**`ItemFormSchema`** — user-editable inputs for the form:
```typescript
brand: z.string().max(100).default(""),
```

**`CreateItemSchema`** — Server Action input:
```typescript
brand: z.string().max(100).default(""),
```

**`UpdateItemSchema`** — partial update (optional):
```typescript
brand: z.string().max(100).optional(),
```

The `.default("")` on `ItemSchema` / `ItemFormSchema` / `CreateItemSchema` means `z.input<...>` makes the field `string | undefined`; the `??` normalisation at the submit boundary (already done for `location` and `notes`) covers that. `UpdateItemSchema` uses `.optional()` — same as all other editable fields there.

### 3. Firestore mapper (`lib/data/inventory.server.ts`) [VERIFIED: codebase]

`toItem()` reads every field with a fallback. Line 57 already does `location: d.location ?? ""`. Add the same:

```typescript
brand: d.brand ?? "",
```

**Existing-item migration concern:** Firestore documents that predate this change have no `brand` field. The `?? ""` fallback means they read as empty string — no migration script needed, no Firestore query changes required. [VERIFIED: same pattern used for `location` and `deliveryOrderIds` which were both added post-v1]

### 4. Server Actions (`app/(app)/inventory/actions.ts`) [VERIFIED: codebase]

`createItem` — in `tx.set(docRef, { ... })`, add alongside `location`:
```typescript
brand: data.brand ?? "",
```

`updateItem` — in `tx.update(itemRef, { ... })`, add alongside `location`:
```typescript
brand: data.brand ?? current.brand ?? "",
```

No other actions (`retireItem`, `adjustItemStock`, `updateLowStockThreshold`, `markLowStockOrdered`) touch the `brand` field.

### 5. Form UI (`components/feature/inventory/ItemForm.tsx`) [VERIFIED: codebase]

**Default values** — add `brand: ""` to the `defaultValues` object (line 88–99).

**`initial` prop normalization** in `onSubmit` for both create and update branches — add `brand: values.brand ?? ""` alongside `location`.

**Field placement** — insert between `location` and the photo field. Pattern from `location` field (lines 296–310):

```tsx
<Field data-invalid={!!errors.brand}>
  <FieldLabel htmlFor="item-brand">Brand</FieldLabel>
  <Input
    id="item-brand"
    placeholder="e.g. Shure, Sennheiser"
    aria-invalid={!!errors.brand}
    {...register("brand")}
  />
  <FieldError
    errors={errors.brand ? [{ message: errors.brand.message }] : undefined}
  />
</Field>
```

No `<Controller>` needed — plain `register()` works for free-text inputs.

### 6. Edit route initial prop (`app/(app)/inventory/[itemId]/edit/page.tsx`) [VERIFIED: codebase]

The `initial` object passed to `<ItemForm>` currently lists every `ItemFormSchema` field explicitly (lines 35–45). Add `brand: item.brand` to this object.

### 7. Detail page (`components/feature/inventory/ItemDetail.tsx`) [VERIFIED: codebase]

The Details tab renders a `<dl>` grid (lines 130–154). `location` renders at line 131–138 with the `|| <span>—</span>` empty fallback. Add brand the same way, adjacent to location:

```tsx
<div>
  <dt className="text-muted-foreground">Brand</dt>
  <dd>
    {item.brand || <span className="text-muted-foreground">—</span>}
  </dd>
</div>
```

### 8. Inventory list — search + column (`components/feature/inventory/InventoryTable.tsx`) [VERIFIED: codebase]

**Filter approach decision:**

Brand is free-text with unbounded cardinality, unlike `category` (4 values) or `lifecycleState` (4 values). A dropdown filter is not useful. A server-side `where("brand", "==", ...)` equality filter would require new composite Firestore indexes for every brand+category or brand+lifecycleState pairing. The correct approach is:

1. **Extend the existing `?q=` text search** to also match `brand` (in addition to `name` and `sku`).
2. **Add a `brand` column** to the table (non-sortable per D-11 since it's a plain attribute, not a quantity/status axis).

`useUrlTableState` does not need changes — `brand` is covered by the existing `q` key, not a new filter key. The `filterKeys` array passed to `useUrlTableState` stays as `["category", "lifecycleState", "isLowStock"]`.

The page-level `searchParams` in `app/(app)/inventory/page.tsx` and `getInventoryPage` are also unchanged — brand search stays client-side within the 50-row cursor window (same as `name`/`sku` today).

**`filtered` useMemo** — extend the `url.q` branch:
```typescript
if (url.q) {
  const q = url.q.toLowerCase();
  if (
    !i.name.toLowerCase().includes(q) &&
    !i.sku.toLowerCase().includes(q) &&
    !i.brand.toLowerCase().includes(q)   // ADD THIS LINE
  ) {
    return false;
  }
}
```

**Column definition** — add after the `category` column (D-11: not sortable):
```typescript
{
  accessorKey: "brand",
  // D-11: brand is NOT sortable.
  header: "Brand",
  cell: ({ row }) =>
    row.original.brand || (
      <span className="text-muted-foreground text-xs">—</span>
    ),
},
```

---

## Common Pitfalls

### Pitfall 1: Forgetting `initial` prop update on the edit route
**What goes wrong:** `brand` renders blank in the edit form even for items that have a brand stored, because the edit page's `initial` object doesn't include it.
**How to avoid:** Step 6 in the change order — `app/(app)/inventory/[itemId]/edit/page.tsx` passes an explicit field list to `<ItemForm initial={...}>`. This must include `brand: item.brand`.

### Pitfall 2: `UpdateItemSchema` uses `.optional()`, not `.default("")`
**What goes wrong:** If `brand` is added as `.default("")` in `UpdateItemSchema` (as in `ItemSchema`), every update that omits the field would overwrite the stored brand with `""`.
**How to avoid:** In `UpdateItemSchema`, use `brand: z.string().max(100).optional()` and in `updateItem` action use `brand: data.brand ?? current.brand ?? ""` so omitting the field preserves the existing value.

### Pitfall 3: Firestore index not needed for brand search
**What goes wrong:** Adding a server-side `where("brand", ...)` filter without pre-declaring the composite index in `firestore.indexes.json` causes a runtime Firestore error.
**How to avoid:** Don't add a server-side brand filter at all — extend `?q=` client-side text search only. No Firestore index changes needed.

### Pitfall 4: `colSpan` in the empty-state TableCell
**What goes wrong:** Adding a `brand` column increments the column count. The `colSpan={columns.length}` in the empty-state `<TableCell>` is dynamic (`columns.length`) so it adjusts automatically. No manual change needed.

---

## Firestore / Existing-Data Migration

No migration script is needed. The `toItem()` mapper uses `d.brand ?? ""` so any Firestore document lacking a `brand` field is safely read as `""`. This is the same approach used for `location` (added in quick-001) and `deliveryOrderIds` (added at Phase 2 launch). Existing items will show `—` for brand on the detail page and be excluded from brand text search until an admin edits and saves them.

---

## No-Op Surfaces

These files do NOT need changes:

| File | Reason |
|------|--------|
| `lib/hooks/use-url-table-state.ts` | No new URL filter key needed |
| `app/(app)/inventory/page.tsx` | `searchParams` type stays unchanged; brand filter is client-side |
| `lib/data/inventory.server.ts` `getInventoryPage` filters | No server-side brand filter |
| `firestore.indexes.json` | No new Firestore query on `brand` |
| `firestore.rules` | No new collection/field-level security change needed |
| `components/feature/inventory/ItemHistoryTab.tsx` | History log shows transactions, not item fields |
| `lib/hooks/use-inventory-live.ts` | Live hook subscribes to the same collection shape; Firestore adds missing fields as undefined → mapper fills `??""` |

---

## Sources

- `lib/types/item.ts` — confirmed field list and `location` precedent [VERIFIED: codebase]
- `lib/schemas/item.ts` — confirmed schema shapes for all four schemas [VERIFIED: codebase]
- `lib/data/inventory.server.ts` — confirmed `toItem()` mapper pattern [VERIFIED: codebase]
- `app/(app)/inventory/actions.ts` — confirmed `createItem`/`updateItem` field propagation [VERIFIED: codebase]
- `components/feature/inventory/ItemForm.tsx` — confirmed form field pattern, `register()` usage, `defaultValues` structure [VERIFIED: codebase]
- `components/feature/inventory/ItemDetail.tsx` — confirmed `<dl>` detail grid pattern [VERIFIED: codebase]
- `components/feature/inventory/InventoryTable.tsx` — confirmed `filtered` useMemo, column definitions, `useUrlTableState` call [VERIFIED: codebase]
- `lib/hooks/use-url-table-state.ts` — confirmed `filters` key contract [VERIFIED: codebase]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

All claims verified from codebase. No unverified assumptions.
