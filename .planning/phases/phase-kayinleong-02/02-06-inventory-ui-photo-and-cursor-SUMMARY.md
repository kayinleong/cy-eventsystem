---
phase: phase-kayinleong-02
plan: 06
subsystem: inventory
tags: [inventory, ui-swap, photo-upload, cursor-pagination, D-15, D-17, P9]
requires:
  - 02-04 (lib/auth/dal.ts requireAdmin / verifySession)
  - 02-05 (lib/data/inventory.server.ts + actions.ts + use-inventory-live.ts + upload-photo.ts)
provides:
  - cursor URL contract on /inventory list page (D-17)
  - photo field on /inventory/new + /inventory/[id]/edit (D-15)
  - real-time onSnapshot audit feed on item detail (AUD-02)
  - 6 Server Action wires across InventoryTable, ItemForm, RetireItemButton,
    AdjustStockDialog (new), ItemHistoryTab, LowStockThresholdsCard
  - generic transactions-live hook for future event-detail + history-report
    consumers
affects:
  - components/feature/table/DataTable.tsx (Rule 3 — internal PaginationState)
  - components/feature/inventory/ItemDetail.tsx (Rule 3 — surface AdjustStockDialog + photo)
tech-stack:
  patterns:
    - Server Component SSR seed (Admin SDK) → Client Component onSnapshot
    - Cursor URL contract (`?cursor=` base64 JSON) replaces `?page=N`
    - TanStack `manualPagination: true` + `pageCount: -1` for cursor consumers
    - useReactTable bypass of generic DataTable wrapper for cursor consumers
    - RESEARCH P9: setFilter / setSort / setGlobalFilter clear cursor atomically
    - rhf + setError + AdjustStockSchema fieldErrors mapping
    - Camera substrate reuse from ScannerWidget for ItemPhotoField
key-files:
  created:
    - components/feature/inventory/ItemPhotoField.tsx
    - components/feature/inventory/AdjustStockDialog.tsx
    - lib/hooks/use-transactions-live.ts
  modified:
    - lib/hooks/use-url-table-state.ts
    - app/(app)/inventory/page.tsx
    - app/(app)/inventory/new/page.tsx
    - app/(app)/inventory/[itemId]/page.tsx
    - app/(app)/inventory/[itemId]/edit/page.tsx
    - components/feature/inventory/InventoryTable.tsx
    - components/feature/inventory/ItemForm.tsx
    - components/feature/inventory/RetireItemButton.tsx
    - components/feature/inventory/ItemHistoryTab.tsx
    - components/feature/settings/LowStockThresholdsCard.tsx
    - components/feature/table/DataTable.tsx (Rule 3)
    - components/feature/inventory/ItemDetail.tsx (Rule 3)
decisions:
  - D-K01 (Rule 3 — blocking compilation) — Plan acceptance required
    `grep -q "setPage" lib/hooks/use-url-table-state.ts` to FAIL, but
    DataTable.tsx (NOT in files_modified) consumed setPage and is shared by
    7 not-yet-migrated tables (EventsTable, HistoryTable, MissingItemsTable,
    RepurchaseTable, StockReportTable, ItemsOutTable, UsersTable). Removing
    setPage broke the build. Fixed by migrating DataTable to TanStack
    internal `PaginationState` — those 7 tables now use client-side
    pagination (no URL ?page=) until their own cursor migrations in later
    plans. Cursor consumers (InventoryTable) bypass DataTable entirely.
  - D-K02 (Rule 3 — verification blocker) — Plan files_modified does NOT
    include `components/feature/inventory/ItemDetail.tsx`, but the
    Task 5 Step B "Adjust stock" smoke test cannot pass without a UI
    affordance for AdjustStockDialog. Surfaced the dialog (admin-only)
    alongside Edit + Retire in ItemDetail header. Also added a small
    <img> photo preview (D-15: uploads from /edit need to be visible).
    Plain <img> with eslint-disable comment avoids next.config.ts
    remotePatterns plumbing for dynamic firebasestorage.app host.
