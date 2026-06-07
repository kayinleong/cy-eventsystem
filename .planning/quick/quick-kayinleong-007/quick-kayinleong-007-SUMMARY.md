---
phase: quick-kayinleong-007
plan: 01
subsystem: ui
tags: [react, firestore, server-action, scanner, location-tracking]

requires:
  - phase: quick-kayinleong-006
    provides: checkoutGroups Firestore collection + CheckoutGroupDoc type used by group-barcode resolution in updateItemsLocationAction
  - phase: quick-kayinleong-005
    provides: externalBarcode field on InventoryItem; barcode lookup pattern (sku / id / externalBarcode)
  - phase: phase-kayinleong-02
    provides: ScannerWidget, ScanSessionProvider, useInventoryLive, adminDb, requireSession, dal

provides:
  - updateItemsLocationAction Server Action — 3-step barcode resolution (SKU/doc-id, externalBarcode, checkoutGroups) with batch Firestore writes
  - LocationPanel component — self-contained scan + preview + location-input UI (no cart participation)
  - ScanMode widened to "checkout" | "checkin" | "location"
  - ScannerWidget patched with eventRequired (default true) and onScan override props

affects:
  - app/(app)/scan — third tab added; LocationPanel mounted for location mode
  - components/feature/scan — ScannerWidget now accepts onScan override; existing callers unchanged

tech-stack:
  added: []
  patterns:
    - "onScan override prop pattern on ScannerWidget: when provided, called instead of addLine — allows panels outside the cart flow to intercept scans"
    - "eventRequired prop pattern: when false, ScannerWidget activates without a selected event (location mode and future event-free flows)"

key-files:
  created:
    - app/(app)/scan/actions.ts
    - components/feature/scan/LocationPanel.tsx
  modified:
    - components/feature/scan/scan-session.tsx
    - components/feature/scan/ScannerWidget.tsx
    - app/(app)/scan/page.tsx

key-decisions:
  - "D-007-01: Admin SDK batch API is adminDb.batch() not adminDb.writeBatch() — the plan used the incorrect API name; fixed inline (Rule 1)"
  - "D-007-02: useInventoryLive returns InventoryItem[] directly, not { items: InventoryItem[] } — the plan's interface comment was wrong; fixed inline (Rule 1)"
  - "D-007-03: LocationPanel does not participate in ScanSessionProvider cart flow — each scan triggers an immediate Server Action call rather than accumulating to a cart"
  - "D-007-04: Group barcode preview in idle state shows placeholder copy instead of pre-fetching checkoutGroups client-side — simpler + avoids a client-side Firestore import just for preview"

requirements-completed: []

duration: ~15min
completed: 2026-06-07
---

# Quick task quick-kayinleong-007: Location Scan Panel Summary

**Third scan tab with barcode-to-location update: LocationPanel + updateItemsLocationAction Server Action resolves item/group barcodes and batch-writes location to Firestore inventory docs**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-07T (session start)
- **Completed:** 2026-06-07
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- New `updateItemsLocationAction` Server Action with Zod validation, `requireSession()` auth gate, and 3-step barcode resolution (SKU/doc-id → externalBarcode → checkoutGroups)
- New `LocationPanel` component: camera scan + manual entry, item preview from live snapshot, free-text location input, immediate batch commit, success/error toasts, "Scan different barcode" reset
- `/scan` page now has three tabs (Check out / Check in / Location); Location tab works without selecting an event

## Task Commits

1. **Task 1: Server Action + ScanMode widen + ScannerWidget patch** - `e4b420c` (feat)
2. **Task 2: LocationPanel component + scan page Location tab** - `835c433` (feat)

## Files Created/Modified

- `app/(app)/scan/actions.ts` — new; `updateItemsLocationAction` Server Action + `UpdateItemsLocationResult` type
- `components/feature/scan/LocationPanel.tsx` — new; self-contained location scan UI with idle/preview/submitting state machine
- `components/feature/scan/scan-session.tsx` — `ScanMode` widened to include `"location"`; sessionStorage validation guard + cross-tab sync guard updated
- `components/feature/scan/ScannerWidget.tsx` — `eventRequired?: boolean` and `onScan?: (value: string) => void` props added; existing callers unchanged
- `app/(app)/scan/page.tsx` — third tab added; `LocationPanel` imported and rendered when `mode === "location"`

## Decisions Made

- D-007-01: Fixed `adminDb.writeBatch()` → `adminDb.batch()` (Admin SDK correct API)
- D-007-02: Fixed `useInventoryLive` usage — returns `InventoryItem[]` directly, not `{ items: ... }`
- D-007-03: LocationPanel does not use the ScanSessionProvider cart; each scan triggers an immediate Server Action call
- D-007-04: Group barcode preview shows placeholder copy at scan time; resolution details surface in the success toast after Server Action returns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect Admin SDK batch API call**
- **Found during:** Task 1 (Server Action creation)
- **Issue:** Plan specified `adminDb.writeBatch()` but the Firebase Admin SDK's `Firestore` type exposes `.batch()` not `.writeBatch()` — TypeScript error TS2339 "Property 'writeBatch' does not exist on type 'Firestore'"
- **Fix:** Changed all three call sites to `adminDb.batch()` (the correct Admin SDK method confirmed via `@google-cloud/firestore` types d.ts)
- **Files modified:** `app/(app)/scan/actions.ts`
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** e4b420c (Task 1 commit)

**2. [Rule 1 - Bug] Fixed incorrect useInventoryLive return value destructuring**
- **Found during:** Task 2 (LocationPanel creation)
- **Issue:** Plan's interface comment described `const { items } = useInventoryLive(...)` but the hook returns `InventoryItem[]` directly (not an object with an `items` property). Using the destructuring pattern would have resulted in `items` being `undefined`.
- **Fix:** Used `const items = useInventoryLive([], { limit: 500 })` — the direct array assignment matching the hook's actual return type
- **Files modified:** `components/feature/scan/LocationPanel.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; build passes
- **Committed in:** 835c433 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 × Rule 1 - Bug)
**Impact on plan:** Both fixes were required for correctness. No scope creep — plan's intent was implemented exactly.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Known Stubs

None — LocationPanel is fully wired to the Server Action; the action writes to Firestore via `adminDb.batch()`. No placeholder copy or hardcoded empty values in the data flow.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's threat model already documents (T-007-01 through T-007-04). The `updateItemsLocationAction` Server Action is the only new trust boundary and is covered by `requireSession()` + Zod validation.

## User Setup Required

None — no new environment variables, external services, or Firebase configuration changes required.

## Next Phase Readiness

- Location update flow is fully functional for items with matching SKUs and items identified by `externalBarcode`
- Group barcode location updates require existing `checkoutGroups` documents (created by quick-kayinleong-006's `createCheckoutGroupAction`)
- Existing checkout and checkin scan flows are unaffected — `ScannerWidget` default props (`eventRequired=true`, no `onScan`) preserve prior behavior

---
*Phase: quick-kayinleong-007*
*Completed: 2026-06-07*
