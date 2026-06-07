# quick-kayinleong-009 — Research: Checkout Print Checklist + DO Document

**Researched:** 2026-06-07
**Domain:** Post-checkout print flows — checklist and Delivery Order document
**Confidence:** HIGH (all findings verified against codebase; no external API assumptions needed)

---

## Summary

After a successful checkout the user lands on `CheckoutGroupDialog` (step 2 shows group barcodes). This task adds two print actions reachable from that dialog: a **checkout checklist** (event name, date, table of items + qty) and a **print-only Delivery Order document** (DO-style layout pre-filled from the cart, no Firestore write, doType `external-outbound`).

The existing `PrintLabelButton` establishes the project print pattern: inject a `<style>` tag with `@media print { body * { visibility: hidden } #print-target, #print-target * { visibility: visible } }`, render a `#print-target` div with the printable content, then call `window.print()`. This task reuses that exact pattern twice — once for the checklist and once for the DO document — keeping both as self-contained print dialogs that open from new buttons on step 2 of `CheckoutGroupDialog`.

Creating a real `DeliveryOrder` Firestore record is intentionally out of scope. The `CreateDeliveryOrderSchema` requires `fileUrl`, `filePath`, `originalFilename`, and `contentType` — none of which exist at checkout time (there is no file). A print-only, pre-filled form avoids schema violations and keeps the DO module clean.

**Primary recommendation:** Add two `<PrintDialog>` components — `CheckoutChecklistDialog` and `CheckoutDOPrintDialog` — both triggered from buttons added to step 2 of `CheckoutGroupDialog`. Both use the `window.print()` + `@media print` pattern already in the codebase.

---

## Project Constraints (from CLAUDE.md)

- Next.js 16.2.6, App Router only. No Pages Router patterns.
- React 19 — Server Components by default; `'use client'` only when needed (these dialogs are pure client).
- shadcn/ui v4.8.0 — use existing `Dialog`, `Button`, `Badge`, `Card` primitives. Do not paste-edit registry components.
- Tailwind CSS v4 — no `tailwind.config.js`. Print styles go in a `<style>` tag inside the component, same as `PrintLabelButton` does.
- lucide-react for icons.
- No new dependencies. `window.print()` is a browser built-in.
- All mock data already in scope — `CommitSuccessPayload` and `EventDoc` are passed as props.

---

## Finding 1 — Intercept Point: CheckoutGroupDialog Step 2

**File:** `app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx`

Step 2 currently renders:
- A paragraph confirming group barcodes are ready.
- One `PrintLabelButton` per group (label + barcode).
- A "Done" button at the bottom (`onClick={onDone}`).

The print buttons should sit **between the group list and the Done button**, presented as a separate section titled "Documents" or similar. This keeps the primary flow (barcode labels) visually first and the document prints secondary.

`CheckoutGroupDialog` receives:
- `payload: CommitSuccessPayload` — `{ cart: ScanCartLine[], txIds: string[], eventId: string }`
- `eventName: string` — event display name

**Missing from props:** `event.startDate` / `event.endDate`. The parent `CheckoutClient` holds the full `EventDoc`. The simplest fix is to pass `eventStartDate: string` as an additional prop to `CheckoutGroupDialog`, extracted from the `event` prop already in `CheckoutClient`. Alternatively pass the entire `EventDoc` — but a narrow prop is cleaner.

`ScanCartLine` shape (confirmed from `scan-session.tsx:83-89`):
```ts
type ScanCartLine = {
  itemId: string;
  itemSku: string;
  itemName: string;
  qty: number;
  availableQty: number;
};
```

All data needed for both print documents is available from `payload.cart`, `eventName`, and the new `eventStartDate` prop. No Server Action or Firestore read required.

[VERIFIED: codebase grep of CheckoutGroupDialog.tsx and scan-session.tsx]

---

## Finding 2 — Printable Checklist

**What to show:**
| Field | Source |
|-------|--------|
| Event name | `eventName` prop |
| Event date | `eventStartDate` prop (formatted, e.g. `new Date(eventStartDate).toLocaleDateString()`) |
| Printed at | `new Date().toLocaleString()` at print time |
| Items table | `payload.cart` — columns: Item Name, SKU, Qty |
| Total items | `payload.cart.reduce((sum, l) => sum + l.qty, 0)` |

**Component:** `CheckoutChecklistDialog` — a `Dialog`-wrapped print preview + `window.print()` button.

