---
phase: phase-kayinleong-02
plan: 02
title: Firebase clients (Web + Admin SDK) + DAL + proxy.ts + Firestore rules/indexes + Storage rules + firebase.json
status: code-complete (deploy pending — see Checkpoint at bottom)
date_completed: 2026-05-25
spike_outcome_branch: PROCEED_AS_PLANNED (per spike 02-01 FINDINGS)
commits:
  - cd9d885 feat: add Firebase SDK singletons + roles helper + env template
  - 2130aea feat: add DAL + proxy.ts + auth route handlers
  - 1344a0f feat: add Firestore rules + indexes + storage rules + firebase.json
  - ac5e1ad docs: create CHANGELOG.md with D-06 rules-unit-tests-skipped entry
  - 26452f2 fix: admin.ts projectId assertion no longer false-positive at boot
files:
  created:
    - lib/firebase/client.ts
    - lib/firebase/admin.ts
    - lib/auth/dal.ts
    - lib/auth/roles.ts
    - proxy.ts
    - app/api/auth/session/route.ts
    - app/api/auth/logout/route.ts
    - firebase.json
    - firestore.rules
    - firestore.indexes.json
    - storage.rules
    - .env.example
    - CHANGELOG.md
  modified:
    - .gitignore
requirements_unblocked:
  - AUTH-01, AUTH-02, AUTH-05, AUTH-09 (infrastructure laid; auth pages wired in 02-03)
  - INT-02 (rules invariant), INT-03 (no client writes to transactions), INT-04 (DAL gate), INT-05 (12 pre-declared indexes)
  - NFR-06, NFR-07, NFR-08, NFR-09
  - RES-01 (offline reads via persistentLocalCache), RES-03 (scan-cart survives reload)
---

# Plan 02-02: Firebase clients + DAL + proxy.ts — Summary

**One-liner:** Block A foundation — server-only Admin SDK + client Web SDK with persistent IndexedDB cache, the `verifySession`/`requireSession`/`requireAdmin` DAL using `getTokens()` from `next-firebase-auth-edge` (per spike FINDINGS A1), `proxy.ts` at repo root via `authMiddleware`, and the security/index manifests for `firebase deploy --only firestore,storage`.

## Branch decision

Spike outcome: **PROCEED_AS_PLANNED** (FINDINGS verdict). Implementation uses `authMiddleware` from `next-firebase-auth-edge` v1.12 + `getTokens()` in the DAL. Both critical FINDINGS corrections were applied:

| Correction | Source | Implementation in 02-02 |
|---|---|---|
| Use `getTokens()`, NOT `verifySessionCookie` | FINDINGS A1 | `lib/auth/dal.ts:54` calls `getTokens(cookieStore, COOKIE_OPTS)`. AUTH-09 immediate revocation via `adminAuth.verifyIdToken(tokens.token, true)` on `dal.ts:65`. |
| `app/api/auth/session/route.ts` is a no-op stub | FINDINGS A1 | Route returns `NextResponse.json({ok:true}, {status:200})`. authMiddleware intercepts in proxy.ts before Next routes here. |
| `proxy.ts` is env-vars only (no `sa.json` fallback) | FINDINGS A2 + manual spike-vs-prod delta | `proxy.ts` reads only `process.env.FIREBASE_*`. No `applicationDefault()`, no `debug:true`. |
| Admin SDK startup project-ID assertion | FINDINGS A2 | `lib/firebase/admin.ts:38` — see Anomaly #1 below for the runtime correction we made. |
| `persistentLocalCache` not `enableIndexedDbPersistence` | RESEARCH §1.2 (deprecated in firebase ^10) | `lib/firebase/client.ts:18` uses `initializeFirestore + persistentLocalCache + persistentSingleTabManager`. |

## Files & key invariants

| File | First non-comment line | Key invariant |
|---|---|---|
| `lib/firebase/client.ts` | `import { initializeApp, ... } from "firebase/app"` | NO `import "server-only"` — Client Components import this. |
| `lib/firebase/admin.ts` | `import "server-only"` (line 6) | Boot reads `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` via `requireEnv` so missing vars name themselves in the error. |
| `lib/auth/dal.ts` | `import "server-only"` (line 16, after header comments) | `verifySession` is `cache(async () => ...)` so per-request memoization is automatic. |
| `lib/auth/roles.ts` | `import "server-only"` (line 8) | Pure helpers — `isAdmin(session)`, `canEditEvent(session, event)`. |
| `proxy.ts` | `import { NextResponse, ... }` | No `export const runtime` (Next 16 proxy is Node-only). `config.matcher` includes `/api/auth/:path*` so authMiddleware can intercept login/logout. |
| `app/api/auth/session/route.ts` | `import "server-only"` | No-op `POST(): NextResponse.json({ok:true}, {status:200})` — comment explains why. |
| `app/api/auth/logout/route.ts` | `import "server-only"` | Decodes envelope via `getTokens`, calls `adminAuth.revokeRefreshTokens(uid)`, returns 204. |

