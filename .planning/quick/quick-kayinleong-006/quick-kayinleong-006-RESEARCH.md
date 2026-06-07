# Quick Task quick-kayinleong-006 — Research

**Researched:** 2026-06-07
**Domain:** Post-checkout group barcode generation — new `checkoutGroups` Firestore collection, split UI, label printing
**Confidence:** HIGH (all findings verified against local codebase; no training-data assumptions for architecture decisions)

---

## Summary

After `commitCheckoutCartAction` returns `{ ok: true, txIds }`, the current `scan-session.tsx` commit handler immediately calls `toast.success`, clears the cart, and calls `router.push(/events/${selectedEvent.id})`. There is **no post-commit pause** — the user is redirected before they can do anything else. The group barcode step must happen **between** the `toast.success` and the `router.push`, by intercepting the success path to surface a modal/dialog instead of navigating away.

The existing label infrastructure (`LabelPreview` + `bwipjs`) is fully reusable for group barcodes: a group barcode is just a free-form string value (the Firestore document ID) rendered as a QR code. `PrintLabelButton` wraps `LabelPreview` with a format picker and print-scoped CSS — that whole component can be reused as-is by passing the group doc ID as the `sku` prop and a descriptive `name`.

The `checkoutGroups` Firestore collection is a new top-level collection. Its access rule should mirror the events pattern (admin OR uid in `allowedStaff` for the linked event), implemented server-side via Admin SDK and in `firestore.rules`. The `createCheckoutGroupAction` Server Action is co-located with the checkout actions file.

**Primary recommendation:** Intercept the commit success path in `scan-session.tsx` by adding a `onCommitSuccess` callback prop to `ScanSessionProvider` (or by lifting success state into the provider). Render a `<CheckoutGroupDialog>` component in `CheckoutClient` that receives the committed cart lines and `txIds` and drives the group creation flow. The server action is co-located in `actions.ts` alongside `commitCheckoutCartAction`.

---

## 1. Checkout Flow — Where to Intercept

**Finding [VERIFIED: scan-session.tsx lines 393–429]:**

The full post-commit success path in `scan-session.tsx`:

```ts
// on result.ok === true
toast.success(`${cart.length} ... checked out`);
setCart([]);
clearPersisted();
router.push(`/events/${selectedEvent.id}`);
router.refresh();
setIsCommitting(false);
```

The cart state (`cart`) and `selectedEvent` are cleared and navigation fires synchronously after the success toast. There is no pause point.

**Three viable intercept patterns:**

### Option A — `onCommitSuccess` callback prop on `ScanSessionProvider` (recommended)

Add an optional `onCommitSuccess?: (payload: CommitSuccessPayload) => void` prop to `ScanSessionProvider`. Inside the commit success path, call `onCommitSuccess({ cart: cartSnapshot, txIds, eventId })` before clearing the cart and navigating. The caller (`CheckoutClient`) holds a ref to `cartSnapshot` + `txIds` and controls whether/when to navigate.

Pros: zero changes to `ScanCartPanel`; `CheckoutClient` owns the dialog; navigation is fully under the caller's control.
Cons: adds a prop to `ScanSessionProvider` — low risk, the interface is internal.

### Option B — Success state lifted into `ScanSessionProvider`

Add `lastCommit: CommitSuccessPayload | null` to the context value. Consumers read it to decide whether to render the dialog. Navigation is deferred until the consumer calls a `clearLastCommit()` mutator.

Pros: no new props.
Cons: couples the group barcode concept to the scan-session core; all consumers see `lastCommit` even when they don't need it.

### Option C — Replace `ScanCartPanel`'s commit button with a two-step flow

Intercept at the UI layer: replace the "Check out N items" CTA with a custom button in `CheckoutClient` that does not use `commit()` from context, instead calling the server action directly.

Cons: duplicates the commit logic; bypasses the useOptimistic revert path; fragile.

**Decision: Option A.** Minimum-invasive, keeps the scan-session core clean.

**Implementation sketch:**

