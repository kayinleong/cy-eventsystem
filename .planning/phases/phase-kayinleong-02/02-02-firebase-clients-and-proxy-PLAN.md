---
phase: phase-kayinleong-02
plan: 02
type: execute
wave: 2
depends_on:
  - 01
files_modified:
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
  - .gitignore
  - CHANGELOG.md
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-05
  - AUTH-09
  - INT-04
  - INT-05
  - NFR-06
  - NFR-07
  - NFR-08
  - NFR-09
  - RES-01
  - RES-03

must_haves:
  truths:
    - "Server-only Admin SDK initializes from FIREBASE_* env vars and never bundles into client chunks."
    - "Client Web SDK initializes once, with persistent IndexedDB cache enabled per D-19."
    - "proxy.ts at repo root (Node runtime, NOT middleware.ts) gates routes by __session cookie presence."
    - "Session route handler creates __session cookie from a verified ID token; logout route revokes refresh tokens and clears the cookie."
    - "verifySession/requireSession/requireAdmin DAL exports memoize per-request via React.cache and reject revoked tokens via verifySessionCookie(cookie, true)."
    - "firestore.rules deploys with a deny-by-default skeleton + per-collection rules from RESEARCH §firestore.rules skeleton."
    - "firestore.indexes.json contains all 12 indexes pre-declared per D-18."
    - "storage.rules deploys with admin-write + signed-in-read on items/{itemId}/photo.jpg."
    - "CHANGELOG.md records D-06 (rules unit tests skipped in v1) per RESEARCH risk #7."
  artifacts:
    - path: "lib/firebase/admin.ts"
      provides: "Server-only Admin SDK singleton: adminAuth, adminDb, adminStorage"
      contains: "import 'server-only'"
    - path: "lib/firebase/client.ts"
      provides: "Web SDK singleton with persistentLocalCache: auth, db, storage"
      contains: "persistentLocalCache"
    - path: "lib/auth/dal.ts"
      provides: "verifySession, requireSession, requireAdmin DAL"
      contains: "cache(async ()"
    - path: "proxy.ts"
      provides: "Node-runtime proxy that gates protected routes by __session cookie presence"
      contains: "export async function proxy"
    - path: "app/api/auth/session/route.ts"
      provides: "POST endpoint that exchanges ID token for __session cookie"
      contains: "createSessionCookie"
    - path: "app/api/auth/logout/route.ts"
      provides: "POST endpoint that revokes refresh tokens + clears cookie"
      contains: "revokeRefreshTokens"
    - path: "firestore.rules"
      provides: "Deny-by-default rules + per-collection allow rules"
      contains: "match /{document=**}"
    - path: "firestore.indexes.json"
      provides: "12 pre-declared composite indexes per D-18"
      contains: "isLowStock"
    - path: "storage.rules"
      provides: "items/{itemId}/photo.jpg rules per D-13"
      contains: "request.auth.token.role"
    - path: "firebase.json"
      provides: "Firebase CLI deploy config: rules + indexes + storage + functions"
      contains: "firestore.rules"
    - path: "CHANGELOG.md"
      provides: "Phase 2 entry with D-06 callout"
      contains: "rules unit tests skipped"
  key_links:
    - from: "lib/auth/dal.ts"
      to: "lib/firebase/admin.ts"
      via: "verifySession() calls adminAuth.verifySessionCookie(cookie, true)"
      pattern: "verifySessionCookie\\(.*true\\)"
    - from: "proxy.ts"
      to: "next/server"
      via: "Optimistic cookie check; passes through if __session present, redirects to /login if absent"
      pattern: "__session"
    - from: "app/api/auth/session/route.ts"
      to: "lib/firebase/admin.ts"
      via: "Verifies ID token then creates session cookie via Admin SDK"
      pattern: "createSessionCookie"
    - from: ".planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md"
      to: "proxy.ts + DAL implementation choice"
      via: "If spike PROCEED, use authMiddleware; if FALLBACK, use raw cookie check + manual createSessionCookie"
      pattern: "PROCEED|FALLBACK"
---

<objective>
**Block A foundation.** Stand up the Firebase clients (Web + Admin SDK), the `proxy.ts` cookie gate, the session-cookie Route Handlers, the DAL (`verifySession`/`requireSession`/`requireAdmin`), and the initial security manifests (`firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firebase.json`). After this plan: any Server Component or Server Action can call `verifySession()` and trust the returned `Session`.

Purpose: Replace Phase 1's mock-cookie role gate with real Firebase Auth without changing the role-gate surface. Per RESEARCH lines 80-85, "the mock cookie payload shape mirrors `__session` decoded shape, so only the cookie-decoder swaps — not the role-gate."

Output: 13 files. After this plan, `proxy.ts` exists at repo root, `lib/firebase/*` is in place, the DAL is callable, and Firebase rules + indexes ship via `firebase deploy --only firestore,storage` (developer runs the deploy command at the end of Task 5).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/phase-kayinleong-02/02-CONTEXT.md
@.planning/phases/phase-kayinleong-02/02-RESEARCH.md
@.planning/phases/phase-kayinleong-02/02-PATTERNS.md
@.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md
@.planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts
@.planning/research/ARCHITECTURE.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md
@.planning/phases/phase-kayinleong-01/01-04-auth-shell-role-gate-SUMMARY.md
@lib/auth/mock-session.ts
@lib/types/session.ts
@lib/types/user.ts
@package.json
@.gitignore

<interfaces>
<!-- Contracts this plan creates that all subsequent plans depend on. -->

```typescript
// lib/firebase/admin.ts — server-only Admin SDK singleton
export const adminAuth: import("firebase-admin/auth").Auth;
export const adminDb: import("firebase-admin/firestore").Firestore;
export const adminStorage: import("firebase-admin/storage").Storage;

// lib/firebase/client.ts — Web SDK singleton (Client Components only)
export const auth: import("firebase/auth").Auth;
export const db: import("firebase/firestore").Firestore;
export const storage: import("firebase/storage").FirebaseStorage;

// lib/auth/dal.ts — the DAL all (app) routes use
export type Session = {
  uid: string;
  email: string;
  displayName: string;
  role: "admin" | "staff";
  disabled: boolean;  // always false when returned (we revoke disabled sessions)
};
export const verifySession: () => Promise<Session | null>;     // wrapped in React.cache
export const requireSession: () => Promise<Session>;            // redirects to /login if null
export const requireAdmin: () => Promise<Session>;              // redirects to /unauthorized if not admin

// lib/auth/roles.ts — pure utilities
export function isAdmin(session: Session | null): boolean;
export function canEditEvent(session: Session, event: {teamLeads: string[]}): boolean;

// proxy.ts — exported at repo root (NOT middleware.ts)
export async function proxy(request: NextRequest): Promise<NextResponse>;
export const config: { matcher: string[] };

// app/api/auth/session/route.ts
export async function POST(req: Request): Promise<Response>; // {idToken} → Set-Cookie __session

// app/api/auth/logout/route.ts
export async function POST(): Promise<Response>; // revokeRefreshTokens + clear cookie
```
</interfaces>

