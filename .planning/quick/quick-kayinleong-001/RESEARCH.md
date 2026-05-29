# Research — quick-kayinleong-001

**Date:** 2026-05-29
**Scope:** three implementation points — bwip-js multi-format, Firebase Storage for DO documents, multi-select item picker.
**Confidence:** HIGH (everything verified against installed source / project files).

---

## 1. bwip-js multi-format

### Format → bcid mapping

Verified against the installed `bwip-js@4.10.1` type defs at `node_modules/bwip-js/dist/bwip-js.d.ts:484, 223, 235, 316`:

| User-facing label | bwip-js `bcid` | Verified at |
|---|---|---|
| QR | `qrcode` | d.ts:484 |
| Code 128 | `code128` | d.ts:223 |
| Code 39 | `code39` | d.ts:235 |
| EAN-13 | `ean13` | d.ts:316 |

Already in use today with `bcid: "qrcode"` at `components/feature/inventory/LabelPreview.tsx:22`.

### Validation per format

`bwipjs.toCanvas()` is **synchronous** and **throws** on invalid input (see existing try/catch at `LabelPreview.tsx:20-33`). The existing component already logs and degrades gracefully — but for a user-chosen format we want to **pre-validate before calling toCanvas** so we can show a clear hint instead of silent failure.

Constraints per format (verified via BWIPP wiki / EAN-13 spec):

| Format | Accepts | Notes |
|---|---|---|
| `qrcode` | Any UTF-8 string up to ~2k chars in practice | Effectively unrestricted for SKU payloads. No pre-validation needed. |
| `code128` | Any 8-bit string; full ASCII | Effectively unrestricted for SKUs. No pre-validation needed. |
| `code39` | `0-9`, `A-Z` (uppercase only), space, `-` `.` `$` `/` `+` `%` `*` | **Lowercase will throw.** Validate with `^[0-9A-Z \-.$/+%*]+$`. |
| `ean13` | Exactly 12 numeric digits — bwip-js auto-appends the check digit (13th). Also accepts the full 13 digits if `includecheck` is left at default. | Validate with `^\d{12}$` or `^\d{13}$`. If the SKU isn't numeric or is the wrong length, EAN-13 is impossible. |

**Project SKU shape:** SKUs are doc IDs in `inventory/{itemId}` and free-form admin-entered strings (no zod constraint on format beyond non-empty — checked via `CreateItemSchema` in `lib/schemas/item.ts`). So `code39` and `ean13` will commonly be invalid for a given SKU.

### Render defaults

For QR (existing) keep:
```ts
{ bcid: "qrcode", text: sku, scale: 4, includetext: false, paddingwidth: 8, paddingheight: 8 }
```