```tsx
// ScanSessionProvider — add prop
onCommitSuccess?: (payload: { cart: ScanCartLine[]; txIds: string[]; eventId: string }) => void

// Inside commit(), on result.ok === true:
const cartSnapshot = cart;  // capture before setCart([])
clearPersisted();
onCommitSuccess?.({ cart: cartSnapshot, txIds: result.txIds, eventId: selectedEvent.id });
// Do NOT call router.push here — caller controls navigation.
// Only call router.push if onCommitSuccess is not provided (backward compat).
if (!onCommitSuccess) {
  router.push(`/events/${selectedEvent.id}`);
  router.refresh();
}
setCart([]);
```

`CheckoutClient` wires it:

```tsx
const [groupPayload, setGroupPayload] = useState<CommitSuccessPayload | null>(null);

<ScanSessionProvider
  initialMode="checkout"
  initialEvent={event}
  onCommitSuccess={(payload) => setGroupPayload(payload)}
>
  ...
  {groupPayload && (
    <CheckoutGroupDialog
      payload={groupPayload}
      onDone={() => {
        setGroupPayload(null);
        router.push(`/events/${event.id}`);
        router.refresh();
      }}
    />
  )}
```

---

## 2. Data Model — `checkoutGroups` Collection

**Finding [VERIFIED: codebase cross-reference — transactions.ts, delivery-order.ts patterns]:**

`commitCheckoutCartAction` returns `{ ok: true; txIds: string[] }`. The `cart` at commit time is available in `scan-session.tsx` (captured before `setCart([])`). Together, these provide all fields the `checkoutGroups` document needs.

### Document shape

```ts
// lib/types/checkout-group.ts
export type CheckoutGroupDoc = {
  id: string;                     // == Firestore doc ID; also the barcode payload
  eventId: string;                // for rule enforcement + query by event
  txIds: string[];                // the transaction IDs from commitCheckoutCartAction
  itemLines: {
    itemId: string;
    itemSku: string;
    itemName: string;
    qty: number;
  }[];                            // denormalized from cart at creation time (AUD-01 pattern)
  createdAt: FieldValue;          // serverTimestamp()
  createdBy: string;              // session.uid
  label: string;                  // human-readable label, e.g. "Group 1 of 2 — Event Name"
};
```

**Why `itemLines` instead of just `txIds`:** The group barcode is printed and scanned later (quick-007 location tracking, quick-008 checkin restriction). Resolving items from `txIds` requires a per-transaction read; denormalizing `itemLines` at creation time is cheaper and consistent with the AUD-01 pattern used throughout (denormalize at write time).

**Why `label` field:** The print dialog needs a human-readable name to show below the barcode. If the user splits into N groups, the label distinguishes them. The server action constructs it from `label` param passed by the client.

**Barcode payload:** The Firestore document ID is the barcode value — it is guaranteed unique, contains no PII, and can be decoded by any scanner. No custom ID scheme is needed.

### Split logic

The split is done entirely in the client UI before calling the server action. The UI divides `itemLines` into N groups evenly. The server action is called once per group. This keeps the server action simple (single document write) and makes the split N independent.

**Even-split algorithm (client side):**

```ts
function splitLines(lines: ItemLine[], n: number): ItemLine[][] {
  const groups: ItemLine[][] = Array.from({ length: n }, () => []);
  lines.forEach((line, i) => groups[i % n].push(line));
  return groups;
}
```

For fractional splits (e.g., 7 items into 3 groups → 3, 2, 2), the modulo distribution is acceptable for v1. The user sees a preview before confirming.

---

## 3. Split UI — Dialog Design

**Finding [VERIFIED: `PrintLabelButton` uses shadcn Dialog; checkout route uses toast + router.push]:**

A modal Dialog after a successful checkout is the correct pattern. The user has just completed an action; showing a new UI flow inline on the checkout page (which is about to navigate away) would be jarring. A Dialog pauses navigation, lets the user complete the optional group barcode step, then navigates on Done.

### Dialog states (single Dialog, step machine)

