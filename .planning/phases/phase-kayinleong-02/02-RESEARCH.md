# Phase 2: Functionality — Research

**Researched:** 2026-05-25
**Domain:** Replace mocks with Firebase Auth + Firestore + Storage + 2 Cloud Functions against a single live project. UI surface frozen except for photo field on inventory forms (D-15) and cursor URLs replacing `?page=N` (D-17).
**Confidence:** HIGH (stack + APIs verified against package.json, Next 16 local docs, and current vendor docs)

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**De-risk strategy (Block A):**
- D-01: 1-day spike on `next-firebase-auth-edge` v1.12+ gates Block A. Artifacts to `.planning/spikes/next-firebase-auth-edge-v1.12/`.
- D-02: Exactly 2 Cloud Functions in v1: (a) `onWrite users/{uid}` → `setCustomUserClaims(uid, { role })`; (b) `allowedStaff` maintenance trigger. No scheduled, no email, no stale-event scanner.
- D-03: Single Firebase project for prod. No staging, no per-dev projects. `npm run dev` writes to live Firestore.
- D-04: No Firebase Emulator Suite at all.
- D-05: First admin via `scripts/seed-first-admin.ts` (Admin SDK one-shot, manual run).
- D-06: AMENDMENT — `firestore.rules` unit tests SKIPPED in v1. Mitigations: deny-by-default skeleton + per-block manual rules audit + Firebase Console Rules Playground for non-trivial rules. PITFALLS C3 acknowledged unmitigated. CHANGELOG entry required.

**Email delivery (Block B):**
- D-07: Email provider = Firebase built-in only. `admin.auth().generatePasswordResetLink(email, actionCodeSettings)` with stock Firebase template.
- D-08: After `/set-password` success, auto-`signInWithEmailAndPassword` + redirect to `/`. Same for invite and forgot-password.
- D-09: `inviteUser` Server Action returns the reset URL in its response payload (both success AND failure paths). `/users/invite` UI shows "Copy link" button after submit.
- D-10: Low-stock + overdue-event email digests stay v2-deferred. v1 surfaces via dashboard widget + nav badge only.

**Photo / Storage (Block C):**
- D-11: Photo source = `<input type='file'>` + dedicated "Take photo" button (inline `getUserMedia`). Reuse `components/feature/scan/ScannerWidget.tsx` camera-permission + iOS error patterns.
- D-12: Client-side image processing via `browser-image-compression` (~10KB). Resize max 1600px long edge, JPEG quality 0.85.
- D-13: Storage rules — path `items/{itemId}/photo.jpg`. Read = any signed-in user. Write = `request.auth.token.role == 'admin'`. No public-read.
- D-14: Replace-only photo lifecycle. Same path overwrite. No removal UI, no versioning, no orphan cleanup.
- D-15: UI SURFACE AMENDMENT — adds photo field to `/inventory/new` + `/inventory/[id]/edit`. Phase 1 form covered name/SKU/totalQty/unit/category/notes only.

**Scale + indexing (Block C/D/E/F/G):**
- D-16: Growth-ready scale — 5000+ items, 100+ events, 5-10 users (Year 1 plateau).
- D-17: Pagination = Firestore cursor (`startAfter`) on every list page. URL contract `?cursor=xxx` replaces Phase 1's `?page=N`. Prev/next only — no "page N of M" total count. TanStack Table sets `manualPagination: true`. REP-06 (shareable filter URLs) preserved.
- D-18: Composite indexes — pre-declare obvious ones in `firestore.indexes.json`; grow reactively. INT-05 explicit ban on console auto-create stands.
- D-19: `enableIndexedDbPersistence(db)` enabled globally in `lib/firebase/client.ts`. RES-01 + RES-03 fulfilled. RES-02 banner wired in Block H. Scan pages disable themselves when offline.
- D-20: Real-time `onSnapshot` listeners scoped to the cursor's 50-row visible window. Tear down on next-page navigation.
- D-21: Dashboard KPI cards backed by Firestore `count()` aggregations. Re-query on mount + on `revalidatePath('/')` after mutations. NOT real-time.

### Claude's Discretion

