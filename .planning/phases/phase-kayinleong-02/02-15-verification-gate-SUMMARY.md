---
phase: phase-kayinleong-02
plan: 15
subsystem: hardening / verification
tags: [verification-gate, regression-report, phase-closure]
requires:
  - All plans 02-01..02-14 PASS (per-block smokes attested by user)
  - Automated gates green
provides:
  - Phase 2 closure: CLAIM.md status=done, STATE.md updated, REQUIREMENTS.md traceability ticked
  - Consolidated regression report per global CLAUDE.md docs gate
  - Final commit landing the closure docs
affects:
  - .planning/phases/phase-kayinleong-02/CLAIM.md
  - .planning/STATE.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
tech-stack:
  added: []
  patterns:
    - "Consolidated regression report citing per-block smoke evidence (plans 02-02 .. 02-14)"
    - "Three-document closure: CLAIM.md (done) + STATE.md (phase tracker) + REQUIREMENTS.md (traceability)"
key-files:
  created:
    - .planning/phases/phase-kayinleong-02/02-15-verification-gate-SUMMARY.md
  modified:
    - .planning/phases/phase-kayinleong-02/CLAIM.md
    - .planning/STATE.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - "Use stable build/tsc/lint gates as primary attestation; per-block smokes already attested in CLAIM.md"
  - "Phase 2 architectural amendments locked in CHANGELOG: D-02 inlined Cloud Functions, D-06 rules unit tests skipped, D-15 photo field, D-17 cursor URLs, D-19 persistentLocalCache, storage write rule relaxed, event status derived from dates, reports sub-nav added"
metrics:
  duration: 8m
  completed: 2026-05-27
---

# Phase 2 Plan 15: Verification Gate Summary

**One-liner:** Phase 2 COMPLETE — all 3 automated gates green, 14 prior plans attested per-block, CLAIM.md closed with full regression report per global CLAUDE.md docs gate.

## Automated Gates — Run 2026-05-27

| Gate | Command | Exit | Output |
|------|---------|------|--------|
| TypeScript | `npx tsc --noEmit` | 0 | clean — zero diagnostics |
| ESLint | `npm run lint` | 0 | 0 errors, 12 warnings (pre-existing `react-hooks/incompatible-library` from TanStack `useReactTable` + react-hook-form `watch()` — same set tracked since plan 02-06; out-of-scope per scope boundary) |
| Production build | `npm run build` | 0 | 30 routes generated (28 functional + `/_not-found` + proxy middleware); "Compiled successfully" |

All gates PASS. No new lint problems introduced by plan 02-15.

## 10-Step Acceptance Demo — Per-Block Evidence Trail

Per the plan, the consolidated 10-step demo is mapped to per-block smokes already attested in CLAIM.md and per-plan SUMMARY artifacts. Each row maps to a ROADMAP success criterion + the plan that delivered it + the smoke that confirmed it.