<spike_outcome_branch>
**Before starting, read `.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md` `## Overall Decision` section.**

- **If `PROCEED_AS_PLANNED`:** Tasks below use `authMiddleware` from `next-firebase-auth-edge` + `getTokens()` in the DAL. The library auto-handles `loginPath`/`logoutPath` cookie set/clear; our `app/api/auth/session/route.ts` and `/logout/route.ts` are thin pass-throughs.
- **If `FALLBACK_HAND_ROLLED`:** Tasks below swap to direct Admin SDK calls. proxy.ts uses raw `request.cookies.get('__session')?.value` presence check (no `authMiddleware`); `/api/auth/session/route.ts` manually calls `adminAuth.createSessionCookie(idToken, {expiresIn: ...})` and sets the cookie; DAL uses `cookies().get('__session')?.value` + `adminAuth.verifySessionCookie(value, true)` directly.

Both branches end up with the SAME public DAL interface (`verifySession`/`requireSession`/`requireAdmin`) — the implementation differs internally.
</spike_outcome_branch>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Firebase SDK singletons + env-example + gitignore</name>
  <files>
    lib/firebase/client.ts,
    lib/firebase/admin.ts,
    lib/auth/roles.ts,
    .env.example,
    .gitignore
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §1.2 (client.ts excerpt lines 146-186), §1.3 (admin.ts excerpt lines 190-216)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §2 rows "lib/firebase/admin.ts" + "lib/firebase/client.ts"
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-19 (offline persistence)
    - .planning/research/STACK.md (firebase ^12.13, firebase-admin ^13 version pins)
    - .planning/research/PITFALLS.md C6 (Admin SDK on Edge)
    - lib/types/session.ts (Session type already exists — DO NOT redefine)
    - .gitignore (current contents)
    - package.json (verify firebase + firebase-admin are listed; install if not)
  </read_first>
  <action>
    **Step 1.1 — Verify dependencies are installed:**

    ```bash
    grep -E '"firebase"' package.json && grep -E '"firebase-admin"' package.json
    ```

    Both must be present. If not:

    ```bash
    npm i firebase firebase-admin
    ```

    Version targets: `firebase ^12.13.0`, `firebase-admin ^13.0.0` per RESEARCH.md.

    **Step 1.2 — Create `lib/firebase/client.ts`** (Web SDK singleton with persistent IndexedDB cache):

    ```typescript
    // lib/firebase/client.ts
    // Per RESEARCH §1.2 (lines 146-186). D-19: persistent cache enabled globally.
    // CRITICAL: Use initializeFirestore + persistentLocalCache (NOT enableIndexedDbPersistence
    // — that API is deprecated since firebase ^10). Same effect, modern API.

    import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
    import { getAuth } from "firebase/auth";
    import {
      initializeFirestore,
      persistentLocalCache,
      persistentSingleTabManager,
      type Firestore,
    } from "firebase/firestore";
    import { getStorage } from "firebase/storage";

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

    // Single-tab manager: 20x faster query path per upstream issue #7347.
    // Multi-tab caveat: opening the app in a second tab falls back to memory-only.
    // Acceptable for v1 sole-developer / single-user workflow (RESEARCH §1.2 multi-tab note).
    const db: Firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager({}),
      }),
    });

    export const auth = getAuth(app);
    export const storage = getStorage(app);
    export { db };
    ```

    NOTE — **DO NOT add `import 'server-only'`** to this file. It is imported by Client Components.

    **Step 1.3 — Create `lib/firebase/admin.ts`** (Admin SDK, server-only):

    ```typescript
    // lib/firebase/admin.ts
    // Per RESEARCH §1.3 (lines 190-216). PITFALLS C6 — must be server-only.
    import "server-only";
    import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
    import { getAuth } from "firebase-admin/auth";
    import { getFirestore } from "firebase-admin/firestore";
    import { getStorage } from "firebase-admin/storage";

    const app: App =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // FIREBASE_PRIVATE_KEY is stored quoted with literal \n; unescape at runtime.
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });

    export const adminAuth = getAuth(app);
    export const adminDb = getFirestore(app);
    export const adminStorage = getStorage(app);
    ```

    The `import "server-only"` MUST be the first non-comment line — any client component that accidentally imports this file gets a build-time error.

    **Step 1.4 — Create `lib/auth/roles.ts`** (centralized authorization helpers):

    ```typescript
    // lib/auth/roles.ts
    import "server-only";
    import type { Session } from "@/lib/types/session";

    export function isAdmin(session: Session | null): boolean {
      return session?.role === "admin";
    }

    /**
     * canEditEvent — admin OR team-lead of this specific event.
     * Used by /events/[eventId]/edit and updateEvent Server Action.
     * Note: backupTeams members CANNOT edit (only checkout/checkin via EVT-08).
     */
    export function canEditEvent(
      session: Session,
      event: { teamLeads: string[] },
    ): boolean {
      if (session.role === "admin") return true;
      return event.teamLeads.includes(session.uid);
    }
    ```

    **Step 1.5 — Create `.env.example`** at repo root. This is COMMITTED to git (the real `.env.local` is gitignored):

    ```
    # .env.example — copy to .env.local (gitignored) and fill in real values.
    # Per RESEARCH §1.1 lines 128-141.

    # Public (client-bundled) Firebase config
    NEXT_PUBLIC_FIREBASE_API_KEY=
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<project-id>.firebasestorage.app
    NEXT_PUBLIC_FIREBASE_APP_ID=

    # Public app URL (used in actionCodeSettings.url for invite/reset links)
    NEXT_PUBLIC_APP_URL=http://localhost:3000

    # Private (server-only) Admin SDK credentials
    # Generate via Firebase Console -> Project Settings -> Service accounts -> Generate new private key.
    # IMPORTANT: FIREBASE_PRIVATE_KEY is double-quoted; literal \n is unescaped at runtime via .replace().
    FIREBASE_PROJECT_ID=<project-id>
    FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@<project-id>.iam.gserviceaccount.com
    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

    # Cookie signature keys (per next-firebase-auth-edge). Generate via: openssl rand -base64 32
    AUTH_COOKIE_SIGNATURE_KEY_CURRENT=
    AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS=

    # Cookie security toggle (true in prod, false in localhost dev)
    USE_SECURE_COOKIES=false
    ```

    **Step 1.6 — Verify `.gitignore`** contains `.env.local` and `.env*.local`:

    ```bash
    grep -qE '^\.env\.local|\.env\*?\.local|\.env\.\*\.local' .gitignore
    ```

    If missing, append:

    ```
    # Environment - per CLAUDE.md secrets hygiene
    .env.local
    .env.*.local
    ```

    Also add (one-off scratch ignore for service-account JSON in case developer drops it in repo):

    ```
    firebase-adminsdk-*.json
    *-service-account.json
    ```
  </action>
  <acceptance_criteria>
    - `test -f lib/firebase/client.ts` succeeds.
    - `head -1 lib/firebase/admin.ts | grep -q 'import "server-only"'` succeeds.
    - `head -1 lib/firebase/client.ts | grep -q 'import "server-only"'` FAILS (client.ts must NOT be server-only — it's imported by Client Components).
    - `grep -q 'persistentLocalCache' lib/firebase/client.ts` succeeds.
    - `grep -q 'persistentSingleTabManager' lib/firebase/client.ts` succeeds.
    - `grep -q 'process.env.FIREBASE_PRIVATE_KEY' lib/firebase/admin.ts` succeeds.
    - `grep -q "replace(/\\\\\\\\n/g," lib/firebase/admin.ts` succeeds (the `.replace(/\\n/g, '\n')` private-key unescape).
    - `test -f lib/auth/roles.ts` succeeds; `grep -q 'export function isAdmin' lib/auth/roles.ts` succeeds; `grep -q 'export function canEditEvent' lib/auth/roles.ts` succeeds.
    - `test -f .env.example` succeeds; `grep -q 'NEXT_PUBLIC_FIREBASE_API_KEY' .env.example` succeeds; `grep -q 'FIREBASE_CLIENT_EMAIL' .env.example` succeeds; `grep -q 'AUTH_COOKIE_SIGNATURE_KEY_CURRENT' .env.example` succeeds.
    - `grep -qE '^\.env\.local' .gitignore` succeeds.
    - `grep -q 'firebase-adminsdk-\*\.json' .gitignore` succeeds.
    - `npx tsc --noEmit` exits 0 (the new files type-check).
  </acceptance_criteria>
  <verify>
    <automated>head -1 lib/firebase/admin.ts | grep -q 'import "server-only"' && grep -q 'persistentLocalCache' lib/firebase/client.ts && test -f .env.example && grep -qE '^\.env\.local' .gitignore && npx tsc --noEmit</automated>
  </verify>
  <done>Web SDK + Admin SDK singletons in place. `.env.example` committed; `.env.local` gitignored. roles.ts helper compiled.</done>
</task>

<task type="auto">
  <name>Task 2: DAL (lib/auth/dal.ts) + proxy.ts + session route handlers</name>
  <files>
    lib/auth/dal.ts,
    proxy.ts,
    app/api/auth/session/route.ts,
    app/api/auth/logout/route.ts
  </files>
  <read_first>
    - .planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md (PROCEED vs FALLBACK — controls which code paths apply)
    - .planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts (the spike's working code; basis for proxy.ts)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §1.4 (proxy.ts), §1.5 (spike criteria), §1.6 (DAL excerpt lines 308-374), §"Token revocation timing" (lines 1730-1737)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §4 excerpts D (DAL with React.cache) and E (proxy.ts shape)
    - lib/auth/mock-session.ts (the Phase 1 surface we are replacing — match the three export names exactly: getMockSession→getSession, requireSession, requireAdmin)
    - lib/types/session.ts (Session type)
    - lib/types/user.ts (UserRole type — used in DAL fallback path)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md (Next 16 proxy spec — must be named `proxy`, Node runtime)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md (Route Handler API — async cookies)
    - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unauthorized.md (Next 16 `unauthorized()` function)
  </read_first>
  <action>
    **Branch decision:** Read `.planning/spikes/next-firebase-auth-edge-v1.12/FINDINGS.md` first. The `## Overall Decision` section says either `PROCEED_AS_PLANNED` or `FALLBACK_HAND_ROLLED`. Implement the matching variant below.

    **Step 2.1 — Create `proxy.ts` at repo root.**

    **PROCEED variant (spike succeeded with authMiddleware):**

    Copy the contents of `.planning/spikes/next-firebase-auth-edge-v1.12/proxy.spike.ts` to `proxy.ts` at repo root, verbatim. The file is already verified-working from the spike. Final content (RESEARCH lines 222-282):

    ```typescript
    // proxy.ts — repo root. NOT middleware.ts (Next 16 renamed). Node runtime by default.
    // Per RESEARCH §1.4 + spike FINDINGS.md PROCEED variant.
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
          console.error("auth proxy error:", error);
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

    **FALLBACK variant (spike failed):**

    Use the raw cookie-presence check from PATTERNS §4 excerpt E (lines 470-512):

    ```typescript
    // proxy.ts — repo root. NOT middleware.ts.
    // Per RESEARCH §1.4 + spike FINDINGS.md FALLBACK variant.
    // Optimistic cookie-presence check only. Per-request cookie verification
    // happens in lib/auth/dal.ts via verifySessionCookie(cookie, true).
    import { NextResponse, type NextRequest } from "next/server";

    const PUBLIC_PATHS = ["/login", "/forgot-password", "/set-password"];

    export function proxy(request: NextRequest) {
      const session = request.cookies.get("__session")?.value;
      const pathname = request.nextUrl.pathname;
      const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

      if (!session && !isPublic) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
      if (session && isPublic) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    export const config = {
      matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)",
      ],
    };
    ```

    **CRITICAL — neither variant exports `runtime`**. Next 16 proxy is Node-only by spec (PITFALLS P3). Adding `export const runtime = 'edge'` or similar causes a build error.

    **Step 2.2 — Create `lib/auth/dal.ts`.**

    **PROCEED variant** (uses `getTokens` from `next-firebase-auth-edge`):

    ```typescript
    // lib/auth/dal.ts
    // Per RESEARCH §1.6 (lines 308-374) + PATTERNS §4 excerpt D.
    // Same three exports as Phase 1's lib/auth/mock-session.ts so 15 import sites
    // change only their import path. PROCEED variant — uses getTokens helper.
    import "server-only";
    import { cache } from "react";
    import { cookies } from "next/headers";
    import { redirect } from "next/navigation";
    import { unauthorized } from "next/navigation";
    import { getTokens } from "next-firebase-auth-edge";
    import { adminAuth, adminDb } from "@/lib/firebase/admin";
    import type { Session } from "@/lib/types/session";
    import type { UserRole } from "@/lib/types/user";

    const COOKIE_OPTS = {
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
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    };

    /**
     * verifySession — decodes the __session cookie with revocation check.
     * React.cache() memoizes per-request so multiple Server Components + the
     * Server Action layer share one decode.
     */
    export const verifySession = cache(async (): Promise<Session | null> => {
      const cookieStore = await cookies(); // Next 16: async
      const tokens = await getTokens(cookieStore, COOKIE_OPTS);
      if (!tokens) return null;

      // Re-verify with revocation flag (next-firebase-auth-edge getTokens
      // returns null on most failures but we want explicit revocation check
      // matching AUTH-09).
      let decoded;
      try {
        decoded = await adminAuth.verifySessionCookie(tokens.token, true);
      } catch {
        return null;
      }

      // Role lives on the token via Cloud Function (D-02 / plan 02-04).
      // For brand-new users whose token predates the function execution,
      // `role` may be missing — fall through to users/{uid} fetch.
      let role = (decoded.role as UserRole | undefined) ?? null;
      let displayName = (decoded.name as string | undefined) ?? null;
      let disabled = false;

      if (!role || !displayName) {
        const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
        const data = userDoc.data();
        role = (data?.role as UserRole) ?? "staff";
        displayName = data?.displayName ?? decoded.email ?? "Unknown";
        disabled = data?.disabled === true;
      }

      if (disabled) {
        // AUTH-09: revoke + return null. Next request hits handleInvalidToken in proxy.ts.
        await adminAuth.revokeRefreshTokens(decoded.uid);
        return null;
      }

      return {
        uid: decoded.uid,
        email: decoded.email ?? "",
        displayName: displayName ?? decoded.email ?? "Unknown",
        role: role ?? "staff",
        disabled: false,
      };
    });

    /** Phase 1 parity alias — same name as mock-session.ts's getMockSession. */
    export const getSession = verifySession;

    export async function requireSession(): Promise<Session> {
      const session = await verifySession();
      if (!session) redirect("/login");
      return session;
    }

    export async function requireAdmin(): Promise<Session> {
      const session = await requireSession();
      if (session.role !== "admin") unauthorized();
      return session;
    }
    ```

    **FALLBACK variant** — same DAL public API but reads cookie directly:

    ```typescript
    // ... same imports except remove getTokens import; keep everything else
    // Inside verifySession:
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (!sessionCookie) return null;
    let decoded;
    try {
      decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch {
      return null;
    }
    // ... rest unchanged
    ```

    **In both variants:** export `getSession`, `verifySession`, `requireSession`, `requireAdmin` with identical signatures.

    **Step 2.3 — Create `app/api/auth/session/route.ts`** (POST: exchanges ID token for __session cookie).

    **PROCEED variant** (authMiddleware auto-handles cookie set; this is a thin pass-through):

    ```typescript
    // app/api/auth/session/route.ts
    // PROCEED variant: next-firebase-auth-edge authMiddleware intercepts POST to loginPath
    // BEFORE this handler runs, so this handler is effectively a no-op return.
    // We still ship the file so the matcher in proxy.ts has a real route to attach to.
    export async function POST(): Promise<Response> {
      return new Response(null, { status: 204 });
    }
    ```

    **FALLBACK variant** (manual cookie set):

    ```typescript
    // app/api/auth/session/route.ts
    // FALLBACK variant: manually create session cookie from verified ID token.
    import "server-only";
    import { NextResponse, type NextRequest } from "next/server";
    import { cookies } from "next/headers";
    import { adminAuth } from "@/lib/firebase/admin";

    export async function POST(req: NextRequest): Promise<Response> {
      const authHeader = req.headers.get("authorization");
      const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 400 });

      try {
        // Verify the ID token is current and from our project
        await adminAuth.verifyIdToken(idToken, true);
        // Create the session cookie (5-day expiry per AUTH-02)
        const expiresIn = 5 * 24 * 60 * 60 * 1000;
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        const cookieStore = await cookies();
        cookieStore.set("__session", sessionCookie, {
          httpOnly: true,
          secure: process.env.USE_SECURE_COOKIES === "true",
          sameSite: "lax",
          path: "/",
          maxAge: expiresIn / 1000,
        });
        return new Response(null, { status: 204 });
      } catch (err) {
        console.error("session create failed:", err);
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }
    ```

    **Step 2.4 — Create `app/api/auth/logout/route.ts`** (POST: revoke + clear).

    Both variants need this; the logic is identical regardless of spike outcome since authMiddleware does NOT auto-revoke refresh tokens (only clears the cookie).

    ```typescript
    // app/api/auth/logout/route.ts
    // POST → revoke refresh tokens (AUTH-09) + clear __session cookie.
    import "server-only";
    import { NextResponse } from "next/server";
    import { cookies } from "next/headers";
    import { adminAuth } from "@/lib/firebase/admin";

    export async function POST(): Promise<Response> {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("__session")?.value;

      if (sessionCookie) {
        try {
          // Decode (without revocation check) just to learn the uid
          const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);
          await adminAuth.revokeRefreshTokens(decoded.uid);
        } catch {
          // Cookie was already invalid — that's fine; we still clear it below.
        }
      }
      cookieStore.delete("__session");
      return new Response(null, { status: 204 });
    }
    ```

    **Step 2.5 — Also need `app/unauthorized.tsx`** (Next 16's `unauthorized()` navigation pairs with this). Phase 1 may already have `/unauthorized/page.tsx` — verify:

    ```bash
    test -f app/unauthorized.tsx || test -f app/\(app\)/unauthorized/page.tsx
    ```

    If neither exists, the DAL's `unauthorized()` call will 500 instead of rendering. Phase 1 created `app/(app)/unauthorized/page.tsx` per the role-gate SUMMARY — so this should already exist. If not, create a minimal one:

    ```typescript
    // app/unauthorized.tsx  (or use existing app/(app)/unauthorized/page.tsx)
    export default function UnauthorizedPage() {
      return (
        <main className="min-h-svh grid place-items-center p-6">
          <div className="max-w-md text-center space-y-2">
            <h1 className="text-2xl font-semibold">Not authorized</h1>
            <p className="text-muted-foreground">You don't have access to this page.</p>
            <a className="text-sm underline" href="/">Back to dashboard</a>
          </div>
        </main>
      );
    }
    ```

    Do NOT replace an existing Phase 1 implementation; only create if missing.
  </action>
  <acceptance_criteria>
    - `test -f proxy.ts` succeeds (file at repo root).
    - `test -f middleware.ts` FAILS (middleware.ts must NOT exist per Next 16 / NFR-08).
    - `grep -q 'export async function proxy(' proxy.ts || grep -q 'export function proxy(' proxy.ts` succeeds.
    - `grep -q "__session" proxy.ts` succeeds.
    - `grep -q 'export const runtime' proxy.ts` FAILS (no runtime export — Next 16 proxy is Node-only).
    - `test -f lib/auth/dal.ts` succeeds.
    - `head -1 lib/auth/dal.ts | grep -q 'import "server-only"'` succeeds.
    - `grep -q 'cache(async' lib/auth/dal.ts` succeeds (React.cache wrap).
    - `grep -qE 'verifySessionCookie\(.+,\s*true\)' lib/auth/dal.ts` succeeds (revocation check).
    - `grep -qE 'export (const|async function) verifySession' lib/auth/dal.ts` succeeds.
    - `grep -qE 'export (const|async function) (requireSession|getSession)' lib/auth/dal.ts` succeeds at least once.
    - `grep -qE 'export async function requireAdmin' lib/auth/dal.ts` succeeds.
    - `grep -q 'unauthorized()' lib/auth/dal.ts` succeeds.
    - `test -f app/api/auth/session/route.ts` succeeds; `grep -q 'export async function POST' app/api/auth/session/route.ts` succeeds.
    - `test -f app/api/auth/logout/route.ts` succeeds; `grep -q 'revokeRefreshTokens' app/api/auth/logout/route.ts` succeeds.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>test -f proxy.ts && ! test -f middleware.ts && head -1 lib/auth/dal.ts | grep -q 'import "server-only"' && grep -qE 'verifySessionCookie\(.+,\s*true\)' lib/auth/dal.ts && grep -q 'revokeRefreshTokens' app/api/auth/logout/route.ts && npx tsc --noEmit</automated>
  </verify>
  <done>DAL, proxy, and session route handlers in place. Next plan (02-03) wires the auth pages to call them.</done>
</task>

<task type="auto">
  <name>Task 3: Firestore rules + indexes + Storage rules + firebase.json</name>
  <files>
    firestore.rules,
    firestore.indexes.json,
    storage.rules,
    firebase.json
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"firestore.rules skeleton (D-06 mitigation)" lines 1821-1900
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"Storage rules (storage.rules per D-13)" lines 1797-1817
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"Index manifest (firestore.indexes.json per D-18)" lines 1744-1791
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §2.2 (firebase.json — lines 510-523)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-06 (deny-by-default + per-block audit), D-13 (storage rules), D-18 (indexes pre-declared)
    - .planning/research/ARCHITECTURE.md (collections schema: users, inventory, events, transactions, missingItems)
    - .planning/REQUIREMENTS.md INT-02 (rules enforce availableQty >= 0 and <= totalQty), INT-03 (no client writes to transactions), INT-05 (indexes in repo, no console auto-create)
  </read_first>
  <action>
    **Step 3.1 — Create `firestore.rules`** at repo root (deny-by-default + per-collection rules per RESEARCH §"firestore.rules skeleton" + D-06 mitigation):

    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {

        // -------- helpers --------
        function isSignedIn() { return request.auth != null; }
        function isAdmin() {
          return isSignedIn() && request.auth.token.role == 'admin';
        }
        function isMember(eventDoc) {
          return isSignedIn() && (
            request.auth.token.role == 'admin'
            || request.auth.uid in eventDoc.data.allowedStaff
          );
        }
        function untouched(field) {
          return !(field in request.resource.data) || request.resource.data[field] == resource.data[field];
        }

        // -------- users --------
        match /users/{uid} {
          // Any signed-in user can read their own doc; admins can read any.
          allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());
          // Only Admin SDK writes — block all client writes.
          // (Cloud Function 1 + Server Actions use Admin SDK and bypass rules.)
          allow create, update, delete: if false;
        }

        // -------- inventory --------
        match /inventory/{itemId} {
          allow read: if isSignedIn();
          // Per INT-02, INV-01..05 — admin-only create/delete; admin-only update with invariant.
          allow create, delete: if isAdmin();
          allow update: if isAdmin()
            && request.resource.data.availableQty is number
            && request.resource.data.availableQty >= 0
            && request.resource.data.availableQty <= request.resource.data.totalQty;
        }

        // -------- events --------
        match /events/{eventId} {
          allow read: if isSignedIn() && isMember(resource);
          allow create: if isSignedIn(); // EVT-01: admin or team lead — enforced in Server Action
          // Admin OR team lead can edit; allowedStaff cannot be modified from clients (Cloud Function manages it).
          allow update: if (isAdmin() || request.auth.uid in resource.data.teamLeads)
            && untouched('allowedStaff');
          allow delete: if isAdmin();
        }

        // -------- transactions (immutable, server-only writes per INT-03 + AUD-04) --------
        match /transactions/{txId} {
          allow read: if isSignedIn();
          allow create, update, delete: if false;
        }

        // -------- missingItems (server-only writes; MIS-01..04) --------
        match /missingItems/{missingId} {
          allow read: if isSignedIn();
          allow create, update, delete: if false;
        }

        // -------- catch-all deny-by-default (D-06 mitigation a) --------
        match /{document=**} {
          allow read, write: if false;
        }
      }
    }
    ```

    **Step 3.2 — Create `firestore.indexes.json`** at repo root (D-18 pre-declared indexes). Source: RESEARCH §"Index manifest" lines 1744-1791.

    ```json
    {
      "indexes": [
        {
          "collectionGroup": "transactions",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "eventId", "order": "ASCENDING" },
            { "fieldPath": "at", "order": "DESCENDING" }
          ]
        },
        {
          "collectionGroup": "transactions",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "itemId", "order": "ASCENDING" },
            { "fieldPath": "at", "order": "DESCENDING" }
          ]
        },
        {
          "collectionGroup": "transactions",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "actorUid", "order": "ASCENDING" },
            { "fieldPath": "at", "order": "DESCENDING" }
          ]
        },
        {
          "collectionGroup": "transactions",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "type", "order": "ASCENDING" },
            { "fieldPath": "at", "order": "DESCENDING" }
          ]
        },
        {
          "collectionGroup": "transactions",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "eventId", "order": "ASCENDING" },
            { "fieldPath": "type", "order": "ASCENDING" },
            { "fieldPath": "parentTxId", "order": "ASCENDING" },
            { "fieldPath": "at", "order": "DESCENDING" }
          ]
        },
        {
          "collectionGroup": "inventory",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "lifecycleState", "order": "ASCENDING" },
            { "fieldPath": "category", "order": "ASCENDING" },
            { "fieldPath": "name", "order": "ASCENDING" }
          ]
        },
        {
          "collectionGroup": "inventory",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "isLowStock", "order": "ASCENDING" },
            { "fieldPath": "name", "order": "ASCENDING" }
          ]
        },
        {
          "collectionGroup": "events",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "status", "order": "ASCENDING" },
            { "fieldPath": "startDate", "order": "ASCENDING" }
          ]
        },
        {
          "collectionGroup": "events",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "allowedStaff", "arrayConfig": "CONTAINS" },
            { "fieldPath": "status", "order": "ASCENDING" },
            { "fieldPath": "startDate", "order": "ASCENDING" }
          ]
        },
        {
          "collectionGroup": "missingItems",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "status", "order": "ASCENDING" },
            { "fieldPath": "reportedAt", "order": "DESCENDING" }
          ]
        },
        {
          "collectionGroup": "missingItems",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "eventId", "order": "ASCENDING" },
            { "fieldPath": "reportedAt", "order": "DESCENDING" }
          ]
        },
        {
          "collectionGroup": "users",
          "queryScope": "COLLECTION",
          "fields": [
            { "fieldPath": "role", "order": "ASCENDING" },
            { "fieldPath": "createdAt", "order": "DESCENDING" }
          ]
        }
      ],
      "fieldOverrides": []
    }
    ```

    **Step 3.3 — Create `storage.rules`** at repo root (D-13):

    ```
    rules_version = '2';
    service firebase.storage {
      match /b/{bucket}/o {
        match /items/{itemId}/photo.jpg {
          allow read: if request.auth != null;
          allow write: if request.auth != null
                       && request.auth.token.role == 'admin'
                       && request.resource.size < 5 * 1024 * 1024
                       && request.resource.contentType.matches('image/.*');
        }
        match /{allPaths=**} {
          allow read, write: if false;
        }
      }
    }
    ```

    **Step 3.4 — Create `firebase.json`** at repo root (RESEARCH §2.2 lines 510-523):

    ```json
    {
      "firestore": {
        "rules": "firestore.rules",
        "indexes": "firestore.indexes.json"
      },
      "storage": {
        "rules": "storage.rules"
      },
      "functions": [
        {
          "source": "functions",
          "codebase": "default",
          "runtime": "nodejs20"
        }
      ]
    }
    ```

    Note: the `functions/` directory does NOT exist yet — it lands in 02-04. `firebase deploy --only firestore` and `--only storage` will work today; `--only functions` won't until 02-04 ships.
  </action>
  <acceptance_criteria>
    - `test -f firestore.rules` succeeds.
    - First non-blank, non-comment, non-`rules_version` line in `firestore.rules` is `service cloud.firestore {`.
    - `grep -q "match /{document=\*\*}" firestore.rules` succeeds (catch-all deny rule).
    - `grep -A1 "match /{document=\*\*}" firestore.rules | grep -q "if false"` succeeds (deny-by-default).
    - `grep -q "availableQty >= 0" firestore.rules` succeeds (INT-02 invariant).
    - `grep -q "availableQty <= request.resource.data.totalQty" firestore.rules` succeeds.
    - `grep -q "array-contains" firestore.indexes.json || grep -q '"arrayConfig": "CONTAINS"' firestore.indexes.json` succeeds (events allowedStaff index).
    - `grep -q "isLowStock" firestore.indexes.json` succeeds (RP-02 / D-21 + P11).
    - Count of `"collectionGroup"` entries in `firestore.indexes.json` is at least 12: `grep -c '"collectionGroup"' firestore.indexes.json` is >= 12.
    - `test -f storage.rules` succeeds; `grep -q "request.auth.token.role == 'admin'" storage.rules` succeeds.
    - `grep -q "items/{itemId}/photo.jpg" storage.rules` succeeds (D-13 path).
    - `test -f firebase.json` succeeds; `grep -q '"functions"' firebase.json` succeeds; `grep -q 'nodejs20' firebase.json` succeeds.
    - `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json'))"` exits 0 (valid JSON).
    - `node -e "JSON.parse(require('fs').readFileSync('firebase.json'))"` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>test -f firestore.rules && grep -q "match /{document=\*\*}" firestore.rules && grep -q "isLowStock" firestore.indexes.json && grep -q "items/{itemId}/photo.jpg" storage.rules && node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json'))" && node -e "JSON.parse(require('fs').readFileSync('firebase.json'))"</automated>
  </verify>
  <done>Rules and indexes manifests committed. Developer can run `firebase deploy --only firestore,storage` after Task 5.</done>