**Print strategy** (matches `PrintLabelButton` pattern exactly):
```tsx
<style>{`
  @media print {
    body * { visibility: hidden !important; }
    #print-checklist, #print-checklist * { visibility: visible !important; }
    #print-checklist { position: absolute; inset: 0; padding: 24px; }
  }
`}</style>
```
The `#print-checklist` div renders a clean table layout. The dialog chrome (buttons, header) is hidden on print; only the content div shows.

**No new dependencies.** The table uses plain HTML `<table>` with Tailwind classes, or just the shadcn `Card` + `Badge` pattern used in `DeliveryOrderDetailPage`.

[VERIFIED: PrintLabelButton.tsx codebase pattern; ASSUMED: no Tailwind v4 `print:` variant used yet — confirmed by grep finding zero usages — but both `<style>` injection and `print:` variant work in Tailwind v4]

---

## Finding 3 — Print-Only DO Document

**Decision confirmed:** Do NOT call `createDeliveryOrder`. The schema requires:
- `fileUrl` (z.url()) — not available
- `filePath` (string) — not available
- `originalFilename` (string) — not available
- `contentType` (enum: pdf/jpg/png) — not available

A print-only form pre-filled from cart data avoids all of these. No Firestore record is created.

**Component:** `CheckoutDOPrintDialog` — opens a `Dialog` showing a DO-style document layout, then `window.print()`.

**Fields to render** (matching DO detail page layout as closely as practical):

| Field | Value |
|-------|-------|
| Document title | "Delivery Order" |
| Type badge | "External — Outbound (to event)" |
| Event (Vendor equivalent) | `eventName` |
| Date | `eventStartDate` formatted |
| Generated at | `new Date().toLocaleString()` |
| Items table | `payload.cart` — columns: Item Name, SKU, Qty |
| Reference IDs | `payload.txIds.join(', ')` (optional footer note) |

The existing `DoTypeBadge` component (`components/feature/delivery-orders/DoTypeBadge.tsx`) can be imported and used directly with `type="external-outbound"`.

**Print style** uses a separate id `#print-do-document` to avoid collision with the checklist's `#print-checklist` id. Same `@media print` pattern.

**Important:** Because both print dialogs use `body * { visibility: hidden }`, they must not be open at the same time. Since each is a separate `Dialog`, only one can be open at a time by the user — this is naturally safe.

[VERIFIED: delivery-order schema/actions.ts; DoTypeBadge component existence confirmed by DO detail page import]

---

## Finding 4 — Existing Print Pattern (authoritative reference)

`PrintLabelButton.tsx` is the established pattern:

```tsx
// Inside a 'use client' component:
<style>{`
  @media print {
    body * { visibility: hidden !important; }
    #print-label, #print-label * { visibility: visible !important; }
    #print-label {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
  }
`}</style>

// The printable content div:
<div id="print-label" className="flex flex-col items-center gap-2 py-4">
  {/* content */}
</div>

// The trigger:
<Button onClick={() => window.print()} disabled={!check.ok}>Print</Button>
```

For a multi-column document (checklist / DO), the `#print-target` div uses `position: absolute; inset: 0; padding: 24px` rather than `display: flex; align-items: center` so it fills the page from the top-left corner, like a real document.

[VERIFIED: PrintLabelButton.tsx lines 60-73, confirmed by codebase read]

---

## Finding 5 — Tailwind v4 Print Utilities

Tailwind v4 supports the `print:` variant natively. Example: `print:hidden` hides an element on print. However, the `PrintLabelButton` pattern uses raw `<style>` injection instead, because:

1. The `visibility: hidden !important` on `body *` then `visibility: visible !important` on the target id is a scoped override — hard to express cleanly with utility classes.
2. It keeps the print logic co-located with the content div, not scattered across utility classes on every element that should be hidden.

**Recommendation:** Follow the same `<style>` injection approach. Do NOT use `print:` utilities on individual elements — this would require annotating every element in the page that isn't in the dialog. The `body * { visibility: hidden }` blanket approach is simpler and matches project convention.

[VERIFIED: globals.css has no existing print rules (confirmed by grep returning empty); PrintLabelButton.tsx sets the precedent]

---

## Component Architecture

