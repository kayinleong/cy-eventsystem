---
quick_id: quick-kayinleong-001
owner: kayinleong
description: User-feedback features — barcode format picker, location field, DO upload (minimal slice). Photo upload already shipped.
flags: --research
must_haves:
  truths:
    - Photo upload is ALREADY SHIPPED (audit confirmed `photoUrl`, `ItemPhotoField`, `lib/storage/upload-photo.ts`, storage rules, detail page display); no work needed.
    - All v1 quantity invariants stay intact — no Server Action touched by this plan mutates `availableQty | totalQty | outQty | damagedQty | lifecycleState`. Only new optional fields and a new collection are introduced.
    - Admin gate stays at Server Action layer (`requireAdmin()`). Storage / Firestore rules enforce signed-in + shape only, not role (per documented cross-service-rule limitation in `storage.rules:22-28`).
    - bwip-js@4.10.1 is already installed and already used; no new deps.
    - Label printing stays browser-print only (REST-API printer integration explicitly deferred by user).
  artifacts:
    - .planning/quick/quick-kayinleong-001/AUDIT.md (gap analysis)
    - .planning/quick/quick-kayinleong-001/RESEARCH.md (bwip-js bcid mapping, Storage upload pattern, multi-select pattern)
  key_links:
    - lib/types/item.ts (extend with `location: string` + `deliveryOrderIds: string[]`)
    - lib/schemas/item.ts (ItemFormSchema, CreateItemSchema, UpdateItemSchema)
    - components/feature/inventory/ItemForm.tsx (add location input)
    - components/feature/inventory/ItemDetail.tsx (show location + DO history block)
    - components/feature/inventory/{LabelPreview,PrintLabelButton}.tsx (format picker)
    - app/(app)/inventory/actions.ts (createItem/updateItem accept location + deliveryOrderIds)
    - firestore.rules (extend inventory update validator; add deliveryOrders match)
    - storage.rules (add delivery-orders/{doId}/document.{ext} block)
    - components/feature/events/TeamLeadCombobox.tsx (template to copy for inventory multi-select)
    - app/(app)/events/new/page.tsx (SSR-prefetch pattern to imitate)
---

# PLAN — quick-kayinleong-001

User feedback maps to three units of work (photo upload is already shipped). Each is a single atomic commit. Pattern fidelity matters more than novelty — every change copies an existing pattern from v1.

Decisions locked from discussion:
- **Photo:** skipped (already shipped; verified in AUDIT.md).
- **DO:** minimal slice — new `deliveryOrders` collection with `{ vendor, fileUrl, filePath, originalFilename, contentType, itemIds[], uploadedAt, uploadedBy }`; admin upload page + back-reference on items.
- **Location:** free-text input on the item form (single string field).
- **Barcode:** user picks at print time — dropdown with QR / Code 128 / Code 39 / EAN-13.

---

## Task A — Label format picker (QR / Code 128 / Code 39 / EAN-13)

**Files**
- `components/feature/inventory/LabelPreview.tsx` — add `format` prop, route to `bcid`, apply 1D render defaults
- `components/feature/inventory/PrintLabelButton.tsx` — add a shadcn `Select` for format, pre-validate SKU per format, refuse-with-hint on invalid
- `lib/labels.ts` (NEW) — small pure helper: `BarcodeFormat` type, `LABEL_FORMATS` list, `canEncode(sku, fmt)` validator

**Action**
1. Create `lib/labels.ts`:
   ```ts
   export type BarcodeFormat = "qrcode" | "code128" | "code39" | "ean13";
   export const LABEL_FORMATS: Array<{ value: BarcodeFormat; label: string }> = [
     { value: "qrcode",  label: "QR" },
     { value: "code128", label: "Code 128" },
     { value: "code39",  label: "Code 39" },
     { value: "ean13",   label: "EAN-13" },
   ];
   export function canEncode(sku: string, fmt: BarcodeFormat):
     | { ok: true } | { ok: false; reason: string } { /* per RESEARCH §1.2 */ }
   ```