</task>

<task type="auto">
  <name>Task 4: CHANGELOG.md entry for D-06 (rules unit tests skipped)</name>
  <files>CHANGELOG.md</files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-06 (rules unit tests SKIPPED + 3 mitigations)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"Risks the planner to flag" #7 (CHANGELOG mandate per global CLAUDE.md docs gate)
    - CLAUDE.md global rules → "Documentation Gate" section + "Breaking change adds CHANGELOG.md entry with the claim ID"
    - test if CHANGELOG.md exists at repo root: `test -f CHANGELOG.md`
  </read_first>
  <action>
    If `CHANGELOG.md` does NOT exist at repo root, create it with this header:

    ```markdown
    # Changelog

    All notable changes to cy-eventsystem are documented in this file. The format
    is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
    project adheres to semver where applicable.

    ## [Unreleased] — phase-kayinleong-02 Functionality

    ### Changed

    ### Decisions

    - **D-06 (Phase 2, `phase-kayinleong-02`): `firestore.rules` unit tests SKIPPED in v1.**
      Reverses ROADMAP Phase 2 success criterion #6 ("rules unit tests pass for every collection").
      Rationale: D-04 bans the Firebase Emulator Suite; `@firebase/rules-unit-testing` spins one
      up internally, conflicting with the no-emulator stance. Mitigations applied instead:
      (a) deny-by-default skeleton at the top of `firestore.rules`;
      (b) mandatory manual rules audit checkpoint at the end of each block that introduces rules
          (plans 02-02, 02-04, 02-05, 02-07, 02-08, 02-09, 02-10) — each block's CLAIM.md
          Verification section must enumerate paths tested + Firebase Console Rules Playground
          outcomes;
      (c) Firebase Console Rules Playground used for any non-trivial rule before deploy.
      PITFALLS C3 (rules-misconfig data leak) is acknowledged PARTIALLY UNMITIGATED.
      v2 candidate: revisit `@firebase/rules-unit-testing` if the manual audit reveals gaps.

    ### Added

    ### Fixed

    ### Removed
    ```

    If `CHANGELOG.md` ALREADY exists at repo root, append a new `## [Unreleased] — phase-kayinleong-02 Functionality` section UNDER the existing top header (or under existing `## [Unreleased]` heading). Use the same `### Decisions` body as above. DO NOT touch any existing release sections.

    **Verification step inside the action:** read the file back and confirm exactly one section in the file contains the substring `D-06 (Phase 2, \`phase-kayinleong-02\`)`. If there are two, you've duplicated — fix.
  </action>
  <acceptance_criteria>
    - `test -f CHANGELOG.md` succeeds.
    - `grep -q "D-06 (Phase 2" CHANGELOG.md` succeeds.
    - `grep -q "firestore.rules\` unit tests SKIPPED" CHANGELOG.md` succeeds.
    - `grep -c "D-06 (Phase 2" CHANGELOG.md` returns exactly 1 (no duplicate sections).
    - `grep -q "phase-kayinleong-02" CHANGELOG.md` succeeds.
  </acceptance_criteria>
  <verify>
    <automated>test -f CHANGELOG.md && grep -q "D-06 (Phase 2" CHANGELOG.md && [ "$(grep -c 'D-06 (Phase 2' CHANGELOG.md)" = "1" ]</automated>
  </verify>
  <done>CHANGELOG.md updated with D-06 entry per global CLAUDE.md docs gate.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Deploy rules + indexes + storage; smoke-test sign-in round-trip</name>
  <what-built>
    Tasks 1–4 created Firebase clients, the DAL, proxy.ts, route handlers, rules, indexes, storage.rules, and firebase.json. The developer must now deploy the rules+indexes+storage to the live Firebase project (per D-03) and smoke-test that a sign-in still works end-to-end via the real session-cookie flow (NOT the spike). At this point, Phase 1's mock auth is still in place at `/login` — that's wired in 02-03.

    NOTE: A full end-to-end sign-in test isn't possible until 02-03 wires the login form to call `signInWithEmailAndPassword` + POST `/api/auth/session`. What we CAN test now: rules deploy, indexes deploy, `npm run build` passes, no missing-env errors at boot, proxy.ts blocks unauthenticated `/` access (redirects to `/login`).
  </what-built>
  <how-to-verify>
    **Step A — Install Firebase CLI if missing:**
    ```bash
    npm i -g firebase-tools
    firebase --version  # ≥13.0 recommended
    ```

    **Step B — Authenticate the CLI to YOUR Firebase account (one-time):**
    ```bash
    firebase login
    ```
    Opens browser → sign in with the Google account that owns the `cy-eventsystem` project.

    **Step C — Verify the active project:**
    ```bash
    firebase use cy-eventsystem    # or whatever your real project ID is
    firebase use   # prints "active project: cy-eventsystem"
    ```

    **Step D — Deploy rules + indexes:**
    ```bash
    firebase deploy --only firestore:rules,firestore:indexes,storage
    ```

    Expected output:
    ```
    ✔ firestore: released rules to cloud.firestore
    ✔ firestore: deployed indexes successfully
    ✔ storage: released rules
    ```

    Indexes can take 5–15 minutes to build. The CLI exits after submitting them; verify status with:
    ```bash
    firebase firestore:indexes
    ```

    Expected: 12 composite indexes listed, all in `READY` or `CREATING` state.

    **PASS:** No errors during deploy; `firebase firestore:indexes` shows the indexes you submitted.
    **FAIL:** Deploy errors — usually permission issues (your account needs Editor role on the Firebase project) or quota (re-run after a few minutes).

    **Step E — Smoke-test the Next.js app:**
    ```bash
    npm run build
    ```
    Expected: build passes with zero TypeScript errors. If the build fails on missing `next-firebase-auth-edge` types or similar, your install is corrupt — `rm -rf node_modules && npm install` and retry.

    ```bash
    npm run dev
    ```
    Open http://localhost:3000 in a private/incognito window (no existing cookies):
    - **Expected:** 307 redirect to `/login` (proxy.ts is blocking anonymous requests).

    Open DevTools → Network. Confirm:
    - First request to `/` shows status 307 with `Location: /login`.
    - No console errors complaining about missing env vars.

    **Step F — Verify Admin SDK does NOT bundle into client chunks:**
    ```bash
    npm run build && grep -r "firebase-admin" .next/static/chunks/ 2>/dev/null | head -3
    ```
    **Expected:** empty output (no matches). If `firebase-admin` is in client chunks, something imported `lib/firebase/admin.ts` from a Client Component — find and fix.

    **Step G — Manual rules audit (D-06 mitigation, FINAL TASK OF BLOCK A):**

    Open https://console.firebase.google.com/project/<your-project>/firestore/rules — Rules tab → "Rules Playground".

    Run these 5 test cases (record outcomes in CLAIM.md under `## Rules Audit — Block A`):

    | # | Path | Authenticated? | Role claim | Op | Expected |
    |---|------|---------------|-----------|-----|----------|
    | 1 | `/users/some-uid` | No (anonymous) | — | read | DENY |
    | 2 | `/inventory/SKU-001` | No | — | read | DENY |
    | 3 | `/transactions/tx-001` | Yes | staff | create | DENY |
    | 4 | `/inventory/SKU-001` | Yes | admin | create (with valid data) | ALLOW |
    | 5 | `/inventory/SKU-001` | Yes | admin | update with `availableQty: -1` | DENY (invariant) |

    Record outcomes in CLAIM.md.

    Report results: "Rules + indexes deployed; smoke test PASS" or "FAIL: <reason>".
  </how-to-verify>
  <resume-signal>Type "deployed and smoke PASS" once rules+indexes+storage deployed and the 5-step manual audit recorded in CLAIM.md. If anything fails, describe it.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → proxy.ts | Cookie-only auth; cookies are HttpOnly + signed (cookieSignatureKeys) |
