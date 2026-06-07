---
phase: quick-kayinleong-003
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/types/item.ts
  - lib/schemas/item.ts
  - lib/data/inventory.server.ts
  - app/(app)/inventory/actions.ts
  - components/feature/inventory/ItemForm.tsx
  - app/(app)/inventory/[itemId]/edit/page.tsx
  - components/feature/inventory/ItemDetail.tsx
  - components/feature/inventory/InventoryTable.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "New and edited inventory items accept a free-text brand value"
    - "Existing items without brand read as empty string (no migration required)"
    - "Brand is displayed in the item detail page with a dash fallback when empty"
    - "Brand column appears in the inventory list table"
    - "The existing text search (q=) matches on brand in addition to name and sku"
  artifacts:
    - path: "lib/types/item.ts"
      provides: "brand: string on InventoryItem"
    - path: "lib/schemas/item.ts"
      provides: "brand field in ItemSchema, ItemFormSchema, CreateItemSchema, UpdateItemSchema"
    - path: "lib/data/inventory.server.ts"
      provides: "brand: d.brand ?? '' in toItem() mapper"
    - path: "app/(app)/inventory/actions.ts"
      provides: "brand persisted in createItem and updateItem Firestore writes"
    - path: "components/feature/inventory/ItemForm.tsx"
      provides: "brand <Field> rendered between location and photo"
    - path: "components/feature/inventory/ItemDetail.tsx"
      provides: "Brand dt/dd row in Details dl grid"
    - path: "components/feature/inventory/InventoryTable.tsx"
      provides: "brand column + brand included in q text filter"
  key_links:
    - from: "lib/types/item.ts"
      to: "lib/schemas/item.ts"
      via: "InventoryItem shape must match schema outputs"
      pattern: "brand: string"
    - from: "lib/data/inventory.server.ts"
      to: "lib/types/item.ts"
      via: "toItem() returns InventoryItem"
      pattern: "brand: d.brand ?? \"\""
    - from: "app/(app)/inventory/actions.ts"
      to: "lib/schemas/item.ts"
      via: "CreateItemSchema and UpdateItemSchema parse action input"
      pattern: "data.brand"
---

<objective>
Add a free-text `brand` field to inventory items across the full vertical slice: type definition, four Zod schemas, Firestore mapper, two Server Actions, form UI, edit route initial prop, detail display, and list table column + text search.

Purpose: Allow staff to record the manufacturer or brand of inventory items (e.g. "Shure", "Sennheiser") and search/browse by brand in the list.
Output: 8 files modified; brand is a first-class field alongside name, sku, location, and notes throughout the inventory subsystem.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/quick-kayinleong-003/quick-kayinleong-003-RESEARCH.md

<!-- Interface context extracted from codebase -->
<interfaces>
<!-- From lib/types/item.ts — add brand: string after notes (line 31) -->
Current tail of InventoryItem interface (fields in order):
  location: string;   // line 29
  notes: string;      // line 31
  deliveryOrderIds: string[];  // line 54
  <!-- brand goes between notes and deliveryOrderIds, or after location -->

<!-- From lib/schemas/item.ts — location pattern (exact lines): -->
ItemSchema:      location: z.string().max(100).default("")   // line 36
ItemFormSchema:  location: z.string().max(100).default("")   // line 75
CreateItemSchema: location: z.string().max(100).default("")  // line 117
UpdateItemSchema: location: z.string().max(100).optional()   // line 129

<!-- From lib/data/inventory.server.ts — mapper pattern: -->
  location: d.location ?? "",  // existing line ~57

<!-- From app/(app)/inventory/actions.ts — write pattern: -->
createItem: brand: data.brand ?? ""
updateItem: brand: data.brand ?? current.brand ?? ""

