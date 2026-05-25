---
phase: phase-kayinleong-02
plan: 05
subsystem: inventory
tags: [inventory, data-layer, server-actions, isLowStock, photo-upload, P11]
requires:
  - 02-01 (firebase / next-firebase-auth-edge dependencies)
  - 02-02 (admin.ts, client.ts, firestore.rules, firestore.indexes.json, storage.rules)
  - 02-04 (lib/auth/dal.ts requireAdmin, lib/data/users.server.ts pattern)
provides:
  - inventory cursor-paged Admin SDK read layer
  - inventory 50-row onSnapshot live hook
  - photo upload helper (browser-image-compression + Web SDK Storage)
  - 6 Server Actions for inventory CRUD + stock adjustment + low-stock controls
  - isLowStock denormalization across all stock-changing mutators (RESEARCH P11)
affects:
  - lib/types/item.ts (isLowStock added, required field)
  - lib/schemas/item.ts (CreateItemSchema, UpdateItemSchema, AdjustStockSchema, computeIsLowStock helper)
  - lib/mock/items.ts (rawSeedItems → map computeIsLowStock — keeps mock surface compiling)
  - lib/mock/store.ts (createItem populates isLowStock for 1:1 mock/Phase 2 contract)
tech-stack:
  added:
    - browser-image-compression ^2.0.2
  patterns:
    - Admin SDK cursor-paged reads (base64 {name, id} cursor; orderBy name + __name__)
    - Firestore Timestamp → ISO string conversion at the data-layer boundary
    - onSnapshot 50-row scoped window per D-20
    - runTransaction wraps every stock-changing mutation (INT-01)
    - tx.set(transactions/{auto}) audit row inside the same transaction (AUD-01)
    - computeIsLowStock recomputed atomically in 5 mutators (RESEARCH P11)
    - revalidatePath for /inventory, /inventory/[itemId], /, /reports/stock, /reports/repurchase
key-files:
  created:
    - lib/data/inventory.server.ts
    - lib/hooks/use-inventory-live.ts
    - lib/storage/upload-photo.ts
    - app/(app)/inventory/actions.ts
  modified:
    - lib/types/item.ts
    - lib/schemas/item.ts
    - lib/mock/items.ts
    - lib/mock/store.ts
    - package.json
    - package-lock.json
decisions:
  - D-K01 (Rule 1 deviation) — plan snippet used lifecycleState='active'; actual type uses 'available'. Used 'available' to match existing ItemLifecycleState + mock store.
  - D-K02 (Rule 3 deviation) — extending isLowStock as a required field forced updates in lib/mock/items.ts (raw-list → mapped via computeIsLowStock) and lib/mock/store.ts:createItem (populate isLowStock). Plan called this "informational only" — actually required for TS compilation. Kept Phase 1 mock surface working until 02-11 wipe.
  - D-K03 (own-code Rule 1 fix) — initial ActionResult<T = Record<string, never>> caused 5 TS2322 errors. Relaxed to ActionResult<T extends object = object> to allow plain { ok: true } returns.
metrics:
  duration_seconds: 514
  duration_human: "8m 34s"
  started: "2026-05-25T12:30:57Z"
  completed: "2026-05-25T12:39:31Z"
  tasks_completed: 4
  files_created: 4
  files_modified: 6
  commits: 4
---

# Phase 2 Plan 05: Inventory data layer + Server Actions Summary

**One-liner:** Cursor-paged Admin SDK reads, 50-row onSnapshot live hook, 6 Server Actions with atomic isLowStock denormalization (RESEARCH P11), and a `browser-image-compression`-backed photo upload helper — the full Block C data layer with no UI swap yet (forms ship in plan 02-06).

## What was built

### Data layer
- `lib/data/inventory.server.ts` — `getInventoryPage({cursor, limit, filters})` and `getItemServer(itemId)`. Base64 `{name, id}` cursor; orderBy name + __name__ for deterministic ordering. Timestamp → ISO conversion preserves the Phase 1 InventoryItem contract (createdAt/updatedAt/lowStockOrderedAt as ISO strings).
- `lib/hooks/use-inventory-live.ts` — `useInventoryLive(initial, opts)` Web SDK onSnapshot listener scoped to a 50-row window per D-20. Defensive console.error on FirestoreError (inventory rule allows any signed-in read, so permission-denied — Plan 02-04 useUsersLive fallout — should not recur).

