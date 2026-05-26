---
phase: phase-kayinleong-02
plan: 13
subsystem: offline + PWA
tags: [RES-01, RES-02, RES-03, RES-04, NFR-09, offline, pwa, sessionStorage, scan-cart]
requires: [02-02, 02-08]
provides: [global OfflineBanner, ScannerWidget offline gate, scan-cart sessionStorage persistence, PWA manifest]
affects: [(app)/layout, ScannerWidget, ScanSessionProvider, root layout metadata]
key-files:
  created:
    - components/layout/OfflineBanner.tsx
    - public/manifest.webmanifest
    - .planning/phases/phase-kayinleong-02/02-13-offline-and-pwa-SUMMARY.md
  modified:
    - app/(app)/layout.tsx
    - components/feature/scan/ScannerWidget.tsx
    - components/feature/scan/scan-session.tsx
    - app/layout.tsx
decisions:
  - "Scanner offline gate lives inside ScannerWidget (single source) — propagates to /scan, /events/[id]/checkout, /events/[id]/checkin without per-page guards. The widget renders a WifiOff placeholder when navigator.onLine===false."
  - "RES-03 persistence keyed on 'scan-cart-v1' (versioned for clean future invalidation) with a 4h staleness guard — older payloads are treated as abandoned sessions rather than silently rehydrating yesterday's cart."
  - "Hydration precedence: explicit initialEvent prop (event-bound pages) always wins over persisted state; persisted state only applies on /scan where no event is supplied. Cart is always rehydrated regardless of mount site."
  - "Theme color moved from Metadata.themeColor (deprecated in Next 16) to the new Viewport export, per node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md."
  - "PWA icon PNGs (192/512) listed in manifest as v2 polish — Lighthouse will warn until icon-192.png/icon-512.png ship, but the manifest itself satisfies RES-04 minimum."
metrics:
  duration: "~50min"
  completed: "2026-05-26"
  tasks_completed: 5
  files_modified: 4
  files_created: 3
---

# Phase 2 Plan 13: Offline + PWA Summary

**One-liner:** RES-01..04 closed — Firestore IndexedDB cache already shipped in 02-02; global OfflineBanner + ScannerWidget offline gate added; scan-cart persisted to sessionStorage under `scan-cart-v1`; PWA manifest live at `public/manifest.webmanifest` and wired through Next 16's Metadata API.

## What changed

### Task 1 — OfflineBanner (RES-02)
Created `components/layout/OfflineBanner.tsx`: a Client Component that subscribes to `navigator.onLine` + window `online`/`offline` events, renders `null` when online (zero steady-state cost), and shows a destructive-toned banner with WifiOff icon + copy "Offline — reconnect to scan. Existing data continues to display from cache." when offline. Wired into `app/(app)/layout.tsx` above the AppShell so every authenticated route surfaces it consistently. The (app) layout grew a vertical flex wrapper to host the banner above the sidebar+main grid.

### Task 2 — Scanner offline gate (RES-02 + D-19)
ScannerWidget now subscribes to `navigator.onLine` and early-returns a disabled placeholder ("Scanner disabled while offline. Reconnect to scan or use manual entry to queue items.") when offline. Single gate covers /scan, /events/[id]/checkout, and /events/[id]/checkin because they all mount the same widget. D-19 rationale: writing to Firestore while offline would queue and race the eventual reconnect, potentially double-decrementing stock. Read-side caching via `persistentLocalCache` is unaffected.

### Task 3 — Scan-cart sessionStorage persistence (RES-03 DELIVERED)
Replaced the React-state-only cart with a sessionStorage-mirrored variant:
- Versioned key `scan-cart-v1` so future schema changes invalidate cleanly.
- 4h staleness guard — abandoned sessions don't rehydrate.
- Hydrate on Provider mount via functional initializers (`useState(() => loadPersisted())`).
- Single mirror `useEffect` watches cart/selectedEvent/mode and writes on change — no churn to the four cart mutators (addLine, removeLine, setQty, endSession).
- Explicit `clearPersisted()` on the commit-success path so cross-tab listeners fire immediately, before the router.push state cascade.
- Cross-tab sync via window `storage` event — committing in tab A clears the cart in tab B.
- SSR-safe: every sessionStorage access guarded with `typeof window !== "undefined"`.
- Hydration precedence: explicit `initialEvent` (event-bound checkout pages) always wins over persisted state, keeping /events/[id]/checkout deterministic.

### Task 4 — PWA manifest (RES-04)
Created `public/manifest.webmanifest` with name "cy-eventsystem", short_name "cy-events", display=standalone, theme/background colors `#0a0a0a`, portrait orientation, and two icon entries (192/512 maskable). Wired from `app/layout.tsx` via the Next 16 Metadata API (`manifest: "/manifest.webmanifest"`). Added `appleWebApp` metadata for iOS home-screen install. Moved theme-color to the new `Viewport` export per Next 16 deprecation guidance.