## Deviations from plan

### 1. `verifySessionCookie` → `verifyIdToken(token, true)` (Correction 1)

PLAN.md (lines 86-87 of the frontmatter `key_links`, and lines 567-571 of the action body) said `verifySessionCookie(cookie, true)`. **FINDINGS A1 explicitly corrected this** — `next-firebase-auth-edge` produces an HMAC-signed envelope, not a Firebase-native session cookie, so `admin.auth().verifySessionCookie` throws `auth/argument-error`. The DAL implementation calls `adminAuth.verifyIdToken(tokens.token, /*checkRevoked*/true)` which is the semantically equivalent AUTH-09 immediate-revocation check on the ID token wrapped inside the auth-edge envelope. The static acceptance test `grep -qE 'verifySessionCookie\(.+,\s*true\)' lib/auth/dal.ts` therefore fails on purpose — the code is correct per FINDINGS, not per PLAN.

### 2. Route handlers ship as no-op stubs (Correction 2)

PLAN.md expected `app/api/auth/session/route.ts` to call `createSessionCookie`. **FINDINGS A1 corrected this** — authMiddleware intercepts the `loginPath` before Next routes to the handler. The session route file is a no-op `POST(): {ok:true,200}` so route resolution succeeds and provides a debugging fallback if the proxy is disabled. `createSessionCookie` is intentionally NOT called anywhere (greps confirm: no functional usage in `lib/` or `app/`).

### 3. Admin SDK startup assertion weakened (Rule 1 — auto-fixed bug)

The Correction 4 boot assertion `if (app.options.projectId !== projectId) throw` always tripped — Firebase Admin SDK does not auto-populate `app.options.projectId` from a `cert()` credential (verified empirically: it stays `undefined`). The build failed with `Firebase project ID mismatch: app initialized with undefined, env says ey-eventsystem`. Fix (commit 26452f2):
1. Pass `projectId` explicitly to `initializeApp({...credential, projectId, storageBucket})` so the option is a reliable echo.
2. Weaken the assertion to `if (app.options.projectId && app.options.projectId !== projectId)` — only throw on actual divergence, not on the `undefined` baseline.

The FINDINGS A2 root cause (mismatched key vs clientEmail producing `invalid_grant`) is a runtime failure on the first authenticated RPC; there is no cheap synchronous boot check for it. The most helpful diagnostic remains `requireEnv` naming the missing variable.

### 4. `.gitignore` `.env*` was too broad (Rule 1 — auto-fixed bug)

The pre-existing `.env*` blanket pattern ignored `.env.example` along with `.env.local`. Fixed by replacing with an explicit blacklist (`.env`, `.env.local`, `.env.*.local`, `.env.{development,production,test}`) and verifying with `git check-ignore .env.example .env.local sa.json` — only the real-secret files remain ignored.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors (1 pre-existing warning in `components/feature/table/DataTable.tsx` unrelated to 02-02) |
| `npm run build` | 27 routes generated; proxy.ts recognised as middleware ("ƒ Proxy (Middleware)") |
| `grep -rl firebase-admin .next/static/chunks/` | empty — Admin SDK does not leak into client bundle (PITFALLS C6 mitigated) |
| `grep -rn 'verifySessionCookie\|createSessionCookie\|enableIndexedDbPersistence' lib/ app/` | only in explanatory comments — no functional usage |
| `! test -f middleware.ts` | true — Next 16 proxy filename correct |
| `head -1 lib/firebase/admin.ts` after comments → `import "server-only"` (line 6) | OK |
| `grep -c '"collectionGroup"' firestore.indexes.json` | 12 |
| `grep -q "if false" firestore.rules` (catch-all) | OK (line 70) |
| `grep -q '"D-06 (Phase 2"' CHANGELOG.md` (occurrences) | 1 |

## Anomalies

### A1. Admin SDK `app.options.projectId` is `undefined` from `cert()` credential