```
State 1 — "Generate group barcodes?"
  - One barcode for all items (default)
  - Split into N groups [number input, 2-10]
  - CTA: "Generate" / "Skip" (skip = navigate to event page immediately)

State 2 — Preview + print
  - For each group: LabelPreview of the doc ID + PrintLabelButton
  - Group label shown below barcode
  - CTA: "Done" (navigate to event page)
```

**No server state needed between steps** — State 1 is pure client computation. State 2 renders generated doc IDs immediately after the `createCheckoutGroupAction` calls resolve.

**Component location:** `app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx`

This is co-located with `checkout-client.tsx`, consistent with the existing component structure.

---

## 4. Label Printing — Reuse vs New Component

**Finding [VERIFIED: PrintLabelButton.tsx, LabelPreview.tsx, lib/labels.ts]:**

`PrintLabelButton` accepts `{ sku, name, externalBarcode? }`. The group doc ID is an arbitrary string — it will always pass `canEncode(id, "qrcode")` because QR accepts any non-empty string. `canEncode` for `qrcode` / `code128` always returns `{ ok: true }` as long as the string is non-empty.

**Firestore auto-IDs are 20 characters of `[A-Za-z0-9]` [ASSUMED — standard Firestore behavior, not verified against SDK source in this repo].** QR and Code 128 both handle this cleanly. EAN-13 requires 12–13 digits (rejected). Code 39 requires uppercase + digits + special chars (fails on lowercase letters). So for group IDs, only QR and Code 128 are viable formats.

**Recommendation: reuse `PrintLabelButton` as-is.** Pass:
- `sku={group.id}` — the barcode payload
- `name={group.label}` — shown below the barcode in the print dialog
- No `externalBarcode` — the group ID is the canonical value

The print-scoped CSS inside `PrintLabelButton` (`#print-label`) works fine for one label at a time. For N groups, the user opens each group's `PrintLabelButton` individually, which is acceptable for v1 (groups are typically 1–3 for this use case).

**No `GroupLabelButton` needed.** `PrintLabelButton` is reusable without modification.

---

## 5. Firestore Rules — `checkoutGroups`

**Finding [VERIFIED: firestore.rules — isMember helper, events rule pattern]:**

The `isMember(eventDoc)` helper already exists:

```js
function isMember(eventDoc) {
  return isSignedIn() && (
    isAdmin()
    || request.auth.uid in eventDoc.data.allowedStaff
  );
}
```

It requires a reference to the event document. For `checkoutGroups`, we need to gate on the linked event's `allowedStaff`. This requires a `get()` call to read the event doc inside the rule.

**Rule pattern:**

```js
// -------- checkoutGroups (quick-kayinleong-006) --------
// Admin or event member can create; immutable after creation.
// Any signed-in user can read (scanners need to resolve group IDs at check-in, quick-008).
match /checkoutGroups/{groupId} {
  allow get, list: if isSignedIn();
  allow create: if isSignedIn()
    && isMember(get(/databases/$(database)/documents/events/$(request.resource.data.eventId)));
  allow update, delete: if false;
}
```

**Notes:**

- `allow get, list: if isSignedIn()` — any staff can scan and resolve a group ID without needing event membership. This is intentional: the group barcode is physically printed and handed to a third party; the scanner at check-in (quick-008) needs to resolve it without knowing which event it belongs to.
- `allow create: if isSignedIn() && isMember(...)` — enforces EVT-08 at the rules layer. The Server Action also enforces it server-side (defense in depth).
- `allow update, delete: if false` — group barcodes are immutable once printed. If a user made a mistake, they generate a new group.
- The `get(...)` call in the rule costs one extra document read per create. This is acceptable for an infrequent operation (group creation happens once per checkout, not per item scan).

**`firestore.indexes.json` additions:** A `checkoutGroups` query by `eventId` + `createdAt DESC` is needed for quick-007/quick-008. Add this index proactively:

```json
{
  "collectionGroup": "checkoutGroups",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "eventId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" },
    { "fieldPath": "__name__", "order": "DESCENDING" }
  ],
  "density": "SPARSE_ALL"
}
```

