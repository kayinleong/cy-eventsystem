---
phase: phase-kayinleong-02
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md
  - .planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts
  - .planning/spikes/next-firebase-auth-edge-v1.12/login-server-action.spike.ts
  - .planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts
  - .planning/spikes/next-firebase-auth-edge-v1.12/README.md
autonomous: false
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-05
  - AUTH-09
  - NFR-07
  - NFR-08
user_setup:
  - service: firebase
    why: "Spike needs a real Firebase project with Auth + Firestore enabled to round-trip a session cookie. Per D-03 we use the single production project (no staging) but the spike writes to a scratch `_spike` namespace to avoid polluting prod schema."
    env_vars:
      - name: NEXT_PUBLIC_FIREBASE_API_KEY
        source: "Firebase Console → Project Settings → General → Web app config"
      - name: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
        source: "Firebase Console → Project Settings"
      - name: NEXT_PUBLIC_FIREBASE_PROJECT_ID
        source: "Firebase Console → Project Settings"
      - name: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        source: "Firebase Console → Project Settings"
      - name: NEXT_PUBLIC_FIREBASE_APP_ID
        source: "Firebase Console → Project Settings → Web app appId"
      - name: FIREBASE_PROJECT_ID
        source: "Same as NEXT_PUBLIC value"
      - name: FIREBASE_CLIENT_EMAIL
        source: "Service-account JSON (Project Settings → Service accounts → Generate new private key) → `client_email`"
      - name: FIREBASE_PRIVATE_KEY
        source: "Same service-account JSON → `private_key` (keep \\n literals, code will unescape)"
      - name: AUTH_COOKIE_SIGNATURE_KEY_CURRENT
        source: "Generate locally: `openssl rand -base64 32` — 32+ random bytes"
      - name: AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS
        source: "Generate locally: `openssl rand -base64 32` — different value than CURRENT"
      - name: USE_SECURE_COOKIES
        source: "`true` in prod, `false` in localhost (dev). For the spike: `false`."
    dashboard_config:
      - task: "Enable Email/Password sign-in method"
        location: "Firebase Console → Authentication → Sign-in method → Email/Password → Enable"
      - task: "Create Firestore in native mode (region asia-southeast1 recommended per Hong Kong-based dev)"
        location: "Firebase Console → Firestore Database → Create database"
      - task: "Create one test user manually for the spike"
        location: "Firebase Console → Authentication → Users → Add user (email + password) — record the credentials in the FINDINGS.md sealed section"
  - service: dev-machine
    why: "Spike scaffolding files live under `.planning/spikes/` and are never imported by the app. Need to be able to run them ad-hoc."
    dashboard_config:
      - task: "`npm i next-firebase-auth-edge@^1.12.0 firebase firebase-admin` if not already in package.json — these become real deps in 02-02 anyway"
        location: "Local terminal"

must_haves:
  truths:
    - "A scratch login flow can sign in via Firebase Web SDK and the response sets a __session HttpOnly cookie."
    - "proxy.ts (Node runtime) correctly distinguishes signed-in vs anonymous requests by __session cookie presence."
    - "verifySession() decodes the cookie via verifySessionCookie(cookie, true) and returns {uid, email, role}."
    - "signOut revokes refresh tokens and clears the cookie."
    - "Token-revocation gate works — disabling a user via Admin SDK rejects their next verifySession call."
    - "Findings note documents PASS/FAIL of all 6 acceptance criteria; fallback path noted if any failed."
  artifacts:
    - path: ".planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md"
      provides: "Outcome of 6 spike checks; fallback recommendation if any check failed"
      contains: "## Acceptance Criteria"
    - path: ".planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts"
      provides: "Spike-only proxy.ts using authMiddleware from next-firebase-auth-edge"
      contains: "authMiddleware"
    - path: ".planning/spikes/next-firebase-auth-edge-v1.12/README.md"
      provides: "How to run the spike; gate criterion for 02-02"
      contains: "Spike acceptance"
  key_links:
    - from: ".planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md"
      to: ".planning/phases/phase-kayinleong-02/02-02-firebase-clients-and-proxy-PLAN.md"
      via: "Gate criterion — if any of the 6 checks fail, 02-02 must add fallback tasks using admin.auth().createSessionCookie() + manual cookie set in Route Handler instead of next-firebase-auth-edge"
      pattern: "next-firebase-auth-edge|createSessionCookie"
---

