# Findings: next-firebase-auth-edge v1.12 spike

**Run date:** 2026-05-25
**Spike duration:** ~1 day (planning + scaffold + 1 execution session)
**Stack:** Next.js 16.2.6, firebase ^12.13, firebase-admin ^13.10, next-firebase-auth-edge v1.12.0
**Node:** v24.14.1
**Firebase project:** Single production project per D-03 (project id redacted from this doc — refer to `.env.local`)

## Verdict

**PROCEED_AS_PLANNED**

`next-firebase-auth-edge` v1.12.0 works cleanly with Next.js 16.2.6 + Firebase Web SDK v12.13 + Firebase Admin SDK v13.10. All 6 acceptance criteria pass. Plan 02-02 should implement `proxy.ts` using `authMiddleware` exactly as in `proxy.spike.ts`, with the env-var and DAL-API corrections documented in §"Recommended deltas for plan 02-02" below.

## Acceptance Criteria Results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Cookie creation round-trip | PASS | POST /api/auth/session with `Authorization: Bearer <idToken>` → `Set-Cookie: __session=<envelope>; HttpOnly; Path=/; Max-Age=432000; SameSite=Lax`. Envelope ~1815 chars. |
| 2 | proxy.ts allows authenticated requests | PASS | GET /login with valid `__session` cookie → 307 to /. `handleValidToken` triggers `redirectToHome`. Proves end-to-end cookie verification (jose + Google JWKs). |
| 3 | proxy.ts blocks anonymous requests | PASS | GET /inventory no-cookie → 307 to `/login?redirect=%2Finventory`. `handleInvalidToken` → `redirectToLogin`. |
| 4 | verifySession decodes claims | PASS | `getTokensFromObject()` returns `{token, decodedToken}` with uid + email matching test user. Claim keys: `aud`, `auth_time`, `email`, `email_verified`, `exp`, `firebase`, `iat`, `iss`, `source_sign_in_provider`, `sub`, `uid`, `user_id`. `role` absent (expected — set by plan 02-04). |
| 5 | signOut clears + revokes | PASS | POST /api/auth/logout → 200 + `Set-Cookie: __session=; Expires=Thu, 01 Jan 1970...; HttpOnly; Path=/; SameSite=Lax`. |
| 6 | Revocation gate (AUTH-09) | PASS | After `revokeRefreshTokens()` + `updateUser({disabled:true})`, `adminAuth.verifyIdToken(token, /*checkRevoked*/true)` throws `auth/user-disabled`. Propagation ~1.5s. |

Source of truth: `.planning/spikes/next-firebase-auth-edge-v1.12/spike-results.json` (machine-readable run output).

## Anomalies / Surprises

### A1. `admin.auth().verifySessionCookie(cookie)` does NOT work on auth-edge cookies

**This was the original Check 4 test approach in the plan, and it always throws `auth/argument-error`.**

`next-firebase-auth-edge` does NOT use Firebase's native session-cookie format (the one produced by `admin.auth().createSessionCookie`). It produces its own HMAC-signed envelope: `<base64-payload>.<base64-signature>`, where the payload contains wrapped ID + refresh tokens. The signature is `HMAC-SHA256(payload, AUTH_COOKIE_SIGNATURE_KEY_CURRENT)` — it rotates against `AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS` for a grace period.

**Correct verification API for plan 02-02's `lib/auth/dal.ts`:**

```typescript
import { getTokens, getTokensFromObject } from "next-firebase-auth-edge";
import { cookies } from "next/headers";

const tokens = await getTokens(await cookies(), {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: "__session",
  cookieSignatureKeys: [
    process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!,
    process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!,
  ],
  serviceAccount: {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  },
});
// tokens?.decodedToken is a DecodedIdToken
```

For **AUTH-09 immediate revocation** in the DAL hot path, additionally call `adminAuth.verifyIdToken(tokens.token, /*checkRevoked*/true)`. The proxy alone accepts stale ID tokens up to their 1-hour TTL; only the Admin SDK `checkRevoked` path enforces immediate revocation.

### A2. `.env.local` `FIREBASE_*` trio mismatched `sa.json`

The spike ran with two credential paths:
- **Path A (`applicationDefault()` via `GOOGLE_APPLICATION_CREDENTIALS=./sa.json`):** PASS.
- **Path B (explicit `cert({projectId, clientEmail, privateKey})` from `.env.local`):** FAILED with `invalid_grant: Invalid grant: account not found`.