2. `LabelPreview.tsx`: add `format?: BarcodeFormat` prop (default `"qrcode"`); switch `bwipjs.toCanvas` options on format per RESEARCH §1.3 (QR keeps current settings; 1D barcodes use `scale: 3, height: 12, includetext: true, textxalign: "center", textsize: 10, paddingwidth: 8, paddingheight: 8`). Keep the existing try/catch.
3. `PrintLabelButton.tsx`: add `useState<BarcodeFormat>("qrcode")` and a `Select` above the preview. On change, re-render the preview. Compute `canEncode(sku, format)` once per render; when not ok, replace the preview with a small muted-tone hint card showing the reason, and disable the Print button. When ok, render `<LabelPreview value={sku} format={format} />` and update the human-readable text below (font-mono for the SKU regardless of format).

**Verify**
- `npm run lint && tsc --noEmit` clean.
- Manual smoke: visit any item detail with an alphanumeric SKU (e.g. `AUD-MIC-01`), open Print label, switch through all four formats — QR + Code 128 + Code 39 render correctly; EAN-13 shows the "needs 12-13 digits" hint and disables Print.
- Test EAN-13 with a 12-digit numeric SKU (or temporarily seed one) — bwip-js auto-appends check digit, prints clean.
- Print preview hides chrome and only the label block appears.

**Done**
- Format picker visible; renders for all four formats; refuses unsupported SKUs with a clear hint; print works; no regressions to the existing QR flow when "QR" is the (default) selection.

---

## Task B — Location field on items

**Files**
- `lib/types/item.ts` — add `location: string` to `InventoryItem`
- `lib/schemas/item.ts` — add `location` (max 100 chars, default `""`) to `ItemSchema`, `ItemFormSchema`, `CreateItemSchema`, `UpdateItemSchema`
- `components/feature/inventory/ItemForm.tsx` — `<Input>` "Location" field (placed between Low-stock threshold and Photo)
- `components/feature/inventory/ItemDetail.tsx` — show `item.location` in the Details tab (above Unit; show `—` when empty)
- `app/(app)/inventory/actions.ts` — `createItem` writes `location: data.location ?? ""`; `updateItem` includes `location` in its update payload when present
- `firestore.rules` — extend inventory `allow update` to permit `location` writes (no extra validator beyond existing `availableQty` invariant; `location` is a free string)
- `lib/data/inventory.server.ts` — confirm `location` is returned by reads (likely no change needed if it does object pass-through, but verify)
- `lib/mock/items.ts` (if seeds exist) — add a sensible `location` to each mock item so existing dev/test snapshots are well-formed

**Action**
1. Add `location: string` to `InventoryItem`.
2. Extend the four Zod schemas with `location: z.string().max(100).default("")`. Decision: max 100 chars, free text. No validator on character set (warehouse codes vary).
3. Add input to `ItemForm`: label "Location", `placeholder="e.g. Warehouse A, Shelf 3"`, `{...register("location")}`, with `FieldError`.
4. Wire `location` into both create and update Server Actions. The shape spread already covers it once schemas include it, but explicit set/update writes keep the diff readable.
5. Display in `ItemDetail`:
   ```tsx
   <div>
     <dt className="text-muted-foreground">Location</dt>
     <dd>{item.location || <span className="text-muted-foreground">—</span>}</dd>
   </div>
   ```
6. Firestore rule: no validator change strictly required because `location` isn't constrained, but for hygiene keep the existing `availableQty` invariant and add no further conditions (the field is optional and free-form). If we add a type check at all, it's `request.resource.data.location is string`.
7. Backfill: existing items have no `location` field. On read, Firestore returns `undefined` which Zod's `.default("")` normalizes to `""` on the next mutation. No migration script needed for this scale.

**Verify**
- `npm run lint && tsc --noEmit` clean.
- Create a new item with a location ("Warehouse A, Shelf 3"); detail page shows it.
- Edit the location; detail page shows the new value.
- Existing items without a location field render `—` on the detail page (defaults work).
- Firestore rules emulator (if test infra exists) accepts the update with `location`; rejects update that violates the `availableQty` invariant (regression check).
- Inventory list still renders (no schema-shape break).

**Done**
- Admin can set/edit location on every item; detail page shows it; existing items don't error.

---

## Task C — Delivery Order (DO) upload — minimal slice

This is the largest piece. Strictly minimal — no vendor master, no receiving dashboard, no scan-based intake. Just: admin uploads a DO file, types vendor name, picks items, gets a record they can refer to. Items keep a back-reference for traceability.

### C.1 — Domain + Storage scaffolding