- Server Action file structure: `app/<route>/actions.ts` co-located with each route.
- `verifySession()` DAL at `lib/auth/dal.ts`; wraps `verifySessionCookie(cookie, true)` + uses `React.cache()` for per-request memoization.
- Cursor encoding for `?cursor=xxx`: base64-encoded JSON of the `startAfter` field values (opaque to clients).
- Optimistic UI via `useOptimistic` (already wired in Phase 1's scan-cart) — Phase 2 swaps commit destination only.
- Error UX: `sonner` toasts + inline form errors via rhf's `setError`. Generic copy for unexpected, specific for known (CO-05 stock-insufficient).
- Error-boundary structure: per-segment `error.tsx` / `loading.tsx` / `not-found.tsx` per ROADMAP Block H.
- `revalidatePath` after every mutation; scoped per route.
- App Check enrollment: planner-discretion.
- `experimental_taintObjectReference` on user records: planner-discretion.
- Plan structure: planner decides 12-15 plans across 3-4 waves.

### Deferred Ideas (OUT OF SCOPE)

Reservations/holds, kits/bundles, unique-asset/serial tracking, asset condition tracking with photos, maintenance workflow, sub-locations, email/Slack notifications for low-stock+overdue, bulk CSV import, per-event Staff permissions, calendar/Gantt view, custom fields, damage photo on missing-item form, nightly stale-active-event scanner, App Check enforcement (optional), versioned photo history, low-stock email digest, scheduled aggregation, multi-region Firestore, CI/CD pipeline for Firebase deploys, sharded counters, `@firebase/rules-unit-testing`.

---

## Phase Requirements

| Block | Requirements | Research support |
|-------|--------------|-------------------|
| A | AUTH-01..06, NFR-06..08, INT-04 | `next-firebase-auth-edge` v1.12 setup, `verifySession()` DAL, `/api/login` + `/api/logout`, role gate via DAL |
| B | AUTH-07..10, INT-04 | `setCustomUserClaims` Cloud Function v2 trigger, `generatePasswordResetLink`, force token refresh on role change |
| C | INV-01..10, INT-01..03 | SKU = doc ID, `runTransaction` + invariant, photo upload via `browser-image-compression` + Storage, QR via `bwip-js` (existing) |
| D | EVT-01..08, INT-04 | `allowedStaff` denormalized + Cloud Function recompute, `array-contains-any` rule, team membership editor |
| E | CO-01..10, SCN-01..06, INT-01..03, AUD-01..04 | `checkoutItem` Server Action with `runTransaction`, `useOptimistic` revert, scanner reused from Phase 1 |
| F | CI-01..08, MIS-01..04, AUD-01..04 | `checkinItem` with `parentTxId` chain, `missingItems` creation, damaged routing, partial check-ins |
| G | REP-01..07, RP-01..04 | Cursor pagination, `count()` aggregations for KPIs, low-stock listener, repurchase suggestions |
| H | NFR-02..03, NFR-05, NFR-09, RES-01..04, INT-05 | Per-segment error boundaries, offline banner, `revalidatePath` audit, index audit |

NFR-01 (stack) and NFR-04 (Phase 1 mock-only) are inherited from Phase 1.

---

## Overview

Phase 2 is a **data-source swap**, not a UI rewrite. Phase 1's deliberate choices make this much easier than greenfield Phase 2 work:

1. The 14 mock-store mutators (`store.checkout`, `store.checkin`, `store.inviteUser`, etc.) have signatures that map 1:1 to Server Actions.
2. The mock cookie payload shape (`{ uid, displayName, email, role, disabled }`) was designed to mirror the decoded `__session` cookie — only the cookie-decoder swaps, not the role-gate.
3. Entity types in `lib/types/*.ts` already match the Firestore data model documented in `research/ARCHITECTURE.md`. Reuse as-is.
4. The Phase 1 scan-cart already uses `useOptimistic`; Phase 2 swaps the commit destination from `store.checkout()` to `checkoutItem()` Server Action.
5. The URL-table hook (`useUrlTableState`) needs a **breaking change** per D-17 — `?page=N` → `?cursor=xxx`. This is the single largest UI refactor in Phase 2.

The two material rewrites are:
- **Auth wire-up** (Block A) — `next-firebase-auth-edge` v1.12 in `proxy.ts` (NOT `middleware.ts`), spike-gated.
- **Cursor pagination** (D-17) — every list page (`/inventory`, `/events`, `/users`, `/reports/*`) loses its "page N of M" UI; gains "prev / next" only. Hook signature changes; consumers need updates.

Cloud Functions surface is tiny (D-02: exactly 2). Email delivery is Firebase built-in only (D-07). No emulator, no staging (D-03/D-04) — dev workflow runs against the live prod project, mitigated by sole-developer + namespace-scratch on the spike.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login / signOut | Frontend Server (proxy + Route Handlers) | Browser (Firebase Web SDK gets ID token) | Session cookie must be `httpOnly` — set/cleared from server only |
| Session verification | Frontend Server (`verifySession()` DAL) | — | Admin SDK is Node-only; cookie decoded server-side |
| Role gate | Frontend Server `(app)/layout.tsx` | API tier (Firestore rules) | Layout reads DAL, rules enforce on direct writes |
| Inventory list read | API (Firestore Web SDK `onSnapshot`) | Frontend Server (Admin SDK seed) | Server seeds initial render, client takes over |
| Inventory write | Frontend Server (Server Action → Admin SDK) | API (Firestore rules deny client writes) | Stock invariant must run server-side inside `runTransaction` |
| Stock decrement (checkout) | Frontend Server (Server Action) | API (Firestore tx + rules) | C1 mitigation; Admin SDK bypasses rules so DAL gates |
| Image upload | Browser (compress + upload via Web SDK) | Storage (rules enforce admin write) | Compression must happen pre-upload to avoid 12MB iPhone files |
| Photo read | Browser (Web SDK gets download URL) | Storage (rules: signed-in read) | Image bytes never touch the Next server |
| Custom claims sync | Cloud Function (onWrite users) | API (Admin SDK `setCustomUserClaims`) | Async; client only sees claims after token refresh |
| `allowedStaff` denormalization | Cloud Function (onWrite events OR users) | API (Firestore rules use `array-contains-any`) | Free O(1) read in rules; Cloud Function pays the write cost |
| Dashboard KPI counts | Frontend Server (Server Component) | API (`getCountFromServer`) | `count()` aggregation is one read, not 5000 |
| Real-time listeners | Browser (Web SDK `onSnapshot`) | API (Firestore rules gate reads) | Server Components can't subscribe — fundamental SSR limit |
| Audit log writes | Frontend Server (Server Action) | API (Firestore rules deny all client writes to transactions) | INT-03 explicit |

---

## Block A — Foundation (Auth wire-up)

### 1.1 — Firebase project provision (one-time, manual)

**Steps (run by developer at project root, not in a Server Action):**

1. Create Firebase project in console (single project per D-03).
2. Enable Auth → Email/Password sign-in method.
3. Enable Firestore (native mode, single region — `asia-southeast1` likely given Hong Kong-based dev).
4. Enable Storage (default bucket).
5. Create service account → generate JSON key → save outside repo.
6. Populate `.env.local` (gitignored):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cy-eventsystem.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cy-eventsystem
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cy-eventsystem.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_PROJECT_ID=cy-eventsystem
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@cy-eventsystem.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
AUTH_COOKIE_SIGNATURE_KEY_CURRENT=<32+ random bytes base64>
AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS=<32+ random bytes base64>
USE_SECURE_COOKIES=true
```

`FIREBASE_PRIVATE_KEY` must be quoted; replace literal `\n` with newlines at read time: `process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')`. [VERIFIED: known Firebase Admin SDK quirk]

### 1.2 — `lib/firebase/client.ts` (Web SDK + IndexedDB persistence)

```typescript
// lib/firebase/client.ts
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

// D-19: persistent cache for offline reads. Use the modern API — the legacy
// `enableIndexedDbPersistence()` is deprecated since firebase ^10. Multi-tab
// can be added later via persistentMultipleTabManager() if needed; v1 uses
// single-tab manager (simpler + 20x faster query path per upstream issue #7347).
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({}),
  }),
});

export const auth = getAuth(app);
export const storage = getStorage(app);
export { db };
```

[CITED: Firebase Web SDK docs — persistent cache supersedes `enableIndexedDbPersistence`]

**D-19 implementation note:** CONTEXT.md says "Call `enableIndexedDbPersistence(db)` once" but this API is **deprecated** as of `firebase` ^10 (we're on 12.13). Use `initializeFirestore` with `localCache: persistentLocalCache(...)` instead. Same effect, modern API.

**Multi-tab caveat (single-tab mode):** Opening the app in a second tab will fail to acquire the persistence lock and fall back to memory-only cache. Acceptable for a single-developer/single-user-at-a-time workflow. Document in CLAIM.md.

### 1.3 — `lib/firebase/admin.ts` (Admin SDK, server-only)

```typescript
// lib/firebase/admin.ts
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
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
```

**Critical:** `import "server-only"` must be the first line. Any accidental import from a Client Component triggers a build error. PITFALLS C6.

### 1.4 — `next-firebase-auth-edge` v1.12 setup

**Install:** `npm i next-firebase-auth-edge` (latest is 1.12.0 as of Feb 2026 per upstream). [VERIFIED: GitHub releases]

**`proxy.ts` at repo root** (Node.js runtime mandatory; Edge unsupported in Next 16 proxy.ts per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`):

```typescript
// proxy.ts
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
    handleValidToken: async ({ token, decodedToken }, headers) => {
      // Authenticated user on a public path → redirect to /
      if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
        return redirectToHome(request);
      }
      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () => {
      // Unauthenticated on a protected path → /login
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
    // Auth endpoints
    "/api/auth/:path*",
    // All app routes except static + image opt
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt).*)",
  ],
};
```

[CITED: next-firebase-auth-edge-docs.vercel.app/docs/usage/middleware — verified Feb 2026]

**Cookie name = `__session`** — this is mandatory on Firebase Hosting if we ever deploy there. Safe choice now.

**`loginPath` + `logoutPath` are auto-handled** by the library — the matcher must include them, but the project does NOT need to write `app/api/auth/session/route.ts` itself. The library exposes the endpoints internally. The client POSTs to `/api/auth/session` with the ID token and receives `Set-Cookie: __session=...` in the response.

### 1.5 — Spike acceptance criteria (D-01)

**Spike artifact location:** `.planning/spikes/next-firebase-auth-edge-v1.12/`

**Day-1 spike PASSES if all 6 checks green against a scratch namespace:**

1. **Cookie creation round-trip:** Login page calls `signInWithEmailAndPassword` → `user.getIdToken()` → `fetch('/api/auth/session', { method: 'POST', body: idToken })`. Network panel shows `Set-Cookie: __session=<JWT>; HttpOnly; Path=/; Max-Age=432000; SameSite=Lax`.
2. **proxy.ts accepts authenticated requests:** Visiting `/` with the cookie returns the protected page (no redirect to `/login`).
3. **proxy.ts redirects unauthenticated requests:** Visiting `/` without the cookie returns a 307 to `/login`.
4. **`verifySession()` returns decoded claims:** A test Server Component calls `verifySession()` and renders `{uid, role, email}` — values match the seed admin user.
5. **`signOut` revokes refresh token + clears cookie:** Logout button calls `/api/auth/logout` → cookie cleared in browser, `verifySession()` throws on next request.
6. **Token-revocation gate works:** Manually disable user via Admin SDK script → next request to `verifySession()` (with `checkRevoked: true`) throws → user redirected to `/login`. AUTH-09 contract.

**If any check fails:** revert to lower-level Firebase Admin SDK session-cookie management (`createSessionCookie` + manual cookie set in Route Handler + custom proxy.ts cookie check). Document the failure in the spike artifact and the planner adds fallback tasks.

### 1.6 — `lib/auth/dal.ts` (Data Access Layer)

```typescript
// lib/auth/dal.ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { unauthorized } from "next/navigation"; // Next 16
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Session } from "@/lib/types/session";
import type { UserRole } from "@/lib/types/user";

/**
 * verifySession — decodes the __session cookie with revocation check.
 * React.cache() memoizes per-request so multiple Server Components and the
 * Server Action layer share one decode.
 */
export const verifySession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies(); // Next 16: async
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    // role lives on the token via the Cloud Function (D-02). On a brand-new
    // user whose token predates the Cloud Function execution, `role` may be
    // missing — fall through to the users/{uid} fetch.
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
      // AUTH-09: existing session must be unusable for disabled users.
      await adminAuth.revokeRefreshTokens(decoded.uid);
      return null;
    }

    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      displayName,
      role,
      disabled: false,
    };
  } catch {
    return null;
  }
});

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

**Key points:**
- `cache()` from `react` (NOT `unstable_cache`) — gives per-request memoization within a single render pass.
- `cookies()` MUST be awaited (Next 16 async). [VERIFIED: node_modules/next/dist/docs/.../version-16.md]
- `verifySessionCookie(cookie, true)` second-arg `true` = revocation check (PITFALLS sessions table). This adds one Auth API call per request — acceptable cost for security.
- Defense-in-depth on disabled users: the cookie might still verify, but `disabled === true` in Firestore forces immediate revocation.
- `unauthorized()` is a Next 16 navigation function that renders `unauthorized.tsx` (analog to `notFound()`). [CITED: node_modules/next/dist/docs/.../unauthorized.md]

### 1.7 — `(app)/layout.tsx` role gate (swap mock → DAL)

Phase 1's `app/(app)/layout.tsx` currently reads the mock cookie. Replace:

```typescript
// app/(app)/layout.tsx
import { requireSession } from "@/lib/auth/dal";
// ... existing shell imports ...

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(); // redirects to /login if no cookie
  return (
    <AppShell session={session}>
      {children}
    </AppShell>
  );
}
```

**Phase 1 surface preserved:** `<AppShell>` already accepts a `session` prop shaped exactly like `Session`. Mock-session helpers in `lib/auth/mock-session.ts` and `lib/auth/read-mock-session-*.ts` get DELETED in this task.

### 1.8 — `/login` page swap

Phase 1's `/login` renders mock users; Phase 2 calls Firebase Auth then posts the ID token to `/api/auth/session`:

```typescript
// app/(auth)/login/page.tsx — Client Component
"use client";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "@/lib/schemas/auth";

export default function LoginPage() {
  const { register, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(LoginSchema),
  });

  async function onSubmit(values: { email: string; password: string }) {
    try {
      const cred = await signInWithEmailAndPassword(auth, values.email, values.password);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("session-create-failed");
      window.location.assign("/"); // hard nav so proxy.ts re-evaluates with new cookie
    } catch (err) {
      setError("root", { message: "Invalid email or password." });
    }
  }
  // ... rhf form JSX ...
}
```

**`window.location.assign('/')` not `router.push('/')`** — full reload is needed so proxy.ts sees the new cookie before the next prefetch. Otherwise the client renders `/` against the old (or missing) cookie state. [CITED: next-firebase-auth-edge docs]

**Authorization header pattern:** the library expects `Authorization: Bearer <idToken>` in the POST to `loginPath`. [VERIFIED: next-firebase-auth-edge v1.12 docs]

### 1.9 — `/forgot-password` and `/set-password`

```typescript
// /forgot-password — Client Component, calls Web SDK
import { sendPasswordResetEmail } from "firebase/auth";
await sendPasswordResetEmail(auth, email);
// Generic success copy regardless of email existence (security)
```

