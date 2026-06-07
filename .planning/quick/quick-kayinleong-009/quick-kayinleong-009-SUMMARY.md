---
phase: quick
plan: quick-kayinleong-009
subsystem: checkout-print
tags: [print, checkout, dialogs, delivery-order]
dependency_graph:
  requires:
    - quick-kayinleong-006  # CheckoutGroupDialog + CommitSuccessPayload
    - quick-kayinleong-004  # DoTypeBadge
  provides:
    - CheckoutChecklistDialog
    - CheckoutDOPrintDialog
  affects:
    - app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx
    - app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx
tech_stack:
  added: []
  patterns:
    - inline <style> @media print isolation (matches PrintLabelButton pattern)
    - shadcn Dialog with DialogTrigger for print preview
key_files:
  created:
    - app/(app)/events/[eventId]/checkout/_components/CheckoutChecklistDialog.tsx
    - app/(app)/events/[eventId]/checkout/_components/CheckoutDOPrintDialog.tsx
  modified:
    - app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx
    - app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx
decisions:
  - Print isolation uses inline <style> with @media print (same as PrintLabelButton D-01-06-E) — not Tailwind print: utilities — keeps behavior co-located with component
  - DO type is always external-outbound for checkout (items leaving for an external event)
  - Documents section placed between group barcodes list and Done button in step 2 with border-t visual divider
metrics:
  duration: "~3 min"
  completed: "2026-06-07"
  tasks: 2
  files_modified: 4
  files_created: 2
---

# Quick Task quick-kayinleong-009 Summary

**One-liner:** Print checklist and Delivery Order dialogs added to CheckoutGroupDialog step 2 — isolated @media print via inline style injection, DoTypeBadge external-outbound, no Firestore writes.

## What Was Built

Two new `'use client'` print-preview dialog components and wiring into the post-checkout group barcode step 2 screen.

**CheckoutChecklistDialog** (`#print-checklist`):
- Trigger: "Print Checklist" button (FileText icon) in CheckoutGroupDialog step 2 Documents section
- Preview shows: heading, event name, event date, printed-at timestamp, cart table (Item Name / SKU / Qty) with total qty footer row
- `@media print` isolates `#print-checklist` only; `window.print()` triggered by a Print button outside the div

**CheckoutDOPrintDialog** (`#print-do-document`):
- Trigger: "Print Delivery Order" button (Package icon) in CheckoutGroupDialog step 2 Documents section
- Preview shows: "Delivery Order" heading, DoTypeBadge(external-outbound), event name, event date, generated-at timestamp, cart table, txIds reference footer
- `@media print` isolates `#print-do-document` only; `window.print()` triggered by a Print button outside the div

**CheckoutGroupDialog changes:**
- Added `eventStartDate: string` prop (ISO string)
- Imports both new dialog components
- Step 2 now has a "Documents" section (border-t divider, flex-wrap layout) between the groups list and the Done button

**checkout-client.tsx changes:**
- Passes `eventStartDate={event.startDate}` to CheckoutGroupDialog

## Deviations from Plan

None — plan executed exactly as written.

## Verification Gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | Exit 0 — no TypeScript errors |
| `npm run lint` | 0 errors, 12 pre-existing TanStack/rhf warnings (out of scope per scope boundary) |
| `npm run build` | Compiled successfully |

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both components are pure client render — all data was already in the browser from a committed checkout. Print id collision mitigation applied per T-009-02: unique ids `#print-checklist` and `#print-do-document` documented in component headers.

## Known Stubs

None — both components render live data from `CommitSuccessPayload` (cart + txIds + eventId) passed from the committed checkout.

## Self-Check: PASSED

- `app/(app)/events/[eventId]/checkout/_components/CheckoutChecklistDialog.tsx` — FOUND (commit dcc02c2)
- `app/(app)/events/[eventId]/checkout/_components/CheckoutDOPrintDialog.tsx` — FOUND (commit dcc02c2)
- `app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx` modified — FOUND (commit 8757e22)
- `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx` modified — FOUND (commit 8757e22)