**Files**
- `lib/types/delivery-order.ts` (NEW) — `DeliveryOrder` type:
  ```ts
  export type DeliveryOrder = {
    id: string;
    vendor: string;
    fileUrl: string;
    filePath: string;          // delivery-orders/{id}/document.<ext>
    originalFilename: string;
    contentType: "application/pdf" | "image/jpeg" | "image/png";
    itemIds: string[];         // inventory item IDs (SKUs)
    notes: string;
    uploadedAt: string;        // ISO
    uploadedBy: string;        // uid
  };
  ```
- `lib/schemas/delivery-order.ts` (NEW) — Zod schemas:
  - `DeliveryOrderSchema` (full doc, for reads)
  - `CreateDeliveryOrderSchema` (Server Action input — `vendor`, `fileUrl`, `filePath`, `originalFilename`, `contentType`, `itemIds[]` (min 1), `notes` (max 2000))
- `lib/storage/upload-delivery-order.ts` (NEW) — exactly the helper sketched in RESEARCH §2.3 using `uploadBytesResumable`; returns `{ url, contentType, path }`.
- `lib/types/item.ts` — add `deliveryOrderIds: string[]` (optional array; default `[]` when absent)
- `lib/schemas/item.ts` — extend `ItemSchema` with `deliveryOrderIds: z.array(z.string()).default([])`. Form schemas do NOT include it (back-reference is server-managed, never user-editable from `ItemForm`).
- `storage.rules` — add `delivery-orders/{doId}/document.{ext}` rule per RESEARCH §2.2
- `firestore.rules` — add `match /deliveryOrders/{doId}` block:
  - `allow get, list: if isSignedIn();`
  - `allow create: if isAdmin();`
  - `allow update, delete: if false;` (v1 = immutable; future v2 might allow delete by admin)
  - Extend `/inventory/{itemId}` `allow update` to permit `deliveryOrderIds` writes (server-managed via `arrayUnion`; rule allows the update as long as `availableQty` invariant still holds — current rule already permits arbitrary other fields)

**Action**
1. Land the types + schemas.
2. Land the upload helper.
3. Update storage.rules and firestore.rules.
4. **Do NOT yet write the UI or the Server Action.** Commit this scaffolding so the next sub-task has a clean foundation.

