# Spike: next-firebase-auth-edge v1.12 + Next 16.2.6

**Plan:** [02-01-spike-auth-edge-PLAN.md](../../phases/phase-kayinleong-02/02-01-spike-auth-edge-PLAN.md)
**Started:** 2026-05-25
**Goal:** Verify `next-firebase-auth-edge` v1.12 works with our exact Next 16.2.6 stack
before committing to it across Block A.
**Decision gate:** D-01 (02-CONTEXT.md). If any of the 6 checks fail, fall back to
hand-rolled session cookies via `admin.auth().createSessionCookie()` + custom Route
Handlers + raw cookie check in `proxy.ts` (see 02-CONTEXT.md `<specifics>` last bullet).

## Why a spike

`next-firebase-auth-edge` v1.12 was released Feb 2026 — close enough to Next 16.2.6
that ABI compatibility is plausible but unverified. Per PROJECT.md context line 186
this 1-day spike was flagged as a Phase 2 open clarification. Better to lose 1 day
proving it works than 3 days to a doomed integration.

## Acceptance Criteria (6 checks)

| #   | Check                                  | What we expect                                                                                                          |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Cookie creation round-trip             | `POST /api/auth/session` with `Authorization: Bearer <idToken>` returns `Set-Cookie: __session=...; HttpOnly; Path=/`. |
| 2   | proxy.ts allows authenticated requests | Visiting `/` with the cookie does NOT redirect.                                                                         |
| 3   | proxy.ts blocks anonymous requests     | Visiting `/inventory` without the cookie returns 307 to `/login`.                                                       |
| 4   | verifySession() returns decoded claims | `{uid, email}` match the test user; `role` is missing (expected — Cloud Function sets it in 02-04).                     |
| 5   | signOut revokes + clears               | `POST /api/auth/logout` returns 200/204 + cookie cleared via `Set-Cookie: __session=; Max-Age=0`.                       |
| 6   | Revocation gate (AUTH-09)              | Admin SDK disables user → next `verifySessionCookie(cookie, true)` rejects with `auth/user-disabled`.                   |

## How to run

> **Prereq:** Task 0 of the plan (Firebase project provisioning + `.env.local` +
> test user) must be complete. See [.env.example](./.env.example) for the
> required env vars.

1. **Temporarily copy the spike proxy to repo root** so Next picks it up:

   ```bash
   cp .planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts proxy.ts
   ```

2. **Create the stub spike route handler** (`next-firebase-auth-edge` intercepts the
   POST at the proxy level; the route file just needs to exist so Next routes the
   path):

   ```bash
   mkdir -p app/api/auth/spike-session
   cat > app/api/auth/spike-session/route.ts <<'EOF'
   // DELETE after spike. Real route handler ships in 02-02.
   export async function POST() { return new Response("handled by proxy", { status: 200 }); }
   EOF
   ```

   > Note: `authMiddleware` from `next-firebase-auth-edge` short-circuits the POST
   > to `loginPath` (`/api/auth/session`) before any route handler runs. The route
   > file existing makes Next's routing happy; the body is unused.

3. **Boot dev server** — if Next emits any "Edge runtime" warning for `proxy.ts`,
   stop immediately and switch to fallback (Edge unsupported per Next 16 proxy
   spec):

   ```bash
   npm run dev
   ```

4. **Walk Checks 1-6** below, recording outcomes in [FINDINGS.md](./FINDINGS.md)
   (created at the end of the spike).

5. **Teardown** — DO NOT commit the spike copies:

   ```bash
   rm proxy.ts
   rm -rf app/api/auth/spike-session
   ```

## Check 1 — Cookie creation round-trip

1. Visit `http://localhost:3000/login` (Phase 1 mock login page renders).
2. Open DevTools → Network panel.
3. Paste the snippet from [login-server-action.spike.ts](./login-server-action.spike.ts)
   into the browser console (substitute your real test-user email + password).