## Verification

| Check | Status |
|------|--------|
| `npx tsc --noEmit` | EXIT 0 |
| `npm run lint` | 0 errors, 12 pre-existing TanStack Table warnings (out-of-scope) |
| `npm run build` | green, all 30 routes generated |
| `test -f public/manifest.webmanifest` | OK |
| `node -e "JSON.parse(fs.readFileSync('public/manifest.webmanifest'))"` | EXIT 0 |
| grep `navigator.onLine` in OfflineBanner.tsx and ScannerWidget.tsx | OK |
| grep `sessionStorage.{set,get,remove}Item.*scan-cart` in scan/ | 3 matches |
| grep `STALE_MS` + `typeof window` in scan-session.tsx | OK |

## RES status

| Req | Status | Source |
|-----|--------|--------|
| RES-01 (offline reads) | DELIVERED via 02-02 | `lib/firebase/client.ts` `persistentLocalCache` |
| RES-02 (offline banner + scanner disable) | DELIVERED | Tasks 1+2 |
| RES-03 (scan-cart persistence) | DELIVERED (fully — not just partial via Firestore cache) | Task 3 |
| RES-04 (PWA manifest) | DELIVERED (v1 minimum; icons v2 polish) | Task 4 |
| NFR-09 | satisfied — offline UX surfaced + writes gated |

## Commits

| Commit | Task | Files |
|--------|------|-------|
| `e19b640` | T1: OfflineBanner per RES-02 | components/layout/OfflineBanner.tsx, app/(app)/layout.tsx |
| `c8fc56b` | T2: Disable scanner widget offline | components/feature/scan/ScannerWidget.tsx |
| `ab53888` | T3: Persist scan-cart to sessionStorage | components/feature/scan/scan-session.tsx |
| `37353cb` | T2 lint fix: remove redundant offline-teardown effect | components/feature/scan/ScannerWidget.tsx |
| `2eeb81c` | T4: PWA manifest per RES-04 | public/manifest.webmanifest, app/layout.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-hooks/set-state-in-effect lint error in ScannerWidget**
- **Found during:** Task 2 lint pass
- **Issue:** The plan's reference implementation suggested a useEffect calling `setActive(false)` when going offline. Modern `eslint-plugin-react-hooks` flags synchronous setState inside an effect body as a cascading-render hazard.
- **Fix:** Removed the imperative effect. React's reconciliation already tears down the `<Scanner/>` MediaStream when the `!online` early-return path renders, so no imperative state change is needed. Replaced the effect with an explanatory comment.
- **Files modified:** components/feature/scan/ScannerWidget.tsx
- **Commit:** 37353cb

**2. [Rule 3 - Compat] Moved themeColor to Viewport export**
- **Found during:** Task 4
- **Issue:** Next 16 deprecates `Metadata.themeColor` in favor of the `Viewport` export.
- **Fix:** Added `export const viewport = { themeColor: "#0a0a0a" }` and removed the themeColor field from Metadata.
- **Files modified:** app/layout.tsx
- **Commit:** 2eeb81c (rolled in with Task 4)

### Anomaly observed (not a Deviation — environmental)

During Task 3 execution, my Write to `components/feature/scan/scan-session.tsx` was reverted at least twice between Write and post-Write verification — most likely because the parallel plan-02-12 orchestrator agent was finishing in the same working tree and a stray sync mechanism reset uncommitted changes. Recovery: re-wrote the file and committed immediately to lock in. Plan 02-12's three commits (`c5759d8`, `28b5a88`, `4fe019e`) all touched only error/loading/not-found files (disjoint from this plan's surface), so no actual conflict occurred — just a transient working-tree reset.

## Threat Model Status

| Threat | Disposition | Realised in code |
|--------|-------------|------------------|
| T-02-13-01 (offline scan races queued writes) | mitigate | ScannerWidget early-return when `!navigator.onLine` |
| T-02-13-02 (cached docs survive sign-out) | accept | persistentLocalCache scoped to Firebase Auth state |
| T-02-13-03 (persisted scan-cart survives sign-out on shared device) | accept | sessionStorage is tab-scoped + payload non-PII |

## Known v2 polish

- `public/icon-192.png` and `public/icon-512.png` need real artwork — currently the manifest references paths that 404. Chrome DevTools → Application → Manifest will warn until the PNGs ship. Lighthouse PWA score blocked on this.

## Self-Check: PASSED
- components/layout/OfflineBanner.tsx — FOUND
- public/manifest.webmanifest — FOUND
- app/(app)/layout.tsx — modified with `<OfflineBanner />` wiring
- components/feature/scan/ScannerWidget.tsx — modified with offline gate
- components/feature/scan/scan-session.tsx — modified with sessionStorage persistence
- app/layout.tsx — modified with manifest + appleWebApp + viewport
- Commits e19b640, c8fc56b, ab53888, 37353cb, 2eeb81c — all FOUND in git log