```typescript
// /set-password?oobCode=... — Client Component
import { confirmPasswordReset, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

async function onSubmit({ password }: { password: string }) {
  const oobCode = new URLSearchParams(window.location.search).get("oobCode");
  // confirmPasswordReset DOES NOT return the email — we need it for auto-sign-in (D-08).
  // Get it from verifyPasswordResetCode FIRST so we can sign in afterward.
  const { verifyPasswordResetCode } = await import("firebase/auth");
  const email = await verifyPasswordResetCode(auth, oobCode!);
  await confirmPasswordReset(auth, oobCode!, password);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await cred.user.getIdToken();
  await fetch("/api/auth/session", { method: "POST", headers: { Authorization: `Bearer ${idToken}` }});
  window.location.assign("/"); // D-08: auto-sign-in + redirect
}
```

[CITED: Firebase Web SDK Auth — `verifyPasswordResetCode` returns the email associated with the oobCode]

---

## Block B — Users + Roles

### 2.1 — Cloud Functions structure

```
functions/
  package.json          # firebase-functions ^6, firebase-admin ^13
  tsconfig.json
  src/
    index.ts            # imports + exports both functions
    setCustomUserClaims.ts
    syncAllowedStaff.ts
```

**`functions/package.json`:**
```json
{
  "name": "functions",
  "main": "lib/index.js",
  "engines": { "node": "20" },
  "scripts": {
    "build": "tsc",
    "deploy": "firebase deploy --only functions"
  },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0"
  }
}
```

Functions live in a separate package (own `node_modules`, own `tsconfig.json`). The Next.js app and `functions/` are independent build artifacts. `firebase.json` at repo root wires them together.

### 2.2 — `firebase.json` (one file at repo root)

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": { "rules": "storage.rules" },
  "functions": [
    { "source": "functions", "codebase": "default", "runtime": "nodejs20" }
  ]
}
```

### 2.3 — Function 1: `setCustomUserClaims` on `users/{uid}` write

```typescript
// functions/src/setCustomUserClaims.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps } from "firebase-admin/app";

if (!getApps().length) initializeApp();
const auth = getAuth();

export const onUserWriteSetClaims = onDocumentWritten(
  { document: "users/{uid}", region: "asia-southeast1" },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after?.data();

    if (!after) {
      // user doc deleted — strip claims so any cached token loses admin
      await auth.setCustomUserClaims(uid, null);
      await auth.revokeRefreshTokens(uid);
      return;
    }

    const role = after.role as "admin" | "staff" | undefined;
    if (!role) return;

    // Only update claims if changed — setCustomUserClaims is rate-limited
    const userRecord = await auth.getUser(uid).catch(() => null);
    if (!userRecord) return;
    const existing = userRecord.customClaims?.role;
    if (existing === role) return;

    await auth.setCustomUserClaims(uid, { role });

    // AUTH-08: role change should propagate "immediately on next sign-in" —
    // revoke refresh tokens so the next ID-token refresh picks up new claims.
    // Without this, the user's existing ID token retains old claims for ~1h.
    await auth.revokeRefreshTokens(uid);
  }
);
```

[CITED: firebase-functions v2 `onDocumentWritten` API + Firebase Auth custom claims docs]

**`setCustomUserClaims(uid, null)`** strips all claims. Pair with `revokeRefreshTokens` so the next request forces a fresh ID token.

**Region:** match Firestore region (recommend `asia-southeast1` for Hong Kong). Cross-region triggers add latency.

### 2.4 — Function 2: `allowedStaff` sync

This must recompute `events/{id}.allowedStaff` whenever either (a) an event's team fields change OR (b) any user's role changes (because admins are auto-included). Two triggers:

```typescript
// functions/src/syncAllowedStaff.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

async function recomputeForEvent(eventId: string) {
  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  const event = eventSnap.data();
  if (!event) return;

  // Admins (full set) + this event's teamLeads + backupTeams
  const adminsQuery = await db.collection("users").where("role", "==", "admin").get();
  const adminUids = adminsQuery.docs.map((d) => d.id);

  const allowed = new Set<string>([
    ...adminUids,
    ...(event.teamLeads ?? []),
    ...(event.backupTeams ?? []),
  ]);

  await eventRef.update({ allowedStaff: Array.from(allowed) });
}

export const onEventTeamChange = onDocumentWritten(
  { document: "events/{eventId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return; // event deleted

    // Skip if neither team list changed AND allowedStaff is already populated
    const teamLeadsChanged = JSON.stringify(before?.teamLeads) !== JSON.stringify(after.teamLeads);
    const backupChanged = JSON.stringify(before?.backupTeams) !== JSON.stringify(after.backupTeams);
    const allowedMissing = !after.allowedStaff?.length;

    if (!teamLeadsChanged && !backupChanged && !allowedMissing) return;

    // Avoid infinite loop: detect "we just wrote this" by checking if the only
    // diff between before/after IS allowedStaff
    const onlyAllowedStaffChanged =
      JSON.stringify({ ...before, allowedStaff: null }) ===
      JSON.stringify({ ...after, allowedStaff: null });
    if (onlyAllowedStaffChanged) return;

    await recomputeForEvent(event.params.eventId);
  }
);

export const onUserRoleChange = onDocumentWritten(
  { document: "users/{uid}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const oldRole = before?.role;
    const newRole = after?.role;
    if (oldRole === newRole) return;

    // role flipped to/from admin → recompute every event's allowedStaff
    if (oldRole === "admin" || newRole === "admin") {
      const events = await db.collection("events").get();
      const batches: Promise<void>[] = [];
      for (const doc of events.docs) {
        batches.push(recomputeForEvent(doc.id));
      }
      await Promise.all(batches);
    }
  }
);
```

[CITED: firebase-functions v2 `onDocumentWritten`]

**Self-write infinite-loop guard:** when this Cloud Function writes `allowedStaff` back to the event doc, the trigger fires AGAIN. Guard by comparing the before/after MINUS the `allowedStaff` field. [VERIFIED: standard Firestore trigger pattern]

**Performance note:** `onUserRoleChange` for an admin promotion recomputes ALL events. At 100+ events this is one batch read + 100 writes = ~$0.0006 per promotion. Acceptable for D-16 scale.

### 2.5 — `inviteUser` Server Action

```typescript
// app/(app)/users/actions.ts
"use server";
import { requireAdmin } from "@/lib/auth/dal";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { InviteUserSchema } from "@/lib/schemas/auth";

export async function inviteUser(formData: FormData) {
  const session = await requireAdmin();

  const parsed = InviteUserSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }

  const { email, displayName, role } = parsed.data;

  try {
    // 1. Create the Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email,
      displayName,
      disabled: false,
      // Don't set password — invitee will set via /set-password
    });

    // 2. Write users/{uid} — Cloud Function 1 picks this up and sets claims
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      disabled: false,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: session.uid,
      lastLoginAt: null,
    });

    // 3. Generate password reset link — Firebase delivers via its built-in template
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
      handleCodeInApp: false,
    };
    const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

    // Firebase's built-in template sends the email automatically when
    // generatePasswordResetLink is invoked via Auth's REST API. The Admin SDK
    // version returns the link but does NOT auto-email. We surface the link in
    // the response (D-09) so the admin can copy/share even if email delivery
    // fails or is not yet wired to a SMTP-backed template.

    revalidatePath("/users");
    return { ok: true as const, resetLink, uid: userRecord.uid };
  } catch (err) {
    // Firebase Auth errors have a `.code` (e.g., "auth/email-already-exists")
    return { ok: false as const, error: (err as Error).message };
  }
}
```

**D-07/D-09 nuance:** `admin.auth().generatePasswordResetLink()` **returns a link but does NOT send the email itself** — that's a common misconception. To trigger Firebase's built-in email template, the project must enable the "Password reset" template in the Firebase Console (Auth → Templates). Once enabled, calling `sendPasswordResetEmail` from the Web SDK (which we use for `/forgot-password`) triggers delivery.

For invite emails specifically: **the Admin SDK call returns the link, but does NOT send the email.** Options:
1. **Adopt:** Admin manually shares the link via Slack/SMS (D-09 already accepts this).
2. **Future:** Call the Auth REST API endpoint `emails:sendOobCode` directly which does send via Firebase's template — undocumented, fragile.
3. **v2:** Wire SendGrid/Resend.

D-09 already commits to surfacing the link in the UI — this is the correct call. [VERIFIED: Firebase Admin Auth — `generatePasswordResetLink` returns URL only]

### 2.6 — `setUserRole` and `disableUser` Server Actions

```typescript
// Same actions.ts
export async function setUserRole(uid: string, role: "admin" | "staff") {
  const session = await requireAdmin();
  // Cloud Function 1 picks up the role change and updates claims + revokes refresh tokens.
  await adminDb.collection("users").doc(uid).update({
    role,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  });
  revalidatePath("/users");
  return { ok: true as const };
}

export async function disableUser(uid: string, disabled: boolean) {
  const session = await requireAdmin();

  // 1. Toggle the Firebase Auth user (this blocks NEW sign-ins)
  await adminAuth.updateUser(uid, { disabled });

  // 2. Toggle the Firestore doc (DAL re-checks this on every request → revokes if disabled)
  await adminDb.collection("users").doc(uid).update({
    disabled,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  });

  // 3. Revoke EXISTING sessions explicitly (AUTH-09)
  if (disabled) await adminAuth.revokeRefreshTokens(uid);

  revalidatePath("/users");
  return { ok: true as const };
}
```

### 2.7 — `scripts/seed-first-admin.ts` (D-05)

```typescript
// scripts/seed-first-admin.ts
// One-time: creates the first admin user after Firebase project provision.
// Run via: npx tsx scripts/seed-first-admin.ts <email> <displayName>
//
// Requires FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in env.
// Does NOT write to git history — uses local .env.local.

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const email = process.argv[2];
const displayName = process.argv[3];