<objective>
**Spike on `next-firebase-auth-edge` v1.12+ against Next 16.2.6.** Per D-01, this is a 1-day throwaway spike that gates all of Block A (plans 02-02 onwards). Verifies the library actually works with our exact stack before we commit to it across the project. Outputs a findings note and, if the spike fails, a recommendation for the fallback path (hand-rolled `admin.auth().createSessionCookie()` + custom Route Handlers + cookie parsing in `proxy.ts`).

**Per CONTEXT.md `<specifics>` last bullet:** "If the spike reveals incompatibility with Next 16.2.6, planner reverts to lower-level Firebase Admin SDK session-cookie management."

Purpose: De-risk before commitment. Better to lose 1 day to a spike than 3 days to a doomed integration.

Output: `.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md` with PASS/FAIL on 6 acceptance criteria + recommended path forward.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/phase-kayinleong-02/02-CONTEXT.md
@.planning/phases/phase-kayinleong-02/02-RESEARCH.md
@.planning/phases/phase-kayinleong-02/02-PATTERNS.md
@.planning/research/STACK.md
@.planning/research/ARCHITECTURE.md
@.planning/research/PITFALLS.md
@package.json
@lib/auth/mock-session.ts

<interfaces>
<!-- The exact API surface we are spiking against. -->

```typescript
// next-firebase-auth-edge v1.12+ public exports (from upstream docs):
import {
  authMiddleware,
  redirectToHome,
  redirectToLogin,
  getTokens,
} from "next-firebase-auth-edge";

// authMiddleware contract (subset we use):
authMiddleware(request: NextRequest, options: {
  loginPath: string;            // "/api/auth/session"
  logoutPath: string;           // "/api/auth/logout"
  apiKey: string;               // NEXT_PUBLIC_FIREBASE_API_KEY
  cookieName: string;           // "__session"
  cookieSignatureKeys: string[]; // [CURRENT, PREVIOUS] — 32+ random bytes each
  cookieSerializeOptions: {
    path: string; httpOnly: boolean; secure: boolean;
    sameSite: "lax"|"strict"|"none"; maxAge: number;
  };
  serviceAccount: {
    projectId: string; clientEmail: string; privateKey: string;
  };
  handleValidToken: (data: {token: string; decodedToken: DecodedIdToken}, headers: Headers) => Promise<NextResponse>;
  handleInvalidToken: () => Promise<NextResponse>;
  handleError: (err: unknown) => Promise<NextResponse>;
}): Promise<NextResponse>;

// getTokens (used inside Server Components / Server Actions to read cookie):
getTokens(cookieStore: ReadonlyRequestCookies, opts: {
  cookieName: string; cookieSignatureKeys: string[]; serviceAccount; apiKey: string;
}): Promise<{token: string; decodedToken: DecodedIdToken} | null>;
```

```typescript
// firebase-admin Admin SDK contract (subset):
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const adminAuth = getAuth(app);
adminAuth.verifySessionCookie(cookie: string, checkRevoked: boolean): Promise<DecodedIdToken>;
adminAuth.revokeRefreshTokens(uid: string): Promise<void>;
adminAuth.createSessionCookie(idToken: string, opts: {expiresIn: number}): Promise<string>;
adminAuth.updateUser(uid: string, props: {disabled?: boolean; ...}): Promise<UserRecord>;
```

