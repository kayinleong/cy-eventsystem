---
quick_id: quick-kayinleong-001
status: complete
completed: 2026-05-29
commits:
  - c5082df: feat(quick-kayinleong-001) — label format picker (QR / Code 128 / Code 39 / EAN-13)
  - ee76b65: feat(quick-kayinleong-001) — add location field to inventory items
  - 31a4d70: feat(quick-kayinleong-001) — DO scaffolding (types, schemas, helper, rules)
  - a20188a: feat(quick-kayinleong-001) — DO upload UI (list, form, detail, item back-references)
---

# Summary — quick-kayinleong-001

## Shipped

Three user-feedback features (photo upload was already shipped — confirmed by audit, no work needed).

### A — Label format picker (commit `c5082df`)
- New `lib/labels.ts` (42 LOC) — `BarcodeFormat` type, `LABEL_FORMATS` list, `canEncode()` validator
- `LabelPreview.tsx` extended with `format` prop; 1D barcodes render with `includetext + textxalign=center + scale=3 + height=12`
- `PrintLabelButton.tsx` now has a shadcn `Select` (4 formats, default QR), pre-validates SKU per format, refuses-with-hint on invalid input (Code 39 lowercase, EAN-13 non-numeric)
- Total: 3 files, +138 / −33 LOC

### B — Location field on items (commit `ee76b65`)
- `InventoryItem.location: string` added to type
- `location` added to all 4 Zod schemas (`ItemSchema`, `ItemFormSchema`, `CreateItemSchema`, `UpdateItemSchema`) — free text, max 100, default `""`
- Form input on `ItemForm` between Low-stock and Photo
- Detail page shows "Location" row above Unit
- `createItem` writes `location`; `updateItem` accepts it
- Read pass-through verified in `lib/data/inventory.server.ts` + `lib/hooks/use-inventory-live.ts`
- Total: 8 files, +40 / −0 LOC

### C — Delivery Order upload, minimal slice (commits `31a4d70` + `a20188a`)

**C.1 (scaffolding, `31a4d70`):**
- `lib/types/delivery-order.ts` — `DeliveryOrder` type
- `lib/schemas/delivery-order.ts` — `DeliveryOrderSchema` + `CreateDeliveryOrderSchema`
- `lib/storage/upload-delivery-order.ts` — `uploadDeliveryOrderDocument(doId, file, onProgress)` using `uploadBytesResumable`; PDF / JPG / PNG; 10MB cap; orphan-blob mitigation via client-generated `doId`
- `InventoryItem.deliveryOrderIds: string[]` back-reference
- `firestore.rules` — new `match /deliveryOrders/{doId}` block (signed-in read, admin create, immutable in v1)
- `storage.rules` — new `match /delivery-orders/{doId}/document.{ext}` block (signed-in read, signed-in + size + content-type write; admin gate stays at Server Action layer per documented cross-service-rule limitation)
- Total: 10 files, +189 / −0 LOC

**C.2 (UI, `a20188a`):**
- `/delivery-orders` list page (admin-only, latest 50 by `uploadedAt desc`)
- `/delivery-orders/new` upload form (SSR-prefetches `getInventoryPage({ limit: 500 })`)
- `/delivery-orders/[doId]` detail page (vendor, file link, items list, uploaded-by/at)
- `createDeliveryOrder` Server Action — `requireAdmin()`, `runTransaction` with reads-before-writes, `arrayUnion` back-reference on each linked item, `serverTimestamp()` for `uploadedAt`, missing-items skip-and-warn
- `InventoryItemMultiCombobox` — copy of `TeamLeadCombobox`, substitutes user fields with item fields, hides retired items
- `DeliveryOrderForm` — client component, generates `doId` client-side, uploads file with progress UI, then calls action
- `DeliveryOrderUploadField` — file picker + progress
- `ItemDetail.tsx` — Delivery Orders chips block in Details tab; `app/(app)/inventory/[itemId]/page.tsx` server-side batch-fetches referenced DOs and passes them down
- Sidebar (desktop + mobile) — admin-only "Delivery Orders" nav with `Truck` icon
- Total: 11 files, +966 / −3 LOC

## Decisions made during execution