if (!email || !displayName) {
  console.error("Usage: tsx scripts/seed-first-admin.ts <email> <displayName>");
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  const existingUsersSnap = await db.collection("users").limit(1).get();
  if (!existingUsersSnap.empty) {
    console.error("Refusing to seed: users collection is not empty.");
    process.exit(2);
  }

  const user = await auth.createUser({ email, displayName });
  await auth.setCustomUserClaims(user.uid, { role: "admin" });
  await db.collection("users").doc(user.uid).set({
    uid: user.uid,
    email,
    displayName,
    role: "admin",
    disabled: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "seed-script",
    lastLoginAt: null,
  });

  // Generate password reset link for first sign-in
  const link = await auth.generatePasswordResetLink(email);
  console.log("=== FIRST ADMIN SEEDED ===");
  console.log("UID:", user.uid);
  console.log("Password set link (visit in browser):", link);
}

run().catch((err) => { console.error(err); process.exit(1); });
```

**Safety rails:**
- Refuses to run if any user already exists (prevents accidental re-seed).
- Logs the password-reset link to stdout — admin visits it to set the password.
- Adds `tsx` as a devDependency for one-off scripts.

---

## Block C — Inventory CRUD

### 3.1 — Schema confirmation

Phase 1's `lib/types/item.ts` (`InventoryItem`) maps directly. Use SKU = doc ID (PROJECT.md KD #14). Field-level conversions: ISO strings → Firestore `Timestamp` at the data-layer boundary.

**Server-only data helper:**
```typescript
// lib/data/inventory.server.ts
import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { InventoryItem } from "@/lib/types/item";

export async function getInventoryPage(opts: {
  cursor?: { name: string; id: string };
  limit?: number;
  filters?: { category?: string; lifecycleState?: string };
}): Promise<{ items: InventoryItem[]; nextCursor: { name: string; id: string } | null }> {
  let q: FirebaseFirestore.Query = adminDb.collection("inventory");
  if (opts.filters?.category) q = q.where("category", "==", opts.filters.category);
  if (opts.filters?.lifecycleState) q = q.where("lifecycleState", "==", opts.filters.lifecycleState);

  q = q.orderBy("name").orderBy("__name__").limit((opts.limit ?? 50) + 1);
  if (opts.cursor) q = q.startAfter(opts.cursor.name, opts.cursor.id);

  const snap = await q.get();
  const docs = snap.docs.slice(0, opts.limit ?? 50);
  const hasMore = snap.docs.length > (opts.limit ?? 50);
  return {
    items: docs.map((d) => firestoreToItem(d)),
    nextCursor: hasMore && docs.length > 0
      ? { name: docs[docs.length - 1].data().name, id: docs[docs.length - 1].id }
      : null,
  };
}
```

**`orderBy('__name__')`** is the Firestore convention for using the document ID as a secondary sort key — critical for cursor stability when many items share the same `name`. [VERIFIED: Firestore docs]

### 3.2 — `createItem` Server Action with SKU uniqueness

```typescript
// app/(app)/inventory/actions.ts
"use server";
import { requireAdmin } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { CreateItemSchema } from "@/lib/schemas/item";

export async function createItem(input: unknown) {
  const session = await requireAdmin();
  const parsed = CreateItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // SKU = doc ID → uniqueness is free at the Firestore level
  const docRef = adminDb.collection("inventory").doc(data.sku);

  try {
    await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(docRef);
      if (existing.exists) {
        throw new Error("SKU_EXISTS");
      }
      tx.set(docRef, {
        id: data.sku,
        ...data,
        availableQty: data.totalQty,
        outQty: 0,
        damagedQty: 0,
        lifecycleState: "available",
        lowStockThreshold: data.lowStockThreshold ?? 0,
        lowStockOrderedAt: null,
        photoUrl: data.photoUrl ?? null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: session.uid,
        updatedBy: session.uid,
      });
    });
    revalidatePath("/inventory");
    revalidatePath("/"); // dashboard KPIs
    return { ok: true as const, itemId: data.sku };
  } catch (err) {
    if ((err as Error).message === "SKU_EXISTS") {
      return { ok: false as const, errors: { sku: ["SKU already exists."] } };
    }
    throw err;
  }
}
```

INV-02 (SKU uniqueness at write time) satisfied by the transactional `tx.get` + assert.

### 3.3 — Photo upload (D-11..D-15)

**Install:** `npm i browser-image-compression` (~10KB, types built-in). [VERIFIED: npm view browser-image-compression]

**Photo field component (reuses ScannerWidget camera-permission pattern):**

```typescript
// components/feature/inventory/ItemPhotoField.tsx
"use client";
import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { Camera } from "lucide-react";
import { useScannerPermission } from "@/components/feature/scan/use-scanner-permission"; // reuse from Phase 1

export function ItemPhotoField({
  itemId, // SKU
  initialUrl,
  onChange,
}: {
  itemId: string;
  initialUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const { error: permError, requestPermission } = useScannerPermission();

  async function processAndUpload(file: File) {
    setUploading(true);
    try {
      // D-12: compress before upload
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3, // 300KB ceiling
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
      });

      // D-13/D-14: items/{itemId}/photo.jpg — replace-only
      const storageRef = ref(storage, `items/${itemId}/photo.jpg`);
      await uploadBytes(storageRef, compressed, { contentType: "image/jpeg" });
      const url = await getDownloadURL(storageRef);
      setPreviewUrl(url);
      onChange(url);
    } finally {
      setUploading(false);
    }
  }

  async function captureFromCamera() {
    await requestPermission(); // reuses ScannerWidget hook
    setShowCamera(true);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
  }

  async function snapPhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) return;
    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    // stop camera
    const stream = videoRef.current.srcObject as MediaStream;
    stream.getTracks().forEach((t) => t.stop());
    setShowCamera(false);
    await processAndUpload(file);
  }

  // ... JSX: <input type=file> + <button>Take photo</button> + camera overlay ...
}
```

**Key reuse points:**
- `useScannerPermission` from Phase 1 — same iOS-specific error copy + tap-to-start pattern.
- `facingMode: { ideal: 'environment' }` matches Phase 1 contract.
- Stop stream on snap to release camera (PITFALLS battery-drain).

**`itemId` requirement:** the form needs the SKU BEFORE upload (path is `items/{itemId}/photo.jpg`). For `/inventory/new`, the SKU is in the form state — upload triggers on field submission rather than on file select. Or: generate the SKU client-side (which is correct anyway since SKU = doc ID).

### 3.4 — `adjustItemStock` (INV-04)

```typescript
export async function adjustItemStock(input: {
  itemId: string;
  delta: number; // can be negative
  reason: string;
}) {
  const session = await requireAdmin();
  const itemRef = adminDb.collection("inventory").doc(input.itemId);
  const txRef = adminDb.collection("transactions").doc();

  await adminDb.runTransaction(async (tx) => {
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists) throw new Error("ITEM_NOT_FOUND");
    const item = itemSnap.data()!;

    const newTotal = item.totalQty + input.delta;
    const newAvailable = item.availableQty + input.delta;
    if (newTotal < 0 || newAvailable < 0) throw new Error("WOULD_GO_NEGATIVE");

    tx.update(itemRef, {
      totalQty: newTotal,
      availableQty: newAvailable,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    });

    tx.set(txRef, {
      type: "adjustment",
      itemId: input.itemId,
      itemSku: item.sku,
      itemName: item.name,
      eventId: null,
      eventName: null,
      qty: Math.abs(input.delta),
      actorUid: session.uid,
      actorName: session.displayName,
      actorRoleAtTimeOfAction: session.role,
      at: FieldValue.serverTimestamp(),
      notes: input.reason,
      parentTxId: null,
      clientTxId: null,
    });
  });

  revalidatePath(`/inventory/${input.itemId}`);
  revalidatePath("/inventory");
  return { ok: true as const };
}
```

INV-04 (required reason) + AUD-01..04 (immutable transaction with actor snapshot) both met.

---

## Block D — Events

### 4.1 — Server Actions

`createEvent` and `updateEvent` write the doc; the Cloud Function recomputes `allowedStaff`. The Server Action initially sets `allowedStaff: []` and the Cloud Function fills it within ~1-2 seconds.

```typescript
export async function createEvent(input: unknown) {
  const session = await requireSession(); // admin OR team lead can create per EVT-01
  const parsed = CreateEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: parsed.error.flatten().fieldErrors };

  const eventRef = adminDb.collection("events").doc();
  await eventRef.set({
    id: eventRef.id,
    ...parsed.data,
    status: "planned",
    allowedStaff: [], // Cloud Function fills this — empty array prevents nulls in rules
    plannedItems: {},
    createdAt: FieldValue.serverTimestamp(),
    createdBy: session.uid,
    closedAt: null,
    closedBy: null,
  });
  revalidatePath("/events");
  return { ok: true as const, eventId: eventRef.id };
}
```

**Race condition note:** between Server Action create (allowedStaff: []) and Cloud Function fill (~1-2s), the team leads cannot access the event because they aren't in `allowedStaff` yet. Mitigation: the Server Action sets `allowedStaff: [...teamLeads, ...backupTeams]` itself (admins still get filled by Cloud Function — but admins also pass the `request.auth.token.role == 'admin'` short-circuit in rules, so this is fine).

**Better:** Server Action sets `allowedStaff` directly with the user-supplied teams. The Cloud Function then merges in the admin uids set. No race window.

### 4.2 — `cancelEvent` with reconciliation (EVT-06)

Phase 1's `store.cancelEvent` already takes a reconciliation map. Translate to:

```typescript
export async function cancelEvent(input: {
  eventId: string;
  reconciliation: Record<string, "returned" | "lost" | "still_with_owner">;
}) {
  const session = await requireAdmin();
  // For each item in reconciliation:
  //   - "returned" → checkin transaction (qty back to availableQty)
  //   - "lost" → missing transaction + missingItems doc
  //   - "still_with_owner" → no-op, just record decision
  // All in a single runTransaction
  // ... see checkin code below for the patterns ...
  revalidatePath("/events");
  revalidatePath(`/events/${input.eventId}`);
}
```

---

## Block E — Scan check-out

### 5.1 — `checkoutItem` Server Action (the marquee transaction)

```typescript
// app/(app)/events/[id]/checkout/actions.ts
"use server";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { CheckoutCartSchema } from "@/lib/schemas/transaction";

