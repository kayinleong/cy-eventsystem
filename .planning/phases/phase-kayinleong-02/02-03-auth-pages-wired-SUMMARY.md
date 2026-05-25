---
phase: phase-kayinleong-02
plan: 03
title: Auth pages wired — /login + /forgot-password + /set-password + (app) role gate + SignOutButton + first-admin seed
status: code-complete (gate: human verification of seed-admin + E2E sign-in)
date_completed: 2026-05-25
commits:
  - 03c6a1d feat: wire /login form to Firebase signInWithEmailAndPassword
  - 05899e4 feat: wire forgot-password + set-password to Firebase
  - f9d4f40 feat: swap (app) role gate + use-current-user to DAL
  - e6d0021 feat: wire SignOutButton + UserMenu to real auth
  - 390a218 feat: delete POC affordances + ship seed-first-admin
files:
  modified:
    - app/(auth)/login/page.tsx
    - app/(auth)/login/_components/login-form.tsx
    - app/(auth)/forgot-password/_components/forgot-password-form.tsx
    - app/(auth)/set-password/page.tsx
    - app/(auth)/set-password/_components/set-password-form.tsx
    - app/(app)/layout.tsx
    - app/(app)/page.tsx
    - app/(app)/settings/page.tsx
    - components/feature/auth/SignOutButton.tsx
    - components/feature/shell/UserMenu.tsx
    - lib/hooks/use-current-user.ts
    - lib/auth/mock-session.ts (converted to re-export shim of dal.ts)
    - lib/mock/cookie.ts (converted to throw-on-call shim)
    - package.json
    - .env.example
  created:
    - scripts/seed-first-admin.ts
  deleted:
    - components/feature/auth/PhaseOnePocRoleSwitcher.tsx
    - app/(auth)/login/_components/seed-users-disclosure.tsx
requirements_satisfied:
  - AUTH-01 (sign-in via Firebase signInWithEmailAndPassword)
  - AUTH-03 (forgot password via sendPasswordResetEmail)
  - AUTH-04 (set password via verifyPasswordResetCode + confirmPasswordReset + D-08 auto-sign-in)
  - AUTH-05 (sign out via /api/auth/logout)
  - AUTH-06 (no public registration — /register returns 404)
  - AUTH-10 (admin-only routes continue to gate via DAL.requireAdmin)
  - INT-04 (DAL is called by (app) layout — partially satisfied; Server Actions in 02-04+ extend the pattern)
  - NFR-06 (server-side auth check — partially; Server Actions land in 02-04+)
---

# Plan 02-03: Auth pages wired — Summary

**One-liner:** Phase 1 mock-cookie auth surface replaced with real Firebase Auth: /login → `signInWithEmailAndPassword` + POST `/api/auth/session`, /forgot-password → `sendPasswordResetEmail`, /set-password → `confirmPasswordReset` + D-08 auto-sign-in, (app)/layout role gate swapped to `requireSession` from `@/lib/auth/dal`, SignOutButton wired to `/api/auth/logout` + `signOut(auth)`, `lib/hooks/use-current-user` switched to `onAuthStateChanged`, POC affordances deleted, `scripts/seed-first-admin.ts` ready for first-admin bootstrap (D-05).

## What changed (file-by-file)

