---
phase: quick-kayinleong-009
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(app)/events/[eventId]/checkout/_components/CheckoutChecklistDialog.tsx
  - app/(app)/events/[eventId]/checkout/_components/CheckoutDOPrintDialog.tsx
  - app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx
  - app/(app)/events/[eventId]/checkout/checkout-client.tsx
autonomous: true
requirements: [quick-kayinleong-009]
must_haves:
  truths:
    - "Step 2 of CheckoutGroupDialog shows a 'Documents' section with two print buttons below the group barcodes list"
    - "Clicking 'Print Checklist' opens a dialog with event name, date, printed-at, and cart items table; window.print() isolates to that div only"
    - "Clicking 'Print Delivery Order' opens a dialog with a DO-style document pre-filled from cart; window.print() isolates to that div only"
    - "No Firestore writes occur — both dialogs are client-only render + window.print()"
    - "TypeScript compiles clean and lint passes"
  artifacts:
    - path: "app/(app)/events/[eventId]/checkout/_components/CheckoutChecklistDialog.tsx"
      provides: "Checkout checklist print dialog"
    - path: "app/(app)/events/[eventId]/checkout/_components/CheckoutDOPrintDialog.tsx"
      provides: "Delivery Order print dialog"
    - path: "app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx"
      provides: "Modified step 2 with Documents section + eventStartDate prop"
    - path: "app/(app)/events/[eventId]/checkout/checkout-client.tsx"
      provides: "eventStartDate prop threaded to CheckoutGroupDialog"
  key_links:
    - from: "CheckoutGroupDialog.tsx (step 2)"
      to: "CheckoutChecklistDialog"
      via: "props: payload, eventName, eventStartDate"
    - from: "CheckoutGroupDialog.tsx (step 2)"
      to: "CheckoutDOPrintDialog"
      via: "props: payload, eventName, eventStartDate"
    - from: "checkout-client.tsx"
      to: "CheckoutGroupDialog"
      via: "new eventStartDate={event.startDate} prop"
---

<objective>
Add two print dialogs to CheckoutGroupDialog step 2: a checkout item checklist and a print-only Delivery Order document. Both use the established window.print() + @media print isolation pattern from PrintLabelButton. No Firestore writes — pure client render.

Purpose: Give staff a printable record of what was checked out immediately after a successful checkout.
Output: Two new dialog components + CheckoutGroupDialog step 2 extended with a "Documents" section.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/quick/quick-kayinleong-009/quick-kayinleong-009-RESEARCH.md

<!-- Key interfaces the executor needs — extracted from codebase -->
<interfaces>
From components/feature/scan/scan-session.tsx:
```typescript
export type ScanCartLine = {
  itemId: string;
  itemSku: string;
  itemName: string;
  qty: number;
  availableQty: number;
};

export type CommitSuccessPayload = {
  cart: ScanCartLine[];
  txIds: string[];
  eventId: string;
};
```

From app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx (current props):
```typescript
type CheckoutGroupDialogProps = {
  payload: CommitSuccessPayload;
  eventName: string;
  onDone: () => void;
};
// Step 2 renders group barcode list with PrintLabelButton per group, then a Done button.
// New eventStartDate: string prop required — thread from checkout-client.tsx event.startDate.
```

From components/feature/delivery-orders/DoTypeBadge.tsx:
```typescript
// Accepts type prop: "internal" | "external-outbound" | "external-inbound"
export function DoTypeBadge({ type }: { type: DoType }) { ... }
```

Print pattern from components/feature/inventory/PrintLabelButton.tsx:
```tsx
// Inline <style> with @media print:
// body * { visibility: hidden !important; }
// #print-label, #print-label * { visibility: visible !important; }
// #print-label { position: absolute; inset: 0; ... }
// Then: <Button onClick={() => window.print()}>Print</Button>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create CheckoutChecklistDialog and CheckoutDOPrintDialog</name>
  <files>
    app/(app)/events/[eventId]/checkout/_components/CheckoutChecklistDialog.tsx
    app/(app)/events/[eventId]/checkout/_components/CheckoutDOPrintDialog.tsx
  </files>
  <action>
Create two new 'use client' components using the PrintLabelButton @media print pattern (style injection + window.print(), NOT Tailwind print: utilities).

**CheckoutChecklistDialog** (`#print-checklist` id):

Props:
```typescript
type CheckoutChecklistDialogProps = {
  payload: CommitSuccessPayload;
  eventName: string;
  eventStartDate: string; // ISO string
};
```

Renders a shadcn Dialog with a trigger Button labeled "Print Checklist" (use FileText icon from lucide-react). The DialogContent shows:
- Print-preview section (`id="print-checklist"`) containing:
  - Heading: "Checkout Checklist"
  - Event: eventName
  - Date: `new Date(eventStartDate).toLocaleDateString()`
  - Printed at: `new Date().toLocaleString()` (computed at render, not state)
  - A plain HTML `<table>` with thead (Item Name / SKU / Qty) and tbody rows from payload.cart
  - Footer row: Total qty = `payload.cart.reduce((sum, l) => sum + l.qty, 0)`
- A "Print" Button below the preview (outside the print target div) that calls `window.print()`

@media print style (injected via `<style>` tag inside the component):
```css
@media print {
  body * { visibility: hidden !important; }
  #print-checklist, #print-checklist * { visibility: visible !important; }
  #print-checklist { position: absolute; inset: 0; padding: 24px; overflow: visible; }
}
```