| Browser → /api/auth/session | Untrusted ID token → admin.auth().verifyIdToken() before issuing session cookie |
| Server → Firestore via Admin SDK | Bypasses rules; relies on Server Action's verifySession() + role check |
| Client SDK → Firestore | Subject to firestore.rules; deny-by-default catches misconfig |
| Client SDK → Storage | Subject to storage.rules; admin-only write on items/{itemId}/photo.jpg |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-02-01 | Spoofing | Forged __session cookie | mitigate | `cookieSignatureKeys` (32+ random bytes); `verifySessionCookie(cookie, true)` rejects unsigned/tampered tokens |
| T-02-02-02 | Tampering | Client writes directly to `transactions` collection | mitigate | `firestore.rules` `transactions/{txId}` allow create/update/delete: if false — only Admin SDK can write (INT-03) |
| T-02-02-03 | Tampering | Client writes negative `availableQty` to inventory | mitigate | `firestore.rules` inventory update invariant: `availableQty >= 0 && availableQty <= totalQty` (INT-02) |
| T-02-02-04 | Repudiation | User denies they signed in | mitigate | Session cookie issued via `createSessionCookie(idToken)` after `verifyIdToken` — auditable in Firebase Auth logs |
| T-02-02-05 | Information disclosure | Admin SDK leaks into client bundle | mitigate | `import 'server-only'` first line of `lib/firebase/admin.ts`; verified by build-time error if violated; PITFALLS C6 |
| T-02-02-06 | Information disclosure | `.env.local` committed to git | mitigate | `.gitignore` `\.env\.local` entry; CLAUDE.md secrets hygiene rule "never read .env.local"; T-02-01-01 inherited |
| T-02-02-07 | Information disclosure | Cross-event read by staff | mitigate | `events/{eventId}` rule `isMember(resource)` — staff must be in event.allowedStaff |
| T-02-02-08 | Denial of service | Cookie signature key rotation breaks all sessions | accept | Single-developer + sole user; if needed, rotate via `AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS` slot |
| T-02-02-09 | Elevation of privilege | Client modifies own `users/{uid}.role` to admin | mitigate | `firestore.rules` users update: if false — only Cloud Function 1 (Admin SDK, 02-04) writes users; clients have no write path |
| T-02-02-10 | Elevation of privilege | Disabled user retains access via cached ID token | mitigate | `verifySessionCookie(cookie, true)` rejects revoked tokens; AUTH-09 chain: disable → revokeRefreshTokens → DAL rejects on next request |
| T-02-02-11 | Information disclosure | Photo bucket browsed by anonymous | mitigate | `storage.rules` allow read: if request.auth != null on items/{itemId}/photo.jpg; deny-by-default on /{allPaths=**} |
| T-02-02-12 | Tampering | Client uploads non-image content to Storage | mitigate | `storage.rules` write: contentType.matches('image/.*') + size < 5MB |
| T-02-02-13 | Tampering | Rules misconfigured allow public-read on inventory | mitigate | D-06 manual audit checkpoint (Task 5 step G); ROADMAP success criterion #6 reversed but mitigated via per-block playground audit |
</threat_model>

