# Claim: phase-kayinleong-02

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-05-25
- status: in-progress
- summary: Functionality — wire Firebase Auth + Firestore + 2 Cloud Functions + Storage; replace every mock with real backend; UI surface frozen from Phase 1
- current plan: 02-04 (users + 2 Cloud Functions + invite — Wave 4, Block B)

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

### Plan 02-03 (auth pages wired — Wave 3, Block A) — code complete; E2E seed + sign-in gate pending (2026-05-25)

- `/login`: signInWithEmailAndPassword → POST /api/auth/session → hard-nav `/`. Generic error copy on failure (T-02-03-05 anti-enumeration). Commit 03c6a1d.
- `/forgot-password`: sendPasswordResetEmail; always shows generic success branch (T-02-03-01 anti-enumeration). Commit 05899e4.
- `/set-password`: verifyPasswordResetCode + confirmPasswordReset + D-08 auto-sign-in + POST /api/auth/session. Commit 05899e4.
- `/register`: already returns notFound() per AUTH-06 — no change.
- `(app)/layout.tsx` + `(app)/page.tsx` + `(app)/settings/page.tsx`: requireSession/getMockSession import path swap from `@/lib/auth/mock-session` → `@/lib/auth/dal` (aliased to keep call sites untouched). Commit f9d4f40.
- `lib/hooks/use-current-user.ts`: REPLACED body with onAuthStateChanged + getIdTokenResult; KEPT useCurrentUser(): Session | null signature. Role from custom claims (Cloud Function 1 in plan 02-04 mirrors users/{uid}.role → token); defaults to "staff" until claims arrive. Commit f9d4f40.
- `components/feature/auth/SignOutButton.tsx`: fetch /api/auth/logout + signOut(auth) + hard-nav /login (useTransition pending + best-effort try/catch). Commit e6d0021.
- `components/feature/shell/UserMenu.tsx`: removed PhaseOnePocRoleSwitcher import + JSX. Commit e6d0021.
- DELETED `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` + `app/(auth)/login/_components/seed-users-disclosure.tsx`. Commit 390a218.
- `scripts/seed-first-admin.ts` NEW (D-05): CLI script createsUser → setCustomUserClaims({role:'admin'}) → writes users/{uid} doc → prints Firebase password-reset link. T-02-03-06 (never logs password) + T-02-03-07 (refuses if users collection non-empty). Commit 390a218.
- `package.json`: added `seed:first-admin` npm script. `.env.example`: added run-instruction comment. Commit 390a218.
- `lib/auth/mock-session.ts` + `lib/mock/cookie.ts`: converted to shims per PATTERNS.md §3 "Option A" (12 (app) consumers route through to real DAL; both deleted in plan 02-11). Commit 390a218.
- Auto-fixes (Rule 1/3): set-password-form `react-hooks/set-state-in-effect` compliance (derive init state from URL param + only setState after async); set-password page wrapped in <Suspense> for Next 16 prerender.
- Verification gates: tsc --noEmit PASS, npm run lint PASS (1 pre-existing Phase 1 warning untouched), npm run build PASS (24 routes, proxy.ts recognized, /set-password builds static).
- See `.planning/phases/phase-kayinleong-02/02-03-auth-pages-wired-SUMMARY.md` for full details + deviation register + manual verification checkpoint instructions.
- **Plan 02-03 gate:** awaiting `npm run seed:first-admin` execution + manual E2E sign-in pass per SUMMARY.md "CHECKPOINT REACHED" section.

## Verification

(Populated when phase completes — must include Regression Report per global CLAUDE.md.)