For 1D barcodes (`code128`, `code39`, `ean13`) — the SKU must be human-readable beneath the bars (operator needs a fallback when the scanner can't read the print):

```ts
{
  bcid: "code128" | "code39" | "ean13",
  text: sku,
  scale: 3,              // smaller than QR — 1D barcodes are wider than tall
  height: 12,            // millimetres; reasonable label height
  includetext: true,     // print human-readable digits/chars below the bars
  textxalign: "center",
  textsize: 10,
  paddingwidth: 8,
  paddingheight: 8,
}
```

The `paddingwidth: 8` / `paddingheight: 8` defaults from the existing component carry over fine for 1D too. Don't set `width` — let bwip-js choose the smallest in-spec module width per the README note about "quantum" sizes at 72 dpi (README:170-181).

### Async surprises

None. `toCanvas(HTMLCanvasElement, RenderOptions)` is a synchronous void-returning call (d.ts:195). No await needed. All four formats share the same call signature. The existing `useEffect(() => { try { bwipjs.toCanvas(...) } catch (err) { ... } }, [value])` pattern at `LabelPreview.tsx:18-34` works unchanged; just add `format` to the deps array.

### Recommendation

1. **Add `format: "qrcode" | "code128" | "code39" | "ean13"` prop to `LabelPreview`** with default `"qrcode"`. Apply the render-defaults table above.
2. **Validate the SKU against the format in `PrintLabelButton`** *before* opening the print dialog. Show a disabled-state hint when the SKU doesn't fit (e.g. "EAN-13 requires 12 digits — this SKU has letters"). Fall-back-to-QR is tempting but silently changing the user's chosen format is a worse UX than refusing — go with **refuse with hint**. Cheap validator:

   ```ts
   function canEncode(sku: string, fmt: BarcodeFormat): { ok: true } | { ok: false; reason: string } {
     if (fmt === "qrcode" || fmt === "code128") return { ok: true };
     if (fmt === "code39")
       return /^[0-9A-Z \-.$/+%*]+$/.test(sku)
         ? { ok: true }
         : { ok: false, reason: "Code 39 needs uppercase A–Z, 0–9, and - . $ / + % * only." };
     if (fmt === "ean13")
       return /^\d{12,13}$/.test(sku)
         ? { ok: true }
         : { ok: false, reason: "EAN-13 needs exactly 12 or 13 digits." };
     return { ok: false, reason: "Unknown format" };
   }
   ```
3. **UI shape:** `Select` (existing shadcn primitive at `components/ui/select.tsx`) inside the existing dialog — 4 options, default QR. Re-render preview on change. No persistence — user re-picks each print session (label format is presentation, not data).

---

## 2. Firebase Storage for DO documents

### Storage path

```
delivery-orders/{doId}/document.{pdf|jpg|png}
```

Rationale:
- Mirrors the `items/{itemId}/photo.jpg` pattern (`storage.rules:29`) — one immutable doc per upload, fixed filename keyed by content-type extension, no rename plumbing.
- `{doId}` is the Firestore `deliveryOrders/{doId}` doc ID (admin-generated UUID or auto-id from `adminDb.collection("deliveryOrders").doc()`). 1:1 mapping.
- Letting the extension vary by content-type means the same path semantics work for the 3 allowed types without needing to URL-encode user filenames.

### storage.rules diff

Add **between** the `match /items/.../photo.jpg` block and the catch-all (`storage.rules:29-39`):

```javascript
// DO uploads — admin-only write (Server Action enforces; rule mirrors the
// Storage-level guard from items/{itemId}/photo.jpg). Signed-in read so any
// staff can view a DO when looking at an item that references it.
// Size cap 10MB (PDFs can be larger than photos — vendors send scanned A4).
// contentType allowlist: pdf | jpg | png. Webp deliberately excluded
// (vendors don't send webp).
match /delivery-orders/{doId}/document.{ext} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
               && request.resource.size < 10 * 1024 * 1024
               && (request.resource.contentType == 'application/pdf'
                   || request.resource.contentType == 'image/jpeg'
                   || request.resource.contentType == 'image/png');
}
```

Note: the existing `items/{itemId}/photo.jpg` rule (`storage.rules:24-28`) documents that the admin gate was moved from Storage to the Server Action because of a cross-service `firestore.get()` eval issue. **Use the same approach for DOs** — Server Action calls `requireAdmin()`, Storage rule only enforces signed-in + size + content-type.

Cap rationale: photo cap is 5MB (`storage.rules:32`). DO documents can plausibly be multi-page scanned PDFs at 1–3 MB. 10MB gives headroom without enabling abuse.

### Upload helper (recommended pattern)

New file `lib/storage/upload-delivery-order.ts`, mirroring `lib/storage/upload-photo.ts`:

```ts
"use client";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

const ALLOWED = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

export type DoUploadProgress = { bytesTransferred: number; totalBytes: number };

export async function uploadDeliveryOrderDocument(
  doId: string,
  file: File,
  onProgress?: (p: DoUploadProgress) => void,
): Promise<{ url: string; contentType: string; path: string }> {
  const ext = ALLOWED[file.type as keyof typeof ALLOWED];
  if (!ext) throw new Error("Unsupported file type. Use PDF, JPG, or PNG.");
  if (file.size >= 10 * 1024 * 1024) throw new Error("File exceeds 10MB.");

  const path = `delivery-orders/${doId}/document.${ext}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.({ bytesTransferred: snap.bytesTransferred, totalBytes: snap.totalBytes }),
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, contentType: file.type, path });
      },
    );
  });
}
```

### File-naming choice

**Pick: store as `document.<ext>` keyed by content-type.** Three reasons:
1. Matches the project's existing pattern at `items/{itemId}/photo.jpg` (`upload-photo.ts:43`) — one fixed filename, replace-on-upload semantics (D-14).
2. No risk of path-injection from a user-supplied filename (e.g. `../../../etc/passwd`); no URL-encoding plumbing needed.
3. Original filename can still be preserved as a **Firestore field** on `deliveryOrders/{doId}` — `originalFilename: "vendor-X-2026-05-28.pdf"` — for display in the UI. Storage path stays canonical.

Persisted on the `deliveryOrders/{doId}` doc:
```ts
{
  fileUrl: string;          // getDownloadURL output
  filePath: string;         // delivery-orders/{doId}/document.pdf — for future deletes
  originalFilename: string; // user-display only
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  // ...vendor, itemIds[], uploadedAt, uploadedBy
}
```

### Recommendation

- **Use `uploadBytesResumable`** (not `uploadBytes`). PDFs can be 5–10MB and uploads from office Wi-Fi may take seconds. Progress UI (shadcn `Progress` at `components/ui/progress.tsx` is already available) keeps the operator aware vs. a frozen-looking spinner. The existing photo helper uses `uploadBytes` because compressed photos are ~300KB; DO documents are 30x larger.
- **Client-component upload flow**, identical to `ItemPhotoField.tsx`: a `"use client"` form component (`DeliveryOrderUploadField.tsx`) calls `uploadDeliveryOrderDocument(doId, file, onProgress)`, then passes `{ fileUrl, filePath, originalFilename, contentType }` into the `createDeliveryOrder` Server Action payload, which writes the Firestore doc. **Generate `doId` client-side first** (`doc(collection(db, "deliveryOrders")).id` or `crypto.randomUUID()`) so the upload path is fixed before the Storage call.
- **Server Action** (`app/(app)/delivery-orders/actions.ts`) calls `requireAdmin()` and writes `deliveryOrders/{doId}` via `adminDb.runTransaction` — defense-in-depth admin gate (Storage rule already gates signed-in + size + content-type).

---

## 3. Multi-select item picker

### Existing components in this repo

**Exact pattern to imitate (file-by-file):**

| File | What it does | Why it's the template |
|---|---|---|
| `components/feature/events/BackupTeamCombobox.tsx:39-135` | Multi-select user picker — `Command` + `Popover` + `Badge` chips with `X` remove buttons | Same UI shape as what the DO form needs: pick many entities from a list of dozens-to-hundreds. |
| `components/feature/events/TeamLeadCombobox.tsx:39-128` | Sibling multi-select with same shape | Even simpler — no `excludeUids` plumbing. Closer to the DO use-case. |
| `components/feature/events/EventForm.tsx:60-61` | Imports both comboboxes, passes `users={users}` as prop | Shows how parent forms feed an SSR-loaded list down. |
| `app/(app)/events/new/page.tsx:27-32` | SSR seed: `const { users } = await getUsersPage({ limit: 200 })` then `<EventForm users={users} />` | Exact SSR-prefetch pattern to copy for items. |

All four shadcn primitives needed are already in `components/ui/`:
- `command.tsx` (cmdk-driven typeahead)
- `popover.tsx` (Radix popover)
- `badge.tsx` (selected-chip rendering)
- `checkbox.tsx` (not actually used by the existing pattern — `Check` icon from lucide is used instead)

**There is no generic shadcn v4 MultiSelect/Combobox** in the registry. The `BackupTeamCombobox` is a project-local composition of those primitives, and it's the lightest viable pattern. Don't pull in a third-party multi-select lib.

### Recommended pattern

Copy `TeamLeadCombobox.tsx` verbatim into `components/feature/inventory/InventoryItemMultiCombobox.tsx` and substitute:
- `users: UserDoc[]` → `items: InventoryItem[]`
- `value: string[]` (uids) → `value: string[]` (item IDs / SKUs)
- `u.displayName` / `u.email` → `item.name` / `item.sku`
- `u.role` → `item.category`
- `u.disabled` filter → `item.lifecycleState !== "retired"` filter (don't show retired items in the picker)

Filename: `InventoryItemMultiCombobox.tsx` (kept under `components/feature/inventory/` because it's an inventory-list-driven picker; the DO upload form imports it).

### Loading strategy

**Server-component prefetch via `getInventoryPage`** (`lib/data/inventory.server.ts:70-97`) at the DO form page:

```ts
// app/(app)/delivery-orders/new/page.tsx
const { items } = await getInventoryPage({ limit: 500 });
return <DeliveryOrderForm items={items} />;
```

`limit: 500` mirrors the checkin form's existing pattern (`app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx:106,111,116`). 500 is the largest single-page cap the project uses today and is well within Firestore's `get()` limits.

**Why server prefetch, not client `useEffect` query:**
- DO upload is an **admin-only page** (`requireAdmin()`), so it's behind a router-level gate — adding the SSR fetch adds one round-trip on navigation, not on every keystroke.
- This is internal tooling, "hundreds of items at most" per the brief. The full list fits comfortably in one Firestore page + payload.
- The page already gets a fresh items list every navigation — no staleness concern.
- Matches the codebase convention: `/events/new` SSR-loads `users` with `limit: 200`, `/inventory` SSR-loads first page of items with `limit: 50`. We are not introducing a new pattern.

**Search behaviour:** **Load all + client-side filter via `CommandInput` typeahead.** `Command` (cmdk) already does substring matching against the `value` prop on each `CommandItem` (see `BackupTeamCombobox.tsx:91` — `value={\`${u.displayName} ${u.email}\`}`). For the items picker, use `value={\`${item.name} ${item.sku} ${item.category}\`}` so a user can type any of those tokens.