```typescript
// Firebase Web SDK (firebase ^12.13):
import { signInWithEmailAndPassword, getAuth } from "firebase/auth";
const cred = await signInWithEmailAndPassword(auth, email, password);
const idToken = await cred.user.getIdToken();
```
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 0: Firebase project + env-var provisioning (USER ACTION)</name>
  <what-needed>
    Per D-03/D-05/D-07, the spike (and the rest of Phase 2) needs a real Firebase project. **The developer must do this manually before the spike can run** — Claude cannot create Firebase projects via CLI without authenticated user context. **Note:** Per CLAUDE.md secrets hygiene rules, Claude MUST NOT read `.env.local` once created; the developer pastes individual values back to Claude on request.
  </what-needed>
  <how-to-verify>
    1. Visit https://console.firebase.google.com/ and create a new project named `cy-eventsystem` (or use existing).
    2. Enable Authentication → Email/Password sign-in method.
    3. Enable Firestore (native mode, region `asia-southeast1`).
    4. Enable Storage (default bucket).
    5. Generate a service-account JSON key: Project Settings → Service Accounts → Generate new private key. **Save this file OUTSIDE the repo** (`~/secrets/cy-eventsystem-admin.json` or similar). It will be deleted after env extraction.
    6. Create `.env.local` at repo root (gitignored) with these exact keys — values from your Firebase project:
       ```
       NEXT_PUBLIC_FIREBASE_API_KEY=...
       NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cy-eventsystem.firebaseapp.com
       NEXT_PUBLIC_FIREBASE_PROJECT_ID=cy-eventsystem
       NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cy-eventsystem.firebasestorage.app
       NEXT_PUBLIC_FIREBASE_APP_ID=...
       NEXT_PUBLIC_APP_URL=http://localhost:3000
       FIREBASE_PROJECT_ID=cy-eventsystem
       FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@cy-eventsystem.iam.gserviceaccount.com
       FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
       AUTH_COOKIE_SIGNATURE_KEY_CURRENT=<openssl rand -base64 32>
       AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS=<openssl rand -base64 32, different value>
       USE_SECURE_COOKIES=false
       ```
       `FIREBASE_PRIVATE_KEY` must be in double-quotes; literal `\n` will be unescaped by the code via `.replace(/\\n/g, '\n')`.
    7. Verify `.env.local` is gitignored — `grep -q "^\\.env\\.local" .gitignore` MUST exit 0. If not, add it before continuing.
    8. Manually create ONE test user in Firebase Console → Authentication → Users (email + password). Record the credentials in step 9 of the spike (FINDINGS.md → "Test User" section); do NOT commit them anywhere.
  </how-to-verify>
  <resume-signal>Type "env ready" once `.env.local` exists with all 12 variables AND a test user has been created in Firebase Authentication. If you encounter any issue (Firebase Console layout changed, region unavailable, etc.), describe it instead of saying "env ready".</resume-signal>
</task>