4. **PASS:** Network panel shows the POST to `/api/auth/session` with response
   header `Set-Cookie: __session=<long-JWT-like-value>; HttpOnly; Path=/; Max-Age=432000; SameSite=Lax`.
   `document.cookie` does NOT include `__session` (HttpOnly hides it from JS —
   that's the desired behavior).
5. **FAIL:** No `Set-Cookie` header, or wrong cookie name (e.g., default `session`
   instead of `__session`), or runtime error.

## Check 2 — proxy.ts allows authenticated requests

1. With the cookie set, navigate to `http://localhost:3000/inventory`.
2. **PASS:** Page renders (Phase 1 mock inventory list shows — mock-session decode
   will silently fail since we're using `__session` not `mock_session`, but the
   proxy gate passing is what we're testing here).
3. **FAIL:** Redirected to `/login` despite the valid cookie.

## Check 3 — proxy.ts blocks anonymous requests

1. Clear all localhost cookies (DevTools → Application → Cookies → Clear all).
2. Navigate to `http://localhost:3000/inventory`.
3. **PASS:** 307 redirect to `/login` (visible in Network panel).
4. **FAIL:** Page loads without redirect — proxy not gating.

## Check 4 — verifySession() returns decoded claims

1. Log in fresh (Check 1 flow).
2. DevTools → Application → Cookies → copy the full `__session` value.
3. In a terminal:

   ```bash
   npm run spike:verify-session "<paste-the-cookie-value-here>"
   ```

4. **PASS:** Output shows decoded claims:

   ```json
   {
     "uid": "...",
     "email": "test@example.com",
     "role": "(no role claim)",
     "auth_time": ...,
     "exp": ...
   }
   ```

   No `role` is expected — the Cloud Function in 02-04 sets it. A manually-created
   test user has no role claim — that's fine for the spike.

5. **FAIL:** `VERIFY FAILED: auth/session-cookie-expired` → try a fresh login.
   `auth/invalid-id-token` or similar after a fresh login → investigate before
   continuing.

## Check 5 — signOut revokes + clears

1. While logged in, from DevTools Console:

   ```javascript
   fetch('/api/auth/logout', { method: 'POST' }).then(r => r.status);
   ```

2. **PASS:** Response is 200 or 204. Reload — `document.cookie` no longer shows
   `__session` (and Network panel shows the response cleared the cookie via
   `Set-Cookie: __session=; Max-Age=0`).
3. **FAIL:** 404 — `next-firebase-auth-edge` may need a route stub at
   `/api/auth/logout`. Check upstream docs and add the stub.

## Check 6 — Revocation gate (AUTH-09)

1. Log in fresh, copy the cookie value from DevTools.
2. Disable the test user via Admin SDK script:

   ```bash
   # USER_UID is from Check 4's decoded output
   npx tsx --env-file=.env.local -e "
     import('firebase-admin/app').then(({initializeApp,cert,getApps}) => {
       const app = getApps()[0] ?? initializeApp({
         credential: cert({
           projectId: process.env.FIREBASE_PROJECT_ID,
           clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
           privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n'),
         }),
       });
       return import('firebase-admin/auth').then(({getAuth}) =>
         getAuth(app).updateUser('<USER_UID>', {disabled: true})
       );
     }).then(() => console.log('disabled')).catch(e => console.error(e));
   "
   ```

   Alternatively: Firebase Console → Authentication → Users → click the user →
   Disable account.

3. Re-run the verify helper with the same cookie value:

   ```bash
   npm run spike:verify-session "<same-cookie-from-step-1>"
   ```

4. **PASS:** Output is `VERIFY FAILED: auth/user-disabled`. The cookie still parses
   structurally but verification rejects it.
5. **FAIL:** Cookie still decodes successfully — `verifySessionCookie` was called
   without the second arg, or revocation isn't propagating. AUTH-09 contract not
   met.
6. **Cleanup:** Re-enable the test user (same script, `disabled: false`) OR via
   Firebase Console.

## After all 6 checks

Write [FINDINGS.md](./FINDINGS.md) recording PASS/FAIL per check + overall
decision (`PROCEED_AS_PLANNED` vs `FALLBACK_HAND_ROLLED`). Then teardown the
spike-only files at repo root.

## Outcome

See [FINDINGS.md](./FINDINGS.md) once the spike runs.