### Photo upload helper
- `lib/storage/upload-photo.ts` — `uploadItemPhoto(itemId, file)`: compresses via browser-image-compression (0.3MB target / 1600px / JPEG q=0.85) then uploads to `items/{itemId}/photo.jpg` (D-13/D-14 replace-only path). Returns the public download URL.

### 6 Server Actions in `app/(app)/inventory/actions.ts`

| Action | Signature | Error codes | Audit row | isLowStock |
|--------|-----------|-------------|-----------|------------|
| `createItem(input)` | `ActionResult<{itemId}>` | `SKU_EXISTS`, Zod errors | none | computed in-tx |
| `updateItem(itemId, input)` | `ActionResult` | `ITEM_NOT_FOUND`, Zod errors | none | recomputed if threshold supplied |
| `retireItem(itemId)` | `ActionResult` | `ITEM_NOT_FOUND`, `ITEM_OUT` | `type=adjustment` (`notes=Item retired`) | force `false` |
| `adjustItemStock(input)` | `ActionResult` | `ITEM_NOT_FOUND`, `WOULD_GO_NEGATIVE`, Zod errors | `type=adjustment` (`notes=reason`) | recomputed in-tx |
| `updateLowStockThreshold(itemId, threshold)` | `ActionResult` | `ITEM_NOT_FOUND`, threshold validation | none | recomputed in-tx |
| `markLowStockOrdered(itemId)` | `ActionResult` | (admin-SDK error) | none | unchanged |

Per-action `revalidatePath` matrix:

| Action | / | /inventory | /inventory/[itemId] | /reports/stock | /reports/repurchase |
|--------|---|------------|---------------------|----------------|---------------------|
| createItem | ✓ | ✓ | — | ✓ | — |
| updateItem | ✓ | ✓ | ✓ | ✓ | ✓ |
| retireItem | ✓ | ✓ | ✓ | ✓ | — |
| adjustItemStock | ✓ | ✓ | ✓ | ✓ | — |
| updateLowStockThreshold | ✓ | ✓ | ✓ | — | ✓ |
| markLowStockOrdered | ✓ | ✓ | ✓ | — | ✓ |

## RESEARCH P11 isLowStock denormalization

The plan's central correctness rule: `isLowStock = (lowStockThreshold > 0 && availableQty <= lowStockThreshold)` MUST be updated atomically inside the same transaction that changes either field. `lib/schemas/item.ts:computeIsLowStock` is the single source of truth; every action that touches availableQty or lowStockThreshold imports + calls it. Callsites confirmed (`grep -c computeIsLowStock app/(app)/inventory/actions.ts`):

- `createItem` — initial set with `availableQty = totalQty`
- `updateItem` — recomputed when `lowStockThreshold` is in the input payload (uses `current.availableQty + nextThreshold`)
- `retireItem` — `isLowStock = false` (retired items must never trigger the low-stock dashboard widget)
- `adjustItemStock` — recomputed with the new `availableQty + item.lowStockThreshold`
- `updateLowStockThreshold` — recomputed with the new `threshold + current.availableQty`
- `markLowStockOrdered` — **unchanged** (no qty/threshold movement)

## Audit-row writes (AUD-01)

Two of the six actions write transactions rows in this plan:

- `retireItem` → `{ type: "adjustment", qty: 0, notes: "Item retired", actorUid + actorName + actorRole snapshot, at: serverTimestamp() }`
- `adjustItemStock` → `{ type: "adjustment", qty: |delta|, notes: reason, actorUid + actorName + actorRole snapshot, at: serverTimestamp() }`

Both writes happen inside the same `runTransaction` as the item update, satisfying INT-03 (atomic invariant) + INT-04 (DAL gate). `createItem`, `updateItem`, `updateLowStockThreshold`, `markLowStockOrdered` are configuration/lifecycle changes — no audit row required per AUD-04 (only stock movements). Future plans 02-08/02-09 follow this same pattern for checkout/checkin.