| File | Change | Notes |
|------|--------|-------|
| `app/(auth)/login/page.tsx` | Removed `<SeedUsersDisclosure/>` import + JSX node | UI surface: header + form only. |
| `app/(auth)/login/_components/login-form.tsx` | Replaced `seedUsers.find` + `writeMockSessionClient` with `signInWithEmailAndPassword` + POST `/api/auth/session` + hard-nav `window.location.assign("/")` | Single generic error attached to password field (T-02-03-05 — no enumeration). Phase 1 rhf + Zod + `<Field>` JSX preserved verbatim. |
| `app/(auth)/forgot-password/_components/forgot-password-form.tsx` | Replaced toast stub with `sendPasswordResetEmail`. Generic success branch regardless of error (T-02-03-01) | Firebase auto-sends the default "Password reset" template per D-07. |
| `app/(auth)/set-password/page.tsx` | Wrapped `<SetPasswordForm/>` in `<Suspense>` (Next 16 prerender requirement for `useSearchParams`) | Rule 3 auto-fix during Task 5 build. |
| `app/(auth)/set-password/_components/set-password-form.tsx` | `verifyPasswordResetCode` on mount → `confirmPasswordReset` → D-08 auto-sign-in via `signInWithEmailAndPassword` → POST `/api/auth/session` → hard-nav `/` | Initial state derived from URL param to comply with D-01-02-A `react-hooks/set-state-in-effect`. Expired/invalid oobCode shows "Request a new link" branch (T-02-03-03). |
| `app/(app)/layout.tsx` | Swapped `requireSession` import from `@/lib/auth/mock-session` → `@/lib/auth/dal` | Body 1:1 unchanged. |
| `app/(app)/page.tsx` (dashboard) | `getMockSession` import → `getSession as getMockSession` from `@/lib/auth/dal` | Alias keeps call sites untouched. |
| `app/(app)/settings/page.tsx` | Same as dashboard | One-line import swap. |
| `components/feature/auth/SignOutButton.tsx` | Replaced `clearMockSessionClient` with: `fetch("/api/auth/logout", {method:"POST"})` + `signOut(auth)` + `window.location.assign("/login")` | `useTransition` for pending; best-effort try/catch on both client + server calls. |
| `components/feature/shell/UserMenu.tsx` | Removed `<PhaseOnePocRoleSwitcher/>` import + JSX | Theme controls + sign-out remain. |
| `lib/hooks/use-current-user.ts` | REPLACED body with `onAuthStateChanged` subscription + `getIdTokenResult` for role custom claim; KEPT `useCurrentUser(): Session \| null` signature | Stale role claims (T-02-03-02) accepted — fresh on next token refresh or hard nav. |
| `lib/auth/mock-session.ts` | Converted to re-export shim of `@/lib/auth/dal` | 12 (app) consumers still import from this path; migration in plans 02-04..02-10; shim deleted in 02-11. |
| `lib/mock/cookie.ts` | Converted to throw-on-call shim with actionable error messages pointing each removed helper at its Phase 2 replacement | Throws at call time, not import time — stale imports don't break tsc but the first runtime call fails loudly. Deleted in 02-11. |
| `scripts/seed-first-admin.ts` | NEW — Admin SDK CLI script that creates the first admin user, sets `role:"admin"` custom claim + writes `users/{uid}` doc, and prints a Firebase password-reset link. Refuses to run if `users` collection non-empty (T-02-03-07). | D-05 first-admin bootstrap. |
| `package.json` | Added `seed:first-admin` npm script (tsx --env-file=.env.local) | Mirrors the spike script pattern from 02-02. |
| `.env.example` | Added run-instruction comment block for the seed script | No new env vars — script takes CLI args. |
| `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` | DELETED | Role switching is no longer a UI affordance (T-02-03-08). |
| `app/(auth)/login/_components/seed-users-disclosure.tsx` | DELETED | Phase 1 demo affordance gone. |

## Deviations from plan

### 1. (Rule 1 auto-fix) `react-hooks/set-state-in-effect` in set-password-form.tsx

The plan's set-password snippet called `setCodeError(...)` and `setVerifyingCode(false)` synchronously inside `useEffect` when `oobCode` was missing. This trips the project's `react-hooks/set-state-in-effect` rule (D-01-02-A compliance — same rule that drove the Phase 1 `useSyncExternalStore` pattern in `use-current-user.ts`).

**Fix:** Derive the initial state from the URL param via `useState(() => ...)`. The effect only sets state after async `verifyPasswordResetCode` resolution, with a `cancelled` guard for unmount.

### 2. (Rule 3 auto-fix) `<Suspense>` boundary around `<SetPasswordForm/>`

`useSearchParams()` inside `<SetPasswordForm/>` is a client-side bailout. Next 16 requires a `<Suspense>` boundary so the page can prerender — otherwise the static build of `/set-password` fails with `useSearchParams() should be wrapped in a suspense boundary at page "/set-password"`.

**Fix:** `app/(auth)/set-password/page.tsx` now wraps the form in `<Suspense fallback={...}/>`. The fallback shows "Loading…" centered. After the fix `/set-password` builds as static (`○` in `next build` output).

### 3. (Architectural decision recorded) Phase 1 mock helpers kept as shims, not deleted outright

PLAN.md Task 5 acknowledges this as "Option A — recommended". Outright deletion of `lib/auth/mock-session.ts` would break the build because 12 (app) routes still import `requireSession` / `requireAdmin` / `getMockSession` from that path; those routes are migrated incrementally in plans 02-04..02-10. Option A wins on "every plan leaves the build green".

- `lib/auth/mock-session.ts` → re-export shim. Same export names; bodies are now the real DAL. The shimmed consumers GET the production behavior immediately.
- `lib/mock/cookie.ts` → throw-on-call shim. Every removed helper throws a loud, actionable error pointing at its Phase 2 replacement.

Both shims will be deleted in plan 02-11 after every (app) consumer has been rewritten to import from `@/lib/auth/dal` directly.

### 4. Seed script shape: CLI args (PLAN.md RESEARCH §2.7) — not env-driven (objective sketch Correction D)