type CheckoutResult =
  | { ok: true; txIds: string[] }
  | { ok: false; error: string; failedLines?: { itemId: string; available: number; requested: number }[] };

export async function checkoutItem(input: {
  eventId: string;
  lines: { itemId: string; qty: number }[];
}): Promise<CheckoutResult> {
  const session = await requireSession();
  const parsed = CheckoutCartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid cart" };

  // 1. Event access check (EVT-08)
  const eventRef = adminDb.collection("events").doc(input.eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) return { ok: false, error: "Event not found" };
  const event = eventSnap.data()!;

  const isAdmin = session.role === "admin";
  const isMember = event.allowedStaff?.includes(session.uid) === true;
  if (!isAdmin && !isMember) return { ok: false, error: "Not authorized for this event" };
  if (event.status === "completed" || event.status === "cancelled") {
    return { ok: false, error: `Event is ${event.status}` };
  }

  // 2. Aggregate per item — cart may have two lines for the same itemId
  const requestedByItem = new Map<string, number>();
  for (const line of parsed.data.lines) {
    requestedByItem.set(line.itemId, (requestedByItem.get(line.itemId) ?? 0) + line.qty);
  }

  const itemIds = Array.from(requestedByItem.keys());
  const itemRefs = itemIds.map((id) => adminDb.collection("inventory").doc(id));

  // 3. Atomic transaction
  const txIds: string[] = [];
  try {
    await adminDb.runTransaction(async (tx) => {
      const itemSnaps = await Promise.all(itemRefs.map((ref) => tx.get(ref)));

      // Invariant check pass 1 — all items must have enough stock
      const failed: { itemId: string; available: number; requested: number }[] = [];
      for (let i = 0; i < itemSnaps.length; i++) {
        const snap = itemSnaps[i];
        if (!snap.exists) {
          failed.push({ itemId: itemIds[i], available: 0, requested: requestedByItem.get(itemIds[i])! });
          continue;
        }
        const available = snap.data()!.availableQty;
        const requested = requestedByItem.get(itemIds[i])!;
        if (available < requested) {
          failed.push({ itemId: itemIds[i], available, requested });
        }
      }
      if (failed.length > 0) {
        // CO-05: entire cart fails atomically
        const err = new Error("STOCK_INSUFFICIENT");
        (err as any).failed = failed;
        throw err;
      }

      // Pass 2 — apply decrements + write tx logs
      for (let i = 0; i < itemSnaps.length; i++) {
        const snap = itemSnaps[i];
        const item = snap.data()!;
        const qty = requestedByItem.get(itemIds[i])!;
        const newAvailable = item.availableQty - qty;
        const newOut = item.outQty + qty;
        // Lifecycle: if any qty out, the item is checked_out (partial allowed)
        const newLifecycle = newAvailable === 0 ? "checked_out" : item.lifecycleState;

        tx.update(itemRefs[i], {
          availableQty: newAvailable,
          outQty: newOut,
          lifecycleState: newLifecycle === "available" && newAvailable < item.totalQty ? "checked_out" : item.lifecycleState,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        });

        // Write one transaction per original cart line (parsed.data.lines, not the aggregated map)
        // — preserves the original cart shape in history.
      }
      // Per-line transactions
      for (const line of parsed.data.lines) {
        const item = itemSnaps[itemIds.indexOf(line.itemId)].data()!;
        const txRef = adminDb.collection("transactions").doc();
        txIds.push(txRef.id);
        tx.set(txRef, {
          type: "checkout",
          itemId: line.itemId,
          itemSku: item.sku,
          itemName: item.name,
          eventId: input.eventId,
          eventName: event.name,
          qty: line.qty,
          actorUid: session.uid,
          actorName: session.displayName,
          actorRoleAtTimeOfAction: session.role,
          at: FieldValue.serverTimestamp(),
          notes: "",
          parentTxId: null,
          clientTxId: null,
        });
      }
    });
  } catch (err) {
    if ((err as Error).message === "STOCK_INSUFFICIENT") {
      return {
        ok: false,
        error: "One or more items are out of stock.",
        failedLines: (err as any).failed,
      };
    }
    throw err;
  }

  revalidatePath(`/events/${input.eventId}`);
  revalidatePath("/inventory");
  revalidatePath("/"); // dashboard
  return { ok: true, txIds };
}
```

**`useOptimistic` revert pattern** (Phase 1 already wires this in `scan-session.tsx` — Phase 2 only swaps the `commit` body):

```typescript
// In scan-session.tsx (Phase 2 update)
const commit = useCallback(async () => {
  setIsCommitting(true);
  // Optimistic apply already happened on addLine() — cart already reflects the decrement
  const result = await checkoutItem({ eventId: selectedEvent!.id, lines: cart });
  setIsCommitting(false);

  if (result.ok) {
    toast.success("Checked out", { description: `${result.txIds.length} items` });
    setCart([]); // clear cart
    router.push(`/events/${selectedEvent!.id}`);
  } else {
    // CO-05: revert + surface failed lines
    toast.error(result.error, {
      description: result.failedLines
        ?.map((f) => `Item ${f.itemId}: only ${f.available} available, requested ${f.requested}`)
        .join("; "),
    });
    // useOptimistic auto-reverts on the next render because the underlying
    // Firestore listener didn't change — the snapshot still shows original qty.
    // Just don't clear the cart; user can adjust qty and retry.
  }
}, [cart, selectedEvent, router]);
```

---

## Block F — Scan check-in

### 6.1 — `checkinItem` Server Action

```typescript
// app/(app)/events/[id]/checkin/actions.ts
"use server";
export async function checkinItem(input: {
  eventId: string;
  lines: {
    itemId: string;
    parentTxId: string; // CI-08: link back to originating checkout
    returnedQty: number;
    missingReason?: "Lost" | "Damaged" | "Not returned" | "Unknown";
    damaged?: boolean;
  }[];
}) {
  const session = await requireSession();
  // Event access check (same as checkout)
  // ...

  const missingIds: string[] = [];
  const txIds: string[] = [];

  await adminDb.runTransaction(async (tx) => {
    // For each line:
    //   1. Read the parent checkout tx (to know the originally-checked-out qty)
    //   2. Compute delta = checkedOutQty - returnedQty
    //   3. If delta > 0 → create missingItems doc + missing transaction
    //   4. If damaged === true → returnedQty goes to damagedQty NOT availableQty
    //   5. Otherwise → returnedQty goes to availableQty
    //   6. outQty decrements by checkedOutQty regardless (the qty IS no longer out)
    //   7. Write one checkin transaction per line with parentTxId
    for (const line of input.lines) {
      const itemRef = adminDb.collection("inventory").doc(line.itemId);
      const itemSnap = await tx.get(itemRef);
      const item = itemSnap.data()!;

      const parentTxRef = adminDb.collection("transactions").doc(line.parentTxId);
      const parentTxSnap = await tx.get(parentTxRef);
      const parentTx = parentTxSnap.data()!;
      const checkedOutQty = parentTx.qty;

      const missingDelta = Math.max(0, checkedOutQty - line.returnedQty);
      const returnedToAvailable = line.damaged ? 0 : line.returnedQty;
      const returnedToDamaged = line.damaged ? line.returnedQty : 0;

      tx.update(itemRef, {
        availableQty: item.availableQty + returnedToAvailable,
        damagedQty: (item.damagedQty ?? 0) + returnedToDamaged,
        outQty: item.outQty - checkedOutQty,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      });

      const txRef = adminDb.collection("transactions").doc();
      txIds.push(txRef.id);
      tx.set(txRef, {
        type: "checkin",
        itemId: line.itemId,
        itemSku: item.sku,
        itemName: item.name,
        eventId: input.eventId,
        eventName: parentTx.eventName,
        qty: line.returnedQty,
        actorUid: session.uid,
        actorName: session.displayName,
        actorRoleAtTimeOfAction: session.role,
        at: FieldValue.serverTimestamp(),
        notes: line.damaged ? "Damaged return" : "",
        parentTxId: line.parentTxId,
        clientTxId: null,
      });

      if (missingDelta > 0) {
        const missingRef = adminDb.collection("missingItems").doc();
        missingIds.push(missingRef.id);
        tx.set(missingRef, {
          id: missingRef.id,
          itemId: line.itemId,
          itemName: item.name,
          eventId: input.eventId,
          eventName: parentTx.eventName,
          qty: missingDelta,
          reason: line.missingReason ?? "Unknown",
          reportedBy: session.uid,
          reportedAt: FieldValue.serverTimestamp(),
          status: "open",
          resolvedAt: null,
          resolvedBy: null,
          parentCheckinTxId: txRef.id,
        });

        // MIS-01 + AUD-01: write a "missing" transaction for the audit trail
        const missTxRef = adminDb.collection("transactions").doc();
        tx.set(missTxRef, {
          type: "missing",
          itemId: line.itemId,
          itemSku: item.sku,
          itemName: item.name,
          eventId: input.eventId,
          eventName: parentTx.eventName,
          qty: missingDelta,
          actorUid: session.uid,
          actorName: session.displayName,
          actorRoleAtTimeOfAction: session.role,
          at: FieldValue.serverTimestamp(),
          notes: line.missingReason ?? "Unknown",
          parentTxId: line.parentTxId,
          clientTxId: null,
        });
      }
    }
  });

  revalidatePath(`/events/${input.eventId}`);
  revalidatePath("/reports/missing");
  revalidatePath("/inventory");
  return { ok: true as const, txIds, missingIds };
}
```

**Partial check-ins (CI-07):** multiple `checkinItem` calls against the same `parentTxId` are allowed — each writes a fresh checkin transaction. The "remaining open qty" is computed at read time: `parentTx.qty - SUM(children where type=checkin).returnedQty`.

### 6.2 — `resolveMissing` (MIS-03 / MIS-04)

```typescript
export async function resolveMissing(input: {
  missingId: string;
  resolution: "found" | "writtenOff";
}) {
  const session = await requireAdmin();
  // found → adds qty back to availableQty
  // writtenOff → decrements totalQty (the item is permanently gone)
  // Either way: missingItems.status flips + a follow-up transaction records the decision
  // ... transaction code ...
}
```

---

## Block G — Reports + Repurchase

### 7.1 — Cursor pagination (D-17 — the largest refactor)

**The URL contract change.**

Phase 1: `/inventory?page=2&q=mic&sort=name:asc&category=Audio`
Phase 2: `/inventory?cursor=eyJuYW1lIjoiTWljICIsImlkIjoiU0tVLU1JQy0xMCJ9&q=mic&sort=name:asc&category=Audio`

The cursor is base64(JSON of the sort field values + doc ID).

**Hook signature update** (modifies `lib/hooks/use-url-table-state.ts`):

```typescript
// New URL grammar: ?cursor=xxx&q=…&sort=…&filters=…
export type UrlTableState = {
  cursor: string | null; // null = first page
  q: string;
  sort: string;
  filters: Record<string, string>;
};

