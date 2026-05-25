# Claim: phase-kayinleong-02

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-05-25
- status: in-progress
- summary: Functionality — wire Firebase Auth + Firestore + 2 Cloud Functions + Storage; replace every mock with real backend; UI surface frozen from Phase 1
- current plan: 02-01 (spike on next-firebase-auth-edge v1.12 — D-01 gate)

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

## Verification

(Populated when phase completes — must include Regression Report per global CLAUDE.md.)
