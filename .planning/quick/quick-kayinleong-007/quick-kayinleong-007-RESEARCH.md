# quick-kayinleong-007 — Location Tracking Flow: Research

**Researched:** 2026-06-07
**Domain:** Scan page extension, Firestore batch writes, Server Action placement
**Confidence:** HIGH — all findings verified directly from codebase sources

---

## Summary

The location tracking flow needs to let staff scan an individual item barcode
(SKU or `externalBarcode`) OR a group barcode (a `checkoutGroups` doc ID), then
type a free-text location. The server resolves which items are affected and
patches `location` on each `inventory` doc.

The cleanest implementation is a **new tab** on the existing `/scan` page
alongside "Check out" and "Check in". The `/scan` page already uses a `<Tabs>`
component with `ScanMode` — adding `"location"` as a third mode tab requires
no routing changes, no new file at `/scan/location`, and keeps the scanner
widget and manual entry re-used as-is.

The two barcode namespaces — individual items and group barcodes — are
disambiguated **by size**: a `checkoutGroups` doc ID is a Firestore
auto-generated 20-character alphanumeric string, while SKUs match the pattern
`/^[A-Z0-9-]+$/i` and `externalBarcode` values are shorter manufacturer codes.
In practice the fastest disambiguation is to try to look up the value as an
individual item first (using the in-memory `useInventoryLive` snapshot), and if
nothing matches, attempt a `checkoutGroups` doc read. The Server Action already
has the same two-path lookup pattern available.

The Server Action that writes location should live in
`app/(app)/scan/actions.ts` — a new file co-located with the route. The
existing `inventory/actions.ts` contains admin-only mutations; location update
is a staff-accessible operation. The location field itself is free-text (max 100
chars, already constrained by `ItemSchema`), so no new schema is needed.

**Primary recommendation:** Add `"location"` as a third `ScanMode` tab on
`/scan`. Resolve barcodes in the UI with a new `useLocationScan` hook (similar
to the existing `addLine` in `scan-session.tsx`). Commit via a new Server Action
`updateItemsLocationAction` in `app/(app)/scan/actions.ts` that accepts
`{ barcodeValue: string; location: string }` and handles both individual-item and
group resolution server-side using the Admin SDK.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Barcode scanning / manual entry | Browser (client) | — | Reuses existing `ScannerWidget` + `ManualEntryInput`; camera is inherently client-side |
| Barcode disambiguation (item vs. group) | API / Backend (Server Action) | Browser (optimistic preview via `useInventoryLive`) | Authoritative resolution requires Firestore reads; client can show a preview from the live snapshot for UX speed |
| `location` field batch update | API / Backend (Server Action) | — | `inventory` write rule is admin-only at the Firestore level; Admin SDK bypasses rules; auth check needed in action |
| Location input UX | Browser (client) | — | Free-text input; no server round-trip until submit |
| Firestore rules for location update | Database / Storage | — | Current rule: `inventory` `update` requires admin — see decision below |

---

## Research Findings

### 1. Current `/scan` Page Structure

**Source:** `app/(app)/scan/page.tsx` [VERIFIED: codebase read]

The page is a pure Client Component that mounts `ScanSessionProvider` inside a
`<Suspense>`. The UI renders a `<Tabs>` with two `<TabsTrigger>` values:
`"checkout"` and `"checkin"`. The `ScanMode` type in
`components/feature/scan/scan-session.tsx` is `"checkout" | "checkin"`.

**Adding a third tab is feasible.** The tab value is read from a
`useScanSession()` context, and the Provider's render logic dispatches on
`mode`. Extending to three modes requires:

1. Widening `ScanMode` to `"checkout" | "checkin" | "location"` in
   `scan-session.tsx`.
2. Adding a third `<TabsTrigger value="location">` in `ScanInner`.
3. Rendering a new `LocationPanel` component when `mode === "location"` (instead
   of the cart + event-picker layout).

The alternative — a new `/scan/location` subroute — would require duplicating
`ScannerWidget`, `ManualEntryInput`, the `<Suspense>` shell, and offline gate.
This is unnecessary complexity. The tab approach is the right call.

### 2. Barcode Resolution: Item vs. Group