<verification>
- `lib/firebase/admin.ts` first line is `import "server-only"`.
- `lib/firebase/client.ts` does NOT contain `import "server-only"`.
- `lib/auth/dal.ts` exports `verifySession`, `requireSession`, `requireAdmin`, and `getSession` (alias).
- `lib/auth/dal.ts` first line is `import "server-only"`.
- `lib/auth/dal.ts` calls `verifySessionCookie(_, true)` (revocation check).
- `proxy.ts` exists at repo root with a `proxy` function export and `config.matcher`.
- `proxy.ts` does NOT export `runtime`.
- `middleware.ts` does NOT exist at repo root.
- `app/api/auth/session/route.ts` and `app/api/auth/logout/route.ts` exist.
- `app/api/auth/logout/route.ts` calls `revokeRefreshTokens(...)`.
- `firestore.rules` contains the `match /{document=**} { allow read, write: if false; }` deny-by-default catch-all.
- `firestore.indexes.json` lists ≥ 12 indexes; includes `isLowStock` and `allowedStaff arrayConfig: CONTAINS`.
- `storage.rules` admin-only write on `items/{itemId}/photo.jpg`.
- `firebase.json` references rules, indexes, storage, and functions.
- `.env.example` is committed; `.env.local` is gitignored (and not committed).
- `CHANGELOG.md` has the D-06 entry.
- `npm run build` exits 0.
- `npx tsc --noEmit` exits 0.
- `npm run lint` exits 0.
- `firebase deploy --only firestore:rules,firestore:indexes,storage` succeeds (developer-verified in Task 5).
- Manual rules audit (5 cases) logged in CLAIM.md under `## Rules Audit — Block A`.
</verification>