// In place of setPage: setCursor + advance helpers
return {
  state,
  setCursor: (nextCursor: string | null) => { /* push */ },
  setGlobalFilter, setSort, setFilter,
};
```

**Server Component reads the cursor:**

```typescript
// app/(app)/inventory/page.tsx
import { getInventoryPage } from "@/lib/data/inventory.server";

export default async function InventoryPage({
  searchParams,
}: { searchParams: Promise<{ cursor?: string; q?: string; sort?: string; category?: string }> }) {
  const params = await searchParams; // Next 16 async
  const cursor = params.cursor ? JSON.parse(atob(params.cursor)) : undefined;
  const { items, nextCursor } = await getInventoryPage({
    cursor,
    limit: 50,
    filters: { category: params.category },
  });
  const nextCursorEncoded = nextCursor ? btoa(JSON.stringify(nextCursor)) : null;
  return (
    <InventoryGrid
      initialItems={items}
      nextCursor={nextCursorEncoded}
      filters={{ category: params.category }}
    />
  );
}
```

**Client list takes over via `onSnapshot`:**

```typescript
// components/feature/inventory/InventoryGrid.tsx
"use client";
import { collection, query, where, orderBy, limit, startAfter, onSnapshot, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export function InventoryGrid({ initialItems, nextCursor, filters }: Props) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    // D-20: listener scoped to current page only
    let q = query(collection(db, "inventory"));
    if (filters.category) q = query(q, where("category", "==", filters.category));
    q = query(q, orderBy("name"), orderBy(documentId()), limit(50));
    // For the FIRST page only, listen for live updates. Subsequent pages
    // (cursor-driven) reuse the Server Component initial fetch + targeted listener.
    const unsubscribe = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(firestoreToItem));
    });
    return () => unsubscribe();
  }, [filters.category]);

  // Render table with manualPagination: true; "Next" button uses router.push with new cursor
}
```

**TanStack Table config:**
```typescript
useReactTable({
  data: items,
  columns,
  manualPagination: true,
  pageCount: -1, // unknown — Firestore can't tell us total
  state: { pagination: { pageIndex: 0, pageSize: 50 } },
  onPaginationChange: () => { /* no-op; we use router for nav */ },
});
```

**UI implication:** the "Page X of Y · K rows" footer becomes "Showing 1-50 · Next →" with NO total count. REP-06 (shareable filter URLs) preserved — the cursor IS the URL state.

### 7.2 — Dashboard KPI cards via `count()` (D-21)

```typescript
// app/(app)/page.tsx (dashboard)
import { adminDb } from "@/lib/firebase/admin";

export default async function DashboardPage() {
  const [totalItems, itemsOut, lowStockCount, activeEvents] = await Promise.all([
    adminDb.collection("inventory").where("lifecycleState", "!=", "retired").count().get(),
    adminDb.collection("inventory").where("outQty", ">", 0).count().get(),
    // Low stock: availableQty <= lowStockThreshold AND threshold > 0
    // Firestore can't compare two fields in a where() — must scan + filter client-side
    // For 5000 items, this is too expensive. Mitigation: pre-flag low-stock at write time
    // with a boolean `isLowStock` derived in Server Actions, then count() that.
    adminDb.collection("inventory").where("isLowStock", "==", true).count().get(),
    adminDb.collection("events").where("status", "==", "active").count().get(),
  ]);

  return <KpiCards
    totalItems={totalItems.data().count}
    itemsOut={itemsOut.data().count}
    lowStockCount={lowStockCount.data().count}
    activeEvents={activeEvents.data().count}
  />;
}
```

**Low-stock counter trap (CRITICAL):** Firestore `where()` cannot compare two fields against each other. `where("availableQty", "<=", "lowStockThreshold")` is **not a valid query**. Solutions:

**Option A (recommended):** Add a denormalized `isLowStock: boolean` field on each item. Update it in every Server Action that touches `availableQty` or `lowStockThreshold` (createItem, updateItem, adjustItemStock, checkoutItem, checkinItem, updateLowStockThreshold). Single `where("isLowStock", "==", true)` is index-friendly and cheap.

**Option B:** Cloud Function `onWrite inventory/{id}` recomputes `isLowStock`. Adds latency + breaks D-02's "exactly 2 Cloud Functions" lock.

**Decision:** Option A. Add `isLowStock: boolean` to the schema + update in all stock-changing Server Actions. Document in PROJECT.md as a derived field.

[VERIFIED: Firebase Firestore query limitations — no cross-field comparison]

### 7.3 — Low-stock listener for dashboard widget (D-20)

```typescript
// components/feature/dashboard/LowStockWidget.tsx
"use client";
import { onSnapshot, query, collection, where, limit } from "firebase/firestore";

export function LowStockWidget({ initial }: { initial: InventoryItem[] }) {
  const [items, setItems] = useState(initial);
  useEffect(() => {
    const q = query(
      collection(db, "inventory"),
      where("isLowStock", "==", true),
      limit(50), // D-20: scoped to first 50; widget shows "+ N more" if hit
    );
    return onSnapshot(q, (s) => setItems(s.docs.map(firestoreToItem)));
  }, []);
  // Phase 1 widget UI re-used; only the data source changes.
}
```

### 7.4 — Nav badge (RP-03)

```typescript
// components/layout/Nav.tsx
"use client";
import { getCountFromServer } from "firebase/firestore";
// On mount + on path changes, fetch the count. Not real-time (D-21 spirit).
// Or: subscribe to count via onSnapshot on `where('isLowStock','==',true).limit(1)`
// and use a separate count query refetched on changes — but count() is one-shot
// in Web SDK. Simpler: re-query on path change.
```

---

## Block H — Hardening

### 8.1 — Server Action audit checklist

Every `actions.ts` file MUST satisfy:

- [ ] First line is `"use server"`.
- [ ] Every exported function calls `await requireSession()` OR `await requireAdmin()` at the top.
- [ ] Input parsed with a Zod schema; failures return `{ ok: false, errors }`.
- [ ] Stock changes inside `adminDb.runTransaction`.
- [ ] Mutation followed by `revalidatePath(...)` for affected routes.
- [ ] Return type is `{ ok: true; ... } | { ok: false; error: string; ... }`.
- [ ] No Admin SDK call without prior auth verification.
- [ ] No raw error throws from Firebase Auth (`auth/email-already-exists`) leaked to client — wrap and map to user-friendly messages.

### 8.2 — Per-segment error boundaries

Create for each route group:

- `app/(app)/error.tsx` — app-wide catch-all (already in Phase 1; verify it doesn't expose Firebase error codes).
- `app/(app)/loading.tsx` — global skeleton during DAL fetch.
- `app/(app)/not-found.tsx` — 404 page.
- `app/(app)/inventory/[itemId]/not-found.tsx` — item-specific.
- `app/(app)/events/[eventId]/not-found.tsx` — event-specific.
- `app/unauthorized.tsx` — Next 16 paired with `unauthorized()` calls in DAL.

[CITED: node_modules/next/dist/docs/.../unauthorized.md]

### 8.3 — Offline banner (RES-02)

```typescript
// components/layout/OfflineBanner.tsx
"use client";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    setOnline(navigator.onLine);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }, []);
  if (online) return null;
  return <div role="alert" className="bg-destructive text-destructive-foreground px-4 py-2 text-sm">Offline — reconnect to scan.</div>;
}
```

Wire into `app/(app)/layout.tsx`. Scan pages also gate the scanner widget on `online === true`.

### 8.4 — Index audit

Run before each block ships: `firebase deploy --only firestore:indexes --dry-run` (the `--dry-run` flag isn't documented but `firebase firestore:indexes` outputs the current deployed set — diff against repo). Alternative: `gcloud firestore indexes composite list --format json` + diff.

### 8.5 — `revalidatePath` matrix

| Server Action | Paths to revalidate |
|---------------|--------------------|
| `createItem` / `updateItem` / `retireItem` / `adjustItemStock` / `markLowStockOrdered` / `updateLowStockThreshold` | `/inventory`, `/inventory/[itemId]`, `/`, `/reports/stock`, `/reports/repurchase` |
| `createEvent` / `updateEvent` | `/events`, `/events/[eventId]`, `/` |
| `cancelEvent` | `/events`, `/events/[eventId]`, `/`, `/reports/out`, `/reports/missing`, `/inventory` |
| `checkoutItem` | `/events/[eventId]`, `/inventory`, `/`, `/reports/out`, `/reports/history` |
| `checkinItem` | `/events/[eventId]`, `/inventory`, `/`, `/reports/out`, `/reports/missing`, `/reports/history` |
| `resolveMissing` | `/reports/missing`, `/inventory`, `/`, `/reports/history` |
| `inviteUser` / `setUserRole` / `disableUser` | `/users` |

---

## Cross-block concerns

### Multi-tab IndexedDB (D-19)

`persistentSingleTabManager` means only the first tab opened acquires the persistence lock; subsequent tabs run in memory-only mode and won't see offline reads. Acceptable for v1 (sole dev, one user at a time). Document in onboarding.

**Future:** swap to `persistentMultipleTabManager()` if multi-tab use surfaces.

### `cookies()`, `headers()`, `params`, `searchParams` are async-only (Next 16)

Every Server Component / Server Action / DAL function must `await` these. Codemod helps: `npx @next/codemod@canary upgrade latest`. Phase 1 already complies (verified by build success).

### `revalidatePath` vs `revalidateTag` vs `updateTag`

- `revalidatePath(path)` — purges the specific path. Use for narrow targeted invalidation after a Server Action.
- `revalidateTag(tag, profile)` — Next 16 requires the 2nd arg (cacheLife profile, e.g., `'max'`). Use only if `cacheLife/cacheTag` opt-in is used.
- `updateTag(tag)` — Server-Actions-only; tag must already be defined. Skip in v1 (we're not using cache tags).

**v1 strategy:** `revalidatePath` everywhere. No `revalidateTag` calls.

### Server Component → Client Component data flow (per ARCHITECTURE.md)

```typescript
// Server Component
const initial = await getInventoryPage(...);
return <InventoryGrid initialItems={initial.items} ... />;

