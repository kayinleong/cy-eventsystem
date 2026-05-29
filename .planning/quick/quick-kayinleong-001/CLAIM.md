# Claim: quick-kayinleong-001

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-05-29
- completed: 2026-05-29
- status: done
- summary: Audit + implement four user-feedback features on inventory items — photo upload (already shipped, no work), Delivery-Order (DO) upload (minimal slice), location field, and label printing barcode-format picker (local-print only).

## Scope (from user feedback)

1. **Photo upload** — items must have a photo. Audited; already shipped (`photoUrl`, `ItemPhotoField`, Firebase Storage `items/{id}/photo.jpg`, detail page display). No work.
2. **DO (Delivery Order) upload** — admin uploads a DO file + vendor + linked items; items keep a back-reference for traceability.
3. **Location field** — admin sets free-text storage location of each item on the create/edit form; shown on detail.
4. **Label printing** — barcode-format picker added (QR / Code 128 / Code 39 / EAN-13) on the existing browser-print dialog. REST-API printer integration explicitly deferred by user.

## What has changed

Four atomic commits on `main` (commit-by-commit summary in `SUMMARY.md`):

| # | Hash | Subject | Files | LOC |
|---|------|---------|-------|-----|
| 1 | `c5082df` | label format picker (QR / Code 128 / Code 39 / EAN-13) | 3 | +138 / −33 |
| 2 | `ee76b65` | add location field to inventory items | 8 | +40 / −0 |
| 3 | `31a4d70` | DO scaffolding — types, schemas, upload helper, rules | 10 | +189 / −0 |
| 4 | `a20188a` | DO upload UI — list, form, detail, item back-references | 11 | +966 / −3 |
|   |          | **TOTAL** | **25 unique paths** | **+1333 / −36** |

New files:
- `lib/labels.ts`, `lib/types/delivery-order.ts`, `lib/schemas/delivery-order.ts`, `lib/storage/upload-delivery-order.ts`
- `app/(app)/delivery-orders/{page,actions}.ts(x)`, `app/(app)/delivery-orders/new/page.tsx`, `app/(app)/delivery-orders/[doId]/page.tsx`
- `components/feature/delivery-orders/{DeliveryOrderForm,DeliveryOrderUploadField}.tsx`
- `components/feature/inventory/InventoryItemMultiCombobox.tsx`

Modified files:
- `lib/types/item.ts`, `lib/schemas/item.ts`, `lib/data/inventory.server.ts`, `lib/hooks/use-inventory-live.ts`
- `app/(app)/inventory/actions.ts`, `app/(app)/inventory/[itemId]/page.tsx`, `app/(app)/inventory/[itemId]/edit/page.tsx`
- `components/feature/inventory/{LabelPreview,PrintLabelButton,ItemForm,ItemDetail}.tsx`
- `components/feature/shell/{AppSidebar,MobileNavSheet}.tsx`
- `firestore.rules`, `storage.rules`

## Verification

### Automated gates (PASS)
- `npx tsc --noEmit` — clean (run by orchestrator post-execution).
- `npm run lint` — 0 errors, 12 warnings (all pre-existing `react-hooks/incompatible-library` on TanStack Table report components; none introduced or touched by this claim).
- `npm run build` (Next 16.2.6 + Turbopack) — PASS, 28 routes generated including the three new `/delivery-orders` routes (executor-reported, pre-orchestrator-verification).

### What was ruled out (no regression risk)
- **No quantity-mutating Server Action touched.** `createItem`/`updateItem`/`adjustItemStock`/`checkoutItem`/`checkinItem`/`retireItem` write paths for `availableQty / totalQty / outQty / damagedQty / lifecycleState` are unchanged. `createItem` now also writes `location` and initializes `deliveryOrderIds: []`; `updateItem` accepts `location`. Neither field participates in the stock invariant.
- **All new schema fields are additive.** No rename, no removal. Legacy docs without `location` / `deliveryOrderIds` render with sensible defaults (`""`, `[]`).
- **Default `PrintLabelButton` format is `qrcode`** — operators using the existing flow see identical behaviour unless they actively pick another format from the new Select.
- **Storage rule for `delivery-orders/{doId}/document.{ext}`** mirrors the existing `items/{itemId}/photo.jpg` shape exactly (signed-in read, signed-in + size + content-type write); admin gate stays at the Server Action layer per the cross-service-rule limitation documented in `storage.rules:22-28`.
- **Firestore rule for `/deliveryOrders/{doId}`** is immutable-by-default (`allow update, delete: if false`), so even a misbehaving client cannot mutate or delete a DO after creation.
- **`firestore.indexes.json` unchanged** — confirmed by `git diff`. Single-field auto-indexes cover `deliveryOrders.orderBy("uploadedAt")` and `inventory array-contains deliveryOrderIds`.

### Manual smoke (deferred — to be run before PR merge)
Smoke plan in `SUMMARY.md` covers: cycle 4 label formats with an existing SKU; create item with location; upload a DO with 2 linked items; verify item detail shows the DO chip and click-through; verify staff cannot reach `/delivery-orders/new` (Server Action `requireAdmin`); regression smokes across the v1 surface (inventory list filter, stock adjust, retire, event create, scan check-out/check-in, reports). Recommended before opening PR.

### Regression Report
Cross-checked the diff hunk-by-hunk:
- **`lib/schemas/item.ts`** — added `location` to 4 schemas + `deliveryOrderIds` to `ItemSchema` only. Existing fields and the `availableQty + outQty + damagedQty <= totalQty` refine unchanged. **Risk: none.**
- **`app/(app)/inventory/actions.ts`** — `createItem` adds `location` + `deliveryOrderIds: []` to the `tx.set` payload; `updateItem` adds `location` to the partial-update payload. Atomicity unchanged. **Risk: none.**
- **`firestore.rules`** — new `deliveryOrders` collection block added between `inventory` and `events`. Inventory rule unchanged. No catch-all change. **Risk: none.**
- **`storage.rules`** — new `delivery-orders/...` block added before catch-all. `items/.../photo.jpg` block unchanged. **Risk: none.**
- **Sidebar nav** — additive item filtered by `roles: ["admin"]`. Staff users never see it. **Risk: none.**
- **`PrintLabelButton.tsx`** — default `format = "qrcode"` preserves existing UX. Validation only refuses-with-hint when user picks an incompatible format. **Risk: none on the QR golden path.**

## Notes

- DO immutable in v1 by Firestore rule (`allow update, delete: if false`). v2 may relax this if admins need to delete or correct.
- Orphan-blob risk on Server Action failure mitigated by client-generated `doId` so the Storage path is fixed before the upload starts; if the action write fails after a successful upload, the blob path is recoverable from the error log. v2 candidate: Cloud Function GC sweep.
- React Compiler purity check rejected `crypto.randomUUID()` inside `useMemo`; executor switched to `useState` lazy initializer. Documented in SUMMARY.md "Decisions made during execution".
