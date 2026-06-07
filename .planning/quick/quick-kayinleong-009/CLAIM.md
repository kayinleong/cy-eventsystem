# Claim: quick-kayinleong-009
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-07
- status: done
- completed: 2026-06-07
- summary: Print checklist and Delivery Order after checkout — printable item checklist with quantities and event name; DO document from DO module; both triggered from checkout success screen

## What Changed

**Created:**
- `app/(app)/events/[eventId]/checkout/_components/CheckoutChecklistDialog.tsx` — print-preview dialog, @media print isolates #print-checklist, event name/date/printed-at + cart table + total qty
- `app/(app)/events/[eventId]/checkout/_components/CheckoutDOPrintDialog.tsx` — print-preview dialog, @media print isolates #print-do-document, DoTypeBadge external-outbound + event name/date/generated-at + cart table + txIds reference

**Modified:**
- `app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx` — added `eventStartDate: string` prop, imported both new dialogs, inserted Documents section in step 2 between groups list and Done button
- `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx` — added `eventStartDate={event.startDate}` prop to CheckoutGroupDialog

**No Firestore writes.** Both dialogs are pure client render + window.print(). No new npm dependencies.

## Verification

### What Was Tested
- `npx tsc --noEmit` — exit 0, no TypeScript errors
- `npm run lint` — 0 errors, 12 pre-existing TanStack/rhf warnings (pre-existing, out of scope)
- `npm run build` — "Compiled successfully"

### What Passed
All automated gates passed. TypeScript confirms the CommitSuccessPayload + EventDoc.startDate prop chain is type-safe end-to-end.

### Regression Report
**Regression surface:** CheckoutGroupDialog (step 2), checkout-client.tsx, CommitSuccessPayload type contract

**Self-audit per hunk:**
1. `CheckoutGroupDialog.tsx` — added `eventStartDate: string` to props type + destructured it. Existing `payload`, `eventName`, `onDone` props unchanged. Step 1 unchanged. Step 2 groups list and Done button unchanged; Documents section inserted between them. No mutation logic touched.
2. `checkout-client.tsx` — single new prop `eventStartDate={event.startDate}` on CheckoutGroupDialog JSX. `event.startDate` is confirmed `string` in `EventDoc`. No other changes. ScanSessionProvider, CheckoutBody, router logic untouched.
3. New `CheckoutChecklistDialog.tsx` and `CheckoutDOPrintDialog.tsx` — new files, no impact on any existing component.

**What was ruled out:**
- Existing checkout flow (scan, commit, Firestore write) not touched — no regression risk
- CheckoutGroupDialog step 1 (split count picker + Generate) not touched
- PrintLabelButton (#print-label) not touched; unique print ids prevent @media print collision
- All other routes unaffected (no shared state changes)