The orchestrator's objective document proposed an env-var-driven seed script (`SEED_FIRST_ADMIN_EMAIL`, `SEED_FIRST_ADMIN_PASSWORD`). The PLAN.md RESEARCH §2.7 specified CLI args (`<email> <displayName>`) + a printed password-reset link. We follow the PLAN.md shape because:

1. Storing the first admin password in `.env.local` is worse hygiene than a one-shot Firebase password-reset link (T-02-03-06 — the password never touches the script).
2. The reset-link pattern matches Phase 2's invite flow (plan 02-04 / D-09), so the admin's first-sign-in UX mirrors what every subsequent invitee will see.
3. CLI args are easier to vary across test runs without editing `.env.local`.

The script also includes a hard-refusal rail: `if (users) is not empty, exit 2`. This prevents accidental re-seed and matches T-02-03-07's mitigation.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 1 pre-existing Phase 1 warning (DataTable) unchanged |
| `npm run build` | 24 routes generated; proxy.ts recognized as "ƒ Proxy (Middleware)"; `/set-password` builds as static |
| `grep -r "PhaseOnePocRoleSwitcher\|SeedUsersDisclosure" app/ components/ lib/ \| grep -v ^.*://` (functional refs) | 0 hits |
| `grep -r "readMockSessionClient\|writeMockSessionClient\|clearMockSessionClient" app/ components/` | 0 hits |
| `grep -r "lib/auth/mock-session\|lib/mock/cookie" app/` (consumers — expected during transition) | 12 hits — all (app) routes outside this plan's `files_modified` scope; route through the re-export shim and get real DAL behavior |
| `app/(auth)/login/_components/login-form.tsx` contains `signInWithEmailAndPassword` | OK |
| `app/(auth)/login/_components/login-form.tsx` contains `/api/auth/session` | OK |
| `app/(app)/layout.tsx` contains `from "@/lib/auth/dal"` | OK |
| `components/feature/auth/SignOutButton.tsx` contains `/api/auth/logout` | OK |
| `lib/hooks/use-current-user.ts` contains `onAuthStateChanged` | OK |
| `scripts/seed-first-admin.ts` contains `setCustomUserClaims` | OK |
| `package.json` contains `"seed:first-admin": "tsx --env-file=.env.local scripts/seed-first-admin.ts"` | OK |

## Threat model — implementation outcomes

All 10 STRIDE rows reach the disposition the plan declared:

- **T-02-03-01 mitigated** — `/forgot-password` always shows the generic success branch (caught + swallowed errors).
- **T-02-03-02 accepted** — `use-current-user`'s role read defaults to `"staff"` until the next ID-token refresh picks up the admin custom claim; documented in the hook's header comment.
- **T-02-03-03 mitigated** — Firebase Auth rejects forged/expired oobCodes inside `verifyPasswordResetCode`; the form's mount-time check catches them before the user types a password.
- **T-02-03-04 mitigated** — `app/api/auth/logout/route.ts` (from plan 02-02) calls `adminAuth.revokeRefreshTokens(uid)`; `SignOutButton.tsx` posts to that endpoint and then signs the Web SDK out client-side.
- **T-02-03-05 mitigated** — login form attaches a single generic "Wrong email or password." regardless of root cause; no Firebase error codes surfaced.
- **T-02-03-06 mitigated** — seed script never accepts a password argument and never logs one; it generates and prints a Firebase password-reset link instead.
- **T-02-03-07 mitigated** — seed script refuses to run if `users` collection is non-empty (exit 2 with a message pointing at `/users/invite`).
- **T-02-03-08 mitigated** — `PhaseOnePocRoleSwitcher.tsx` deleted; `UserMenu.tsx` import + JSX scrubbed; grep confirms 0 functional references.
- **T-02-03-09 accepted** — Firebase rate-limits `/api/auth/session` on the server side.
- **T-02-03-10 accepted** — Firebase rate-limits `sendPasswordResetEmail` per source IP + email; the generic success copy doesn't act as an oracle.

## How subsequent plans (02-04..02-10) inherit Block A

Every (app) Server Component, Server Action, and admin-gated route from 02-04 onward begins with `await requireSession()` or `await requireAdmin()` from `@/lib/auth/dal`. Plan 02-03's deliberate keep-shim strategy means:

- Plans 02-04 (users + invite) → 02-10 (dashboard live) can migrate each route's `from "@/lib/auth/mock-session"` line to `from "@/lib/auth/dal"` at their own pace; until they do, the shim re-exports give them production behavior already.
- The 12 still-pending consumers are listed by file in `02-PATTERNS.md` §3 row "lib/auth/mock-session.ts (DELETE)". Plan 02-11 finalizes the import migration and removes both shims.
- The `useCurrentUser` hook's signature is preserved, so all 13 client consumers (TopBar, scan-session, dashboard widgets, etc.) re-render correctly without any call-site change.