**Source:** `lib/types/item.ts`, `lib/types/checkout-group.ts`,
`components/feature/scan/scan-session.tsx` lines 302-313 [VERIFIED: codebase read]

**Individual items** are already resolved in `scan-session.tsx`'s `addLine`:

```typescript
const item =
  items.find((i) => i.sku.toLowerCase() === lower) ??       // SKU match
  items.find((i) => i.id === trimmed) ??                     // ID match
  items.find((i) => i.externalBarcode !== "" && i.externalBarcode === trimmed);
```

The `useInventoryLive` hook (limit 500) is already subscribed inside
`ScanSessionProvider`. For the location mode the UI can re-use this snapshot for
an optimistic preview of which items will be affected.

**Group barcodes** are `checkoutGroups` doc IDs — Firestore auto-IDs, which are
20-character alphanumeric strings (e.g., `"abc123XYZ789defGHIJK"`). They will
not match any SKU or `externalBarcode`. The disambiguation algorithm:

```
1. Try item resolution from useInventoryLive snapshot.
2. If found → single item.
3. If not found → attempt getDoc(checkoutGroups/{barcodeValue}) in Server Action.
4. If found → resolve all itemIds from itemLines.
5. If neither → "not recognized" error.
```

Doing step 3 in the Server Action (not client-side) avoids an extra Firestore
client read per scan and keeps the barcode-to-items resolution atomic with the
write.

**Client-side preview (optional UX optimization):** Since `checkoutGroups` docs
are readable by any signed-in user (Firestore rule `allow get, list: if
isSignedIn()`), the client could do a one-shot `getDoc` to show a preview
before the user confirms location. This is a UX nicety — not required for
correctness.

### 3. Server Action Placement

**Source:** `app/(app)/inventory/actions.ts`, `app/(app)/events/[eventId]/checkin/actions.ts` [VERIFIED: codebase read]

All existing inventory mutation actions use `requireAdmin()`. This matches the
Firestore rule requiring `isAdmin()` for `inventory` updates.

**The location tracking flow is staff-accessible** (not admin-only) by design.
However, the current `inventory` Firestore rule enforces:

```
allow update: if isAdmin()
  && request.resource.data.availableQty is number
  && request.resource.data.availableQty >= 0
  && request.resource.data.availableQty <= request.resource.data.totalQty;
```

The Server Action uses the **Admin SDK** (`adminDb`) which **bypasses Firestore
rules entirely**. So even though the rule requires `isAdmin()`, the Admin SDK
write goes through regardless. The auth check is therefore enforced by the
Server Action itself, not by Firestore rules.

**Decision required:** Should `location` update be:
- Admin-only (use `requireAdmin()` in the Server Action) — consistent with
  existing `updateItem`; staff cannot update location.
- Staff-accessible (use `requireSession()` + optionally check event membership)
  — any authenticated staff can track location; more useful for the stated
  workflow.

Given that the task description says "staff scans" to update location, the
correct access level is `requireSession()` (any authenticated user). The
Firestore rule does NOT need updating because Admin SDK bypasses rules. However,
**if a client-side doc read is added for preview**, the rule already allows
`get, list: if isSignedIn()`, so that also passes for staff.

**New file: `app/(app)/scan/actions.ts`** — this keeps location-scan logic
co-located with the scan route and avoids polluting `inventory/actions.ts` with
a non-admin path. Pattern matches CLAUDE.md convention: "Server actions
(Phase 2): `app/<route>/actions.ts` co-located with the route."

### 4. Group Barcode Resolution and Batch Write

**Source:** `lib/types/checkout-group.ts`, `app/(app)/delivery-orders/actions.ts` line 59, `app/(app)/events/[eventId]/checkin/actions.ts` [VERIFIED: codebase read]

`CheckoutGroupDoc.itemLines` is `CheckoutGroupItemLine[]` where each line has
`{ itemId, itemSku, itemName, qty }`. To update location for all items in a
group, the Server Action needs to:

1. `adminDb.collection("checkoutGroups").doc(groupId).get()` — single read.
2. Extract `itemLines.map(l => l.itemId)` — deduplicated set of item IDs.
3. Batch-update `location` on each inventory doc.