1. **`useState` lazy initializer instead of `useMemo` for `doId` generation.** React Compiler's purity check rejects `crypto.randomUUID()` inside `useMemo`. Functionally identical for the use case. Executor caught this in lint; fixed before commit.
2. **`uploadedAt = FieldValue.serverTimestamp()`, not ISO string.** Plan said ISO; server-authoritative timestamp is strictly better (no client-clock-skew risk). Read pages convert Timestamp → ISO via a `tsToIso` helper, so the `DeliveryOrder` type `uploadedAt: string` contract holds at the read boundary.
3. **DO detail page `/delivery-orders/[doId]` gated at `requireSession`, not `requireAdmin`.** Letting any signed-in staff open a DO detail enables traceability from item → vendor. Create stays admin-only.
4. **`lib/mock/items.ts` seed update skipped.** Directory doesn't exist (Phase 2 removed mocks). Plan said "if seeds exist".
5. **`firestore.rules` inventory update validator unchanged.** Re-confirmed the existing `availableQty` invariant already permits arbitrary other fields including `deliveryOrderIds`.
6. **No new entries in `firestore.indexes.json`.** Single-field auto-indexes cover `deliveryOrders.orderBy("uploadedAt")` and `inventory array-contains deliveryOrderIds`.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS (clean) |
| `npm run lint` | PASS — 0 errors, 12 warnings (all pre-existing `react-hooks/incompatible-library` on TanStack Table report components; none touched by this claim) |
| `npm run build` | PASS (Next 16.2.6 + Turbopack, 28 routes generated including the 3 new `/delivery-orders` routes) — executor-reported |
| Manual dev-server smoke | DEFERRED — recommended before opening PR (see "Smoke plan" below) |
| Firestore rules emulator unit test | NOT RUN — emulator infra implied by `storage.rules:22-28` was not exercised; visual rule diff matches existing patterns |

## Smoke plan (recommended before PR merge)

1. `npm run dev` → sign in as admin.
2. Visit any item detail → click **Print label** → cycle QR / Code 128 / Code 39 / EAN-13. With `AUD-MIC-01`-style SKU expect Code 39 to render (uppercase, valid chars) and EAN-13 to refuse with hint. Browser print dialog opens for QR / Code 128 / Code 39.
3. Visit `/inventory/new` → create an item with a Location (e.g. "Warehouse A, Shelf 3"). Detail shows the location.
4. Visit `/delivery-orders` → empty list. Click **New**. Upload a small PDF (<5MB). Type vendor. Pick 2 items in the multi-combobox. Submit.
5. Land on `/delivery-orders/{doId}` → vendor + file link + item links.
6. Open one of the linked items → "Delivery orders" chips visible in Details tab, click chip → back on the DO.
7. Sign out, sign back in as **staff** → `/delivery-orders/new` rejects (action calls `requireAdmin`); `/delivery-orders` list still readable, sidebar nav hidden.
8. **Regression smokes** — confirm v1 flows still work: inventory list filter, stock adjust, retire, event create, scan check-out/check-in, reports stock/out/missing.

## Regression risk surface

- **No quantity-mutating action touched.** `availableQty / totalQty / outQty / damagedQty / lifecycleState` writes are unchanged.
- **No existing schema field renamed or removed.** All changes additive.
- **Default `PrintLabelButton` format is `qrcode`** — current operators see identical behaviour unless they actively pick another format.
- **Location defaults to `""`** on legacy items; render shows `—`. No backfill needed.
- **Sidebar nav** filtered by existing `roles: ["admin"]` array; staff never see Delivery Orders.
- **`firestore.indexes.json` unchanged** — confirmed by `git diff`.

## Out of scope (deferred)

- REST-API printer integration (user explicitly deferred — "for now just add a support to print out the label")
- Vendor master / vendor reuse across DOs (free-text per-DO for v1)
- Receiving dashboard / scan-on-intake
- DO edit / delete (immutable in v1 via `allow update, delete: if false`)
- Bulk label print / PDF export
- Item-list location column / location filter
- Cloud Function GC sweep for orphan Storage blobs
- Photo upload (already shipped pre-claim)

## File counts

- New files: 11
- Modified files: 14
- Net LOC: +1333 / −36