| # | ROADMAP success criterion | Delivered by plan | Smoke evidence |
|---|---------------------------|-------------------|----------------|
| 1 | Admin signs in, invites staff, staff sets password, signs in | 02-03 (auth pages) + 02-04 (users + Copy-link D-09) | CLAIM.md "## Rules Audit — Block A" (5/5 user-attested); 02-03 SUMMARY auth E2E pass |
| 2 | Admin creates item + event + assigns team; staff checks out via QR; stock matches at every step | 02-05/06 (inventory) + 02-07 (events + allowedStaff) + 02-08 (checkout marquee) | 02-06 inventory smoke (user-attested PASS); 02-07 events smoke (user-attested PASS); 02-08 checkout smoke (user-attested PASS) |
| 3 | Concurrent check-outs cannot drive availableQty negative; UI surfaces clear error | 02-08 (CO-05 invariant + STOCK_INSUFFICIENT failedLines) | 02-08 SUMMARY checkpoint smoke D "concurrent invariant test" — user-attested PASS via 2-browser race |
| 4 | Missing items flagged at check-in appear in /reports/missing; admin resolves; resolution affects stock | 02-09 (checkin + MIS-01..04) | 02-09 SUMMARY 7-row smoke (user-attested PASS); resolution outcomes Found / WrittenOff both verified |
| 5 | Phase 1 UI surface not regressed (with D-15 + D-17 amendments) | 02-06 (photo D-15 + cursor URLs D-17) + 02-07/08/09/10 (every page swap preserved layouts) | Phase 1 UI shell primitives (Plan 01-03) reused verbatim; visual chrome unchanged on /login, /, /inventory, /events, /scan, /reports/*, /users, /settings |
| 6 | ~~Firestore rules unit tests~~ — AMENDED per D-06; replaced by manual rules audit chain | 02-02..02-14 (8 manual audits) | CLAIM.md "## Rules Audit — Block A" (5 rows) + `rules-audit-final.md` (39 Firestore + 9 Storage = 48 rows cross-collection) — both attested |
| 7 | `firestore.indexes.json` deploys clean; no auto-create prompts | 02-02 (12 indexes declared) + 02-07/09 (expanded to 19) + 02-14 (reconciliation + sync commit 315793a) | INT-05 reaffirmed in `rules-audit-final.md`; deploy command output in audit doc |
| 8 | `npm run build` + `tsc --noEmit` + ESLint pass | This plan 02-15 | All 3 gates exit 0; see "Automated Gates" table above |
| 9 | (composite of 1-8) PWA installability + offline UX | 02-13 (RES-01..04) | 02-13 SUMMARY (user-attested PASS); offline banner + scanner gate + scan-cart sessionStorage + PWA manifest |
| 10 | (composite of 1-8) Segment boundaries + error/loading/not-found | 02-12 | 02-12 SUMMARY: 9 special files + HTML hygiene fix; build passes with all boundaries |

## Phase 2 Architectural Amendments

The following deviated from plan-time intent during Phase 2 execution; each is documented in CHANGELOG.md, CLAIM.md, and per-plan SUMMARY artifacts.

1. **D-02 re-amended (commit 93bf62d):** Cloud Functions removed entirely; logic inlined into Server Actions. `functions/` directory deleted in plan 02-07. Two logical functions (setCustomUserClaims + allowedStaff sync) now run synchronously inside `inviteUser`, `setUserRole`, `disableUser`, `createEvent`, `updateEvent` via `recomputeAllowedStaffForEvent` from `@/lib/data/allowed-staff.server`. No deploy step required for functions.
2. **D-06 (rules unit tests skipped):** Acknowledged unmitigated risk at plan-time; mitigation = 8 manual audits (1 per block + final cross-collection in `rules-audit-final.md`). 48-row audit matrix replaces automated tests.
3. **D-15 (photo field added):** `/inventory/new` and `/inventory/[id]/edit` gained `ItemPhotoField` component (camera + file-picker, client-side resize to 0.3MB / 1600px). Phase 1 UI surface amendment.
4. **D-17 (cursor URL contract):** All list pages (`/inventory`, `/events`, `/users`, `/reports/*`) migrated from `?page=N` to `?cursor=xxx` per Firestore cursor pagination model. Page-N/M chrome replaced with Prev/Next. Phase 1 URL contract amendment.
5. **D-19 corrected to `persistentLocalCache`:** `enableIndexedDbPersistence` is deprecated in firebase ^12; `lib/firebase/client.ts` uses `persistentLocalCache(persistentSingleTabManager({}))` per RESEARCH note.
6. **Storage write rule relaxed (commit 96cf12a):** Any signed-in user can write `items/{itemId}/photo.jpg` within size + content-type bounds; admin gate enforced upstream in Server Actions via `requireAdmin()`. v2 follow-up: re-tighten once Storage→Firestore cross-service eval lag reproducible.
7. **Event status derived from dates (commit b23c449):** Instead of a stored `status` field with manual transitions, event status is computed from `startDate`/`endDate` vs current time (`planned` if start>now, `active` if start<=now<=end, `completed` if end<now, `cancelled` if `cancelledAt` set). Eliminates a class of stale-status bugs.
8. **Reports sub-nav added (commit 319fa9c):** Plan 02-10 added a reports sub-nav (Stock / Out / History / Missing / Repurchase) so users can switch between the 5 reports without going to the sidebar. Sidebar Reports stays highlighted across all `/reports/*` sub-pages.
9. **Server Action result type relaxation:** `ActionResult<T = Record<string, never>>` produced 5 TS2322 errors at `return { ok: true }`. Relaxed to `ActionResult<T extends object = object>` (plan 02-05).
10. **Mock layer wholesale deletion (plan 02-11, commit db2b96b):** 10 files (`lib/auth/mock-session.ts`, `lib/mock/*` × 8, `lib/hooks/use-mock-store.ts`) deleted in one commit. Project is now 100% Firebase-backed.

## Phase 2 Metrics

- **Plans executed:** 15 (02-01 spike + 02-02..02-14 implementation + 02-15 closure)
- **Waves:** 13
- **Phase 2 commits:** 102 (per `git log --grep='phase-kayinleong-02' | wc -l`)
- **Server Actions audited:** 15 (across 6 `actions.ts` files; 106/106 checklist items PASS — see `audit-server-actions.md`)
- **Firestore composite indexes:** 19 (declared in `firestore.indexes.json`; deployed clean per INT-05)
- **Manual rules audits:** 8 (1 per block A-G + final cross-collection in `rules-audit-final.md`)
- **Rules Playground matrix:** 48 rows (39 Firestore + 9 Storage)
- **Cloud Functions:** 0 (logic inlined per re-amended D-02)
- **Files deleted (Phase 1 affordances):** 10 (`lib/mock/*` + mock-session shim + use-mock-store)
- **REQ-IDs traced:** 88 Phase 2 IDs + Phase 1 carry-over = 92 total (excludes NFR-04 which is Phase-1-only)

## v2 Polish (Open Follow-Ups)

Documented in respective plan SUMMARY files; not v1 blockers:

- **PWA icon PNGs** — `public/icon-192.png` + `public/icon-512.png` real artwork. Lighthouse PWA installability warns until shipped.
- **Storage write rule re-tightening** — Once cross-service eval lag is reproducible, re-narrow the relaxed photo write rule to admin-only.
- **Scan-cart sessionStorage cross-tab edge cases** — Current implementation handles same-tab refresh + token refresh; multi-tab edit on same cart not yet tested under stress.
- **`adjustItemStock` defensive revalidation** — Audit log flagged that crossing the low-stock threshold via adjust could defensively `revalidatePath('/reports/repurchase')`. Non-blocking.
- **Frequently-flagged-missing signal** on `/reports/repurchase` — Currently v1 scope is low-stock signal only; cross-collection aggregation of missingItems deferred.
- **Node 20 runtime deprecation Q4 2026** — `functions/package.json` is unused (Cloud Functions removed) but Node 20 will eventually need bumping to Node 22 if v2 reintroduces functions.
- **`unauthorized()` Next 16 experimental** — `app/unauthorized.tsx` exists (staged) but the current DAL bounces via `redirect("/unauthorized")` from `requireAdmin()` until the experimental `authInterrupts` API stabilizes.
- **TanStack `useReactTable` React Compiler warning** — 12 pre-existing `react-hooks/incompatible-library` warnings. Library limitation; will resolve when TanStack ships v9.x memoization-safe variants.

## Self-Check

- [x] All 3 automated gates run and PASS (tsc/lint/build all exit 0)
- [x] 10-step acceptance demo mapped to per-block evidence trail (every row references the plan that delivered it + the smoke that confirmed it)
- [x] Architectural amendments documented (10 items)
- [x] Metrics captured
- [x] v2 polish list assembled

## Self-Check: PASSED

Files exist:
- `.planning/phases/phase-kayinleong-02/02-15-verification-gate-SUMMARY.md` — this file (FOUND)
- `.planning/phases/phase-kayinleong-02/CLAIM.md` — updated below (FOUND)
- `.planning/STATE.md` — updated below (FOUND)
- `.planning/REQUIREMENTS.md` — updated below (FOUND)
- `.planning/ROADMAP.md` — updated below (FOUND)

Commits referenced (sample, all verified via `git log --oneline`):
- 93bf62d (D-02 re-amendment) — FOUND
- db2b96b (mock wipe) — FOUND
- 315793a (indexes sync) — FOUND
- 96cf12a (storage rule relaxation) — FOUND
- b23c449 (event status derived from dates) — FOUND
- 319fa9c (reports sub-nav) — FOUND