<success_criteria>
- AUTH-01, AUTH-02, AUTH-05, AUTH-09 unblocked at infrastructure level (02-03 wires the auth pages to use this infrastructure).
- INT-02 (rules invariant), INT-03 (no client writes to transactions), INT-04 (DAL gate), INT-05 (indexes in repo, no console auto-create) satisfied.
- NFR-06 (use server + verifySession at top), NFR-07 (server-only Admin SDK), NFR-08 (proxy.ts not middleware.ts), NFR-09 (no cacheComponents) satisfied.
- RES-01 (offline reads via persistentLocalCache) + RES-03 (in-progress scan cart survives reload via IndexedDB) infrastructure in place.
- D-06 documented in CHANGELOG.md.
- All subsequent plans (02-03 onwards) can call `verifySession()` / `requireSession()` / `requireAdmin()` and trust the result.
- Firebase rules + indexes deployed live; manual rules audit recorded in CLAIM.md.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-02-firebase-clients-and-proxy-SUMMARY.md` documenting:
- All 13 files created/modified.
- Spike outcome branch chosen (PROCEED or FALLBACK) and which variant of proxy.ts / DAL was implemented.
- The exact `import "server-only"` placement on `lib/firebase/admin.ts` + `lib/auth/dal.ts` + `lib/auth/roles.ts`.
- Manual rules audit findings from Task 5 step G (5 test cases — PASS/FAIL each).
- `firebase deploy` output excerpt confirming rules + indexes + storage deploy.
- Any anomalies (e.g., env var that wasn't documented in .env.example, edge case in proxy.ts cookieSerializeOptions).
The summary should be ≤ 120 lines.
</output>