**Verify**
- `tsc --noEmit` clean.
- Firebase emulator (if started in dev) parses both rule files without syntax errors. If no emulator handy, eyeball-validate against the existing rule syntax (the project's `firestore.rules` already follows the same shape).

**Done**
- Types + schemas + helper + rules diffs committed atomically; no UI yet.

### C.2 — Server Action + admin page + inventory multi-select

**Files**
- `app/(app)/delivery-orders/page.tsx` (NEW) — admin-only list page. Calls `requireAdmin()`, fetches recent DOs via `adminDb.collection("deliveryOrders").orderBy("uploadedAt", "desc").limit(50)`. Renders a table: Vendor | File | Items count | Uploaded at | Action (View). Card + Table primitives already exist.
- `app/(app)/delivery-orders/new/page.tsx` (NEW) — admin-only upload form page. SSR-prefetches inventory list via `getInventoryPage({ limit: 500 })` and renders `<DeliveryOrderForm items={items} />`.
- `app/(app)/delivery-orders/[doId]/page.tsx` (NEW) — DO detail page. Shows vendor, file link (open in new tab), items list (with links back to each item), uploaded by/at.
- `app/(app)/delivery-orders/actions.ts` (NEW) — `createDeliveryOrder(input)`:
  - `requireAdmin()`
  - `CreateDeliveryOrderSchema.safeParse(input)`
  - `adminDb.runTransaction`:
    - Set `deliveryOrders/{doId}` with the parsed fields + `uploadedAt: new Date().toISOString()` + `uploadedBy: session.uid`
    - For each `itemId`, `tx.update(inventoryRef, { deliveryOrderIds: FieldValue.arrayUnion(doId) })` — but only if the item exists (tx.get assert, skip-and-warn if missing rather than abort, since the picker may be slightly stale)
  - `revalidatePath("/delivery-orders")` and `revalidatePath("/inventory/<each itemId>")`
  - Returns `{ ok: true, doId }`
- `components/feature/inventory/InventoryItemMultiCombobox.tsx` (NEW) — copy `TeamLeadCombobox.tsx` verbatim, substitute fields per RESEARCH §3.2. Hide `lifecycleState === "retired"` items.
- `components/feature/delivery-orders/DeliveryOrderForm.tsx` (NEW) — client component:
  - `useForm` with `DeliveryOrderFormSchema` (vendor, notes, itemIds[])
  - File input + `uploadDeliveryOrderDocument(doId, file, onProgress)` (client-side doId via `crypto.randomUUID()`)
  - Progress bar via shadcn `Progress`
  - `InventoryItemMultiCombobox` for items
  - On submit: call `createDeliveryOrder({ doId, vendor, fileUrl, filePath, originalFilename, contentType, itemIds, notes })`
- `components/feature/delivery-orders/DeliveryOrderUploadField.tsx` (NEW) — file picker (PDF / JPG / PNG), progress UI; exposes `onUploaded({ fileUrl, filePath, originalFilename, contentType })`
- `components/feature/inventory/ItemDetail.tsx` — extend Details tab with a "Delivery orders" subsection showing chips/links per `deliveryOrderIds` (load the DO docs server-side from the page that renders ItemDetail and pass them down as a prop — keeps ItemDetail server-render-friendly).
- `app/(app)/inventory/[itemId]/page.tsx` — fetch `deliveryOrders` referenced by the item (server-side, batched `getAll`) and pass `deliveryOrders={...}` to ItemDetail.
- `components/feature/shell/AppSidebar.tsx` — add nav item: `{ href: "/delivery-orders", label: "Delivery Orders", icon: Truck, roles: ["admin"] }`. Same admin-only filter as Users.
- `components/feature/shell/MobileNavSheet.tsx` — mirror the nav item for parity.

**Action**
1. Land the new component + page + action files in one commit (or split server-then-client commits if it's cleaner — executor decision).
2. Sidebar update committed last in this sub-task so the nav item only appears when the destination exists.

**Verify**
- `npm run lint && tsc --noEmit` clean.
- Manual smoke:
  - As admin, visit `/delivery-orders` → empty list. Click "New".
  - Upload a small PDF (e.g. 1MB); progress reaches 100%.
  - Type vendor "Acme Audio"; pick 2 items in the multi-select.
  - Submit → redirect to `/delivery-orders/{doId}`; doc shows vendor, file link (opens), item links (open).
  - Visit one of the linked items → "Delivery orders" subsection shows a chip linking back to the DO.
  - Repeat with a JPG (image DO).
  - As a non-admin (staff) user, `/delivery-orders` 404s or unauthorized-redirects (router-level `requireAdmin` guard).
- Storage rule emulator (if available): non-admin can read DO docs; only admin can write. Files >10MB rejected. `.exe` content-type rejected.

**Done**
- Admin can upload a DO with vendor + items + file; record persists in Firestore + Storage; items keep a back-reference; non-admins can read but not create.

---

## Cross-cutting verification (after all three tasks)

- `npm run build` succeeds (Next 16 production build — full typecheck + lint pass + bundling).
- All v1 flows still work — at minimum smoke:
  - Inventory list renders, filter works, low-stock badge unchanged
  - Item create / edit (with photo + location)
  - Stock adjust, retire
  - Event create, scan check-out, scan check-in
  - Reports: stock / out / missing all load
- No new Firestore composite indexes required for v1 (per RESEARCH gotchas — array-contains + single-field indexes auto-create).
- `firestore.indexes.json` unchanged (intentional — confirm in `git diff`).
- Regression Report written into CLAIM.md `## Verification` section before commit.

---

## Out of scope (logged, not built)

- REST-API printer integration (user deferred).
- Vendor master / vendor reuse across DOs (free-text per-DO for v1).
- Receiving dashboard / scanning-on-intake.
- DO edit / delete (immutable for v1).
- Bulk label print / PDF export.
- Photo upload (already shipped).
- Item-list location column / location filter (location only on detail + edit forms for v1; column can come in a follow-up if usage demands).

---

## Risks & mitigations

- **Orphan storage blob on Server Action failure.** Mitigation: log the orphan path; manual cleanup; v2 will add a Cloud Function GC sweep. (Per RESEARCH gotcha §7.)
- **`items` SSR payload at limit=500.** ~200KB raw / 30KB gzipped per RESEARCH §3.3 — fine; will revisit at >1k items.
- **Storage rule path-glob behaviour.** Need to confirm `match /delivery-orders/{doId}/document.{ext}` matches `.pdf|.jpg|.png` and rejects others. If the wildcard glob bites, fall back to three explicit `match` blocks (one per extension).
- **Sidebar icon import.** Lucide ships `Truck`; verify (`import { Truck } from "lucide-react"`).