<!-- From components/feature/inventory/ItemForm.tsx — field pattern: -->
<Field data-invalid={!!errors.location}>
  <FieldLabel htmlFor="item-location">Location</FieldLabel>
  <Input id="item-location" {...register("location")} />
  <FieldError errors={errors.location ? [{ message: errors.location.message }] : undefined} />
</Field>
<!-- brand field goes after location, before photo -->
defaultValues includes: location: initial?.location ?? ""

<!-- From components/feature/inventory/ItemDetail.tsx — dt/dd pattern: -->
<div>
  <dt className="text-muted-foreground">Location</dt>
  <dd>{item.location || <span className="text-muted-foreground">—</span>}</dd>
</div>

<!-- From components/feature/inventory/InventoryTable.tsx — q filter pattern: -->
if (url.q) {
  const q = url.q.toLowerCase();
  if (!i.name.toLowerCase().includes(q) && !i.sku.toLowerCase().includes(q)) {
    return false;
  }
}
<!-- Add: && !i.brand.toLowerCase().includes(q) -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Type and schema — add brand to the data contract</name>
  <files>lib/types/item.ts, lib/schemas/item.ts</files>
  <action>
Follow the exact `location` field precedent for both files.

**lib/types/item.ts:**
Add `brand: string;` to the `InventoryItem` interface, positioned after `notes` and before `deliveryOrderIds`. Add a short comment: `// Free-text manufacturer or brand name. Empty string when not set.`

**lib/schemas/item.ts:**
Add `brand: z.string().max(100).default(""),` to:
  - `ItemSchema` — alongside location (same position pattern)
  - `ItemFormSchema` — alongside location
  - `CreateItemSchema` — alongside location

Add `brand: z.string().max(100).optional(),` to:
  - `UpdateItemSchema` — alongside `location: z.string().max(100).optional()` (line 129)

Do NOT use `.default("")` in `UpdateItemSchema` — that would silently overwrite existing brand values on partial updates that omit the field.
  </action>
  <verify>npx tsc --noEmit</verify>
  <done>TypeScript compiles clean; `InventoryItem.brand` is `string`; all four schemas include brand with the correct modifier (default vs optional).</done>
</task>

<task type="auto">
  <name>Task 2: Data layer — mapper, Server Actions, and form wiring</name>
  <files>
    lib/data/inventory.server.ts,
    app/(app)/inventory/actions.ts,
    components/feature/inventory/ItemForm.tsx,
    app/(app)/inventory/[itemId]/edit/page.tsx
  </files>
  <action>
**lib/data/inventory.server.ts — toItem() mapper:**
Add `brand: d.brand ?? "",` alongside the existing `location: d.location ?? ""` line. This handles existing Firestore documents that predate the field — they read as empty string with no migration script.

**app/(app)/inventory/actions.ts:**
In `createItem`'s `tx.set(...)` payload, add:
  `brand: data.brand ?? ""`
alongside `location: data.location ?? ""`.

In `updateItem`'s `tx.update(...)` payload, add:
  `brand: data.brand ?? current.brand ?? ""`
alongside `location: data.location ?? current.location ?? ""`.
The double-fallback preserves the stored value when the field is omitted from a partial update.

**components/feature/inventory/ItemForm.tsx:**
1. In `defaultValues`, add `brand: initial?.brand ?? ""` alongside `location: initial?.location ?? ""`.
2. In the JSX, add a `<Field>` block for brand, placed after the location field and before the photo/notes field. Use `register("brand")` (plain text input, no Controller needed):

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

3. In the `onSubmit` boundary normalization (where `location` and `notes` are normalized via `?? ""`), add `brand: values.brand ?? ""`.

**app/(app)/inventory/[itemId]/edit/page.tsx:**
In the `initial` object passed to `<ItemForm initial={{ ... }}>`, add `brand: item.brand` alongside `location: item.brand` — specifically follow the same pattern as `location: item.location`. Without this, the edit form renders blank for brand even when the item has a stored brand.
  </action>
  <verify>npm run build</verify>
  <done>Build succeeds with no TypeScript errors; `brand` flows through create and update actions; edit form pre-populates brand for existing items.</done>
