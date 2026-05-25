# Plan 02-01: next-firebase-auth-edge v1.12 spike — Summary

**Status:** complete
**Wave:** 1
**Decision:** PROCEED_AS_PLANNED
**Date:** 2026-05-25

## What was built

A 1-day throwaway spike validating that `next-firebase-auth-edge@1.12.0` works with Next.js 16.2.6 + Firebase Auth + Firestore + Firebase Admin SDK 13. Six acceptance criteria executed programmatically via `run-spike.ts` against the project's live Firebase project; all PASS.

## Key files

### Created
- `.planning/spikes/next-firebase-auth-edge-v1.12/README.md` — spike charter + run guide
- `.planning/spikes/next-firebase-auth-edge-v1.12/.env.example` — env-var reference for plan 02-02
- `.planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts` — basis for production `proxy.ts` in 02-02
- `.planning/spikes/next-firebase-auth-edge-v1.12/login-server-action.spike.ts` — client login reference
- `.planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts` — original Check 4 attempt (uses WRONG API per FINDINGS A1 — do NOT model 02-02 DAL on this file)
- `.planning/spikes/next-firebase-auth-edge-v1.12/run-spike.ts` — programmatic test runner (reusable in plan 02-15)
- `.planning/spikes/next-firebase-auth-edge-v1.12/spike-results.json` — 6/6 PASS, machine-readable
- `.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md` — full findings doc with 5 anomalies + 6 recommended deltas

### Modified
- `.gitignore` — added `sa.json` + `firebase-adminsdk-*.json` + `*-credentials.json` + `*-service-account.json`
- `package.json` + `package-lock.json` — added `firebase@^12.13`, `firebase-admin@^13.10`, `next-firebase-auth-edge@^1.12.0`, `tsx@^4.22.3` (dev)
- `.planning/phases/phase-kayinleong-02/CLAIM.md` — recorded plan 02-01 outcome under "What has changed"

### Created during spike but DELETED before commit (intentional teardown)
- `proxy.ts` at repo root — temporary spike copy; production version ships in plan 02-02
- `app/api/auth/session/route.ts` + `app/api/auth/logout/route.ts` — temporary spike stubs; production versions ship in plan 02-02

Verified clean via `git status --short` returning empty.

## Requirements addressed

AUTH-01, AUTH-02, AUTH-05, AUTH-09, NFR-07, NFR-08 — all validated at spike level. Full implementation lands in plans 02-02 (Firebase clients + proxy.ts + route handlers), 02-03 (auth pages wired), and 02-05 (`lib/auth/dal.ts` swap).

## Commits

| Commit | Subject |
|--------|---------|
| `745f2e1` | chore(phase-kayinleong-02): start plan 02-01 spike + gitignore service-account JSON |
| `8031b55` | feat(phase-kayinleong-02): install firebase + next-firebase-auth-edge + tsx for plan 02-01 spike |
| `1b4cf08` | feat(phase-kayinleong-02): scaffold next-firebase-auth-edge v1.12 spike workspace |
| `f39a172` | feat(phase-kayinleong-02): complete plan 02-01 spike — all 6 checks PASS, PROCEED |

## Key Anomalies Discovered (impact on subsequent plans)

| Anomaly | Impact on Phase 2 |
|---------|-------------------|
| **A1**: `verifySessionCookie` does NOT work on auth-edge cookies — must use `getTokens()`/`getTokensFromObject()` from the library | Plan 02-05's `lib/auth/dal.ts` MUST use the library's API; the PLAN.md text proposing `admin.auth().verifySessionCookie` is INCORRECT and must be corrected during plan 02-05 execution. |
| **A2**: `.env.local` `FIREBASE_*` trio mismatched `sa.json` — spike used `sa.json` via `applicationDefault()`, env-var path failed | Developer MUST reconcile `.env.local` with `sa.json` values BEFORE plan 02-02 runs. Production uses env-var path only (`sa.json` is a dev-loop convenience). |
| **A3**: Phase 1 `(app)/layout.tsx` reads `mock_session` not `__session` | Expected — resolved by plan 02-05 DAL swap. No action needed during spike. |
| **A4**: Cookie size ~1815 chars (vs ~1024 for Firebase native sessions) | Note for per-request size budgeting. Under 4KB limit, but noteworthy. |
| **A5**: Library runs cleanly on Node runtime in Next 16 | No action needed — confirms plan assumptions. |

## Self-Check

- [x] All 6 acceptance criteria executed (results in `spike-results.json`)
- [x] Decision recorded: **PROCEED_AS_PLANNED**
- [x] FINDINGS.md written with full anomaly catalog + recommended deltas
- [x] No temporary files leaked outside `.planning/spikes/` (verified via `git status --short` empty)
- [x] No secrets in committed files (verified — only env-var names + redacted lengths logged)
- [x] CLAIM.md updated with plan 02-01 outcome
- [x] No `proxy.ts` at repo root
- [x] No `app/api/auth/` directory

## Self-Check: PASSED

## Hand-off to plan 02-02

Plan 02-02 implements the production scaffold. Order of operations:

1. **Developer reconciles `.env.local`** with `sa.json` values (FINDINGS A2). Without this, plan 02-02's Admin SDK init will fail at startup.
2. **`lib/firebase/admin.ts`** — env-var-only init. Use the working code shape from `proxy.spike.ts` lines 18-42 (the `cert()` block) MINUS the `applicationDefault()` fallback. Add startup assertion that `getAuth().app.options.projectId === process.env.FIREBASE_PROJECT_ID`.
3. **`lib/firebase/client.ts`** — Web SDK init with `initializeFirestore(app, { localCache: persistentLocalCache(...) })` per RESEARCH note that `enableIndexedDbPersistence` is deprecated in Firebase 12.x.
4. **`proxy.ts`** at repo root — direct port of `proxy.spike.ts` MINUS the `sa.json` fallback. No `debug: true`. Node runtime confirmed working.
5. **`app/api/auth/session/route.ts`** + **`app/api/auth/logout/route.ts`** — no-op stubs (proxy intercepts). Comment explaining why. Reconfirm Next 16 doesn't require these files to exist for proxy to intercept.
6. **`firestore.rules`** + **`firestore.indexes.json`** + **`storage.rules`** + **`firebase.json`** + `.env.example` — per plan 02-02 task list.

Plan 02-05 (`lib/auth/dal.ts`) will be the place to apply FINDINGS A1's API correction. The DAL must use `getTokens(await cookies(), options)` from the library, not `admin.auth().verifySessionCookie`. For AUTH-09 immediate revocation in mutation hot paths, also call `adminAuth.verifyIdToken(token, /*checkRevoked*/true)`.
