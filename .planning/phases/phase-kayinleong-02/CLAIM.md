# Claim: phase-kayinleong-02

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-05-25
- status: in-progress
- summary: Functionality — wire Firebase Auth + Firestore + 2 Cloud Functions + Storage; replace every mock with real backend; UI surface frozen from Phase 1
- current plan: 02-03 (auth pages wired — Wave 3, Block A foundation)

## What will change

- Phase 2 implementation context captured in `.planning/phases/phase-kayinleong-02/02-CONTEXT.md`
- Discussion audit trail in `.planning/phases/phase-kayinleong-02/02-DISCUSSION-LOG.md`
- Subsequent claims under this phase will:
  - Stand up Firebase project + Admin SDK + Web SDK clients
  - Wire `next-firebase-auth-edge` v1.12+ session cookies (after a 1-day spike)
  - Ship `firestore.rules` + `firestore.indexes.json` (rules unit tests SKIPPED in v1 — amends ROADMAP success criterion #6)
  - Replace every `lib/mock/*` call site with Server Actions + Firestore transactions
  - Add 2 Cloud Functions: `onWrite(users) → setCustomUserClaims`, `onWrite(events|users) → maintain event.allowedStaff`
  - Add inventory photo field to `/inventory/new` + `/inventory/[id]/edit` (UI surface amendment)
  - Migrate all list pages from `?page=N` to `?cursor=xxx` Firestore cursor pagination (UI URL contract amendment)
  - Enable Firestore IndexedDB persistence + RES-02 offline banner + scanner-page disable when offline
  - Ship `/api/auth/session` + `/api/auth/logout` route handlers
  - Wire `proxy.ts` (NOT `middleware.ts`) for optimistic cookie check
  - Delete Phase 1 POC affordances: `PhaseOnePocRoleSwitcher`, `SeedUsersDisclosure`, and `lib/mock/*` wholesale

## What has changed

### Plan 02-01 (spike on next-firebase-auth-edge v1.12) — complete (2026-05-25)

- Spike workspace scaffolded at `.planning/spikes/next-firebase-auth-edge-v1.12/`
- Programmatic spike runner (`run-spike.ts`) implementing all 6 acceptance checks
- All 6 acceptance criteria PASS — verdict: **PROCEED_AS_PLANNED**
- Verdict + anomalies documented (see commit message + spike-results.json + handoff notes)
- Key correction discovered: `admin.auth().verifySessionCookie()` does NOT work on auth-edge
  cookies (HMAC envelope format, not Firebase native). Plan 02-02 DAL must use
  `getTokensFromObject()` / `getTokens()` from the library instead.
- Anomaly: `.env.local` FIREBASE_* trio mismatched `sa.json`. Spike used sa.json via
  `applicationDefault()`. Developer must reconcile before 02-02.
- Throwaway repo-root files cleaned up (proxy.ts + app/api/auth/* stubs deleted before
  commit).
- Dependencies committed: `firebase@^12.13`, `firebase-admin@^13.10`, `next-firebase-auth-edge@^1.12.0`, `tsx@^4.22.3` (dev).
- `.gitignore` updated to exclude service-account JSON variants.

### Plan 02-02 (Firebase clients + DAL + proxy + rules/indexes) — code complete; deploy + rules audit pending (2026-05-25)

- `lib/firebase/admin.ts` — Admin SDK singleton, `import "server-only"`, env-var-only init + startup project-ID assertion (FINDINGS A2 fix).
- `lib/firebase/client.ts` — Web SDK singleton with `persistentLocalCache(persistentSingleTabManager({}))` per RESEARCH note (`enableIndexedDbPersistence` deprecated in firebase ^12).
- `lib/auth/dal.ts` — `verifySession` / `requireSession` / `requireAdmin` exports memoized via `React.cache`. Uses `getTokens()` from `next-firebase-auth-edge` + `adminAuth.verifyIdToken(token, true)` for AUTH-09 immediate revocation (FINDINGS A1 fix — PLAN.md text proposing `verifySessionCookie` was incorrect).
- `lib/auth/roles.ts` — `Role` type + role helpers.
- `proxy.ts` at repo root — port of `proxy.spike.ts` MINUS `sa.json` fallback (env-vars only, no `debug:true`).
- `app/api/auth/session/route.ts` + `app/api/auth/logout/route.ts` — no-op stubs (proxy's authMiddleware intercepts; route files exist to satisfy Next routing).
- `firestore.rules` — deny-by-default skeleton + per-collection allow rules from RESEARCH §"firestore.rules skeleton" per D-06 mitigation.
- `firestore.indexes.json` — 12 pre-declared composite indexes per D-18 (includes `isLowStock` per RESEARCH P11).
- `storage.rules` — admin-write + signed-in-read on `items/{itemId}/photo.jpg` per D-13.
- `firebase.json` — Firebase CLI deploy config (rules + indexes + storage; no functions yet — plan 02-04).
- `.env.example` at repo root — template for `.env.local`. `.gitignore` updated to explicit env blacklist so `.env.example` commits cleanly (Deviation #4 in SUMMARY.md).
- `CHANGELOG.md` — D-06 entry (rules unit tests skipped in v1, mitigation = manual audit per block + Console Rules Playground).
- Verification gates green: `tsc --noEmit` PASS, `npm run lint` PASS (1 pre-existing Phase 1 warning untouched), `npm run build` PASS (27 routes generated, proxy.ts recognized).
- Admin SDK does NOT leak into client bundle (verified via grep `firebase-admin` in `.next/static/chunks/` returns empty — PITFALLS C6 mitigated).
- Commits: `cd9d885` (clients), `2130aea` (DAL + proxy + routes), `1344a0f` (rules + indexes + storage + firebase.json), `ac5e1ad` (CHANGELOG), `26452f2` (admin.ts assertion fix), `e3a89a0` (SUMMARY).
- **Plan 02-02 complete (2026-05-25)** — user confirmed `firebase deploy --only firestore:rules,firestore:indexes,storage` succeeded + `npm run dev` smoke test PASSED (incognito → /login 307 redirect via proxy.ts). 5-row Rules Playground audit attested by user as PASS. See "## Rules Audit — Block A" below.

## Rules Audit — Block A (plan 02-02 deploy gate, 2026-05-25)

User-attested manual Firebase Console Rules Playground audit per D-06 mitigation (rules unit tests skipped in v1, replaced with manual audit per block):

| # | Path | Auth | Op | Expected | Result |
|---|------|------|-----|----------|--------|
| 1 | `users/SOME_UID` | Unauthenticated | get | DENY | PASS (attested) |
| 2 | `inventory/SKU-001` | Authenticated staff | get | ALLOW | PASS (attested) |
| 3 | `inventory/SKU-001` | Authenticated staff | update | DENY (admin-only writes) | PASS (attested) |
| 4 | `events/EVT-001` | Authenticated NOT in allowedStaff | get | DENY (array-contains-any gate) | PASS (attested) |
| 5 | `transactions/TX-001` | Authenticated admin | create from client | DENY (server-only writes) | PASS (attested) |

**Smoke test:** `npm run dev` → incognito http://localhost:3000 → 307 redirect to `/login` (proxy.ts cookie gate working). User-attested PASS.

**Deploy command run:** `firebase deploy --only firestore:rules,firestore:indexes,storage` — succeeded, indexes READY/CREATING.

**Note on audit attestation:** The 5 rows above are user-attested (the user manually ran the Playground tests during the smoke gate). Future plans (02-04..02-10) each have their own rules-touching audit checkpoint per D-06; results from those will append to this section as separate "Rules Audit — Block B/C/D/E/F/G" subsections.

## Verification

(Populated when phase completes — must include Regression Report per global CLAUDE.md.)
