---
phase: quick-kayinleong-006
plan: 01
subsystem: scan, checkout, firestore
tags: [checkoutGroups, barcode, group-label, server-action, firestore-rules, firestore-indexes]

requires:
  - phase: quick-kayinleong-005
    provides: scan-session.tsx substrate, commitCheckoutCartAction, PrintLabelButton
  - phase: phase-kayinleong-02
    provides: Firebase Admin DAL, requireSession, Firestore rules infrastructure

provides:
  - checkoutGroups Firestore collection with type + schema + Server Action
  - Post-checkout group barcode dialog (two-step: count picker → print labels)
  - CommitSuccessPayload type + onCommitSuccess prop on ScanSessionProvider
  - Immutable checkoutGroups Firestore rules (isMember create, signed-in read)
  - checkoutGroups eventId+createdAt composite index

affects:
  - quick-kayinleong-007 (check-in group scan — reads checkoutGroups by group ID)
  - quick-kayinleong-008 (group barcode scan at check-in entry point)

tech-stack:
  added: []
  patterns:
    - "Post-commit deferred navigation: onCommitSuccess prop lets callers intercept
       the commit success path and show a dialog before navigating away"
    - "Parallel Server Action calls: Promise.all over createCheckoutGroupAction for
       each split group — fail-fast on any error, commit-all on full success"
    - "Round-robin item split: splitLines(lines, n) distributes cart lines evenly
       across n groups by index modulo — groups[i % n]"

key-files:
  created:
    - lib/types/checkout-group.ts
    - lib/schemas/checkout-group.ts
    - app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx
  modified:
    - app/(app)/events/[eventId]/checkout/actions.ts
    - components/feature/scan/scan-session.tsx
    - app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx
    - firestore.rules
    - firestore.indexes.json

key-decisions:
  - "onCommitSuccess is optional — when absent, existing router.push behavior is
     preserved; /scan page is unaffected without any changes at that call site"
  - "CheckoutGroupDialog uses Dialog open=always-true with no-op onOpenChange —
     user must use Skip or Done; no accidental backdrop dismiss"
  - "Each group write is a separate createCheckoutGroupAction call (not batched in
     a single transaction) — group creation is independent and failure of one is
     surfaced as a user-retryable toast"

requirements-completed:
  - quick-kayinleong-006

duration: 18min
completed: 2026-06-07
---

# Quick Task quick-kayinleong-006 Summary

**Post-checkout group barcode generation: CheckoutGroupDialog with split picker, parallel Firestore writes via createCheckoutGroupAction, and PrintLabelButton per group — scan-session defers navigation via onCommitSuccess prop.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-06-07
- **Tasks:** 3 (2 implementation + 1 verification)
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- After a successful checkout, a dialog surfaces offering 1–10 group barcodes instead of immediate navigation to the event page
- Each group creates an immutable `checkoutGroups` Firestore document with denormalized item lines + event reference; the doc ID is the barcode payload
- `PrintLabelButton` renders per group after creation; "Done" and "Skip" both navigate to the event page
- `/scan` page (the standalone scanner) remains unaffected — `onCommitSuccess` is absent there, so the existing `router.push` path fires unchanged

## Task Commits

1. **Task 1: Type, schema, Server Action, rules, indexes** - `afbf2fa` (feat)
2. **Task 2: CheckoutGroupDialog + scan-session + checkout-client** - `9bf4d32` (feat)
3. **Task 3: Build verification + CLAIM.md** - (docs commit below)

## Files Created/Modified

- `lib/types/checkout-group.ts` — `CheckoutGroupDoc` + `CheckoutGroupItemLine` types for checkoutGroups collection
- `lib/schemas/checkout-group.ts` — `CreateCheckoutGroupInputSchema` (Zod 4) + `CreateCheckoutGroupInput`
- `app/(app)/events/[eventId]/checkout/actions.ts` — appended `createCheckoutGroupAction` Server Action (EVT-08 gate + Firestore write); `commitCheckoutCartAction` unchanged
- `app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx` — two-step dialog: group count picker (1–10) with live split preview → print labels using `PrintLabelButton`
- `components/feature/scan/scan-session.tsx` — added `CommitSuccessPayload` export type; optional `onCommitSuccess` prop on `ScanSessionProvider`; cart snapshot captured before clearing
- `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx` — wired `onCommitSuccess` → `groupPayload` state → `CheckoutGroupDialog`; `onDone` navigates via `router.push`
- `firestore.rules` — `checkoutGroups` block: `isSignedIn()` read, `isMember(event)` create, update/delete immutable
- `firestore.indexes.json` — `checkoutGroups` composite index: `eventId ASC`, `createdAt DESC`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data paths are wired. `createCheckoutGroupAction` writes real Firestore documents; `PrintLabelButton` renders real barcodes.

## Threat Surface Scan

All security surfaces are covered by the plan's threat model:
- T-006-01: `requireSession()` at Server Action entry
- T-006-02: EVT-08 gate (admin OR allowedStaff) + Firestore `isMember()` defense-in-depth
- T-006-03: `allow update, delete: if false` — documents immutable after creation
- T-006-04: `allow get, list: if isSignedIn()` — intentional; no PII in group docs
- T-006-05: Dialog clamps splitCount to 1–10; each group independently validated by Zod

No new unplanned security surfaces introduced.

## Self-Check: PASSED