**How many items can a group have?** [ASSUMED] There is no schema-level cap on
`itemLines`. The checkout cart accumulates lines from `useInventoryLive([], {
limit: 500 })`, and a single scan session could theoretically generate a group
with many item types. In practice, event checkout groups are a handful of items
(typically 1-20 lines per group based on the use-case description). No explicit
limit is documented anywhere in the codebase.

**Batch write vs. transaction:** Location updates do not need to be atomic with
reads (unlike stock quantity changes). There is no invariant to enforce — we are
simply patching a free-text field. A **`adminDb.writeBatch()`** is appropriate:

```typescript
const batch = adminDb.writeBatch();
for (const itemId of itemIds) {
  batch.update(adminDb.collection("inventory").doc(itemId), {
    location: newLocation,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  });
}
await batch.commit();
```

Firestore batches support up to 500 writes per batch [CITED:
https://firebase.google.com/docs/firestore/manage-data/transactions#batched-writes].
Since group sizes are at most ~20-50 items in practice, a single batch suffices.
No chunking needed.

**`runTransaction` is overkill here** — location update doesn't need
read-before-write or atomicity with quantity fields. `writeBatch` is the correct
tool.

**`tx.getAll()` pattern** is used in `delivery-orders/actions.ts` and is
available in the Admin SDK for multi-doc reads within a transaction. For the
group path (reading the `checkoutGroups` doc + then batch-writing), the simpler
non-transactional pattern (read group doc, then batch write inventory docs) is
acceptable since there is no shared invariant to protect.

### 5. Location Selection UX

**Source:** `lib/types/item.ts` line 32-34, `lib/schemas/item.ts` line 36 [VERIFIED: codebase read]

`InventoryItem.location` is `string` (free-text). `ItemSchema` caps it at 100
characters. The `UpdateItemSchema` already includes `location: z.string().max(100).optional()`.

**Free-text input is correct** for this flow. No predefined locations exist in
the schema. A simple `<Input>` component with a max-length of 100 is all that's
needed. No `<Select>` or autocomplete is required.

**UX flow for the Location tab:**

```
1. Staff scans (or types) a barcode into ScannerWidget / ManualEntryInput.
2. UI resolves the barcode → shows preview of matched items (name list).
3. Staff types a location string in a text input.
4. Staff taps "Update location" → Server Action called.
5. Success toast; scan widget resets for next scan.
```

The scan session does NOT need a cart for location mode. There is no "accumulate
then commit" pattern here — each scan is an immediate update. The `ScanSessionProvider`
state management (cart, commit, etc.) is not needed for location mode. The
`LocationPanel` component manages its own local state (`pendingBarcode`,
`resolvedItems`, `locationInput`).

### 6. Firestore Rules Impact

**Source:** `firestore.rules` lines 44-57 [VERIFIED: codebase read]

Current `inventory` update rule:

```
allow update: if isAdmin()
  && request.resource.data.availableQty is number
  && request.resource.data.availableQty >= 0
  && request.resource.data.availableQty <= request.resource.data.totalQty;
```

**This rule is irrelevant for the Server Action** — Admin SDK writes bypass all
Firestore security rules. No rule change is needed.

**However**, a note for future client-side location writes (if ever added): the
current rule would block any non-admin. If we ever wanted staff to update
`location` directly from the client SDK, the rule would need a separate
`allow update: if isSignedIn() && <field restriction>` clause. That is out of
scope for this quick task.

`checkoutGroups` rule: `allow get, list: if isSignedIn()` — any authenticated
user (including staff) can read group docs. This enables the client-side preview
path without rule changes.

---

## Architecture Patterns

### Scan Mode Extension Pattern

```typescript
// scan-session.tsx — widen ScanMode union
export type ScanMode = "checkout" | "checkin" | "location";
// [VERIFIED: current definition is "checkout" | "checkin" at line 78]
```

```typescript
// app/(app)/scan/page.tsx — add third tab
<TabsTrigger value="location">Location</TabsTrigger>
// [VERIFIED: existing pattern at lines 59-63]
```

### New Server Action: `updateItemsLocationAction`

```typescript
// app/(app)/scan/actions.ts  (NEW FILE)
"use server";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const UpdateItemsLocationSchema = z.object({
  barcodeValue: z.string().min(1),
  location: z.string().max(100),
});

export type UpdateItemsLocationResult =
  | { ok: true; updatedItemIds: string[]; resolvedAs: "item" | "group" }
  | { ok: false; error: string };

export async function updateItemsLocationAction(
  input: unknown,
): Promise<UpdateItemsLocationResult> {
  const session = await requireSession();
  // ... resolve barcode → item(s), batch-update location
}
```

### Barcode Resolution in Server Action

```typescript
// Try individual item by SKU/id first
const bySkuSnap = await adminDb
  .collection("inventory")
  .where("sku", "==", barcodeValue)
  .limit(1)
  .get();
// If empty, try externalBarcode
const byExtSnap = await adminDb
  .collection("inventory")
  .where("externalBarcode", "==", barcodeValue)
  .limit(1)
  .get();
// If still empty, try checkoutGroups doc
const groupSnap = await adminDb
  .collection("checkoutGroups")
  .doc(barcodeValue)
  .get();
```

**Important:** since SKU IS the doc ID (`id === sku` per PROJECT.md key decision
#14), the fastest SKU lookup is `adminDb.collection("inventory").doc(barcodeValue).get()`
— a direct doc read, not a where query. This is the correct approach.

### Batch Location Write

```typescript
const batch = adminDb.writeBatch();
for (const itemId of resolvedItemIds) {
  batch.update(adminDb.collection("inventory").doc(itemId), {
    location: parsed.data.location,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  });
}
await batch.commit();
// revalidatePath for each itemId + /inventory list
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Firestore multi-doc write | Manual sequential `update()` calls in a loop (non-atomic, slower) | `adminDb.writeBatch()` |
| Camera scanning | Custom barcode decode logic | `ScannerWidget` (already exists) |
| Manual entry fallback | New input component | `ManualEntryInput` (already exists) |
| Location string validation | Custom validator | `z.string().max(100)` — already in `ItemSchema` |

---

## Common Pitfalls

### Pitfall 1: Treating Location Mode as a Cart Flow
**What goes wrong:** Trying to reuse `ScanSessionProvider`'s cart/commit model
for location — adds `ScanCartLine` entries and a "commit all" step.
**Why it happens:** The existing scan infrastructure is cart-based.
**How to avoid:** Location mode does an immediate per-scan update. No cart. The
`LocationPanel` holds its own local state (`pendingBarcode`, `resolvedItems`,
`locationInput`) and calls the Server Action directly on confirm.

### Pitfall 2: Using a Firestore Transaction Instead of a Batch
**What goes wrong:** Wrapping the location batch in `runTransaction`, which is
heavier, has a 5-second deadline, and retries on contention.
**Why it happens:** Transactions are used throughout the codebase for stock
changes.
**How to avoid:** Location is a simple field patch with no read-then-write
invariant. Use `writeBatch`.

### Pitfall 3: Widening ScanMode Without Handling the Mode in ScannerWidget
**What goes wrong:** `ScannerWidget` checks `selectedEvent` before activating
(`disabled={!selectedEvent}`). Location mode doesn't require an event. If
ScannerWidget.isPaused logic still gates on `selectedEvent`, location scans
will never activate.
**What to do:** The `LocationPanel` will render its own scanner instance or
pass a `paused` override. Alternatively, refactor `ScannerWidget`'s
`isPaused` to accept an `eventRequired` prop (default true).

### Pitfall 4: SKU vs. Doc ID Lookup
**What goes wrong:** Using a `where("sku", "==", barcodeValue)` query instead
of a direct `doc(barcodeValue).get()` when resolving by SKU.
**Why it happens:** SKU is a field AND the doc ID; the simpler `where` query
is reached for first.
**How to avoid:** Per PROJECT.md key decision #14, SKU === doc ID. Use
`adminDb.collection("inventory").doc(barcodeValue).get()` for O(1) SKU lookup.
Then fall back to `where("externalBarcode", "==", barcodeValue)` for external
barcodes, then `checkoutGroups` doc read for group barcodes.

### Pitfall 5: Missing `revalidatePath` after Batch Write
**What goes wrong:** Location updated in Firestore but `/inventory/[id]` detail
page shows stale data for server-rendered views.
**How to avoid:** Call `revalidatePath("/inventory")` and per-item
`revalidatePath(\`/inventory/${itemId}\`)` after `batch.commit()`.

---

## Scope Decision: New `/scan/location` Route vs. Third Tab

**Verdict: Third tab on existing `/scan` page.**

| Factor | Third Tab | New Route |
|--------|-----------|-----------|
| Reuses `ScannerWidget` + `ManualEntryInput` | Yes — same component tree | Requires import in new page |
| Requires new `ScanSessionProvider` complexity | No — mode is just a tab value | No |
| Requires new URL in CLAUDE.md sitemap | No | Yes — "Adding or removing a route requires updating ROADMAP.md and PROJECT.md in the same claim" |
| Complexity | Lower | Higher |

The `ScanMode` type extension is a one-line change. Tab rendering is additive.
`ScannerWidget` needs a small fix for the no-event-required case (Pitfall 3).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Group checkout carts in practice contain 1–20 item lines, so a single `writeBatch` is sufficient | Research Finding 4 | If groups routinely exceed 500 items, batching chunks are needed — extremely unlikely given the use case |

---

## Implementation Checklist (for Planner)

1. **Widen `ScanMode`** in `scan-session.tsx` to include `"location"`.
2. **Add Location tab** in `app/(app)/scan/page.tsx` — third `<TabsTrigger>`.
3. **Create `LocationPanel` component** at
   `components/feature/scan/LocationPanel.tsx` with own local state (no cart).
   - Renders `ScannerWidget` (with `eventRequired=false` or equivalent override)
     and `ManualEntryInput`.
   - Shows resolved item preview after scan.
   - Shows `<Input>` for location text.
   - Calls `updateItemsLocationAction` on confirm.
4. **Patch `ScannerWidget`** to accept an `eventRequired?: boolean` prop
   (default `true`) so location mode can activate without a selected event.
5. **Create `app/(app)/scan/actions.ts`** with `updateItemsLocationAction`:
   - `requireSession()` auth gate.
   - Barcode resolution: direct doc read (`inventory/{barcodeValue}`), then
     `externalBarcode` where query, then `checkoutGroups/{barcodeValue}` doc read.
   - `writeBatch` to patch `location`, `updatedAt`, `updatedBy` on all resolved
     item docs.
   - `revalidatePath` calls.
6. **No Firestore rule changes needed.**
7. **No new schema needed** — `z.string().max(100)` is already in `ItemSchema`
   and `UpdateItemSchema`.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `app/(app)/scan/page.tsx` — current scan page structure, Tabs usage
- `components/feature/scan/scan-session.tsx` — `ScanMode` type, `addLine` barcode resolution, `ScanSessionProvider` shape
- `components/feature/scan/ScannerWidget.tsx` — `selectedEvent` gate, `paused` prop
- `lib/types/item.ts` — `location: string` field definition
- `lib/types/checkout-group.ts` — `CheckoutGroupDoc.itemLines` shape
- `lib/schemas/item.ts` — `ItemSchema` location max(100), `UpdateItemSchema`
- `app/(app)/inventory/actions.ts` — `requireAdmin()` pattern, `runTransaction` usage
- `app/(app)/events/[eventId]/checkin/actions.ts` — `requireSession()` for staff operations
- `app/(app)/events/[eventId]/checkout/actions.ts` — `createCheckoutGroupAction` pattern
- `app/(app)/delivery-orders/actions.ts` — `tx.getAll()` multi-doc read pattern
- `firestore.rules` — inventory update rule (admin-only), checkoutGroups rule (isSignedIn read)
- `lib/auth/dal.ts` — `requireSession()` vs `requireAdmin()` distinction

### Secondary (MEDIUM confidence)
- Firestore batched writes 500-op limit: [CITED: https://firebase.google.com/docs/firestore/manage-data/transactions#batched-writes]

---

## Metadata

**Confidence breakdown:**
- Scan page mode extension: HIGH — direct code verified
- Barcode resolution logic: HIGH — existing `addLine` pattern plus doc-id SKU convention verified
- Server Action placement and auth level: HIGH — verified `requireSession` vs `requireAdmin` split
- Batch write appropriateness: HIGH — no invariant to protect; existing batch pattern in delivery-orders
- Firestore rules impact: HIGH — Admin SDK bypasses rules; verified

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable codebase, no external API dependencies)