// Client Component
"use client";
const [items, setItems] = useState(initialItems);
useEffect(() => onSnapshot(q, ...), []);
```

Pattern survives Phase 1 → Phase 2; only `getInventoryPage` swaps from mock-store-selector to Admin-SDK-query.

### Token revocation timing

After role change → Cloud Function calls `revokeRefreshTokens(uid)`. The user's currently-open page still has a valid ID token (up to 1h TTL). Two mitigations:

1. **Server-side revocation:** DAL's `verifySessionCookie(cookie, true)` rejects revoked sessions on next request → user redirected to `/login`.
2. **Client-side force-refresh:** Subscribe to `users/{uid}` doc; on update, call `user.getIdToken(true)` to force a refresh.

v1 ships only (1). User experience: role change takes effect on next navigation, not in real-time. Acceptable.

### App Check (planner-discretion)

Skip in v1 — adds reCAPTCHA Enterprise config + Storage rules clauses. Document as v2 hardening item.

---

## Index manifest (firestore.indexes.json per D-18)

```json
{
  "indexes": [
    { "collectionGroup": "transactions", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "eventId", "order": "ASCENDING" }, { "fieldPath": "at", "order": "DESCENDING" }] },
    { "collectionGroup": "transactions", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "itemId", "order": "ASCENDING" }, { "fieldPath": "at", "order": "DESCENDING" }] },
    { "collectionGroup": "transactions", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "actorUid", "order": "ASCENDING" }, { "fieldPath": "at", "order": "DESCENDING" }] },
    { "collectionGroup": "transactions", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "type", "order": "ASCENDING" }, { "fieldPath": "at", "order": "DESCENDING" }] },
    { "collectionGroup": "transactions", "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "eventId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "parentTxId", "order": "ASCENDING" },
        { "fieldPath": "at", "order": "DESCENDING" }
      ] },
    { "collectionGroup": "inventory", "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "lifecycleState", "order": "ASCENDING" },
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ] },
    { "collectionGroup": "inventory", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "isLowStock", "order": "ASCENDING" }, { "fieldPath": "name", "order": "ASCENDING" }] },
    { "collectionGroup": "events", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "startDate", "order": "ASCENDING" }] },
    { "collectionGroup": "events", "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "allowedStaff", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "ASCENDING" }
      ] },
    { "collectionGroup": "missingItems", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "reportedAt", "order": "DESCENDING" }] },
    { "collectionGroup": "missingItems", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "eventId", "order": "ASCENDING" }, { "fieldPath": "reportedAt", "order": "DESCENDING" }] },
    { "collectionGroup": "users", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "role", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" }] }
  ],
  "fieldOverrides": []
}
```

Deploy: `firebase deploy --only firestore:indexes`.

**Reactive growth (D-18):** when a new query throws `FAILED_PRECONDITION: The query requires an index`, the error message gives a console URL — **DO NOT CLICK IT** (INT-05 ban). Instead, copy the index definition into `firestore.indexes.json` and redeploy.

---

## Storage rules (storage.rules per D-13)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /items/{itemId}/photo.jpg {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.token.role == 'admin'
                   && request.resource.size < 5 * 1024 * 1024 // 5MB hard cap
                   && request.resource.contentType.matches('image/.*');
    }
    match /{allPaths=**} {
      allow read, write: if false; // deny-by-default
    }
  }
}
```

Deploy: `firebase deploy --only storage`.

---

## firestore.rules skeleton (D-06 mitigation)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ------- helpers -------
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

    // ------- users -------
    match /users/{uid} {
      // Any signed-in user can read their own doc; admins can read any.
      allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());
      // Only Admin SDK writes — block all client writes.
      // (Cloud Function 1 uses Admin SDK and bypasses rules.)
      allow create, update, delete: if false;
    }

    // ------- inventory -------
    match /inventory/{itemId} {
      allow read: if isSignedIn();
      allow create, delete: if isAdmin();
      allow update: if isAdmin()
        && request.resource.data.availableQty is number
        && request.resource.data.availableQty >= 0
        && request.resource.data.availableQty <= request.resource.data.totalQty;
    }

    // ------- events -------
    match /events/{eventId} {
      allow read: if isSignedIn() && isMember(resource);
      allow create: if isSignedIn(); // any signed-in user can create (EVT-01)
      // Admin or team lead (creator) can edit. Block edits to allowedStaff from clients
      // (Cloud Function 2 manages it via Admin SDK).
      allow update: if (isAdmin() || request.auth.uid in resource.data.teamLeads)
        && untouched('allowedStaff');
      allow delete: if isAdmin();
    }

    // ------- transactions (immutable, server-only writes) -------
    match /transactions/{txId} {
      allow read: if isSignedIn();
      allow create, update, delete: if false;
    }

    // ------- missingItems -------
    match /missingItems/{missingId} {
      allow read: if isSignedIn();
      // Server-only writes (Server Actions). MIS-03 resolution also goes through Admin SDK.
      allow create, update, delete: if false;
    }

    // ------- catch-all deny -------
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**D-06 manual audit checkpoint protocol** — at the end of each block introducing rules, the block's CLAIM.md must contain a `## Rules Audit` section listing:

1. Which paths were tested (e.g., `inventory/{itemId}` create, `events/{eventId}` read by non-member).
2. Test method (Firebase Console Rules Playground, manual browser test).
3. Result + screenshot/log.

Blocks A, C, D, E, F, G each get a rules-audit task at the end. Block H gets a cross-collection final audit.

---

## Common Pitfalls (Phase 2 specific)

### P1: Admin SDK leaks into client bundle

**Warning sign:** Build error `Module not found: Can't resolve 'firebase-admin/...'` from a Client Component.
**Fix:** Every file using `firebase-admin/*` MUST begin with `import 'server-only'` (PITFALLS C6).

### P2: `cookies()` / `headers()` used synchronously

**Warning sign:** TS error `Argument of type 'Promise<ReadonlyRequestCookies>' is not assignable to ...`.
**Fix:** `const cookieStore = await cookies();` (Next 16 async-only). [VERIFIED: node_modules/next/dist/docs/.../version-16.md]

### P3: `proxy.ts` with Edge runtime export

**Warning sign:** Build error `runtime config is not available in proxy files`.
**Fix:** Don't add `export const runtime`. Next 16's proxy is Node-only by spec. [CITED: node_modules/next/dist/docs/.../proxy.md]

### P4: Multi-tab IndexedDB lock collision

**Warning sign:** Console warning `Cannot acquire IndexedDB persistence lock`.
**Fix:** Accept v1 single-tab limit; document. Swap to `persistentMultipleTabManager()` in v2 if needed.

### P5: Cloud Function infinite loop (self-write)

**Warning sign:** Function logs show `onEventTeamChange` firing repeatedly on the same event.
**Fix:** Guard against the function's own writes via the before/after diff check (shown in `syncAllowedStaff.ts` above).

### P6: `setCustomUserClaims` rate limit

**Warning sign:** `auth/too-many-requests` from Cloud Function.
**Fix:** Skip if claims are already correct (shown in `setCustomUserClaims.ts` above). The function only writes claims if the new role differs from existing.

### P7: Stale claims after role change

**Warning sign:** Demoted admin still sees admin nav for up to 1h.
**Fix:** Cloud Function calls `revokeRefreshTokens(uid)` — forces fresh ID token on next request. The DAL's `verifySessionCookie(cookie, true)` rejects revoked sessions. Document UX expectation: "Role changes apply on next navigation."

### P8: Transaction read-then-write doesn't see same-tx writes

**Warning sign:** Cart with two lines of the same item sees `availableQty: X` on the second line read inside the same `runTransaction`.
**Fix:** Aggregate per-item BEFORE the transaction (shown in `checkoutItem.ts` above). Inside the transaction, do all reads first, then all writes. [VERIFIED: Firestore runTransaction semantics]

### P9: Cursor invalidation on filter change

**Warning sign:** User changes `?category=Audio&cursor=xxx` from Audio → Lighting; cursor was relative to Audio docs and points into unrelated data.
**Fix:** Clear the cursor whenever a filter changes. `useUrlTableState` must call `n.delete('cursor')` in `setFilter` and `setGlobalFilter` (existing behavior preserved).

### P10: Listener bills on tab background

**Warning sign:** Firestore costs spike for users who leave the dashboard open.
**Fix:** D-20 partially mitigates (50-row scope). Additional: detach listeners on `visibilitychange === 'hidden'` (PITFALLS real-time listener cost runaway).

### P11: `isLowStock` denorm drift