Do not paginate inside the picker. With ≤500 items the DOM cost is negligible and `cmdk` virtualization is unnecessary at this scale.

### Recommendation

1. **New component:** `components/feature/inventory/InventoryItemMultiCombobox.tsx` — copy `TeamLeadCombobox` verbatim, substitute item fields.
2. **SSR-prefetch items list** in `app/(app)/delivery-orders/new/page.tsx` and `app/(app)/delivery-orders/[doId]/edit/page.tsx` (if edit is in scope) via `getInventoryPage({ limit: 500 })`. Filter `lifecycleState !== "retired"` client-side inside the combobox (the SSR list keeps retired items for completeness; the combobox hides them like `BackupTeamCombobox` hides `disabled` users).
3. **Form integration:** the DO form passes `itemIds: string[]` into the `createDeliveryOrder` Server Action; the action persists it on `deliveryOrders/{doId}.itemIds` and (optionally) writes the back-reference `inventory/{itemId}.deliveryOrderIds: string[]` via `FieldValue.arrayUnion(doId)` inside the same `runTransaction`.

---

## Pitfalls / gotchas

- **bwip-js `toCanvas` throws synchronously** on invalid input — keep the existing `try/catch` in `LabelPreview.tsx`. Don't wrap in `await` / `.catch()`, you'll miss the throw.
- **Code 39 lowercase is a silent foot-gun.** Operator types `sku-001` lowercase → throws "bwipp: Invalid character". Validator-in-`PrintLabelButton` is the cleanest defence; don't auto-uppercase (lossy and confusing).
- **EAN-13 with 12 digits is correct.** bwip-js auto-appends the 13th check digit. Don't manually compute the check digit and pass 13 — that double-encodes unless you set `includecheck: false`. Easiest: just accept 12 OR 13 digits.
- **Storage rule path globbing.** `match /delivery-orders/{doId}/document.{ext}` uses a path-segment glob. Verify it allows `document.pdf`, `document.jpg`, `document.png` and **rejects** `document.exe` — test with the Firebase Rules emulator before deploying (the project already has Storage rule unit-test infra implied by `storage.rules` comments at lines 22-28).
- **Cross-service rule eval bug is documented in `storage.rules:22-28`** — the `firestore.get()` admin check inside Storage rules fails inconsistently. For DOs, **do not** try to enforce admin-only via Storage rules with a cross-service check. Keep admin gate at the Server Action layer; Storage rule only enforces signed-in + size + content-type.
- **Storage download URL host** — Storage download URLs use the bucket's `*.firebasestorage.app` host. The existing photo component uses a plain `<img>` and an `eslint-disable-next-line @next/next/no-img-element` (see `ItemPhotoField.tsx:152-157`) to avoid `next.config.ts` `images.remotePatterns` plumbing. **For PDF DOs**, render an `<a href={url} target="_blank" rel="noreferrer">` "Open document" link rather than embedding — PDFs in `<iframe>` are inconsistent across browsers and overkill for the v1 ask. For JPG/PNG DOs reuse the same plain `<img>` + eslint-disable approach.
- **`uploadBytesResumable` returns a task, not a Promise.** The pattern in §2 wraps it in `new Promise` and resolves in the `complete` callback — copy that shape, don't `await` the task directly (it won't resolve).
- **doId must exist before upload.** Generate the doc ID client-side (`doc(collection(db, "deliveryOrders")).id`) so the Storage path is known before the upload starts. If you upload first and then create the Firestore doc and they race, you can leak an orphan storage blob if the Firestore write fails. Order: generate id → upload → call Server Action with `{ doId, fileUrl, filePath, originalFilename, contentType, vendor, itemIds }` → Server Action writes Firestore doc with `doc(doId)` (deterministic write). If the Server Action write fails, log the orphan blob path for manual cleanup (acceptable for v1; future: a Cloud Function GC sweep).
- **`firestore.indexes.json` already has 19 indexes** (per `phase-kayinleong-02` SUMMARY and confirmed by index file inspection). For the DO list/picker:
  - Listing `deliveryOrders` by `uploadedAt desc` needs a single-field index — Firestore auto-creates these, no manual index needed.
  - Filtering `inventory where deliveryOrderIds array-contains <doId>` needs only the array-contains single-field index, which Firestore auto-creates.
  - **No new entries in `firestore.indexes.json` are required** for v1 unless we add a combined filter (e.g. `vendor + uploadedAt`). Defer until proven necessary.
