# Quick Task quick-kayinleong-008 — Research

**Researched:** 2026-06-07
**Domain:** Check-in barcode guard — reject group barcodes during check-in
**Confidence:** HIGH

---

## Summary

The check-in flow has two entry points where a barcode is resolved: the `/scan` page in checkin mode (uses `addLine` in `scan-session.tsx`) and the dedicated `/events/[eventId]/checkin` page (uses `CheckinForm` + `commitCheckinCartAction`). This task concerns a specific case that can only arise at the scan-page entry point: a staff member scans a checkout-group barcode (a Firestore auto-ID from the `checkoutGroups` collection) instead of an individual item barcode.

The dedicated check-in form (`CheckinForm`) does not accept a barcode at all — it pre-populates from live open checkout transactions and has no scan/manual-entry field. The only surface where a group barcode can be inadvertently submitted is `addLine` in `scan-session.tsx`, which is called for every scan on the `/scan` page regardless of mode.

**Primary recommendation:** Add a single early-exit guard in `addLine` (scan-session.tsx) that fires a Firestore `.get()` on `checkoutGroups/{trimmed}` when the scanned value is not found in the inventory index. If the document exists, reject with the prescribed error message and return `{ ok: false }` without touching the cart.

---

## Check-in Flow Architecture

### Two entry points — only one accepts a raw barcode

| Entry Point | Accepts raw barcode? | Where guard belongs |
|-------------|---------------------|---------------------|
| `/scan` page (checkin mode) | YES — `addLine(skuOrId)` in `scan-session.tsx` | `addLine`, before item lookup |
| `/events/[eventId]/checkin` | NO — prepopulated from live checkout transactions, no scan input | N/A — guard not needed |

### `/scan` checkin mode commit path

The `/scan` page in checkin mode does NOT submit barcodes to `commitCheckinCartAction`. From `scan-session.tsx` lines 466–469:

```typescript
} else {
  // checkin mode: routes to the per-event check-in screen (CI-02)
  router.push(`/events/${selectedEvent.id}/checkin`);
}
```

Scanning items in checkin mode on the /scan page only builds a cart that is used to *navigate* to the checkin form. The cart items are not submitted as check-in lines — the `CheckinForm` then re-derives the open lines from Firestore live state. This means:

1. The group barcode guard must fire in `addLine` (scan-session.tsx).
2. `commitCheckinCartAction` does NOT need a guard — it never receives raw barcodes; it only receives `parentTxId` references from the form's pre-populated open lines.

---

## Why a Firestore Read Is Required

`CheckoutGroupDoc.id` is a Firestore auto-generated ID (20-character alphanumeric, e.g., `aB3dEfGhIjKlMnOpQrSt`). Inventory SKUs are user-defined (typically `ITEM-001`, `CAM-SONY-001`, etc.) and `externalBarcode` values are manufacturer barcodes (numeric strings, EAN/UPC format). There is no reliable format-based heuristic to distinguish a group barcode from a SKU or external barcode without a Firestore lookup.

The existing `addLine` logic already reaches `{ ok: false, reason: "Item not recognized" }` when the scanned value matches nothing in the inventory array (`items` from `useInventoryLive`). The group barcode check should intercept **at that "not found in inventory" branch**, before the generic "not recognized" toast fires.

---

## Insertion Point in `addLine` — Code Path

Current `addLine` flow (scan-session.tsx lines 310–378):

```
1. Trim and empty-check
2. Look up item in `items[]` (SKU, id, externalBarcode)
3. If NOT found → toast "Item not recognized" → return { ok: false }
4. If found → lifecycle + stock checks → cart update
```

The guard inserts between step 2 and step 3:

```
2b. If NOT found in items[] → check checkoutGroups/{trimmed} via getDoc
    → If checkoutGroups doc EXISTS → toast prescribed error → return { ok: false }
    → If NOT exists → fall through to "Item not recognized" toast (existing behavior)
```

This keeps the change minimal: one conditional Firestore read that fires only when the inventory lookup already failed. Normal scans (item found) are entirely unaffected.

### Firebase SDK call

`addLine` is a client-side callback in a `'use client'` component. The correct SDK is the **Web (client) SDK** (`firebase/firestore`), not the Admin SDK.

```typescript
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

// Inside addLine, after the item lookup returns undefined:
const groupRef = doc(db, "checkoutGroups", trimmed);
const groupSnap = await getDoc(groupRef);
if (groupSnap.exists()) {
  toast.error("Group barcodes cannot be used for check-in. Please scan individual item barcodes.");
  return { ok: false, reason: "Group barcode" };
}
```