---

**CheckoutDOPrintDialog** (`#print-do-document` id):

Props:
```typescript
type CheckoutDOPrintDialogProps = {
  payload: CommitSuccessPayload;
  eventName: string;
  eventStartDate: string; // ISO string
};
```

Renders a shadcn Dialog with a trigger Button labeled "Print Delivery Order" (use Package icon from lucide-react). The DialogContent shows:
- Print-preview section (`id="print-do-document"`) containing:
  - Heading: "Delivery Order"
  - Import and render `DoTypeBadge` with `type="external-outbound"` (from `@/components/feature/delivery-orders/DoTypeBadge`)
  - Event: eventName
  - Date: `new Date(eventStartDate).toLocaleDateString()`
  - Generated at: `new Date().toLocaleString()`
  - A plain HTML `<table>` with thead (Item Name / SKU / Qty) and tbody rows from payload.cart
  - Footer note: `Reference: ${payload.txIds.join(', ')}`
- A "Print" Button below the preview that calls `window.print()`

@media print style:
```css
@media print {
  body * { visibility: hidden !important; }
  #print-do-document, #print-do-document * { visibility: visible !important; }
  #print-do-document { position: absolute; inset: 0; padding: 24px; overflow: visible; }
}
```

Use unique ids to avoid collision with `#print-label` (PrintLabelButton) and with each other. Since only one Dialog can be open at a time, there is no simultaneous-render conflict.

Both components import from:
- `@/components/ui/dialog` (Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger)
- `@/components/ui/button` (Button)
- lucide-react (FileText / Package icon)
- `@/components/feature/scan/scan-session` (CommitSuccessPayload, ScanCartLine types)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "CheckoutChecklist|CheckoutDOPrint" | head -20</automated>
  </verify>
  <done>Both files exist with no TypeScript errors. Each exports a named component. Each has a unique @media print id. No new npm dependencies added.</done>
</task>

<task type="auto">
  <name>Task 2: Wire print dialogs into CheckoutGroupDialog step 2 + thread eventStartDate</name>
  <files>
    app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx
    app/(app)/events/[eventId]/checkout/checkout-client.tsx
  </files>
  <action>
**CheckoutGroupDialog.tsx** — two changes:

1. Add `eventStartDate: string` to `CheckoutGroupDialogProps` and destructure it in the component.

2. In the step 2 JSX, insert a "Documents" section between the groups list and the Done button:
```tsx
{/* Documents section */}
<div className="space-y-2 border-t pt-4">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documents</p>
  <div className="flex flex-wrap gap-2">
    <CheckoutChecklistDialog
      payload={payload}
      eventName={eventName}
      eventStartDate={eventStartDate}
    />
    <CheckoutDOPrintDialog
      payload={payload}
      eventName={eventName}
      eventStartDate={eventStartDate}
    />
  </div>
</div>
```

Import both dialog components at the top of the file:
```tsx
import { CheckoutChecklistDialog } from "./CheckoutChecklistDialog";
import { CheckoutDOPrintDialog } from "./CheckoutDOPrintDialog";
```

---

**checkout-client.tsx** — thread the new prop:

Find the `<CheckoutGroupDialog` JSX and add `eventStartDate={event.startDate}`. The `event` prop is already in scope as `EventDoc`. No other changes.

Verify `EventDoc.startDate` is a string field (confirmed by research: lib/types/event.ts has `startDate: string`).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint 2>&1 | tail -20</automated>
  </verify>
  <done>
    - CheckoutGroupDialog step 2 renders the Documents section with both print buttons between the group list and the Done button.
    - checkout-client.tsx passes eventStartDate={event.startDate} to CheckoutGroupDialog.
    - `npx tsc --noEmit` exits 0.
    - `npm run lint` exits 0 (only known pre-existing TanStack/rhf warnings are acceptable).
    - `npm run build` exits 0 with 32 routes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client render → window.print() | All data is already in browser memory from a committed checkout; no new surface exposed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-009-01 | Information Disclosure | Print dialogs showing cart data | accept | Data is already visible on the checkout screen to the authenticated user; print merely reproduces what's on-screen. No new data exposure. |
| T-009-02 | Tampering | @media print id collision with future components | mitigate | Unique ids `#print-checklist` and `#print-do-document` documented in component headers; future components must not reuse these ids. |
</threat_model>

<verification>
1. `npx tsc --noEmit` — exits 0
2. `npm run lint` — exits 0 (pre-existing TanStack warnings acceptable)
3. `npm run build` — exits 0, still 32 routes
4. Manual: navigate to /events/[eventId]/checkout, complete a checkout, step 2 shows Documents section with two buttons
5. Manual: click "Print Checklist" — dialog opens with event name/date/items table; window.print() dialog shows only checklist content
6. Manual: click "Print Delivery Order" — dialog opens with DO layout + DoTypeBadge; window.print() dialog shows only DO content
</verification>

<success_criteria>
- Two new dialog components exist and compile clean
- CheckoutGroupDialog step 2 shows "Documents" section between group list and Done button
- checkout-client.tsx passes eventStartDate to CheckoutGroupDialog without TypeScript errors
- No new npm dependencies
- No Firestore writes introduced
- tsc + lint + build all pass
</success_criteria>

<output>
After completion, create `.planning/quick/quick-kayinleong-009/quick-kayinleong-009-SUMMARY.md` and update CLAIM.md status to done with Verification section.
</output>