## Deferred items (out of scope for this plan)

- 1 stale comment in `app/(app)/events/new/page.tsx:9` mentions `PhaseOnePocRoleSwitcher` for historical context. The file is outside plan 02-03's `files_modified` scope (Block D in plan 02-06). Will be cleaned up when that page migrates to `@/lib/auth/dal`.

## Self-Check: PASSED

- All 5 task commits present and committed (`git log --oneline -5` → 03c6a1d, 05899e4, f9d4f40, e6d0021, 390a218).
- All commits use `feat(phase-kayinleong-02): ...` prefix per global CLAUDE.md (owner slug embedded).
- `scripts/seed-first-admin.ts` exists; contains `setCustomUserClaims`; contains "Refusing to seed" safety rail.
- `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` deleted (verified by `test -f` failing).
- `app/(auth)/login/_components/seed-users-disclosure.tsx` deleted (verified by `test -f` failing).
- `lib/auth/mock-session.ts` exists and re-exports from `./dal` (verified by grep).
- `lib/mock/cookie.ts` exists and throws with "Phase 2: mock-cookie helpers were removed" (verified by grep).
- `tsc --noEmit`, `npm run lint`, `npm run build` all green.
- No functional references to `PhaseOnePocRoleSwitcher`, `SeedUsersDisclosure`, `readMockSessionClient`, `writeMockSessionClient`, `clearMockSessionClient` remain in `app/` or `components/`.

---

## CHECKPOINT REACHED

**Type:** human-action
**Plan:** 02-03 auth pages wired
**Progress:** 5/5 code tasks complete + committed. Working tree clean. `tsc + lint + build` all green. SUMMARY written.

**What's left:** One-time first-admin bootstrap + end-to-end auth verification per Task 6 (`checkpoint:human-verify, gate=blocking`).

### Awaiting human action

**Step A — Seed the first admin** (requires `.env.local` populated with Admin SDK credentials per `.env.example`):

```bash
npm run seed:first-admin -- you@example.com "Your Name"
```

Expected output:
```
=== FIRST ADMIN SEEDED ===
UID:         <some-firebase-uid>
Email:       you@example.com
DisplayName: Your Name
Role:        admin

Link: https://<project>.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=...
```

If the seed prints **"Refusing to seed: users collection is not empty"**, the spike test user or a previous run already populated `users`. Either delete the test user from Firebase Console → Authentication, and remove the `users` collection in Firestore, or skip seeding and promote an existing user manually (Console → Users → set custom claim `role: admin` + write `users/{uid}` doc).

**Step B — Set the first admin's password:** Copy the password-reset link from Step A → paste into a browser. Firebase serves a hosted reset page (NOT this app's `/set-password`). Set a password.

**Step C — Sign in via the app:**
1. `npm run dev`
2. Open http://localhost:3000 in a private window.
3. **Expected:** 307 redirect to `/login` (proxy.ts cookie gate).
4. At `/login`, enter the seeded email + password. Click "Sign in".
5. **Expected:** Network panel shows POST `/api/auth/session` → 200. Page hard-navigates to `/`. Dashboard renders.
6. DevTools → Application → Cookies → `__session` is present (HttpOnly, SameSite=Lax).

**Step D — Sign-out:**
1. Click avatar (top-right) → "Sign out".
2. **Expected:** POST `/api/auth/logout` → 204. Page navigates to `/login`. `__session` cookie cleared.

**Step E — Forgot-password (smoke test):**
1. `/login` → "Forgot password?" → enter the seeded email → "Send reset link".
2. Expect generic "If an account exists, a reset link has been sent" copy.
3. Check your email for "Reset your password" (Firebase template).
4. (Optional) Visit the link → set a new password → return to /login → sign in with the new password.

**Step F — Phase 1 UI regression spot-check:**
Visit each route and confirm rendering is identical to Phase 1:
- `/login` — form + "Forgot password?" link; NO seed-users disclosure block
- `/` — dashboard with KPI cards + 4 widgets (mock data still backing widgets — swap is plan 02-10)
- `/inventory` — Phase 1 mock data still rendering
- `/events` — Phase 1 mock data still rendering
- `/scan` — camera widget mounts
- `/settings` — theme card + low-stock thresholds
- User-menu (top-right) — theme controls + Sign out. **NO** "Switch role" / "Acting as: admin" rows.

**To resume:** Reply `auth E2E PASS, UI unchanged` (or describe failures with the specific step that broke).