```
CheckoutGroupDialog (existing — modify step 2 only)
├── Step 1: group count picker (unchanged)
└── Step 2: success screen (ADD below group list, above Done)
    ├── [existing] group barcode list with PrintLabelButton
    ├── [NEW] "Documents" section header
    ├── [NEW] <CheckoutChecklistDialog> trigger button
    ├── [NEW] <CheckoutDOPrintDialog> trigger button
    └── [existing] Done button
```

New files:
- `app/(app)/events/[eventId]/checkout/_components/CheckoutChecklistDialog.tsx`
- `app/(app)/events/[eventId]/checkout/_components/CheckoutDOPrintDialog.tsx`

CheckoutGroupDialog prop addition:
```ts
// Before:
type CheckoutGroupDialogProps = {
  payload: CommitSuccessPayload;
  eventName: string;
  onDone: () => void;
};

// After:
type CheckoutGroupDialogProps = {
  payload: CommitSuccessPayload;
  eventName: string;
  eventStartDate: string;   // <-- new, ISO string from EventDoc.startDate
  onDone: () => void;
};
```

`CheckoutClient.tsx` already has the full `EventDoc` and passes it as `event`. The call site change is:
```tsx
// Before:
<CheckoutGroupDialog payload={groupPayload} eventName={event.name} onDone={…} />

// After:
<CheckoutGroupDialog
  payload={groupPayload}
  eventName={event.name}
  eventStartDate={event.startDate}
  onDone={…}
/>
```

---

## ID Collision Avoidance

`PrintLabelButton` uses the static id `#print-label`. The new components must use distinct ids to avoid conflicts if both components render simultaneously (e.g., a label dialog still mounted while a checklist dialog opens — unlikely but possible).

| Component | Print target id |
|-----------|----------------|
| PrintLabelButton (existing) | `#print-label` |
| CheckoutChecklistDialog (new) | `#print-checklist` |
| CheckoutDOPrintDialog (new) | `#print-do-document` |

Since only one `@media print` context fires at a time and the `<style>` tags reference specific ids, there is no interference.

---

## Common Pitfalls

### Pitfall 1: Dialog scroll cuts off print content
**What goes wrong:** The `Dialog` renders content in a scrollable overflow container. If the item list is long, `window.print()` prints only the visible viewport, clipping the table.

**How to avoid:** In `@media print`, set `#print-checklist { overflow: visible; page-break-inside: avoid; }` and remove max-height constraints. For very long lists, `page-break-after: auto` on `<tr>` allows multi-page print naturally.

### Pitfall 2: Using the same `#print-label` id
**What goes wrong:** If a `PrintLabelButton` is rendered anywhere else on the page (e.g., parent event page) while the checkout dialog is open, its `#print-label` div could conflict with the checklist's print style if they share an id.

**How to avoid:** Use unique ids per component (`#print-checklist`, `#print-do-document`) as documented above.

### Pitfall 3: Passing event date through multiple hops
**What goes wrong:** Forgetting to thread `eventStartDate` through `CheckoutClient → CheckoutGroupDialog → CheckoutChecklistDialog` leads to either prop drilling errors or having to default to "—".

**How to avoid:** Add `eventStartDate` to `CheckoutGroupDialogProps`, destructure it, pass it directly to both dialog components. Single prop, single hop from the parent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Print styling | Custom CSS-in-JS or Tailwind `print:` on every element | `<style>` + `body * { visibility: hidden }` + single id target (existing pattern) |
| DO type badge | Custom badge component | Import existing `DoTypeBadge` |
| Dialog chrome | Custom modal | shadcn `Dialog` (existing) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind v4 `print:` variant works but is not required — raw `<style>` injection is the project convention | Finding 5 | Low — both approaches work; convention preference only |

---

## Sources

- `CheckoutGroupDialog.tsx` — step 2 layout, prop types [VERIFIED: codebase read]
- `CheckoutClient.tsx` — EventDoc prop availability, call site for CheckoutGroupDialog [VERIFIED: codebase read]
- `scan-session.tsx` — CommitSuccessPayload and ScanCartLine type definitions [VERIFIED: codebase read]
- `PrintLabelButton.tsx` — project print pattern (style injection + window.print) [VERIFIED: codebase read]
- `delivery-orders/actions.ts` + `lib/schemas/delivery-order.ts` — why real DO creation is blocked (required file fields) [VERIFIED: codebase read]
- `delivery-orders/[doId]/page.tsx` — DO layout reference for print document design [VERIFIED: codebase read]
- `lib/types/event.ts` — EventDoc.startDate field confirmed [VERIFIED: codebase read]
