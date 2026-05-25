# Changelog

All notable changes to cy-eventsystem are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to semver where applicable.

## [Unreleased] — phase-kayinleong-02 Functionality

### Changed

- Phase 2 wires Firebase Auth + Firestore + Storage in place of Phase 1 mocks.
  UI surface frozen from Phase 1 (per `02-CONTEXT.md`); only the data source
  swaps. Specific surface amendments (when they happen) get their own entries.

### Decisions

- **D-06 (Phase 2, `phase-kayinleong-02`): `firestore.rules` unit tests SKIPPED
  in v1.** Reverses ROADMAP Phase 2 success criterion #6 ("rules unit tests pass
  for every collection"). Rationale: D-04 bans the Firebase Emulator Suite, and
  `@firebase/rules-unit-testing` spins one up internally, conflicting with the
  no-emulator stance. Mitigations applied in place of unit tests:
  - (a) **Deny-by-default skeleton** at the top of `firestore.rules` (`match
    /{document=**} { allow read, write: if false; }`) — any rule that doesn't
    explicitly grant access denies by construction.
  - (b) **Mandatory manual rules audit checkpoint** at the end of each block
    that introduces or touches rules (plans 02-02, 02-04, 02-05, 02-07, 02-08,
    02-09, 02-10) — each block's `CLAIM.md` Verification section must enumerate
    the paths tested and the Firebase Console Rules Playground outcomes.
  - (c) **Firebase Console Rules Playground** is the substitute for unit tests
    for any non-trivial rule before deploy.
  - `PITFALLS.md` C3 (rules-misconfig data leak) is acknowledged PARTIALLY
    UNMITIGATED. Severity is bounded by the deny-by-default catch-all + manual
    audit + single-developer single-production-project topology (D-03).
  - v2 candidate: revisit `@firebase/rules-unit-testing` if the manual audit
    reveals gaps that the per-block playground checks could not catch.

### Added

- `lib/firebase/client.ts` — Web SDK singleton with persistent IndexedDB cache
  (D-19; `initializeFirestore` + `persistentLocalCache` + `persistentSingleTabManager`).
- `lib/firebase/admin.ts` — server-only Admin SDK singleton with startup
  `projectId` assertion (FINDINGS A2 — catches credential mismatch early).
- `lib/auth/dal.ts` — `verifySession` / `requireSession` / `requireAdmin` Data
  Access Layer wrapping `getTokens()` from `next-firebase-auth-edge`. AUTH-09
  immediate revocation check via `adminAuth.verifyIdToken(token, /*checkRevoked*/true)`.
- `lib/auth/roles.ts` — pure helpers `isAdmin` + `canEditEvent`.
- `proxy.ts` at repo root (Next 16 renamed from `middleware.ts`) — wraps
  `authMiddleware`; 5-day cookie TTL per AUTH-02.
- `app/api/auth/session/route.ts` + `app/api/auth/logout/route.ts` — POST
  endpoints intercepted by `authMiddleware`. Logout additionally calls
  `revokeRefreshTokens(uid)` for AUTH-09 immediate effect.
- `firestore.rules` + `firestore.indexes.json` (12 pre-declared composite
  indexes per D-18) + `storage.rules` + `firebase.json`.
- `.env.example` — environment template (`.env.local` remains gitignored).

### Fixed

- `.gitignore` no longer matches `.env.example` (was blanket `.env*`). Real
  secrets (`.env.local`, `.env.*.local`, `sa.json`, `firebase-adminsdk-*.json`)
  continue to be ignored.

### Removed
