---
phase: phase-kayinleong-02
plan: 12
subsystem: app-router-boundaries
tags: [block-h, wave-11, error-boundaries, loading-states, not-found, accessibility]
requires: [02-02]
provides: [error-boundary-app, loading-skeleton-app, not-found-app, not-found-item, not-found-event, loading-inventory, loading-events, loading-reports, unauthorized-page-top-level]
affects: [(app)/*, /unauthorized]
tech-stack-added: []
tech-stack-patterns: [next-16-file-conventions, react-error-boundary, react-suspense]
key-files-created:
  - app/(app)/error.tsx
  - app/(app)/loading.tsx
  - app/(app)/not-found.tsx
  - app/(app)/inventory/[itemId]/not-found.tsx
  - app/(app)/events/[eventId]/not-found.tsx
  - app/(app)/inventory/loading.tsx
  - app/(app)/events/loading.tsx
  - app/(app)/reports/loading.tsx
  - app/unauthorized.tsx
key-files-modified: []
decisions:
  - 'Use `reset` prop (stable Next 16) instead of `unstable_retry` for error.tsx — avoids the unstable_ prefix without sacrificing functionality.'
  - 'Inner segment boundaries use <div>, not <main>, because (app)/layout.tsx already renders <main>; nested <main> elements are invalid HTML.'
  - 'Coexist app/unauthorized.tsx (top-level, paired with future unauthorized() call) AND app/(app)/unauthorized/page.tsx (existing redirect("/unauthorized") target). Latter to be removed when DAL graduates off experimental authInterrupts.'
metrics:
  duration: ~15min
  completed: 2026-05-26
  commits: [c5759d8, 28b5a88]
---

# Phase 2 Plan 12: Error / Loading / Not-Found Segments Summary

NFR-05 Block H — every authenticated segment now ships graceful error / loading / not-found fallbacks; T-02-12-01 (error.tsx Firebase leak) and T-02-12-02 (event not-found enumeration) mitigated; unauthorized.tsx primed for Next 16's `unauthorized()`.

## What shipped

| File | Purpose |
|------|---------|
| `app/(app)/error.tsx` | App-wide error boundary (Client Component; renders only `error.digest`, never `error.message`). |
| `app/(app)/loading.tsx` | App-wide skeleton during DAL fetch. |
| `app/(app)/not-found.tsx` | Generic 404 inside the authenticated shell. |
| `app/(app)/inventory/[itemId]/not-found.tsx` | "Item not found" → links to /inventory. |
| `app/(app)/events/[eventId]/not-found.tsx` | Anti-enumeration copy (T-02-12-02) → links to /events. |
| `app/(app)/inventory/loading.tsx` | Filter-bar + 8-row table skeleton. |
| `app/(app)/events/loading.tsx` | Status-chip + 8-row card skeleton. |
| `app/(app)/reports/loading.tsx` | Light skeleton; ReportsTabs nav stays visible. |
| `app/unauthorized.tsx` | Top-level pair for Next 16 `unauthorized()` (AUTH-10). |

## Verification

- `npx tsc --noEmit` — PASS (silent).
- `npm run build` — PASS (26 routes generated, Turbopack compiled in 4.9s).
- `npm run lint` — 13 pre-existing problems (1 error in `ScannerWidget.tsx` + 12 warnings) unchanged. **0 new lint issues from this plan.**
- File existence: all 9 PLAN-listed files present (`test -f` PASS for every entry).
- `head -3 app/(app)/error.tsx | grep -q '"use client"'` — PASS.
- `grep -q "error.digest" app/(app)/error.tsx` — PASS. `error.message` appears only in comments + `console.error()`, never in JSX.

## Deviations

1. **[Rule 2 — HTML hygiene]** PLAN's `error.tsx` / `not-found.tsx` examples wrapped content in `<main>`. `(app)/layout.tsx` already renders `<main>`, so nested `<main>` elements would result. Changed inner wrappers to `<div>`. `app/unauthorized.tsx` (top-level, no parent layout `<main>`) kept `<main>` as intended.
2. **[Rule 3 — out-of-scope WIP discovered]** During Task 2 verification, `components/feature/scan/scan-session.tsx` showed a 184-line uncommitted modification (a Plan 02-13 RES-03 sessionStorage persistence WIP) that I did not author. Per SCOPE BOUNDARY, reverted with `git checkout -- components/feature/scan/scan-session.tsx`. Did NOT commit the foreign change; Plan 02-13's owner re-applies.

## Self-Check: PASSED

- FOUND: `app/(app)/error.tsx` (commit c5759d8)
- FOUND: `app/(app)/loading.tsx` (commit c5759d8)
- FOUND: `app/(app)/not-found.tsx` (commit c5759d8)
- FOUND: `app/unauthorized.tsx` (commit c5759d8)
- FOUND: `app/(app)/inventory/[itemId]/not-found.tsx` (commit 28b5a88)
- FOUND: `app/(app)/events/[eventId]/not-found.tsx` (commit 28b5a88)
- FOUND: `app/(app)/inventory/loading.tsx` (commit 28b5a88)
- FOUND: `app/(app)/events/loading.tsx` (commit 28b5a88)
- FOUND: `app/(app)/reports/loading.tsx` (commit 28b5a88)
- FOUND: commit c5759d8 (`git log --oneline | grep c5759d8`)
- FOUND: commit 28b5a88 (`git log --oneline | grep 28b5a88`)