</task>

<task type="auto">
  <name>Task 3: UI surfaces — detail display and list column + search</name>
  <files>
    components/feature/inventory/ItemDetail.tsx,
    components/feature/inventory/InventoryTable.tsx
  </files>
  <action>
**components/feature/inventory/ItemDetail.tsx:**
In the Details tab `<dl>` grid, add a brand row adjacent to the location row (place it directly after location):

```tsx
<div>
  <dt className="text-muted-foreground">Brand</dt>
  <dd>
    {item.brand || <span className="text-muted-foreground">—</span>}
  </dd>
</div>
```

**components/feature/inventory/InventoryTable.tsx:**
Two changes:

1. **Column definition** — add a `brand` column after the `category` column (non-sortable per project D-11 convention; brand is a plain attribute, not a quantity/status axis). Add the comment `// D-11: brand is NOT sortable.`:

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

2. **Text filter extension** — in the `filtered` useMemo, extend the `url.q` branch to also match `brand`:

```typescript
if (url.q) {
  const q = url.q.toLowerCase();
  if (
    !i.name.toLowerCase().includes(q) &&
    !i.sku.toLowerCase().includes(q) &&
    !i.brand.toLowerCase().includes(q)
  ) {
    return false;
  }
}
```

Do NOT add brand to `filterKeys` in the `useUrlTableState` call — brand search uses the existing `q` key (free-text substring match). A dropdown filter is not appropriate for unbounded cardinality. Do NOT add a server-side `where("brand", ...)` Firestore filter — that would require new composite indexes.

Note: `colSpan={columns.length}` in the DataTable empty-state `<TableCell>` is already dynamic so it adjusts to the new column count automatically — no manual change needed.
  </action>
  <verify>npm run lint && npm run build</verify>
  <done>Lint passes (0 errors); build succeeds; brand column renders in the inventory list; detail page shows brand with dash fallback; text search on /inventory matches brand.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client form → Server Action | User-supplied brand text crosses here; must be validated |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-003-01 | Tampering | CreateItemSchema / UpdateItemSchema | mitigate | `z.string().max(100)` enforces max length at Server Action entry; malformed input is rejected by Zod parse before Firestore write |
| T-003-02 | Information Disclosure | InventoryTable brand column | accept | brand is non-sensitive inventory metadata; visible to all authenticated users same as name/sku/category |
</threat_model>

<verification>
1. `npx tsc --noEmit` — exits 0, no new type errors
2. `npm run lint` — exits 0, 0 errors (pre-existing TanStack warnings are out of scope)
3. `npm run build` — exits 0, route count unchanged at 30
4. Visit `/inventory/new` — Brand field renders between Location and next field
5. Create an item with brand "Shure" — detail page shows "Shure" under Brand
6. Create an item without brand — detail page shows "—" under Brand
7. Visit `/inventory` — Brand column visible in table
8. Type "shure" in the search box — items with brand "Shure" appear in results
9. Edit an existing item with a brand — edit form pre-populates the brand field correctly
</verification>

<success_criteria>
- `brand: string` is a typed field on `InventoryItem` and all four Zod schemas
- New items created via the form persist `brand` to Firestore
- Existing items without a stored brand field read as `""` (no migration needed)
- Edit form pre-populates brand from the stored item
- `/inventory/[id]` detail page shows the Brand row with a dash when empty
- `/inventory` list shows a Brand column and the `?q=` text search matches on brand
- All automated gates pass: tsc + lint + build
</success_criteria>

<output>
After completion, create `.planning/quick/quick-kayinleong-003/quick-kayinleong-003-SUMMARY.md` using the summary template. Update `CLAIM.md` status to `done` and fill in the Verification section. Update `.planning/STATE.md` quick tasks table with the completion row.
</output>
