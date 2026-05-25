---
phase: phase-kayinleong-02
plan: 04
subsystem: users + roles (Block B)
tags: [cloud-functions, server-actions, firebase-admin, auth, invite-flow, allowedStaff-sync]
requires:
  - 02-02 (admin.ts, dal.ts, firestore.rules, firebase.json, indexes)
  - 02-03 (real auth wired, seed-first-admin shipped)
provides:
  - 2 Cloud Functions deployed via `firebase deploy --only functions` (3 trigger registrations)
  - 3 Server Actions for /users surface (invite/setRole/disable) gated by requireAdmin()
  - Admin SDK cursor-paged read helper (lib/data/users.server.ts) + Web SDK live hook (lib/hooks/use-users-live.ts)
  - Copy-link UI on /users/invite (Sheet + standalone form) per D-09
affects:
  - app/(app)/users/* (page + invite/page + invite/_components/form)
  - components/feature/users/* (UsersTable, InviteUserSheet, UserRoleSelectInline, DisableUserButton)
  - firebase.json (functions block predeploy + ignore)
  - eslint.config.mjs (functions/lib/** + functions/node_modules/** globalIgnores)
tech-stack:
  added:
    - firebase-functions ^6.0.0 (functions/ package — separate npm scope)
    - firebase-admin ^13.0.0 (functions/ package — peer of root admin)
    - typescript ^5.6.0 (functions/ devDep)
  patterns:
    - Cloud Functions v2 onDocumentWritten (region asia-southeast1)
    - Server Action result contract — discriminated union {ok: true, ...} | {ok: false, error}
    - Server Component SSR seed → Client onSnapshot takeover (D-17 / D-20)
key-files:
  created:
    - functions/package.json
    - functions/tsconfig.json
    - functions/.gitignore
    - functions/src/index.ts
    - functions/src/setCustomUserClaims.ts
    - functions/src/syncAllowedStaff.ts
    - app/(app)/users/actions.ts
    - lib/data/users.server.ts
    - lib/hooks/use-users-live.ts
  modified:
    - firebase.json (predeploy + ignore)
    - .gitignore (functions/lib + functions/node_modules)
    - eslint.config.mjs (globalIgnores)
    - app/(app)/users/page.tsx
    - app/(app)/users/invite/page.tsx
    - app/(app)/users/invite/_components/invite-user-page-form.tsx
    - components/feature/users/UsersTable.tsx
    - components/feature/users/InviteUserSheet.tsx
    - components/feature/users/UserRoleSelectInline.tsx
    - components/feature/users/DisableUserButton.tsx
decisions:
  - D-02 refined honored: 2 logical Cloud Functions (Function 1 = onUserWriteSetClaims; Function 2 = allowedStaff sync) implemented as 3 trigger registrations across 2 source files
  - D-04 honored at codebase level: functions/package.json has no `serve` script and no `emulators` reference (verified via grep)
  - D-07 honored: email delivery = Firebase built-in via generatePasswordResetLink
  - D-09 honored: inviteUser returns resetLink on success; UI shows Copy-link button on both Sheet and standalone /users/invite form
  - D-17 honored: /users uses cursor pagination (base64-encoded {displayName, uid})
  - D-20 honored: useUsersLive scopes onSnapshot to 50-row window
  - InviteUserSchema imported from @/lib/schemas/user (not @/lib/schemas/auth as plan text suggested — Phase 1 schema was already in user.ts)
  - Firestore Timestamp → ISO string conversion at the data-layer boundary so UserDoc shape (createdAt: string) stays compatible with Phase 1 consumers
metrics:
  duration: ~20 minutes (sequential, single agent)
  tasks: 7 (6 auto + 1 checkpoint pending human deploy)
  completed_date: 2026-05-25
---

# Phase 02 Plan 04: Users + Cloud Functions + Actions — Summary

Wire Block B end-to-end. Ship the 2 logical Cloud Functions (3 trigger registrations) per refined D-02, the 3 Server Actions for `/users`, and swap the Phase 1 mock-store consumers to the real backend. The deploy step is human-gated (Task 7 checkpoint).

## What shipped

### Cloud Functions (functions/)

Standalone npm package at `functions/` with `engines.node: 20`. **No** `"serve"` script, **no** `emulators` reference per D-04 (verified by `grep`). `firebase.json` predeploys via `npm --prefix "$RESOURCE_DIR" run build`.

| Logical function | Source file | Trigger registrations | Region |
|---|---|---|---|
| Function 1 — claims mirror | `functions/src/setCustomUserClaims.ts` | `onUserWriteSetClaims` (users/{uid}) | asia-southeast1 |
| Function 2 — allowedStaff sync | `functions/src/syncAllowedStaff.ts` | `onEventTeamChange` (events/{id}) + `onUserRoleChange` (users/{uid}) | asia-southeast1 |

**Function 1 mechanics:** on `users/{uid}` write, mirror `role` to Auth custom claims. P6 rate-limit guard skips no-op writes (existing claim === new role). After any role change, `revokeRefreshTokens(uid)` propagates AUTH-08 immediately (DAL re-verifies with `checkRevoked: true`). When the user doc is deleted, claims are stripped.

**Function 2 mechanics:** both triggers funnel through `recomputeForEvent(eventId)` which unions `admins (users where role==admin) ∪ teamLeads ∪ backupTeams` and dedupes via `Set`. Self-write loop guard `onlyAllowedStaffChanged` (RESEARCH P5/A6) skips when our own `allowedStaff` write fires the trigger again. `onUserRoleChange` recomputes ALL events only when admin status flips (the union shape changes for every event); ~$0.0006 per promotion at D-16 scale.

### Server Actions (app/(app)/users/actions.ts)

3 actions, all gated by `requireAdmin()` from the real DAL:

- **`inviteUser(formData)`** — Zod-parsed via `InviteUserSchema` (from `@/lib/schemas/user` — Phase 1 location, not `@/lib/schemas/auth` as the plan text suggested). Calls `adminAuth.createUser` → writes `users/{uid}` (Function 1 picks it up) → `generatePasswordResetLink` with action URL = `/set-password`. Returns `{ok: true, uid, resetLink}` on success per D-07/D-09. On `auth/email-already-exists` returns a friendly message.
- **`setUserRole(uid, role)`** — last-admin demote guard (refuses if `uid === session.uid && role === 'staff' && admin count ≤ 1`). Updates `users/{uid}.role`; Cloud Function 1 mirrors to claims + revokes refresh tokens; Cloud Function 2 (`onUserRoleChange`) recomputes `allowedStaff` across all events if admin flipped.
- **`disableUser(uid, disabled)`** — cannot-disable-self guard. Updates `adminAuth.updateUser({disabled})` + Firestore `disabled` + `revokeRefreshTokens(uid)` when disabling (belt-and-braces with Function 1).

All 3 actions call `revalidatePath('/users')` on success.

### Data layer (lib/data/users.server.ts)

`getUsersPage({cursor, limit, filters})` — cursor-paged read per D-17. Cursor = base64 `{displayName, uid}`. `orderBy displayName + __name__` for deterministic next-page sequencing. `limit+1` fetch detects `hasMore`. `getUserServer(uid)` — single-doc helper. Firestore `Timestamp` → ISO string conversion to honor Phase 1 `UserDoc` shape.

### Live hook (lib/hooks/use-users-live.ts)

`useUsersLive(initial, {role?, limit?})` — `onSnapshot` scoped to the 50-row window per D-20. Initial state seeded from the Server Component's `getUsersPage` call; Web SDK takes over for live updates.

### UI swap

- `app/(app)/users/page.tsx` — Server Component does `requireAdmin()` + `getUsersPage()`; passes `{initialUsers, nextCursor, currentUserUid}` to `<UsersTable>`.
- `app/(app)/users/invite/page.tsx` — only the DAL import path changed.
- `app/(app)/users/invite/_components/invite-user-page-form.tsx` — RHF preserved; on submit builds FormData and calls `inviteUser`; on success renders the D-09 Copy-link panel.
- `components/feature/users/UsersTable.tsx` — `useMockStore` → `useUsersLive`; added cursor prev/next chrome.
- `components/feature/users/InviteUserSheet.tsx` — Sheet preserved; success branch swaps content for D-09 Copy-link panel.
- `components/feature/users/UserRoleSelectInline.tsx` — `setUserRole` Server Action.
- `components/feature/users/DisableUserButton.tsx` — `disableUser` Server Action.

## Deviations from Plan

Three deviations applied automatically; none required architectural decisions.

**1. [Rule 3 — Blocking import path]** Plan text at Task 4 Step 4.0 said `InviteUserSchema` lives in `lib/schemas/auth.ts`. Actually, Phase 1 shipped it in `lib/schemas/user.ts`. The Server Action imports from the existing location to avoid duplicating the schema. Both files already validate via `z.email()` / `UserRoleEnum`.

**2. [Rule 1 — Type compatibility]** Plan text at Task 5 step 5.1 had `createdAt: data.createdAt?.toMillis?.() ?? null` which returns `number | null`. Phase 1's `UserDoc.createdAt: string` (ISO). Following the plan literally would break `new Date(row.original.createdAt).toLocaleDateString()` in UsersTable. Fix: convert Firestore Timestamp → ISO string via a small `tsToIso` helper in both `lib/data/users.server.ts` and `lib/hooks/use-users-live.ts`. Preserves the Phase 1 UserDoc contract.

**3. [Rule 3 — Blocking lint gate]** After Task 2, root `npm run lint` failed with 8 errors against `functions/lib/*.js` (CommonJS `require()` style flagged by `@typescript-eslint/no-require-imports`). The CommonJS output is correct for the Cloud Functions runtime; the issue is that the root project's ESLint config scans the compiled artifact. Fix: added `functions/lib/**` and `functions/node_modules/**` to `globalIgnores` in `eslint.config.mjs`. The source files in `functions/src/` are not linted at the root level either; if functions/ needs its own lint pass it can add its own ESLint config.

## Authentication gates

None — admin user already exists (seeded in plan 02-03). All Server Actions gate on the existing `requireAdmin()` from the DAL.

## Commits

| Hash | Task | Description |
|---|---|---|
| `bca3052` | 1 | scaffold functions/ package for Cloud Functions |
| `e8bca18` | 2 + 3 | add 2 Cloud Functions per D-02 refined (3 trigger registrations) |
| `d1b687f` | 4 | add users Server Actions (invite/setRole/disable) |
| `6f93334` | 5 | add users Admin SDK helper + onSnapshot hook |
| `27df45b` | 6 | wire /users UI to Server Actions + live hook + Copy-link per D-09 |

## Verification gates (all green)

- `npx tsc --noEmit` — exit 0
- `npm run lint` — exit 0 (1 pre-existing Phase 1 DataTable warning untouched per plans 02-02/02-03)
- `npm run build` — exit 0, 28 routes generated, proxy.ts recognized, `/users` + `/users/invite` ƒ-rendered
- `npm --prefix functions run build` — exit 0, `functions/lib/{index,setCustomUserClaims,syncAllowedStaff}.js` exist
- `grep -E '"serve"|emulators' functions/package.json` — no matches (D-04 enforced at code level)
- `grep -rE 'seedUsers' components/feature/users/` — 0 matches (Phase 1 actor lookup removed)
- `grep "verifySessionCookie|createSessionCookie" lib/ app/ functions/src/` — only mentioned in comments documenting why we DON'T use those APIs (FINDINGS A1)

## Self-Check

- [x] `functions/package.json` exists, engines.node = 20, no serve/emulators
- [x] `functions/src/setCustomUserClaims.ts` exists, `onDocumentWritten`, `setCustomUserClaims(uid, null)` delete branch, `revokeRefreshTokens`, region `asia-southeast1`, P6 rate-limit guard
- [x] `functions/src/syncAllowedStaff.ts` exists, `onEventTeamChange` + `onUserRoleChange` exports, `recomputeForEvent` shared helper, `onlyAllowedStaffChanged` self-write guard
- [x] `functions/src/index.ts` re-exports all 3 trigger registrations
- [x] `app/(app)/users/actions.ts` starts with `"use server"`, 3 × `await requireAdmin()`, calls `generatePasswordResetLink`, returns `resetLink`, calls `revokeRefreshTokens`, 5 × `revalidatePath`, includes "Cannot demote the last admin"
- [x] `lib/data/users.server.ts` has `import "server-only"`, exports `getUsersPage` + `getUserServer`, uses `startAfter`, base64 cursor encoding
- [x] `lib/hooks/use-users-live.ts` has `"use client"`, `onSnapshot`, 50-row window
- [x] `firebase.json` functions[0] has predeploy + ignore
- [x] `app/(app)/users/page.tsx` imports DAL + uses `getUsersPage`
- [x] `components/feature/users/UsersTable.tsx` uses `useUsersLive`, no `useMockStore`
- [x] 3 client components import from `@/app/(app)/users/actions`, no `@/lib/mock/store` imports
- [x] `navigator.clipboard.writeText` present in `InviteUserSheet.tsx` (D-09)
- [x] No `seedUsers` references anywhere in `components/feature/users/`
- [x] tsc / lint / build all green; functions build green
- [x] All 5 commits exist in git log

## Self-Check: PASSED

## CHECKPOINT REACHED — pending human action (Task 7)

Code complete + green. Deploy is human-gated:

1. `firebase deploy --only functions --project <project-id>` — first deploy takes 3-5 minutes.
2. Verify 3 triggers deployed in asia-southeast1: `onUserWriteSetClaims`, `onEventTeamChange`, `onUserRoleChange`.
3. End-to-end invite flow: /users/invite → submit → verify Copy-link panel renders → verify Firebase password-reset email arrives → click link → set password → auto-sign-in → /users denies access (non-admin).
4. Role change test: admin promotes the staff user → Function 1 log shows `setCustomUserClaims` + `revokeRefreshTokens` → staff session redirects to /login on next request.
5. Disable user test: admin disables a user → hard refresh in user's browser → redirects to /login.
6. Manual rules audit (D-06): 6 cases for users + transactions paths (table in plan Task 7 Step G); record outcomes in CLAIM.md under `## Rules Audit — Block B`.

See plan §"Task 7" `<how-to-verify>` for the full procedure.