- **Combobox payload size at 500 items.** Each item carries ~20 fields. SSR payload ≈ 200KB raw; gzipped ≈ 30KB. Fine for an admin-only page. If items grow past a few thousand, switch to a server-side typeahead (Firestore `where("name", ">=", q).where("name", "<=", q + "")`), but that's premature for the stated scale.

---

## Sources

- **Installed package (HIGH):** `node_modules/bwip-js/dist/bwip-js.d.ts` (lines 195, 223, 235, 316, 484) — bcid names + sync `toCanvas` signature
- **Installed package (HIGH):** `node_modules/bwip-js/README.md:106-181` — option semantics, sync error throwing, sizing quanta
- **Project files (HIGH):** `storage.rules:13-40`, `firestore.rules:43-57`, `lib/storage/upload-photo.ts:32-46`, `components/feature/inventory/{LabelPreview,PrintLabelButton,ItemPhotoField}.tsx`, `components/feature/events/{TeamLead,BackupTeam}Combobox.tsx`, `app/(app)/events/new/page.tsx`, `lib/data/inventory.server.ts:70-103`, `app/(app)/inventory/actions.ts:39-60`
- **Web (MEDIUM):** [BWIPP Code 39 wiki](https://github.com/bwipp/postscriptbarcode/wiki/Code-39) — Code 39 character set (uppercase only)
- **Web (MEDIUM):** [Firebase Storage core syntax](https://firebase.google.com/docs/storage/security/core-syntax), [Storage rules conditions](https://firebase.google.com/docs/storage/security/rules-conditions) — `contentType.matches()` and multi-type allow patterns
- **Web (LOW, single source):** EAN-13 12-digits-with-auto-checkdigit behaviour — confirmed by [BarcodeOcean EAN-13 calculator](https://www.barcodeocean.com/check-digit-calculator) and corroborated by general barcode-library convention; recommend a one-line test in dev to confirm bwip-js 4.10.1 honours this (call `bwipjs.toCanvas(c, { bcid: "ean13", text: "012345678901" })` and verify no throw).
