# Audit — quick-kayinleong-001

**Date:** 2026-05-29
**Auditor:** Explore agent (read-only)
**Sources:** lib/types/item.ts, components/feature/inventory/*, app/inventory/**, firestore.rules, storage.rules, package.json

---

## Feature 1: Photo upload — **PRESENT (complete)**

**Evidence:**
- Type: `InventoryItem.photoUrl: string | null` — `lib/types/item.ts:27`
- Component: `components/feature/inventory/ItemPhotoField.tsx` (file picker + camera capture, client-side compression via `browser-image-compression`)
- Upload helper: `lib/storage/upload-photo.ts:32-46` — Web SDK `ref()`, `uploadBytes()`, `getDownloadURL()`; storage path `items/{itemId}/photo.jpg`; target 0.3MB / 1600px / JPEG q=0.85
- Wired into both `/inventory/new` and `/inventory/[id]/edit` forms via `ItemForm.tsx:296-309`
- Displayed on detail page `ItemDetail.tsx:54-64` (renders when `item.photoUrl` set)
- Storage rules: `storage.rules:29-34` — read for signed-in, write requires signed-in + <5MB + image/*; admin gate enforced at Server Action layer (`requireAdmin()` in `createItem` / `updateItem`)

**Gaps:** None. INV-01/INV-03 + D-15 shipped.

---

## Feature 2: Delivery Order (DO) upload — **MISSING**

**Evidence:** zero grep matches for `deliveryOrder|delivery_order|vendor|purchase|receiving|receipt` across `lib/`, `components/feature/inventory/`, `app/inventory/`. No vendor field on `InventoryItem`. No receiving workflow. No DO subcollection.

**Gaps:**
- No DO document type, storage path, or rules
- No vendor field on items
- No "receiving" / intake workflow to attach DO to one or many items
- No traceability link from item → DO → vendor

**Effort sizing:** Medium-Large — this is a new domain concept (vendor + purchase event + DO file + item-to-DO links). Single quick task can deliver the minimal slice (DO file upload + items reference a DO id) but full vendor master + receiving dashboard is a separate phase.

---

## Feature 3: Location field — **MISSING**

**Evidence:** `InventoryItem` has no location/storage/shelf/warehouse/bin/rack field. `ItemForm.tsx:171-337` has no location input. `ItemDetail.tsx:115-143` Details tab shows only Unit / Low-stock / Notes. `InventoryTable.tsx` columns don't include location.

**Gaps:**
- Add `location: string` to `InventoryItem` (free-text per user feedback: "can add input field for the locations")
- Form input on create + edit
- Show on detail page
- Optional: list column or filter (per user request: "organise")
- Rules update to validate the new field (allowable type, max length)

**Effort sizing:** Small. Trivial schema extension.

---

## Feature 4: Label printing — **PARTIAL (QR only, browser-print only)**

**Library:** `bwip-js@4.10.1` (`package.json:19`) — supports both QR and many 1D barcodes.

**Print mechanism:** Browser `window.print()` + `@media print` CSS.

**Evidence:**
- `LabelPreview.tsx:1-43` — `bwipjs.toCanvas()` with `bcid: "qrcode"`, scale 4, padding 8px
- `PrintLabelButton.tsx:1-88` — Dialog → `window.print()` (line 35), `@media print` hides chrome and centers `#print-label`, prints QR + SKU + name
- Surfaced on detail page `ItemDetail.tsx:77` (single-item action)

**Gaps (per user scope):**
- User said: "for now just add a support to print out the label (qr or barcode)" — QR is already supported, **barcode is not**. Adding a barcode toggle would satisfy the user's literal ask.
- REST-API printer integration is explicitly **deferred** by user ("for now just add a support to print out the label").
- Out of scope (not requested): bulk print, PDF export, label-template customization.

**Effort sizing:** Tiny — add a `format: "qr" | "barcode"` prop / toggle to `LabelPreview` and `PrintLabelButton`. `bwip-js` already supports `code128`, `code39`, `ean13`, etc.

---

## Overall conclusion

Of the four feature requests, **photo upload is already shipped**. **Label printing is 80% there** — adding a barcode-mode toggle on the existing component is a tiny diff. **Location** is a small schema extension. **DO upload** is the biggest piece because it introduces a new domain concept (vendor + receiving record).

Cross-cutting concerns to plan around:
- All inventory writes go through Server Actions guarded by `requireAdmin()` — new fields must be added to both the Server Action validators and the Firestore rules diff
- `firestore.indexes.json` already has 19 indexes (per Phase 2 SUMMARY). Adding `location` may not need a new index for v1 (no list filter required); DO traceability will likely need one (`deliveryOrderId` ASC if we filter items by DO).
- Storage rules currently allow only `items/{itemId}/photo.jpg`. DO uploads will need a new path (e.g. `delivery-orders/{doId}/document.{pdf|jpg|png}`) + admin-only write.
- No backfill needed for `location` (default empty string), `deliveryOrderId` (default null), or label barcode format (default "qr").

## Recommended scope for this claim

Given this is a `/gsd-quick` task (small + atomic) and the user's wording "for now just add a support to print out the label", recommend:

1. **Label barcode toggle** — extend `LabelPreview` + `PrintLabelButton` with `format: "qr" | "barcode"` and a UI toggle. **(In)**
2. **Location field** — add `location: string` to type + form + detail + rules. **(In)**
3. **DO upload — minimal slice** — add a "Delivery Orders" admin page where an admin uploads a DO file + names a vendor + selects items to associate. New Firestore collection `deliveryOrders/{doId}` with `{ vendor, fileUrl, itemIds[], uploadedAt, uploadedBy }`. Link items via `deliveryOrderIds: string[]` on `InventoryItem`. Show DO history block on item detail. Storage path `delivery-orders/{doId}/document.<ext>`. **(In, but largest piece — recommend planning carefully or splitting)**
4. **Photo upload** — already done; no work. **(Out — already shipped)**