The `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` values in `.env.local` do not match what `sa.json` contains. Before plan 02-02 ships, the developer MUST reconcile `.env.local` so the env-var path works in production (we don't want to ship `sa.json` to a hosted environment).

**Recommended fix:** Open `sa.json`, copy the three fields into `.env.local` literally:
- `FIREBASE_PROJECT_ID` ← `project_id`
- `FIREBASE_CLIENT_EMAIL` ← `client_email`
- `FIREBASE_PRIVATE_KEY` ← `private_key` (wrap in double quotes, keep `\n` literal escapes verbatim — code unescapes at startup)

### A3. Phase 1 `(app)/layout.tsx` redirects auth-edge requests

`requireSession()` in Phase 1 reads the `mock_session` cookie (not `__session`) → it redirects auth-edge-authed requests to `/login`. This is expected Phase 1 behavior and gets resolved in plan 02-05 when the DAL is swapped. During the spike, Check 2 was retargeted at `/login` (a public path) where `handleValidToken`'s `redirectToHome` runs.

### A4. Cookie size ~1815 chars

Larger than Firebase native session cookies (~1024 chars) — the auth-edge envelope carries the full ID token + refresh token + metadata + HMAC signature. Still under the 4KB HTTP cookie limit, but noteworthy for per-request size budgeting (especially when paired with other large cookies or framework state).

### A5. Runs on Node runtime cleanly

No Edge runtime warnings emitted from Next 16.2.6's `proxy.ts`. The library is Edge-compatible historically but Node-compatible too. Per `STACK.md`, Next 16 `proxy.ts` runs on Node only (Edge unsupported) — confirmed working.

## Spike Code Disposition

| File | Action | Reason |
|------|--------|--------|
| `README.md` | KEEP | Spike charter + run guide |
| `.env.example` | KEEP | Env-var reference for plan 02-02 |
| `proxy.spike.ts` | KEEP | Basis for production `proxy.ts` in plan 02-02 |
| `verify-session.spike.ts` | KEEP (with caveat) | Uses WRONG API per A1; do NOT model the production DAL on this file |
| `login-server-action.spike.ts` | KEEP | Reference snippet for Phase 2 client login flow |
| `run-spike.ts` | KEEP | Programmatic regression test — reusable in plan 02-15 verification gate |
| `spike-results.json` | KEEP | Run output of 6/6 PASS |
| `proxy.ts` at repo root | DELETED before commit | Temporary spike copy; production version ships in plan 02-02 |
| `app/api/auth/session/route.ts` + `app/api/auth/logout/route.ts` stubs | DELETED before commit | Temporary spike stubs; production versions ship in plan 02-02 |

## Test User Lifecycle

The spike runner (`run-spike.ts`) creates and tears down a test user PER RUN (`spike-${Date.now()}@spike.local`) via Admin SDK. No long-lived spike user remains in the Firebase Auth user table. The first production admin is created separately via `scripts/seed-first-admin.ts` in plan 02-04, per CONTEXT.md D-05.

## Recommended Deltas for Plan 02-02

1. **`lib/firebase/admin.ts`** — env-var-only init per RESEARCH §1.2. Fix `.env.local` first (per A2) so the env-var path works. Do NOT ship the `sa.json` fallback to production. Add a startup assertion that `getAuth().app.options.projectId === process.env.FIREBASE_PROJECT_ID` to catch credential mismatch early.

2. **`proxy.ts`** at repo root — direct port of `proxy.spike.ts` MINUS the `sa.json` fallback used during the spike (env-vars only). No `debug: true` in production.

3. **`app/api/auth/session/route.ts`** + **`app/api/auth/logout/route.ts`** — no-op stubs (proxy intercepts these paths). Add a comment explaining why. Verify Next 16 doesn't require the route file to exist for `proxy.ts` to intercept (should be fine, but spike used real stubs so this needs reconfirming in 02-02).

4. **`lib/auth/dal.ts`** (in plan 02-05, not 02-02) — use `getTokens(await cookies(), options)` or `getTokensFromObject()`, NOT `admin.auth().verifySessionCookie`. See A1 for code shape.

5. **AUTH-09 hot path** — Plan 02-05's DAL MUST call `adminAuth.verifyIdToken(token, /*checkRevoked*/true)` for any fresh-auth request that mutates state. The proxy alone allows stale tokens for up to 1 hour (the ID token TTL); only the Admin SDK `checkRevoked` path enforces immediate revocation.

6. **Key rotation procedure** — when `AUTH_COOKIE_SIGNATURE_KEY_CURRENT` rotates: move current value to `AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS`, generate new `CURRENT` via `openssl rand -base64 32`, redeploy. Old sessions continue to decode via `PREVIOUS` for the grace period (until cookie expiry — 5 days per plan). Document this in `PROJECT.md` Operations section when plan 02-02 lands.

## Regression Report

**Tested:** library integration with Next 16.2.6, cookie round-trip (mint + verify + clear), Admin SDK init (both `applicationDefault()` and `cert()` paths), AUTH-09 revocation flow.

**Passed:** all 6 spike criteria; both credential paths attempted (only `applicationDefault()` succeeded — see A2); HMAC sign+verify; revocation propagation ~1.5s.

**Ruled out:** Edge runtime path (Node-only confirmed); Firebase Hosting `__session` cookie conflict (not deploying to Hosting); `enableTokenRefreshOnExpiredKidHeader` edge case (defaults to true; not exercised in spike).

**Out of scope:** Cloud Function for role claims (plan 02-04); Vercel request size limits (plan 02-13); AUTH-05 multi-session behavior (plans 02-05 + 02-06).

**No regressions:** spike was additive — only new files under `.planning/spikes/`, new `package.json` deps, and `.gitignore` additions. All spike-only repo-root files (`proxy.ts`, `app/api/auth/*` stubs) deleted before commit. `git status --short` returns empty.

## Next Step

Proceed to `.planning/phases/phase-kayinleong-02/02-02-firebase-clients-and-proxy-PLAN.md` with the deltas in §"Recommended Deltas for Plan 02-02" applied.