**Important:** `addLine` is currently synchronous. Adding `await getDoc(...)` makes it async. The return type `{ ok: true } | { ok: false; reason: string }` changes to `Promise<{ ok: true } | { ok: false; reason: string }>`. All callers must be updated:

| Caller | File | Current call | Change needed |
|--------|------|-------------|---------------|
| `ScannerWidget` | `components/feature/scan/ScannerWidget.tsx` | `addLine(value)` | `await addLine(value)` |
| `ManualEntryInput` | `app/(app)/scan/page.tsx` | `addLine(sku)` | `await addLine(sku)` |
| Possibly others | — | grep needed | grep `addLine(` |

The `useCallback` wrapping `addLine` and the `ScanSessionContextValue` type definition must both reflect the async signature change.

---

## Firestore Rules Impact

`checkoutGroups` documents are read-accessible to authenticated users based on the existing security rules (written in quick-kayinleong-006). The guard uses a standard `getDoc` with the user's session — this should be covered by the existing allow-read rule for authenticated users. No rules change is expected, but the plan should verify.

---

## Error Message (Prescribed — Do Not Change)

> "Group barcodes cannot be used for check-in. Please scan individual item barcodes."

This is the exact message specified in the task. Use as the `toast.error` string.

---

## Scope Boundaries

**In scope:**
- `addLine` in `scan-session.tsx` — make async, add group barcode guard
- `ScanSessionContextValue` type — update `addLine` return type to `Promise<...>`
- Caller updates — `ScannerWidget.tsx`, `ManualEntryInput` on scan page, any other direct `addLine` callers

**Out of scope:**
- `commitCheckinCartAction` — receives only `parentTxId` refs, never raw barcodes
- `CheckinForm` — no barcode input surface
- Checkout mode of `addLine` — group barcodes are valid in checkout mode (they're generated post-checkout for labeling, but there's no stated requirement to block them on checkout scans)

---

## Common Pitfalls

### Pitfall 1: Adding guard to checkout mode
**What goes wrong:** If the mode check is not scoped to `mode === "checkin"`, the guard would fire for all scans including checkout mode, adding unnecessary latency to every unrecognized checkout scan.
**How to avoid:** Gate the group barcode Firestore read on `mode === "checkin"` only.

### Pitfall 2: Forgetting to await in callers
**What goes wrong:** `ScannerWidget` calls `addLine` without await — the toast fires after the calling code completes, and the cart may update before the guard resolves if the promise is not awaited.
**How to avoid:** Find every `addLine(` usage with grep, update each to `await addLine(`.

### Pitfall 3: Race on rapid scans
**What goes wrong:** A user rapidly fires two scans. The first triggers the Firestore read; the second `addLine` call starts before the first resolves.
**How to avoid:** The Firestore read is a one-time `.getDoc()` (not a listener) and is mode-gated. Concurrent calls are safe — both will independently check the doc and both will independently reject. No additional debounce is needed beyond what `ScannerWidget` already has.

### Pitfall 4: `useCallback` dependency array
**What goes wrong:** `mode` is already in the `useCallback` dependency array for `addLine` (line 377: `[items, mode]`). Adding `db` from the firebase client import is a module-level singleton (not React state), so it does not need to be in the dependency array.
**How to avoid:** Keep the dependency array as `[items, mode]`.

---

## Files to Change

| File | Change |
|------|--------|
| `components/feature/scan/scan-session.tsx` | Make `addLine` async; add group barcode guard after item lookup fails; update `ScanSessionContextValue` type |
| `components/feature/scan/ScannerWidget.tsx` | `await addLine(...)` |
| `app/(app)/scan/page.tsx` | `await addLine(sku)` in ManualEntryInput onSubmit |

**Verify callers with:**
```bash
grep -rn "addLine(" /Users/ka.yin.leong/Documents/cy-eventsystem/components /Users/ka.yin.leong/Documents/cy-eventsystem/app --include="*.tsx" --include="*.ts"
```

---

## Sources

- `[VERIFIED: codebase]` — scan-session.tsx addLine logic, commit path, ScanSessionContextValue type
- `[VERIFIED: codebase]` — checkin/actions.ts: receives parentTxId refs only, no raw barcode input
- `[VERIFIED: codebase]` — checkin-form.tsx: no scan/manual entry input, pre-populated from Firestore
- `[VERIFIED: codebase]` — scan/page.tsx: ManualEntryInput calls addLine; checkin mode routes to event/checkin
- `[VERIFIED: codebase]` — lib/types/checkout-group.ts: CheckoutGroupDoc.id is the barcode payload; format is Firestore auto-ID (no reliable format heuristic)
- `[ASSUMED]` — Firestore client SDK `getDoc` is permitted by existing checkoutGroups security rules for authenticated users; the plan should verify `firestore.rules` contains a matching allow-read before closing the claim