<task type="auto">
  <name>Task 1: Scaffold spike workspace</name>
  <files>
    .planning/spikes/next-firebase-auth-edge-v1.12/README.md,
    .planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts,
    .planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts,
    .planning/spikes/next-firebase-auth-edge-v1.12/login-server-action.spike.ts,
    package.json
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"Block A — Foundation" lines 116-475 (full Block A research with proxy.ts excerpt at 222-282, DAL excerpt at 308-374)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md `<decisions>` D-01 (spike gate), `<specifics>` last bullet (fallback path)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §2 "proxy.ts (repo root, NEW)" row + §4 excerpt E (proxy.ts shape)
    - package.json (current dependencies — verify firebase, firebase-admin versions; add next-firebase-auth-edge if missing)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md (Next 16 proxy spec — Node-only runtime, function name `proxy`, matcher syntax)
    - AGENTS.md (Next 16 breaking-change warning — DO NOT use middleware.ts, DO use proxy.ts)
  </read_first>
  <action>
    These are spike-only files. They live under `.planning/spikes/` and are NEVER imported by the app build. They exist to verify `next-firebase-auth-edge` v1.12+ works with Next 16.2.6 before we wire the real implementation in 02-02.

    **Step 1.1 — Install the library (if not present):**

    ```bash
    npm i next-firebase-auth-edge@^1.12.0
    ```

    Verify it landed:

    ```bash
    grep -E '"next-firebase-auth-edge"' package.json
    ```

    Must show the dep with version `^1.12.0` or higher. If not, fail this task and rerun.

    **Step 1.2 — Create `.planning/spikes/next-firebase-auth-edge-v1.12/README.md`:**

    ```markdown
    # Spike: next-firebase-auth-edge v1.12 + Next 16.2.6

    **Started:** {date}
    **Goal:** Verify the library works with our exact stack before committing to it across Block A.
    **Decision gate:** D-01 (CONTEXT.md). If any of the 6 checks below fail, fall back to hand-rolled session cookies in 02-02.

    ## Acceptance Criteria (6 checks)

    1. **Cookie creation round-trip** — login Server Action / Route Handler sets `__session` HttpOnly cookie.
    2. **proxy.ts allows authenticated requests** — visiting `/` with the cookie does NOT redirect.
    3. **proxy.ts blocks anonymous requests** — visiting `/` without the cookie returns 307 to `/login`.
    4. **verifySession() returns decoded claims** — `{uid, email, role}` match the test user.
    5. **signOut revokes + clears** — logout endpoint revokes refresh tokens and clears cookie.
    6. **Revocation gate** — admin.auth().updateUser(uid, {disabled: true}) → next verifySession throws → user redirected to /login.

    ## How to run

    1. Ensure `.env.local` exists with all Firebase + cookie-signature env vars (see Task 0).
    2. Temporarily copy `proxy.spike.ts` → `proxy.ts` at repo root.
    3. Temporarily wire `app/api/auth/spike-session/route.ts` (created during the spike).
    4. Run `npm run dev`.
    5. Walk through the 6 checks in Task 3 below; record PASS/FAIL in `FINDINGS.md`.
    6. After the spike, restore: `rm proxy.ts; rm app/api/auth/spike-session/route.ts`.

    ## Outcome

    See `FINDINGS.md`.
    ```

    **Step 1.3 — Create `.planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts`:**

    This is the EXACT content that will be copied to `proxy.ts` at repo root during the spike (and later baked into 02-02 if the spike passes). It uses `authMiddleware` from `next-firebase-auth-edge`.

    ```typescript
    // proxy.spike.ts — copy to repo-root /proxy.ts during the spike. NEVER imported in app code.
    // Per RESEARCH.md §1.4 (lines 218-283).
    import { NextResponse, type NextRequest } from "next/server";
    import {
      authMiddleware,
      redirectToHome,
      redirectToLogin,
    } from "next-firebase-auth-edge";

    const PUBLIC_PATHS = ["/login", "/forgot-password", "/set-password"];

    export async function proxy(request: NextRequest) {
      return authMiddleware(request, {
        loginPath: "/api/auth/session",
        logoutPath: "/api/auth/logout",
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        cookieName: "__session",
        cookieSignatureKeys: [
          process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!,
          process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!,
        ],
        cookieSerializeOptions: {
          path: "/",
          httpOnly: true,
          secure: process.env.USE_SECURE_COOKIES === "true",
          sameSite: "lax" as const,
          maxAge: 5 * 24 * 60 * 60, // AUTH-02: 5-day expiry
        },
        serviceAccount: {
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        },
        handleValidToken: async (_data, headers) => {
          if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
            return redirectToHome(request);
          }
          return NextResponse.next({ request: { headers } });
        },
        handleInvalidToken: async () => {
          return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
        },
        handleError: async (error) => {
          console.error("[spike proxy error]", error);
          return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
        },
      });
    }

    export const config = {
      matcher: [
        "/api/auth/:path*",
        "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt).*)",
      ],
    };
    ```

    **Step 1.4 — Create `.planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts`:**

    Standalone Node script invoked via `npx tsx .planning/spikes/.../verify-session.spike.ts <session-cookie-value>` to test `verifySessionCookie(cookie, true)` directly. Useful to debug Check 4 + Check 6 without going through the browser.

    ```typescript
    // verify-session.spike.ts — invoke: npx tsx .planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts <cookie>
    import { initializeApp, cert, getApps } from "firebase-admin/app";
    import { getAuth } from "firebase-admin/auth";

    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    }

    const cookie = process.argv[2];
    if (!cookie) {
      console.error("Usage: tsx verify-session.spike.ts <session-cookie>");
      process.exit(1);
    }

    getAuth()
      .verifySessionCookie(cookie, true)
      .then((decoded) => {
        console.log("DECODED:", JSON.stringify({
          uid: decoded.uid,
          email: decoded.email,
          role: decoded.role ?? "(no role claim)",
          auth_time: decoded.auth_time,
          exp: decoded.exp,
        }, null, 2));
      })
      .catch((err) => {
        console.error("VERIFY FAILED:", err.code ?? err.message);
        process.exit(2);
      });
    ```

    **Step 1.5 — Create `.planning/spikes/next-firebase-auth-edge-v1.12/login-server-action.spike.ts`:**

    A test client-side helper script the developer can run from the browser console to login + capture the resulting cookie. Stored as a `.ts` reference but used as a snippet pasted into the browser DevTools during spike check 1.

    ```typescript
    // login-server-action.spike.ts — browser console snippet for Check 1.
    // Paste into DevTools at http://localhost:3000/login after wiring proxy.ts.
    // The actual Web SDK call exists in app/(auth)/login/_components/login-form.tsx after 02-03.
    /*
    async function spikeLogin(email, password) {
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
      const { initializeApp, getApps } = await import('firebase/app');
      const app = getApps()[0] ?? initializeApp({
        apiKey: 'YOUR_KEY',
        authDomain: 'YOUR_DOMAIN',
        projectId: 'YOUR_PROJECT_ID',
      });
      const auth = getAuth(app);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      console.log('login response:', res.status, await res.text());
      console.log('document.cookie:', document.cookie);
      return res.ok;
    }
    spikeLogin('test@example.com', 'password').then(ok => console.log('OK?', ok));
    */
    export {};
    ```

    File content is the comment block (commented out so it doesn't run during tsc). It exists in-repo as the canonical snippet for posterity.

    **Step 1.6 — `package.json` script (optional helper):**

    Add a one-line npm script for invoking the verify-session.spike.ts helper:

    ```json
    "scripts": {
      "spike:verify-session": "tsx .planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts"
    }
    ```

    Also add `tsx` to devDependencies if not present (`npm i -D tsx`).
  </action>
  <acceptance_criteria>
    - `grep -q '"next-firebase-auth-edge"' package.json` exits 0.
    - `grep -E '"next-firebase-auth-edge".*"\^1\.1[2-9]"' package.json` exits 0 (version 1.12+).
    - `grep -q '"tsx"' package.json` exits 0.
    - File `.planning/spikes/next-firebase-auth-edge-v1.12/README.md` exists.
    - File `.planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts` exists and `grep -q 'authMiddleware' .planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts` exits 0.
    - File `.planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts` contains `export async function proxy(` (grep exits 0).
    - File `.planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts` contains `cookieName: "__session"` (grep exits 0).
    - File `.planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts` does NOT contain `export const runtime` (grep exits 1 — Next 16 proxy is Node-only by spec, no runtime export).
    - File `.planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts` exists and contains `verifySessionCookie` (grep exits 0).
    - `npx tsc --noEmit .planning/spikes/next-firebase-auth-edge-v1.12/*.ts` produces ZERO errors (spike files type-check on their own).
  </acceptance_criteria>
  <verify>
    <automated>grep -q '"next-firebase-auth-edge"' package.json && grep -q 'authMiddleware' .planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts && test -f .planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts && test -f .planning/spikes/next-firebase-auth-edge-v1.12/README.md</automated>
  </verify>
  <done>Spike scaffolding committed. Library installed at v1.12+. Files in `.planning/spikes/` are throwaway — they will be deleted after the spike completes (Task 3) and the real implementation lands in 02-02.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Run the spike — 6 acceptance checks against live Firebase</name>
  <what-built>
    Spike scaffolding from Task 1 is in place. Now the developer must temporarily copy `proxy.spike.ts` to repo-root `proxy.ts`, wire a temporary `/api/auth/spike-session/route.ts`, and run through the 6 checks against the real Firebase project provisioned in Task 0.
  </what-built>
  <how-to-verify>
    Execute the 6 checks in order. Record outcomes in `.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md` (created in Task 3).

    **Setup (one-time per spike run):**
    1. `cp .planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts proxy.ts` (root proxy is temporary; will be deleted after spike).
    2. Create `app/api/auth/spike-session/route.ts` with this body (also temporary):
       ```typescript
       // app/api/auth/spike-session/route.ts — DELETE after spike. The real one ships in 02-02.
       // Note: next-firebase-auth-edge intercepts POST /api/auth/session at the proxy level
       // BEFORE this route handler runs, so we don't actually need a body here for the spike.
       // This file just makes Next happy about the route existing.
       export async function POST() { return new Response("handled by proxy", { status: 200 }); }
       ```
       (Actually: with `authMiddleware`, the cookie is set DURING proxy processing of the POST to `loginPath`. The route handler can be a stub or omitted — the proxy short-circuits. Verify this exact behavior during the spike — it's one of the things we're checking.)
    3. `npm run dev` — server should boot without errors. If Next emits "proxy.ts is using Edge runtime" warning, stop and switch to fallback path (Edge unsupported per Next 16 spec).

    **Check 1 — Cookie creation round-trip:**
    1. Visit `http://localhost:3000/login` (Phase 1 mock login renders).
    2. Open DevTools → Network. Paste the `spikeLogin('test@example.com', 'your-password')` snippet from `login-server-action.spike.ts` (substitute real values from your `.env.local`).
    3. **PASS:** Network panel shows `Set-Cookie: __session=<JWT-like-value>; HttpOnly; Path=/; Max-Age=432000; SameSite=Lax`. `document.cookie` does NOT include `__session` (HttpOnly hides it from JS — that's correct).
    4. **FAIL:** No `Set-Cookie` header, or wrong cookie name, or runtime error in dev console.

    **Check 2 — proxy.ts allows authenticated requests:**
    1. With the cookie set, navigate to `http://localhost:3000/` (or any (app) route).
    2. **PASS:** Page renders (whatever Phase 1 (app) layout shows; mock-session decode will likely fail since we're using __session not mock_session — that's OK, we're only testing the proxy's cookie-presence gate here).
    3. **FAIL:** Redirected to `/login` despite having a valid `__session` cookie.

    **Check 3 — proxy.ts blocks anonymous requests:**
    1. Clear all cookies for localhost (DevTools → Application → Cookies → Clear all).
    2. Navigate to `http://localhost:3000/inventory`.
    3. **PASS:** 307 redirect to `/login` (visible in Network panel).
    4. **FAIL:** Page loads without redirect (proxy not gating).

    **Check 4 — verifySession() returns decoded claims:**
    1. Log back in (Check 1 flow).
    2. From DevTools Application → Cookies, copy the full `__session` cookie value.
    3. In a terminal: `npm run spike:verify-session "<paste-the-cookie-value-here>"`.
    4. **PASS:** Output shows `DECODED: { uid: "...", email: "test@example.com", role: "(no role claim)", auth_time: ..., exp: ... }`. (No `role` is expected — the Cloud Function in 02-04 sets it; for the spike with a manually-created user, role is missing — that's fine.)
    5. **FAIL:** `VERIFY FAILED: auth/session-cookie-expired` or `auth/invalid-id-token` — try a fresh login. If still failing, investigate before continuing.

    **Check 5 — signOut revokes + clears:**
    1. While logged in, hit `POST /api/auth/logout` from DevTools Console: `fetch('/api/auth/logout', {method:'POST'}).then(r => r.status)`.
    2. **PASS:** Response is 200 or 204. `document.cookie` no longer has `__session` (verify by reloading; the cookie should be cleared by the next response if it was Set-Cookie cleared).
    3. **FAIL:** 404 (logout endpoint not wired) — `next-firebase-auth-edge` may need explicit logout route handler. Check the upstream docs and add the route stub.

    **Check 6 — Revocation gate:**
    1. Log in fresh, copy the cookie value.
    2. In Firebase Console → Authentication → Users, find the test user, click → Disable account.
       *Alternative if Firebase Console disable button isn't available:* run a one-off Admin SDK script:
       ```bash
       npx tsx -e "import('firebase-admin/app').then(({initializeApp,cert})=>{const app=initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g,'\\n')})});require('firebase-admin/auth').getAuth(app).updateUser('<USER_UID>',{disabled:true}).then(()=>console.log('disabled'))})"
       ```
    3. Run `npm run spike:verify-session "<the-cookie-from-step-1>"`.
    4. **PASS:** Output is `VERIFY FAILED: auth/user-disabled` (or similar). The cookie still parses but verification rejects it.
    5. **FAIL:** Cookie still decodes successfully — revocation didn't propagate. Check that `verifySessionCookie(cookie, true)` is called with the second arg (revocation flag).
    6. **Cleanup:** Re-enable the test user in Firebase Console.

    **Teardown after all 6 checks:**
    ```
    rm proxy.ts
    rm app/api/auth/spike-session/route.ts
    ```
    DO NOT commit `proxy.ts` or any spike-only handlers. The real `proxy.ts` lands in 02-02.

    Report results in resume-signal: "PASS all 6" / "FAIL on check N: <reason>" / mixed results.
  </how-to-verify>
  <resume-signal>Type one of: "PASS all 6" (proceed to 02-02 as planned with authMiddleware) / "FAIL check N: <reason>" / "PASS 1-X, FAIL Y-Z" (we'll discuss fallback). Then proceed to Task 3 regardless of outcome — Task 3 records the findings.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Write FINDINGS.md and clean up spike artifacts</name>
  <files>
    .planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md,
    proxy.ts,
    app/api/auth/spike-session/route.ts
  </files>
  <read_first>
    - .planning/spikes/next-firebase-auth-edge-v1.12/README.md (acceptance criteria list — must mirror these in FINDINGS.md)
    - .planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts (the code being tested)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md `<specifics>` last bullet (fallback path: hand-rolled `admin.auth().createSessionCookie()` + custom Route Handlers)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"Risks the spike must resolve" lines 1988-1992
    - CLAUDE.md "CLAIM.md Lifecycle" section (Verification section requirements)
  </read_first>
  <action>
    Write the findings note and remove spike-only files from repo root.

    **Step 3.1 — Create `.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md`:**

    Template — substitute outcomes from Task 2's resume-signal.

    ```markdown
    # Findings: next-firebase-auth-edge v1.12 spike

    **Run date:** {YYYY-MM-DD}
    **Spike duration:** {actual hours}
    **Stack:** Next 16.2.6, firebase ^12.13, firebase-admin ^13, next-firebase-auth-edge v1.12.x
    **Firebase project:** cy-eventsystem (single project per D-03)

    ## Acceptance Criteria

    | # | Check | Result | Notes |
    |---|-------|--------|-------|
    | 1 | Cookie creation round-trip | PASS / FAIL | {Set-Cookie header observed? cookie name? maxAge? Any anomalies?} |
    | 2 | proxy.ts allows authenticated requests | PASS / FAIL | {Did /inventory render with valid cookie?} |
    | 3 | proxy.ts blocks anonymous requests | PASS / FAIL | {307 to /login confirmed?} |
    | 4 | verifySession() returns decoded claims | PASS / FAIL | {uid + email matched? role was missing (expected — Cloud Function will set it)} |
    | 5 | signOut revokes + clears | PASS / FAIL | {200/204 returned? cookie cleared?} |
    | 6 | Revocation gate (disabled user) | PASS / FAIL | {auth/user-disabled error on next verify?} |

    ## Overall Decision

    **{PROCEED_AS_PLANNED | FALLBACK_HAND_ROLLED}**

    {If PROCEED: 02-02 implements `proxy.ts` exactly as in `proxy.spike.ts`. The library works.}

    {If FALLBACK: 02-02 swaps to hand-rolled session-cookie management. Specifics:
    - Replace `authMiddleware` import with direct cookie check in proxy.ts (see RESEARCH §1.4 fallback note).
    - Replace `loginPath` auto-handling with explicit `app/api/auth/session/route.ts` that calls `admin.auth().createSessionCookie(idToken, {expiresIn: 5*24*60*60*1000})` and sets the cookie manually.
    - Replace `getTokens()` in DAL with direct `cookies().get('__session')?.value` → `adminAuth.verifySessionCookie(value, true)`.
    - All 6 acceptance criteria can still be met with the hand-rolled approach; it's just more code.
    }

    ## Anomalies / Surprises

    {Anything unexpected during the spike — log it. Examples:
    - Cookie name conflict with Firebase Hosting reserved __session
    - Multi-tab IndexedDB persistence warnings
    - TypeScript errors in the library types
    - Race conditions in the proxy → API handler chain
    - Edge runtime warnings (if any — should NOT happen per Next 16 proxy spec)
    }

    ## Spike Code Disposition

    - `proxy.spike.ts`: keep in `.planning/spikes/` for reference. Will be the basis for the real `proxy.ts` in 02-02.
    - `verify-session.spike.ts`: keep — still useful as a debugging helper post-Phase-2.
    - `proxy.ts` (root, spike copy): DELETED after spike.
    - `app/api/auth/spike-session/route.ts` (stub): DELETED after spike.
    - `npm run spike:verify-session` script: keep.

    ## Test User

    {Document the test user's uid + email here (NOT the password). The 02-04 `seed-first-admin.ts` script will replace this user with the real first admin.}

    ## Next Step

    Proceed to 02-02-firebase-clients-and-proxy-PLAN.md.
    ```

    **Step 3.2 — Remove spike-only root files:**

    ```bash
    rm -f proxy.ts
    rm -rf app/api/auth/spike-session/
    ```

    Both files (if they exist) were temporary copies for the spike. The real versions land in 02-02.

    **Step 3.3 — If spike FAILED, append a "Fallback Tasks for 02-02" section to FINDINGS.md** listing the exact deltas needed in 02-02:
    - Replace authMiddleware import with raw cookie check in proxy.ts
    - Implement /api/auth/session/route.ts manually with createSessionCookie + cookies().set
    - Implement /api/auth/logout/route.ts manually with revokeRefreshTokens + cookies().delete
    - Update DAL to use cookies().get('__session') directly instead of getTokens()

    These will be wired into 02-02 as REVISED action text when this phase's plans are re-read by the executor.

    **Step 3.4 — Update PROJECT.md or STATE.md** (whichever has the Phase 2 progress section) with:
    > Spike D-01 completed {date}: result = {PROCEED | FALLBACK}. See `.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md`.
  </action>
  <acceptance_criteria>
    - File `.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md` exists.
    - FINDINGS.md contains `## Acceptance Criteria` section.
    - FINDINGS.md contains `## Overall Decision` section with `PROCEED_AS_PLANNED` OR `FALLBACK_HAND_ROLLED`.
    - FINDINGS.md contains `## Test User` section (uid + email captured; no password).
    - No `proxy.ts` file exists at repo root (`test -f proxy.ts` returns non-zero).
    - No `app/api/auth/spike-session/` directory exists (`test -d app/api/auth/spike-session` returns non-zero).
    - `.planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts` STILL exists (kept as reference for 02-02).
    - `.planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts` STILL exists.
    - Either PROJECT.md OR STATE.md mentions "Spike D-01 completed" (`grep -l 'Spike D-01 completed' .planning/PROJECT.md .planning/STATE.md` returns at least one match).
  </acceptance_criteria>
  <verify>
    <automated>test -f .planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md && grep -q "Acceptance Criteria" .planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md && grep -qE "(PROCEED_AS_PLANNED|FALLBACK_HAND_ROLLED)" .planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md && ! test -f proxy.ts && ! test -d app/api/auth/spike-session</automated>
  </verify>
  <done>FINDINGS.md committed with PROCEED/FALLBACK decision. All spike-only repo-root files deleted. 02-02 reads FINDINGS.md before starting and adjusts its proxy.ts and route-handler tasks accordingly. Phase 2 unblocked.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → /api/auth/session | Untrusted ID token; verified via admin.auth().verifyIdToken before issuing session cookie |
| Browser → /(app)/* | Untrusted `__session` cookie; verified via verifySessionCookie(cookie, true) on every Server-side read |
| Cloud Function → Firestore | Trusted server-side; bypasses rules — this is the only intended path for transactions writes |
| Service-account JSON → repo | NEVER cross — `.env.local` is gitignored; FIREBASE_PRIVATE_KEY only exists in env (CLAUDE.md secrets gate) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01-01 | Information disclosure | `.env.local` accidentally committed | mitigate | `.env.local` in `.gitignore`; CLAUDE.md global rule "Never read .env.local without user instruction" |
| T-02-01-02 | Tampering | `__session` cookie value modified by client | mitigate | Cookie signed via `AUTH_COOKIE_SIGNATURE_KEY_CURRENT` (32+ random bytes); verifySessionCookie rejects forgeries |
| T-02-01-03 | Elevation of privilege | Spike user grants self admin via custom claims | accept | Spike user is a manual one-off; 02-04 Cloud Function sets claims from Firestore role; not an attack surface in spike phase |
| T-02-01-04 | Information disclosure | proxy.ts logs print cookies / tokens | mitigate | `console.error("[spike proxy error]", error)` logs error object only, not raw cookies; verify during spike that no PII leaks |
| T-02-01-05 | Repudiation | Spike test user actions not logged | accept | Spike is throwaway; no audit log needed; the test user is removed after spike |
| T-02-01-06 | Denial of service | Spike accidentally locks out the test user | accept | Test user can be re-enabled via Firebase Console; spike is dev-environment only |
</threat_model>

<verification>
- `.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md` exists with PASS/FAIL on all 6 criteria.
- No leftover spike files at repo root (`! test -f proxy.ts && ! test -d app/api/auth/spike-session`).
- `next-firebase-auth-edge` and `tsx` are committed to package.json.
- Either FINDINGS.md says PROCEED_AS_PLANNED (02-02 uses authMiddleware) OR says FALLBACK_HAND_ROLLED (02-02 swaps to hand-rolled session cookies — fallback tasks listed in FINDINGS.md).
- PROJECT.md or STATE.md notes the spike outcome and date.
- CLAIM.md for phase-kayinleong-02 updated with the spike result.
- CHANGELOG.md entry recorded for D-06 (rules unit tests skipped) since this is the first plan in the phase to commit — per RESEARCH.md `Risks the planner to flag` #7.
</verification>

<success_criteria>
- D-01 spike complete: 6 acceptance criteria answered (PASS or FAIL).
- AUTH-01, AUTH-02, AUTH-05, AUTH-09 directly tested in the spike (sign-in, session persistence, sign-out, revocation gate).
- NFR-07 (server-only Admin SDK) and NFR-08 (proxy.ts not middleware.ts) verified at scaffolding level.
- 02-02 has a clear, unambiguous path forward — either "use authMiddleware exactly as in proxy.spike.ts" OR "fall back to hand-rolled session cookies per the FINDINGS.md fallback section".
- Throwaway spike artifacts cleaned up; no leakage into production paths.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-01-spike-auth-edge-SUMMARY.md` documenting: spike outcome (PASS/FAIL per check), recommended path for 02-02 (proceed or fallback), env-var inventory (names only, no values), and any anomalies observed during the spike. The summary should be ≤ 80 lines.
</output>
