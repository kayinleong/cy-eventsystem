# Claim: quick-kayinleong-003
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-07
- completed: 2026-06-07
- status: done
- summary: Add brand free-text field to inventory items — type, schema, form, list, and detail pages

## What Will Change

Add a free-text `brand` field (max 100 chars) to inventory items across the full vertical slice:
- `InventoryItem` type and 4 Zod schemas
- Firestore mappers (server + live client hook)
- createItem and updateItem Server Actions
- ItemForm UI (field between Location and Photo, defaultValues, onSubmit)
- Edit page initial prop
- ItemDetail detail row with dash fallback
- InventoryTable column (non-sortable per D-11) and q= text search

## What Has Changed

All 9 files modified per plan. Brand is a first-class field alongside name, sku, location, and notes.

Key implementation decisions:
- UpdateItemSchema uses `.optional()` (not `.default("")`) to avoid silently wiping brand on partial updates
- use-inventory-live.ts toItem() also updated (deviation — plan listed only inventory.server.ts; live hook has an identical mapper that was missing brand)
- InventoryTable brand column carries `// D-11: brand is NOT sortable.` audit comment
- q= text filter extended to `!i.brand.toLowerCase().includes(q)` (no new Firestore index needed)

Commits: 96c72cc (Tasks 1+2), c69d1ff (Task 3)

## Verification

### Regression Surface

Changes touch the inventory subsystem read and write paths. Potentially affected:
- /inventory list (InventoryTable) — brand column added, q filter extended
- /inventory/new (ItemForm create mode) — brand field added to form
- /inventory/[itemId] (ItemDetail) — brand row added to details tab
- /inventory/[itemId]/edit (ItemForm edit mode + edit page) — brand field pre-populated
- Firestore createItem and updateItem actions — brand field persisted

### Self-Audit of Diff

- Types and schemas: brand added as optional/default consistent with location precedent; UpdateItemSchema correctly uses `.optional()` to avoid silent overwrites
- Mappers (inventory.server.ts + use-inventory-live.ts): `brand: d.brand ?? ""` mirrors `location: d.location ?? ""` exactly — handles existing documents without migration
- Server Actions: createItem uses `data.brand ?? ""` (never null to Firestore); updateItem uses double fallback `data.brand ?? current.brand ?? ""` to preserve stored value on partial update
- ItemForm: defaultValues includes `brand: ""`, JSX Field after Location before Photo, both create and update onSubmit payloads include brand
- edit/page.tsx: `brand: item.brand` passes the stored value to form initial — edit form pre-populates correctly
- ItemDetail: standard dt/dd pattern with dash fallback, no logic change
- InventoryTable: column added after category; q filter extended to include brand; no new filter keys, no new Firestore where() clause

No regressions expected: no quantity-mutating actions touched, no auth paths changed, no existing fields modified.

### What Was Tested

- `npx tsc --noEmit` — PASS (0 errors)
- `npm run lint` — PASS (0 errors; 12 pre-existing TanStack/rhf warnings out of scope per scope boundary)
- `npm run build` — PASS (32 routes, unchanged from pre-task baseline)

### What Was Ruled Out

- Negative stock invariant: not touched — brand is a metadata field, no qty logic
- Auth paths: not touched — requireAdmin() calls unchanged
- Firestore rules: not touched — brand is a plain inventory document field within existing `allow read/write` surface
- Other collections (events, transactions, deliveryOrders): not touched