metrics:
  duration_seconds: 965
  duration_human: "16m 5s"
  started: "2026-05-25T13:11:02Z"
  completed: "2026-05-25T13:27:07Z"
  tasks_completed: 4
  files_created: 3
  files_modified: 12
  commits: 4
---

# Phase 2 Plan 06: Inventory UI swap + photo field + cursor URLs Summary

**One-liner:** Cursor URL pagination (D-17) on /inventory, photo upload field reusing the ScannerWidget camera substrate on /new + /edit (D-15), and full Server Action wiring across 6 inventory client components — InventoryTable + ItemForm + ItemHistoryTab via the new useTransactionsLive hook, plus the new AdjustStockDialog and threshold editor.

## What was built

### URL contract — `useUrlTableState`

`lib/hooks/use-url-table-state.ts` rewritten for D-17:

- `state.cursor: string | null` reads `?cursor=` (opaque base64 JSON blob
  produced by `lib/data/inventory.server.ts:encodeCursor`).
- `setCursor(string | null)` replaces `setPage(number)`. Null clears the URL
  param.
- `setGlobalFilter` / `setSort` / `setFilter` all call `n.delete("cursor")`
  BEFORE updating their own value, per RESEARCH P9 — a stale cursor points
  at rows the new filter excludes (4 cursor deletes across the file).
- `pending` from `useTransition` exposed for future loading affordances.

### Generic DataTable bridge (Rule 3 fix)

`DataTable.tsx` migrated from `useUrlTableState.setPage` → internal TanStack
`PaginationState`. The 7 other tables (EventsTable, HistoryTable, etc.)
still compile and run; they paginate client-side now until each migrates
to cursor URLs in its own plan. Documented inline.

### Server Component pages (SSR seed → Client takeover)

| Page | DAL helper | Admin SDK call |
|------|------------|----------------|
| `/inventory` | `requireSession` | `getInventoryPage({cursor, filters})` |
| `/inventory/new` | `requireAdmin` | none |
| `/inventory/[itemId]` | `verifySession` | `getItemServer(itemId)` + `notFound()` |
| `/inventory/[itemId]/edit` | `requireAdmin` | `getItemServer(itemId)` + `notFound()` |

All 4 use Next 16 async `searchParams` / `params` patterns.

### Client components

| Component | Action | Hook | Error UX |
|-----------|--------|------|----------|
| InventoryTable | n/a (read-only) | `useInventoryLive(initialItems)` | sonner toast |
| ItemForm | createItem / updateItem | n/a | rhf `setError("sku", …)` for SKU_EXISTS + Zod fieldErrors; toast for non-field errors |
| RetireItemButton | retireItem | n/a | toast.error(ITEM_OUT / ITEM_NOT_FOUND) |
| ItemHistoryTab | n/a (read-only) | `useTransactionsLive({itemId, limit:50})` | console.error on FirestoreError |
| AdjustStockDialog (NEW) | adjustItemStock | n/a | toast.error(WOULD_GO_NEGATIVE), AdjustStockSchema fieldErrors |
| LowStockThresholdsCard | updateLowStockThreshold | `useInventoryLive([])` | toast.error |

### ItemPhotoField (D-15 UI surface amendment)

`components/feature/inventory/ItemPhotoField.tsx`:

- File picker via hidden `<input type="file" accept="image/*">` + visible
  "Choose file" button.
- "Take photo" button — reuses ScannerWidget pattern:
  - `getUserMedia({video:{facingMode:{ideal:"environment"}}})` (rear camera).
  - iOS-specific permission-denied copy mirrors UI-SPEC.
  - Inline `<video>` element with Snap / Cancel buttons.
  - Stream cleanup on unmount (battery hygiene from ScannerWidget).
- On selection: calls `uploadItemPhoto(itemId, file)` from plan 02-05.
  The helper compresses (browser-image-compression, 0.3MB target / 1600px /
  q=0.85) then writes `items/{itemId}/photo.jpg`. Returns download URL.