---

## 6. Server Action — Location and Signature

**Finding [VERIFIED: actions.ts, checkout/page.tsx, CLAUDE.md "Server actions (Phase 2): app/<route>/actions.ts co-located with the route"]:**

**Location:** `app/(app)/events/[eventId]/checkout/actions.ts` — extend the existing file with a second export `createCheckoutGroupAction`.

**Rationale:** The group barcode is a direct consequence of a checkout. Its action lives with the checkout actions, and the Server Action file already imports `requireSession`, `adminDb`, and `FieldValue`. No new imports needed.

**Signature:**

```ts
export type CreateCheckoutGroupResult =
  | { ok: true; groupId: string }
  | { ok: false; error: string };

export async function createCheckoutGroupAction(input: {
  eventId: string;
  txIds: string[];
  itemLines: { itemId: string; itemSku: string; itemName: string; qty: number }[];
  label: string;
}): Promise<CreateCheckoutGroupResult>
```

**Action body outline:**

1. `requireSession()` — get `uid`.
2. EVT-08 gate: read event doc, verify `isAdmin || uid ∈ allowedStaff`.
3. Validate input (Zod schema in `lib/schemas/checkout-group.ts`).
4. `adminDb.collection("checkoutGroups").doc()` — let Firestore auto-generate the ID.
5. `docRef.set({ id: docRef.id, eventId, txIds, itemLines, label, createdAt: FieldValue.serverTimestamp(), createdBy: uid })`.
6. Return `{ ok: true, groupId: docRef.id }`.

No `revalidatePath` needed — there is no server-rendered page that lists checkout groups yet.

**Zod schema location:** `lib/schemas/checkout-group.ts` (new file).

---

## 7. Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `lib/types/checkout-group.ts` | CREATE | `CheckoutGroupDoc` type |
| `lib/schemas/checkout-group.ts` | CREATE | Zod input schema for `createCheckoutGroupAction` |
| `app/(app)/events/[eventId]/checkout/actions.ts` | MODIFY | Add `createCheckoutGroupAction` export |
| `app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx` | CREATE | Post-checkout dialog — split UI + label printing |
| `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx` | MODIFY | Wire `onCommitSuccess` + render `<CheckoutGroupDialog>` |
| `components/feature/scan/scan-session.tsx` | MODIFY | Add `onCommitSuccess` prop + defer navigation when provided |
| `firestore.rules` | MODIFY | Add `checkoutGroups` rule block |
| `firestore.indexes.json` | MODIFY | Add `checkoutGroups` composite index |

---

## 8. Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Barcode rendering | Custom canvas drawing | `bwipjs.toCanvas` (already used in `LabelPreview`) |
| Print-scoped CSS | Custom print utility | `@media print` pattern already in `PrintLabelButton` |
| Label dialog chrome | Custom modal | shadcn `Dialog` (already used in `PrintLabelButton`) |
| Number input with bounds | Custom stepper | shadcn `Input` type=number with min/max; or reuse `QtyStepper` |
| Even-split algorithm | Complex partitioning | Simple `i % n` modulo distribution (sufficient for v1) |

---

## 9. Common Pitfalls

### Pitfall 1: Capturing cart before `setCart([])`

**What goes wrong:** React state batching — if you read `cart` after calling `setCart([])` inside the same synchronous commit block, you may see the emptied cart.
**How to avoid:** In the `commit()` function, capture `const cartSnapshot = cart` (close over the current value) before any `setCart` call. Pass `cartSnapshot` to `onCommitSuccess`.

### Pitfall 2: Navigation fires before group creation completes

**What goes wrong:** `router.push` navigates to the event page while the `createCheckoutGroupAction` calls are still in flight.
**How to avoid:** Only call `router.push` from the `onDone` callback of `CheckoutGroupDialog`, after all `createCheckoutGroupAction` calls have resolved. Do not call `router.push` from `scan-session.tsx` when `onCommitSuccess` is provided.

