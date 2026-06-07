---
phase: quick-kayinleong-003
plan: "01"
subsystem: inventory
tags: [brand, inventory, form, table, search, firestore]
dependency_graph:
  requires:
    - lib/types/item.ts (InventoryItem)
    - lib/schemas/item.ts (4 schemas)
    - lib/data/inventory.server.ts (toItem mapper)
    - lib/hooks/use-inventory-live.ts (client toItem mapper)
    - app/(app)/inventory/actions.ts (createItem, updateItem)
    - components/feature/inventory/ItemForm.tsx
    - app/(app)/inventory/[itemId]/edit/page.tsx
    - components/feature/inventory/ItemDetail.tsx
    - components/feature/inventory/InventoryTable.tsx
  provides:
    - brand: string on InventoryItem and all four Zod schemas
    - brand persisted to Firestore in createItem and updateItem
    - brand pre-populated in edit form
    - brand row in item detail page
    - brand column in inventory table
    - brand matched in q text filter
  affects: []
tech_stack:
  added: []
  patterns:
    - z.string().max(100).default("") for optional free-text fields in create schemas
    - z.string().max(100).optional() in UpdateItemSchema (no default to avoid silent overwrites on partial update)
    - D-11 audit comment on non-sortable columns
key_files:
  created: []
  modified:
    - lib/types/item.ts
    - lib/schemas/item.ts
    - lib/data/inventory.server.ts
    - lib/hooks/use-inventory-live.ts
    - app/(app)/inventory/actions.ts
    - components/feature/inventory/ItemForm.tsx
    - app/(app)/inventory/[itemId]/edit/page.tsx
    - components/feature/inventory/ItemDetail.tsx
    - components/feature/inventory/InventoryTable.tsx
decisions:
  - "UpdateItemSchema uses .optional() (not .default('')) for brand — prevents silent brand wipe on partial update"
  - "brand column in InventoryTable is NOT sortable per D-11 (unbounded cardinality, plain attribute)"
  - "brand search uses existing q= key (free-text substring match), not a new dropdown filter — avoids composite Firestore index"
  - "use-inventory-live.ts toItem() mapper patched in same commit as inventory.server.ts — both are Firestore→InventoryItem boundaries"
metrics:
  duration: ~3 min
  completed: 2026-06-07
  tasks: 3 (committed as 2 atomic commits: Task1+2 together, Task3)
  files_modified: 9
---

# Quick Task quick-kayinleong-003: Brand Field Summary

## One-liner

Free-text `brand` field wired across the full inventory vertical slice: type → Zod schemas (4) → two Firestore mappers → two Server Actions → ItemForm UI (field + defaultValues + onSubmit) → ItemDetail display → InventoryTable column and `q=` search.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | Type, schemas, data layer, form | 96c72cc | lib/types/item.ts, lib/schemas/item.ts, lib/data/inventory.server.ts, lib/hooks/use-inventory-live.ts, app/(app)/inventory/actions.ts, components/feature/inventory/ItemForm.tsx, app/(app)/inventory/[itemId]/edit/page.tsx |
| 3 | Detail row, table column, q search | c69d1ff | components/feature/inventory/ItemDetail.tsx, components/feature/inventory/InventoryTable.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] lib/hooks/use-inventory-live.ts toItem() mapper also needs brand**

- **Found during:** Task 2 (tsc verification revealed second mapper with same InventoryItem return type)
- **Issue:** `use-inventory-live.ts` has its own `toItem()` function mapping Firestore QueryDocumentSnapshot → InventoryItem. The plan listed only `inventory.server.ts` but the live client hook has a structurally identical mapper that was missing `brand: data.brand ?? ""`.
- **Fix:** Added `brand: data.brand ?? ""` to `use-inventory-live.ts` toItem() alongside `location`.
- **Files modified:** `lib/hooks/use-inventory-live.ts`
- **Commit:** 96c72cc (included in Task 1+2 commit)

Tasks 1 and 2 were committed together because the tsc gate (Task 1's verify step) couldn't pass until the mapper was also updated — the type error in `inventory.server.ts` was a direct consequence of adding `brand: string` to `InventoryItem`. Both files reached a clean compile state in the same logical unit of work.

## Known Stubs

None. Brand is fully wired end-to-end.

## Threat Flags

No new threat surface beyond what the plan's threat model already covers (T-003-01 mitigated by `z.string().max(100)` on all four schemas; T-003-02 accepted).

## Automated Gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run lint` | PASS (0 errors; 12 pre-existing TanStack/rhf warnings out of scope) |
| `npm run build` | PASS (32 routes; route count unchanged) |

## Self-Check: PASSED

All key files exist. Both commits (96c72cc, c69d1ff) confirmed in git log.