**Warning sign:** Dashboard low-stock count doesn't match the items shown in the widget.
**Fix:** Every Server Action that touches `availableQty` or `lowStockThreshold` must recompute `isLowStock = availableQty <= lowStockThreshold && lowStockThreshold > 0` and write it in the same transaction. Add to the audit checklist.

### P12: `generatePasswordResetLink` doesn't email

**Warning sign:** Admin invites a user → no email arrives.
**Fix:** D-09's "show the link with Copy button" already accepts this. The Admin SDK method returns the URL only — Firebase's built-in template is only triggered by Web SDK's `sendPasswordResetEmail` (which goes via Auth's REST API path that does send).

### P13: `bwip-js` server-side import in Client Component

**Warning sign:** Bundle bloat in client chunks.
**Fix:** `bwip-js/browser` for client; `@bwip-js/node` for server. Already wired correctly in Phase 1.

---

## Validation Architecture

`workflow.nyquist_validation` is not enabled in `.planning/config.json` for this project (check at plan time). Skip this section unless config changes.

Manual verification per block (mandatory):
- `npm run build` passes.
- `tsc --noEmit` passes.
- `npm run lint` passes.
- Manual click-through of affected routes against live Firebase project.
- Rules audit checkpoint logged in CLAIM.md (D-06).

---

## Risks + Open Questions

### Risks the spike must resolve (Block A first day)

1. **`next-firebase-auth-edge` v1.12 + Next 16.2.6 compatibility** — library claims support but v1.12 is recent (Feb 2026). If the spike fails, fall back to hand-rolled session-cookie management via `admin.auth().createSessionCookie()` + custom Route Handlers + cookie parsing in `proxy.ts`. Spike artifacts at `.planning/spikes/next-firebase-auth-edge-v1.12/`.
2. **Cookie size on Firebase Hosting** — default config bundles session into one cookie. If multi-claim setup pushes near 4KB, enable `enableMultipleCookies: true`. v1 has only `role` claim — should fit.

### Risks for the planner to flag

3. **PITFALLS C3 (rules misconfig data leak)** — D-06 leaves this PARTIALLY UNMITIGATED. Planner adds rules-audit task at end of each block introducing rules (A, C, D, E, F, G).
4. **PITFALLS C5 (stuck-out items)** — D-02 explicitly defers the nightly scanner. Operations handle via `/reports/out`. Planner should add a note in `/reports/out` UI: "Items overdue must be reconciled manually — open the event and run check-in."
5. **Cursor-stale data on long sessions** — if a user lingers on page 5, then page 1 sees new items inserted; navigating back doesn't show them. Mitigation: page 1 has a live `onSnapshot` (D-20 page-scoped listener); cursor pages 2+ stay stale until refresh. Acceptable.
6. **`isLowStock` denormalization** — adds field to inventory schema + write-time updates in 6 Server Actions. Easy to miss one. Audit checklist item.
7. **CHANGELOG.md required entry per D-06** — global CLAUDE.md docs gate mandates this. Planner must include a docs task at Block A.

### Open questions for the planner

8. **Firestore region** — recommend `asia-southeast1` for Hong Kong, but verify with stakeholder if data sovereignty matters. Affects Cloud Function region too.
9. **Storage bucket region** — should match Firestore region for cost.
10. **App URL for `actionCodeSettings.url`** — `NEXT_PUBLIC_APP_URL` env var required; in dev = `http://localhost:3000`, in prod = TBD. Block on first deploy.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Firestore region = `asia-southeast1` | 2.3, 2.4 | Cross-region latency on Cloud Functions if mismatched |
| A2 | `next-firebase-auth-edge` v1.12 works with Next 16.2.6 | 1.4 | Spike fails → fallback to hand-rolled session cookie code (more work for Block A) |
| A3 | `generatePasswordResetLink` does NOT send the email via Admin SDK | 2.5 | If wrong (Firebase changed behavior), D-09 fallback path is redundant — no harm |
| A4 | `isLowStock` denormalization is required because `where()` can't compare two fields | 7.2 | Verified by Firestore docs — query syntax has no cross-field operator. Solid. |
| A5 | `persistentLocalCache` replaces `enableIndexedDbPersistence` per firebase v10+ | 1.2 | If we revert to `enableIndexedDbPersistence` it still works (deprecated but functional). Either path is fine. |
| A6 | Cloud Function 2 self-write guard prevents infinite trigger loop | 2.4 | Untested in this project. Standard pattern; verify in Block D execution. |
| A7 | `setCustomUserClaims(uid, null)` strips claims | 2.3 | [CITED: Firebase docs] |
| A8 | Single-tab IndexedDB persistence is acceptable for v1 | 1.2, Cross-block | If multi-tab use surfaces, swap to `persistentMultipleTabManager`. Reversible decision. |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — proxy.ts spec, Node-only runtime, matcher, version history
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — Next 16 breaking changes (read earlier in research)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/unauthorized.md` — Next 16 `unauthorized()` navigation function
- `.planning/research/STACK.md` — locked library versions
- `.planning/research/ARCHITECTURE.md` — Firestore collections schema, auth pattern, folder structure
- `.planning/research/PITFALLS.md` — C1-C6 critical risks + per-category traps
- `.planning/research/SUMMARY.md` — cross-cutting synthesis
- `.planning/research/FEATURES.md` — competitor UX patterns (Cheqroom scan-cart, EZRentOut Bluetooth, Snipe-IT audit feed)
- `package.json` — locked deps verified
- `lib/mock/store.ts` + `lib/types/*.ts` + `lib/hooks/use-mock-store.ts` + `lib/hooks/use-url-table-state.ts` — Phase 1 surface to swap

### Secondary (MEDIUM confidence)
- [next-firebase-auth-edge v1.12 docs (Feb 2026)](https://next-firebase-auth-edge-docs.vercel.app/docs/usage/middleware) — proxy.ts setup, authMiddleware options, cookie configuration
- [next-firebase-auth-edge GitHub](https://github.com/awinogrodzki/next-firebase-auth-edge) — version verification (v1.12.0)
- [Firebase Auth — Manage Session Cookies](https://firebase.google.com/docs/auth/admin/manage-cookies) — `verifySessionCookie(cookie, checkRevoked)` semantics
- [Firestore — Aggregation queries](https://firebase.google.com/docs/firestore/query-data/aggregation-queries) — `getCountFromServer`, `getAggregateFromServer`
- [Firestore — Offline data](https://firebase.google.com/docs/firestore/manage-data/enable-offline) — `persistentLocalCache` API
- [Firebase Functions v2 — Firestore triggers](https://firebase.google.com/docs/firestore/extend-with-functions-2nd-gen) — `onDocumentWritten`
- [Firebase Auth — Custom Claims & Security Rules](https://firebase.google.com/docs/auth/admin/custom-claims) — `setCustomUserClaims`, claims propagation, `revokeRefreshTokens`
- [Next.js — revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) — server-only, post-mutation invalidation
- [browser-image-compression npm](https://www.npmjs.com/package/browser-image-compression) — `maxSizeMB`, `maxWidthOrHeight`, TypeScript support

### Tertiary (LOW confidence — needs spike verification)
- next-firebase-auth-edge `enableMultipleCookies` behavior on Firebase Hosting — assumed defaults work for single-claim setup
- Cloud Function trigger latency on `asia-southeast1` — assumed <2s

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library version verified against `package.json` and `node_modules/`
- Architecture: HIGH — leverages existing research/ARCHITECTURE.md + ROADMAP block structure
- Auth wire-up: MEDIUM — `next-firebase-auth-edge` v1.12 + Next 16 compatibility hinges on the spike (D-01)
- Cloud Functions: HIGH — APIs verified; self-write guard is standard pattern
- Cursor pagination: MEDIUM-HIGH — Firestore APIs verified; UI refactor scope sized
- Photo upload: HIGH — `browser-image-compression` widely used; reuses Phase 1 camera pattern
- Rules: MEDIUM — skeleton is conservative deny-by-default; D-06 manual audit fills the gap

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (30 days; auth-edge library + Firebase APIs are stable)

---

## RESEARCH COMPLETE

**5-line summary:**

1. Phase 2 is a data-source swap powered by Phase 1's deliberately Firestore-shaped mock contracts — 14 mock-store mutators map 1:1 to Server Actions, the mock cookie payload mirrors the `__session` decoded shape, and entity types already match the Firestore data model.
2. Block A (Foundation) is gated by a 1-day `next-firebase-auth-edge` v1.12 spike with 6 explicit pass criteria; on spike failure, fall back to hand-rolled session-cookie management via `admin.auth().createSessionCookie()` + custom Route Handlers.
3. The two material rewrites are (a) auth via `proxy.ts` (NOT `middleware.ts`, Node-only runtime per Next 16) + `verifySession()` DAL with React.cache + `verifySessionCookie(cookie, true)` revocation check, and (b) D-17's cursor pagination — `?page=N` becomes `?cursor=xxx` on every list page, hook signature changes, TanStack Table goes `manualPagination: true` with no total count.
4. Cloud Functions surface is exactly 2 per D-02 (setCustomUserClaims onWrite users, allowedStaff sync onWrite events + onWrite users); add `isLowStock` denormalization in 6 Server Actions because Firestore `where()` cannot compare two fields against each other (`availableQty <= lowStockThreshold` requires the denorm); rules ship deny-by-default + manual per-block audit checkpoints per D-06's mitigation of skipped rules-unit-tests.
5. Photo upload reuses Phase 1's ScannerWidget camera-permission pattern + `browser-image-compression` (compress to 300KB / 1600px / JPEG 0.85) + Storage path `items/{itemId}/photo.jpg` (replace-only); `useOptimistic` already wired in Phase 1's scan-cart so Block E only swaps `store.checkout` → `checkoutItem` Server Action with `runTransaction` invariant assert + per-line transaction writes — cart commits atomically per CO-04/CO-05/CO-06.

**File created:** `/Users/ka.yin.leong/Documents/cy-eventsystem/.planning/phases/phase-kayinleong-02/02-RESEARCH.md`