### Pitfall 3: Firestore auto-ID used as barcode value before document is written

**What goes wrong:** The client generates a fake ID, renders the label, but the Firestore write hasn't happened yet. If the user prints and scans before the write completes, the scanner finds no document.
**How to avoid:** Call `createCheckoutGroupAction` first. Only render `LabelPreview` (and enable the Print button) after `{ ok: true, groupId }` is received.

### Pitfall 4: PrintLabelButton `#print-label` ID conflict for multiple groups

**What goes wrong:** `PrintLabelButton` hard-codes `id="print-label"` on the preview div. If two `PrintLabelButton` instances are in the DOM simultaneously, both have the same ID, and the `@media print` CSS reveals all of them.
**How to avoid:** Each group's print dialog is opened independently (one Dialog at a time). Only one `PrintLabelButton` dialog is visible at any time. This is not a problem in practice because Dialog uses a portal and only one is open. Noted as a known limitation in the code comment.

### Pitfall 5: `get()` call in Firestore rules for `checkoutGroups/create` — extra read cost

**What goes wrong:** Rules that call `get()` cost one additional document read per matching operation. For create-heavy collections this adds up.
**Impact here:** Group creation is once per checkout session (infrequent). Cost is negligible.

---

## 10. Code Examples

### Verified: `bwipjs.toCanvas` for QR (from `LabelPreview.tsx`)

```tsx
// Source: components/feature/inventory/LabelPreview.tsx lines 30-36
bwipjs.toCanvas(canvasRef.current, {
  bcid: "qrcode",
  text: value,
  scale: 4,
  includetext: false,
  paddingwidth: 8,
  paddingheight: 8,
});
```

Group barcode uses the same call — `value` = the Firestore doc ID.

### Verified: shadcn Dialog pattern (from `PrintLabelButton.tsx`)

```tsx
// Source: components/feature/inventory/PrintLabelButton.tsx lines 75-127
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>...</DialogTrigger>
  <DialogContent>
    <DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>
    ...
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
      <Button onClick={doPrint}>Print</Button>
    </div>
  </DialogContent>
</Dialog>
```

`CheckoutGroupDialog` is a Dialog without a Trigger (controlled externally via `open={!!groupPayload}`).

### Verified: Firestore Admin SDK auto-ID pattern (from `actions.ts` lines 190-191)

```ts
// Source: app/(app)/events/[eventId]/checkout/actions.ts lines 190-191
const txRef = adminDb.collection("transactions").doc();
txIds.push(txRef.id);
```

`createCheckoutGroupAction` uses the same pattern: `const groupRef = adminDb.collection("checkoutGroups").doc()` — the ID is available immediately as `groupRef.id` before the write.

---

## 11. Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Firestore auto-generated IDs are 20 chars of `[A-Za-z0-9]`, safe for QR and Code 128 | §4 | Negligible — canEncode("qrcode") accepts any non-empty string unconditionally; even if the charset assumption is wrong, QR handles arbitrary text |

---

## Sources

### Primary (HIGH confidence — verified against local codebase)
- `components/feature/scan/scan-session.tsx` — commit() success path, ScanSessionProvider interface
- `app/(app)/events/[eventId]/checkout/actions.ts` — commitCheckoutCartAction signature and CheckoutResult type
- `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx` — CheckoutClient structure
- `components/feature/inventory/PrintLabelButton.tsx` — PrintLabelButton reuse analysis
- `components/feature/inventory/LabelPreview.tsx` — bwipjs.toCanvas usage pattern
- `lib/labels.ts` — canEncode() logic for format compatibility
- `firestore.rules` — isMember helper, existing rule patterns
- `firestore.indexes.json` — existing index patterns for new index design
- `lib/types/delivery-order.ts` — denormalization pattern (AUD-01)
- `lib/types/transaction.ts` — TransactionDoc shape and parentTxId pattern
- `CLAUDE.md` — co-location rule for Server Actions, stack constraints

### Tertiary (LOW confidence — assumed)
- A1: Firestore auto-ID charset — `[ASSUMED]`
