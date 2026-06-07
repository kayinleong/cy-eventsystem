---
phase: quick-kayinleong-008
plan: 01
subsystem: ui
tags: [firebase, firestore, checkin, scan, barcode, client-sdk]

# Dependency graph
requires:
  - phase: quick-kayinleong-006
    provides: checkoutGroups Firestore collection + Firestore rules (isSignedIn allow-read)
  - phase: quick-kayinleong-007
    provides: ScanMode type (location mode addition), ScannerWidget props
provides:
  - async addLine with mode-gated checkoutGroups Firestore probe
  - prescribed error toast for group barcodes in checkin mode
affects: [scan, checkin, checkout-client]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode-gated Firestore probe in error branch: fires only when (a) inventory lookup fails AND (b) mode === checkin"
    - "Async useCallback with await getDoc: safe because db is a module-level singleton, not React state — excluded from dependency array"

key-files:
  created: []
  modified:
    - components/feature/scan/scan-session.tsx
    - components/feature/scan/ScannerWidget.tsx
    - app/(app)/scan/page.tsx
    - app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx

key-decisions:
  - "Guard is strictly mode-gated to checkin only — checkout scans never trigger the Firestore read, preserving checkout-mode latency"
  - "db singleton excluded from useCallback deps — it is a module-level constant, not React state"
  - "handleScan in ScannerWidget made async to await addLine; ScannerWidget already debounces same-value within 1500ms, so concurrent calls are safe"

patterns-established:
  - "Async addLine pattern: convert synchronous useCallback to async; update ScanSessionContextValue type; await at every call site"

requirements-completed:
  - "quick-008: reject group barcodes in checkin mode with clear error toast"

# Metrics
duration: 15min
completed: 2026-06-07
---

# Quick Task quick-kayinleong-008 Summary

**Async addLine in scan-session.tsx with mode-gated `getDoc(checkoutGroups/{id})` probe — precise error toast on group barcode scan in checkin mode, zero latency impact in checkout mode**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-07T07:23:00Z
- **Completed:** 2026-06-07T07:38:54Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Made `addLine` async (`useCallback` + `Promise` return type) in `scan-session.tsx`
- Updated `ScanSessionContextValue.addLine` return type to `Promise<{ ok: true } | { ok: false; reason: string }>`
- Inserted mode-gated group barcode guard: fires `getDoc(db, "checkoutGroups", trimmed)` only when `mode === "checkin"` AND item not found in inventory
- Error toast fires exact prescribed message: "Group barcodes cannot be used for check-in. Please scan individual item barcodes."
- Awaited `addLine` in `ScannerWidget.handleScan` (handler made async)
- Awaited `addLine` in `ManualEntryInput onSubmit` on `/scan` page
- Awaited `addLine` in `ManualEntryInput onSubmit` in `checkout-client.tsx`
- tsc exit 0, lint exit 0 (12 pre-existing TanStack/rhf warnings, 0 errors, 0 new warnings)

## Task Commits

1. **Task 1: Make addLine async, add mode-gated group barcode guard, update all callers** - `4142f88` (feat)

**Plan metadata:** (final docs commit — see below)

## Files Created/Modified

- `components/feature/scan/scan-session.tsx` — Added `firebase/firestore` imports (`doc`, `getDoc`) + `db` from client; updated `ScanSessionContextValue.addLine` to async return type; made `addLine` useCallback async; inserted checkin-mode group barcode guard in `if (!item)` branch
- `components/feature/scan/ScannerWidget.tsx` — Made `handleScan` async; added `await addLine(value)`
- `app/(app)/scan/page.tsx` — Changed ManualEntryInput `onSubmit` from `(sku) => addLine(sku)` to `async (sku) => { await addLine(sku); }`
- `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx` — Same onSubmit async wrapper; guard is mode-gated internally so checkout mode incurs no extra Firestore read

## Decisions Made

- Guard is strictly mode-gated to `mode === "checkin"` — checkout mode never reaches the `getDoc` call, preserving zero-latency happy path.
- `db` is a module-level singleton (not React state); correctly excluded from the `useCallback` dependency array `[items, mode]`.
- `handleScan` in `ScannerWidget` is now async — the existing 1500ms same-value debounce already prevents rapid concurrent calls from racing the Firestore read.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `getDoc` call uses the authenticated user's session (Firebase client SDK); existing Firestore rules `allow get: if isSignedIn()` on `checkoutGroups` cover this without modification. Only `exists()` is inspected — no document data is read. Consistent with T-008-01/T-008-02 disposition (accept) in the plan threat register.

## Known Stubs

None.

## Self-Check: PASSED

- `components/feature/scan/scan-session.tsx` — exists, contains `mode === "checkin"` guard and `Promise<` return type
- `components/feature/scan/ScannerWidget.tsx` — exists, contains `await addLine`
- `app/(app)/scan/page.tsx` — exists, contains `async (sku) => { await addLine(sku); }`
- `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx` — exists, contains `async (sku) => { await addLine(sku); }`
- Commit `4142f88` exists in git log

## Next Steps

None required. This task closes the quick-008 guard. Checkout mode scan latency is unchanged.

---
*Phase: quick-kayinleong-008*
*Completed: 2026-06-07*