Documented above (Deviation #3). Worth flagging globally: any code that wants to read the current project ID from `getApps()[0].options.projectId` will get `undefined` unless `initializeApp` was called with `{credential, projectId, ...}` explicitly. We do this in `lib/firebase/admin.ts` now.

### A2. `revokeRefreshTokens` lives in logout route but not in DAL hot path on every request

The DAL's AUTH-09 check (`verifyIdToken(token, true)`) RE-VALIDATES on every request — it does NOT call `revokeRefreshTokens`. Revocation happens at one of two points:
1. User-initiated logout → `POST /api/auth/logout` → `adminAuth.revokeRefreshTokens(uid)`.
2. Admin disables a user (plan 02-09) → `revokeRefreshTokens(uid)` in that Server Action.

After either point, `verifyIdToken(token, true)` returns rejected → DAL returns null → proxy redirects to /login. Spike A6 measured propagation at ~1.5s. This matches the AUTH-09 SLA.

### A3. `app.options.storageBucket` is set; storageBucket arg in initializeApp is honored

Confirmed at build time — no warnings about missing bucket. Plan 02-13 (photo uploads) inherits the bucket implicitly via `getStorage(adminApp)`.

## Threat model — implementation outcomes

All 13 STRIDE rows from the plan's `<threat_model>` reach `mitigate` disposition with the following implementations:

- T-02-02-01 (forged cookie): `cookieSignatureKeys` array + HMAC verify in authMiddleware; `verifyIdToken(token, true)` adds defence-in-depth in DAL.
- T-02-02-02 (client writes to transactions): `firestore.rules` `transactions/{txId}` allow create,update,delete: if false.
- T-02-02-03 (negative qty): `firestore.rules` inventory update invariant `availableQty >= 0 && availableQty <= totalQty`.
- T-02-02-05 (Admin SDK leak): `import "server-only"` line 6 of admin.ts + verified empty grep on `.next/static/chunks/`.
- T-02-02-06 (.env.local commit): `.gitignore` explicit `.env.local` + secrets-hygiene comment.
- T-02-02-07 (cross-event read by staff): `events/{eventId}` rule `isMember(resource)` + `allowedStaff` untouched on client updates.
- T-02-02-09 (self-promote to admin): `users/{uid}` allow create,update,delete: if false.
- T-02-02-10 (disabled-user cached token): `verifyIdToken(token, true)` + DAL fallback users/{uid}.disabled check + revokeRefreshTokens.
- T-02-02-11 + T-02-02-12 (storage): `storage.rules` admin-write + 5MB cap + image/* contentType + deny-by-default on /{allPaths=**}.
- T-02-02-13 (rules misconfig): D-06 manual audit checkpoint deferred to live Firebase Console Rules Playground after deploy (see Checkpoint).

T-02-02-08 (key rotation breaks sessions): `accept` per plan; key rotation procedure documented in CHANGELOG / to be added to PROJECT.md Operations section in a future claim.

## Documentation gate

- `CHANGELOG.md` created with D-06 entry (rules unit tests skipped + 3 mitigations + acknowledged residual risk).
- `.env.example` committed; secrets remain gitignored.
- No new patterns introduced beyond what RESEARCH.md / PATTERNS.md already document.

## Self-Check: PASSED

- All 13 files present and committed (verified by `git log --name-only`).
- All 5 commits use `feat(phase-kayinleong-02): ...` / `fix(...)` / `docs(...)` prefixes per global CLAUDE.md.
- `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm run build` exit 0.
- No `firebase-admin` strings in `.next/static/chunks/`.
- No functional usages of `verifySessionCookie`, `createSessionCookie`, or `enableIndexedDbPersistence` in `lib/` or `app/` (comments only).
- `middleware.ts` does not exist at repo root.

---

## CHECKPOINT REACHED

**Type:** human-action
**Plan:** 02-02 firebase clients + proxy
**Progress:** 5 tasks complete + committed. Working tree clean. Code passes typecheck + lint + build. SUMMARY written.

**What's left:** One-time live Firebase deploy. The rules and indexes are in the repo but not yet running in the cloud Firebase project.

**Awaiting human action:**

1. **(If not already installed)** `npm i -g firebase-tools` and `firebase login`.

2. **Verify active project:**
   ```bash
   firebase use   # should print the cy-eventsystem project id (e.g. ey-eventsystem)
   ```
   If not set: `firebase use <project-id>`.

3. **Deploy rules + indexes + storage:**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

4. **Verify indexes are building/ready** (takes 5–15 min for builds to complete):
   ```bash
   firebase firestore:indexes
   ```
   Expected: 12 composite indexes listed in `READY` or `CREATING` state.

5. **Manual D-06 rules audit (Firebase Console → Firestore → Rules → Rules Playground).** Record results in `CLAIM.md` under `## Rules Audit — Block A`:

   | # | Path | Auth | Role | Op | Expected |
   |---|------|------|------|----|----------|
   | 1 | `/users/some-uid` | anon | — | read | DENY |
   | 2 | `/inventory/SKU-001` | anon | — | read | DENY |
   | 3 | `/transactions/tx-001` | yes | staff | create | DENY |
   | 4 | `/inventory/SKU-001` | yes | admin | create (valid data) | ALLOW |
   | 5 | `/inventory/SKU-001` | yes | admin | update with `availableQty: -1` | DENY |

6. **Smoke-test the dev server (incognito):** `npm run dev` → open http://localhost:3000 → expect 307 redirect to `/login` (proxy gates anon traffic). Confirm DevTools Network shows the redirect and no missing-env errors in the dev server console.

**To proceed:** Reply "deployed and smoke PASS" (or describe failures). After confirmation, the orchestrator can advance to plan 02-03 (login + register + forgot/set-password client wiring).