- Preview: plain `<img>` with `eslint-disable-next-line @next/next/no-img-element`
  — avoids `next.config.ts` `images.remotePatterns` plumbing for the
  dynamic `<project>.firebasestorage.app` bucket host. Storage rules
  enforce signed-in read (D-13) so token-less leak vectors are not a
  concern.
- Gated by `disabled` prop + uploading state to prevent double-submits.
- For NEW items, ItemForm gates the field on `sku.trim().toUpperCase() !==
  ""` because the upload path is `items/{sku}/photo.jpg`.

### useTransactionsLive

`lib/hooks/use-transactions-live.ts` ships the Phase 2 generic audit-feed
hook used by:
- ItemHistoryTab (this plan)
- EventHistoryTab + HistoryTable + RecentActivityFeed (future plans 02-08/10)

Subscription is `onSnapshot(query(...where(...itemId|eventId|actorUid|type),
orderBy(at desc), limit(50)))`. Defensive `FirestoreError` console.error
mirrors useInventoryLive — the transactions rule allows `read: if isSignedIn()`
so permission-denied should never fire, but a future rule tightening would
surface immediately. Composite indexes already declared in
`firestore.indexes.json` plan 02-02 cover all single-filter cases.

## Deviations from plan

### Auto-fixed (no user confirmation needed)

**D-K01 [Rule 3 — blocking compilation]** Plan's Task 1 acceptance required
`grep -q "setPage" lib/hooks/use-url-table-state.ts` to FAIL, but
`components/feature/table/DataTable.tsx` (consumed by EventsTable +
HistoryTable + MissingItemsTable + RepurchaseTable + StockReportTable +
ItemsOutTable + UsersTable) still imported `setPage`. Plan text in Task 1
acknowledged "npx tsc --noEmit will fail until consumers swap" but only
InventoryTable was listed as a consumer in Task 4. DataTable.tsx is NOT in
plan `files_modified`. Migrated DataTable to TanStack internal
`PaginationState` so the 7 other tables compile cleanly until their own
cursor migrations. Documented in DataTable.tsx inline. Commit `0538e31`.

**D-K02 [Rule 3 — verification blocker]** Plan Task 5 Step B requires E2E
"Adjust stock" smoke test on /inventory/[id], but Plan `files_modified` does
NOT include `components/feature/inventory/ItemDetail.tsx`. Without surfacing
the new AdjustStockDialog in ItemDetail, the verification cannot proceed.
Added admin-only AdjustStockDialog trigger to ItemDetail header alongside
Edit + Retire. Also added a small `<img>` photo preview to the header
(D-15: photos uploaded on /edit must be visible somewhere on detail).
Commit `b2808ec`.

### None of:
- Rule 4 architectural changes (no schema / Firebase project changes).
- Authentication gates (none encountered — admin gates flow through DAL).
- Touched `firestore.rules`, `firestore.indexes.json`, `storage.rules`,
  `firebase.json`, `app/(app)/inventory/actions.ts`, `lib/firebase/*.ts`,
  `lib/auth/dal.ts`, `proxy.ts`. All frozen per plan must-not-do.
- New routes added (28 → 28).

## Photo upload flow

End-to-end manual test pending Task 5 checkpoint. Expected sequence:

1. Admin → `/inventory/new` → fills SKU `TEST-001` → photo field activates.
2. Clicks "Choose file" → picks JPEG. browser-image-compression resizes
   to ≤1600px long edge, JPEG q=0.85, target 0.3MB. Writes to
   `items/TEST-001/photo.jpg`. Toast "Photo uploaded". photoUrl in form
   state.
3. Submits → createItem({...form, photoUrl}) → server tx writes inventory
   doc with photoUrl + isLowStock + audit row not required for create
   (per AUD-04 / 02-05 SUMMARY).
4. Redirects to `/inventory/TEST-001`. Photo visible in detail header.

## Cursor pagination demo (URL examples)

| Action | URL |
|--------|-----|
| First page | `/inventory` |
| Category filter | `/inventory?category=Audio` |
| Page 2 | `/inventory?cursor=eyJuYW1lIjoiW2xhc3QtbmFtZS1vbi1wYWdlLTFdIiwiaWQiOiJbbGFzdC1pZF0ifQ%3D%3D` |
| Filter change clears cursor | typing in search box → `?q=mic` (cursor gone) |
| Low-stock filter | `/inventory?isLowStock=true` |
| Multiple filters | `/inventory?category=Audio&lifecycleState=available&q=mic` |