## Deviations from plan

### Auto-fixed (no user confirmation needed)

**D-K01 [Rule 1 — plan text typo]** Plan code snippet used `lifecycleState: "active"` for createItem; the actual `ItemLifecycleState` enum is `"available" | "checked_out" | "damaged" | "retired"`. Used `"available"` (matches existing type + Phase 1 mock store createItem). Commit `0ad8a35`.

**D-K02 [Rule 3 — blocking compilation]** Plan Step 1.3 called the mock-data isLowStock update "informational only" since "Phase 2 wipes mock data". This was incorrect: extending `InventoryItem` with a required `isLowStock: boolean` triggers TS errors in `lib/mock/items.ts` (30 seed items) and `lib/mock/store.ts:createItem` (mutator construction). Fixed by converting `seedItems` to a derived array (`rawSeedItems.map(i => ({...i, isLowStock: computeIsLowStock({...})}))`) — single source of truth, mock surface remains TS-clean until plan 02-11 deletes it. Also added `isLowStock` to `lib/mock/store.ts:createItem`. Commit `7755412`.

**D-K03 [own-code Rule 1 fix]** Initial `type ActionResult<T = Record<string, never>>` caused 5 TS2322 errors at `return { ok: true }`. Relaxed to `ActionResult<T extends object = object>` so empty-payload happy returns type-check. No behavioral change. Commit `0ad8a35`.

### None of:
- Architectural changes (Rule 4)
- Authentication gates (none encountered — plan is data-layer only)
- New routes added (28 → 28)
- firestore.rules / firestore.indexes.json / storage.rules touched (forbidden per plan)

## Verification

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run lint` | PASS (1 pre-existing Phase 1 warning, untouched) |
| `npm run build` | PASS (28 routes; same baseline as Plan 02-04; proxy.ts recognized) |

Acceptance grep checks:

- `grep -q 'import "server-only"' lib/data/inventory.server.ts` ✓
- `grep -q "startAfter" lib/data/inventory.server.ts` ✓
- `grep -q "onSnapshot" lib/hooks/use-inventory-live.ts` ✓
- `grep -q "browser-image-compression" lib/storage/upload-photo.ts` ✓
- `grep -q "isLowStock: boolean" lib/types/item.ts` ✓
- 6/6 exported actions, 6/6 `requireAdmin`, 5 `runTransaction` (markLowStockOrdered intentionally omits per plan), 5 `computeIsLowStock` references (1 import + 4 invocations + 1 explicit-false in retireItem).
- `grep -q '"browser-image-compression"' package.json` ✓ (`^2.0.2`)

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `7755412` | feat(phase-kayinleong-02): extend item type with isLowStock; install browser-image-compression |
| 2 | `232264f` | feat(phase-kayinleong-02): add inventory Admin SDK helper + onSnapshot hook |
| 3 | `20c015f` | feat(phase-kayinleong-02): add browser-image-compression photo upload helper |
| 4 | `0ad8a35` | feat(phase-kayinleong-02): add 6 inventory Server Actions with isLowStock denormalization (P11) |

## Hand-off to plan 02-06 (UI swap)

Plan 02-06 will:
1. Swap `app/(app)/inventory/page.tsx` from `useMockStore` to `getInventoryPage()` SSR + `useInventoryLive(initial)`.
2. Wire `/inventory/new` and `/inventory/[itemId]/edit` forms to `createItem` / `updateItem` Server Actions; integrate `uploadItemPhoto` for the photo field (D-11 file picker + camera capture).
3. Wire stock adjustment dialog → `adjustItemStock` with required reason field (INV-04).
4. Wire retire button → `retireItem`; the `ITEM_OUT` error path must surface a user-readable toast.
5. Wire low-stock threshold inline editor → `updateLowStockThreshold` and the "Mark ordered" button → `markLowStockOrdered`.

No data-layer changes are expected for 02-06.

## Self-Check: PASSED

All 4 created files present; all 4 commit hashes verified in `git log`.