## Verification

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run lint` | PASS (0 errors, 5 warnings — pre-existing React Compiler "incompatible-library" diagnostics on TanStack `useReactTable` and RHF `watch`; identical to the 1 pre-existing Phase 1 warning, now multiplied because more such libraries are used) |
| `npm run build` | PASS (28 routes; proxy.ts recognized) |

Acceptance grep checks:

- `grep -q "setCursor" lib/hooks/use-url-table-state.ts` ✓
- `! grep -q "setPage" lib/hooks/use-url-table-state.ts` ✓
- 4 × `n.delete("cursor")` in the hook (P9 mitigation, exceeds ≥3 requirement) ✓
- `grep -q "manualPagination: true" components/feature/inventory/InventoryTable.tsx` ✓
- `grep -q "uploadItemPhoto" components/feature/inventory/ItemPhotoField.tsx` ✓
- `grep -q "facingMode.*environment" components/feature/inventory/ItemPhotoField.tsx` ✓
- `grep -q "getUserMedia" components/feature/inventory/ItemPhotoField.tsx` ✓
- `grep -q "onSnapshot" lib/hooks/use-transactions-live.ts` ✓
- `grep -q 'orderBy("at", "desc")' lib/hooks/use-transactions-live.ts` ✓
- `grep -q "useTransactionsLive" components/feature/inventory/ItemHistoryTab.tsx` ✓
- `grep -q "getInventoryPage" app/(app)/inventory/page.tsx` ✓
- `grep -q "getItemServer" app/(app)/inventory/[itemId]/page.tsx` ✓
- `grep -q 'from "@/lib/auth/dal"' app/(app)/inventory/{page,new/page,[itemId]/edit/page,[itemId]/page}.tsx` ✓ (all 4)
- No `useMockStore` import in any modified inventory client component ✓
- No `seedUsers` reference in `components/feature/inventory/` ✓
- No `from "@/lib/mock/store"` import in inventory client components ✓

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `0538e31` | feat(phase-kayinleong-02): migrate use-url-table-state to cursor pagination per D-17 |
| 2 | `456fa04` | feat(phase-kayinleong-02): add useTransactionsLive + ItemPhotoField per D-11/D-15 |
| 3 | `8ae847f` | feat(phase-kayinleong-02): wire inventory Server Component pages to DAL + Admin SDK |
| 4 | `b2808ec` | feat(phase-kayinleong-02): wire 6 inventory client components to Firebase |

## Hand-off to plan 02-07 (or next wave)

Plan 02-06 completes Block C UI swap. Open items for downstream:
- `lib/mock/store.ts` + `lib/mock/items.ts` + `lib/mock/selectors.ts` still
  present; deletion deferred to plan 02-11 wholesale wipe per PATTERNS §3.
- 7 list tables (EventsTable, HistoryTable, MissingItemsTable,
  RepurchaseTable, StockReportTable, ItemsOutTable, UsersTable) still
  consume the generic DataTable wrapper with TanStack internal pagination.
  Each will migrate to direct `useReactTable({manualPagination:true})` +
  SSR-seeded `nextCursor` in its own plan (Block D — events, Block G —
  reports). UsersTable already migrated separately in plan 02-04.
- `next.config.ts` `images.remotePatterns` not added — plain `<img>` for
  Storage download URLs is fine for Phase 2 v1. Future plan can add the
  bucket host if next/image optimizations are needed.

## CHECKPOINT REACHED

Plan is `autonomous: false` — see CHECKPOINT REACHED section appended to the
agent return message for the 9-step E2E + rules-audit walkthrough.

## Self-Check: PASSED

All 13 plan files_modified + 2 Rule 3 deviation files (DataTable.tsx,
ItemDetail.tsx) present on disk and committed. All 4 commit hashes verified
in `git log`. tsc / lint / build green.
