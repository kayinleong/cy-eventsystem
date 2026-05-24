# Architecture Research — cy-eventsystem

**Researched:** 2026-05-24
**Stack:** Next.js 16.2.6 + React 19.2.4 + shadcn/ui + Tailwind v4 + Firebase (Auth + Firestore + Storage)
**Confidence:** HIGH

---

## High-level diagram

```
                          ┌──────────────────────────────────────────────┐
                          │                    BROWSER                   │
                          │  ┌────────────────────────────────────────┐  │
                          │  │  React 19 Client Components            │  │
                          │  │  - Scanner (camera, ZXing)             │  │
                          │  │  - Real-time inventory grid (onSnap.)  │  │
                          │  │  - Forms (useActionState, optimistic)  │  │
                          │  │  - shadcn/ui primitives                │  │
                          │  └──────┬────────────────────┬────────────┘  │
                          │  reads  │ (onSnapshot)       │ writes (RSC)  │
                          │  ▼      ▼                    ▼               │
                          │  ┌───────────────┐   ┌──────────────────┐    │
                          │  │ Firestore     │   │ Server Action    │    │
                          │  │ Web SDK       │   │ (POST to RSC)    │    │
                          │  │ (IndexedDB    │   │                  │    │
                          │  │  cache)       │   │                  │    │
                          │  └──────┬────────┘   └────────┬─────────┘    │
                          └─────────┼─────────────────────┼──────────────┘
                                    │ rules-gated         │ HTTPS + __session
              ┌─────────────────────┼─────────────────────┼──────────────────┐
              │                     ▼                     ▼                  │
              │           ┌──────────────────┐  ┌───────────────────────┐    │
              │           │  FIRESTORE       │  │  NEXT.JS 16 SERVER    │    │
              │           │  (rules)         │  │  ┌─────────────────┐  │    │
              │           │  collections:    │  │  │ proxy.ts        │  │    │
              │           │   users          │  │  │ (optimistic     │  │    │
              │           │   inventory      │  │  │  cookie check)  │  │    │
              │           │   events         │  │  └────────┬────────┘  │    │
              │           │   transactions   │  │           │           │    │
              │           │   missingItems   │  │  ┌────────▼────────┐  │    │
              │           │                  │◀─┼──┤ Admin SDK       │  │    │
              │           │                  │  │  │ (server-only)   │  │    │
              │           └──────┬───────────┘  │  └─────────────────┘  │    │
              │                  │              └───────────────────────┘    │
              │                  ▼                                           │
              │           ┌──────────────────┐                               │
              │           │  CLOUD FUNCTIONS │                               │
              │           │  - onUserWrite   │                               │
              │           │    (sync claims) │                               │
              │           │  - maintain      │                               │
              │           │    allowedStaff  │                               │
              │           └──────────────────┘                               │
              │                  FIREBASE                                    │
              └──────────────────────────────────────────────────────────────┘
```

**Data flow rules:**
- **Reads (real-time):** Client → Firestore (direct, rules gate). Server Components do initial fetch via Admin SDK for SSR hydration seed.
- **Writes (stock-changing):** Client → Server Action → Admin SDK → Firestore. **Never** direct client writes for stock-changing operations.
- **Reads (audit/history):** Server Component → Admin SDK → Firestore.

---

## Firestore Data Model

### `users/{uid}`

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | matches doc id |
| `email` | string | indexed (admin search) |
| `displayName` | string | |
| `role` | `"admin"` \| `"staff"` | source of truth; mirrored to custom claims |
| `disabled` | boolean | soft-disable |
| `createdAt`, `createdBy` | Timestamp, uid | |
| `lastLoginAt` | Timestamp | updated on session creation |

**Writes:** created by Server Action on admin invite. `role` updates trigger Cloud Function to sync custom claims.

**Indexes:** `role + createdAt`, single-field on `email`.

### `inventory/{itemId}`

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | |
| `sku` | string | unique; scanned barcode payload |
| `category` | string | "Audio", "Lighting", etc. |
| `totalQty` | number | owned by org; rarely changes |
| `availableQty` | number | atomically updated in transaction |
| `outQty` | number | redundant projection (`totalQty - availableQty`) |
| `unit` | string | "pcs", "set" |
| `photoUrl` | string \| null | Firebase Storage URL |
| `notes` | string | |
| `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | | |

**Writes:** CRUD admin-only. Stock fields updated **only** inside a Firestore transaction that simultaneously writes a `transactions` log entry.

**Hot path:** `inventory where sku == X limit 1` (scan lookup).

**Indexes:** auto on `sku`, composite `category + name`, single-field `availableQty`.

### `events/{eventId}`

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | |
| `startDate`, `endDate` | Timestamp | |
| `status` | `"planned"` \| `"active"` \| `"completed"` \| `"cancelled"` | |
| `location`, `description` | string | |
| `teamLeads` | string[] (uids) | primary owners |
| `backupTeams` | string[] (uids) | backup staff who can act on event |
| `allowedStaff` | string[] (uids) | **denormalized** union of `teamLeads + backupTeams + admins`. Used in security rules for cheap `array-contains-any`. Recomputed by Cloud Function on team changes. |
| `plannedItems` | map `{[itemId]: {plannedQty, notes}}` | optional pre-event plan |
| `createdAt`, `createdBy`, `closedAt`, `closedBy` | | |

**Why `allowedStaff` denormalized:** Firestore rules can't efficiently OR across multiple arrays. Single `array-contains-any` on `allowedStaff` is O(1).

**Indexes:** `status + startDate`, `allowedStaff + startDate`.

### `transactions/{txId}` — immutable audit log

Append-only event log. `inventory.availableQty` is a materialized projection.

| Field | Type | Notes |
|-------|------|-------|
| `type` | `"checkout"` \| `"checkin"` \| `"adjustment"` \| `"missing"` | |
| `itemId`, `itemSku`, `itemName` | string | denormalized for report perf |
| `eventId`, `eventName` | string | denormalized |
| `qty` | number | always positive; sign implied by `type` |
| `actorUid`, `actorName` | | |
| `at` | Timestamp | `serverTimestamp` |
| `notes` | string | |
| `parentTxId` | string \| null | links check-in to check-out |
| `clientTxId` | string \| null | optional idempotency key |

**Writes:** created inside a Firestore transaction alongside inventory update. **Immutable:** rules deny update/delete. Corrections are new "adjustment" transactions.

**Indexes:** `eventId + at desc`, `itemId + at desc`, `eventId + type + parentTxId + at`, `at desc`.

**Top-level (not subcollection)** so items have their own history queries spanning events.

### `missingItems/{missingId}`

| Field | Type | Notes |
|-------|------|-------|
| `itemId`, `itemName`, `eventId`, `eventName` | denormalized | |
| `qty` | number | |
| `reportedBy`, `reportedAt` | | |
| `status` | `"open"` \| `"found"` \| `"writtenOff"` | |
| `resolvedAt`, `resolvedBy` | nullable | |
| `parentCheckinTxId` | string | |

### Hybrid lifecycle (log + mutable projection)

- **Source of truth:** `transactions` (immutable).
- **Fast-read projection:** `inventory.availableQty` / `outQty` (mutable, atomic with tx writes).
- **Open-checkout set:** `transactions where parentTxId == null and type == "checkout"`.

O(1) current state + full auditability. Every state change touches both atomically.

---

## Auth + Authz

### Firebase Auth with session cookies

```
Login:
  Client:  signInWithEmailAndPassword(auth, email, pw)         // Web SDK
           idToken = await user.getIdToken()
           POST /api/auth/session { idToken }                  // Route Handler
              └─ Server: admin.auth().createSessionCookie(idToken, { expiresIn: 5d })
                        cookies().set('__session', ..., { httpOnly, secure, sameSite: 'lax' })
           router.push('/dashboard')

Every request:
  proxy.ts (NOT middleware.ts — Next.js 16 rename)
    - reads __session cookie
    - OPTIMISTIC check only (do NOT verify with Admin SDK; runs on every prefetch)
    - missing cookie on protected route → redirect /login
    - present cookie on auth route → redirect /dashboard

Server Components / Server Actions:
    - call verifySession() from lib/auth/dal.ts (React.cache wrapped)
    - admin.auth().verifySessionCookie(cookie, true)  // checks revocation
    - returns { uid, role, email, displayName } or calls unauthorized()
```

**Why session cookies (not ID tokens):** session cookies last 5–14 days; revokable server-side; `httpOnly` protects from XSS.

### Role storage: hybrid

Store role in **both** custom claims AND `users.role`.

| Storage | Used For | Why |
|---------|----------|-----|
| **Custom claims** | Firestore rules (`request.auth.token.role == 'admin'`); cheap Server Action checks | Free to read; no doc fetch |
| **`users.role`** | Admin UI; queryable lists | Cannot query custom claims |

**Sync:** Cloud Function `onWrite` on `users/{uid}` → `setCustomUserClaims(uid, { role })`. Firestore is source of truth.

**Caveat:** Custom claims propagate only on token refresh (~1h). On role demotion, also `revokeRefreshTokens(uid)`.

### Defense in depth (where role checks happen)

| Layer | What it checks | Failure mode |
|-------|----------------|--------------|
| 1. `proxy.ts` | cookie present? optimistic only | redirect to /login |
| 2. Server Component / Layout | `verifySession()` via DAL; `verifySessionCookie(cookie, true)` | `unauthorized()` → `app/unauthorized.tsx` |
| 3. Server Action | re-runs `verifySession()` + role check per action | `{ ok: false, error }` |
| 4. Firestore Security Rules | final gatekeeper using `request.auth.token.role` | `permission-denied` |

**Critical:** Server Actions are POST-reachable — proxy alone is insufficient. Every Server Action **must** verify auth + role independently.

### Admin-invite-only registration

No invite tokens. Use Firebase's built-in password-reset link.

1. Admin fills "Invite User" form.
2. Server Action `inviteUser(...)`:
   - `admin.auth().createUser({ email, displayName, disabled: false })`
   - `admin.auth().generatePasswordResetLink(email)` → invitee gets a signed time-limited URL
   - Write `users/{uid}` doc with role, createdBy
   - Email link (Firebase built-in or SendGrid)
3. No public `/register` route. Only login + reset.

---

## Next.js App Router structure

### Server vs Client split

Default Server Components. `'use client'` only for:

| Page / component | Type | Why |
|---|---|---|
| Inventory list (page) | Server | Admin-SDK initial fetch, streamed |
| Inventory grid (nested) | Client | `onSnapshot` listener |
| Event detail (page) | Server | static metadata + history |
| "Items currently out" panel | Client (nested) | `onSnapshot` to open transactions |
| Scanner pages | Client (entirely) | camera, multi-step flow |
| Forms | Client form + Server Action | `useActionState`, `useOptimistic` |
| Login / forgot-pw / set-pw | Client | Firebase Web SDK in browser |
| Reports | Server | aggregated server-side |
| Admin user list | Server (list) + Client (row actions) | static + interactive menus |
| Nav / sidebar | Server | user info via DAL |

**Pattern:** server shells with client islands. Push `'use client'` to smallest leaf.

### Server Actions checklist

1. `'use server'` directive
2. `await verifySession()` at top
3. Role check for specific action
4. Zod validation of inputs
5. Mutation inside transaction where stock changes
6. `revalidatePath(...)` after success
7. Return typed `{ ok: true, data } | { ok: false, error }`

### Firebase client SDK vs Admin SDK

| When | SDK | File |
|------|-----|------|
| Login / signOut / getIdToken | Web SDK `firebase/auth` | `lib/firebase/client.ts` |
| Real-time listeners | Web SDK `firebase/firestore` | `lib/firebase/client.ts` |
| Storage uploads (client) | Web SDK `firebase/storage` | `lib/firebase/client.ts` |
| Server Component initial fetch | Admin SDK | `lib/firebase/admin.ts` — `import 'server-only'` |
| Server Action transactions | Admin SDK | `lib/firebase/admin.ts` |
| Verify session cookies / set claims / revoke | Admin SDK | `lib/firebase/admin.ts` |

**Admin SDK bypasses rules** — server is trusted, so DAL must enforce auth/role before any Admin SDK call.

---

## State management

No global client state library. Default to React state + URL + Firestore listeners + Server Components.

| State | Lives in |
|-------|----------|
| Auth state | Server (DAL via cookie) + client mirror (`onAuthStateChanged`) |
| Filter / search / pagination | URL search params |
| Real-time data | Firestore listeners in Client Components |
| Initial render seed | Server Component fetch via Admin SDK → props |
| Form state | `useActionState` or `useState` |
| Multi-step scan flow | Client `useReducer` |
| Pending optimistic updates | React 19 `useOptimistic` |
| Toasts | shadcn `sonner` |

**TanStack Query? Not in MVP.** Firestore listeners + IndexedDB cache already give caching + offline + real-time. Defer until non-realtime aggregate views are needed.

**Real-time pattern:**
```ts
// Server Component
export default async function Page() {
  await verifySession()
  const initial = await getInventoryServer()   // Admin SDK
  return <InventoryGrid initial={initial} />
}

// 'use client'
export function InventoryGrid({ initial }) {
  const items = useInventoryLive(initial)  // onSnapshot, seeded
  return <Grid items={items} />
}
```

Seed kills "no data → flash → data" jank. Listener takes over after hydration.

---

## Concurrency + integrity

### No-negative-qty: Firestore transaction inside Server Action

```ts
'use server'
export async function checkoutItem({ eventId, itemId, qty }) {
  const session = await verifySession()
  if (qty <= 0) return { ok: false, error: 'qty must be positive' }

  const event = await getEventWithAccessCheck(eventId, session)
  if (!event) return { ok: false, error: 'Not allowed for this event' }

  const itemRef = adminDb.collection('inventory').doc(itemId)
  const txRef = adminDb.collection('transactions').doc()

  try {
    await adminDb.runTransaction(async (t) => {
      const itemSnap = await t.get(itemRef)
      if (!itemSnap.exists) throw new BizError('Item not found')
      const available = itemSnap.data().availableQty
      if (available < qty) throw new BizError(`Only ${available} available`)

      t.update(itemRef, {
        availableQty: FieldValue.increment(-qty),
        outQty:       FieldValue.increment(qty),
        updatedAt:    FieldValue.serverTimestamp(),
        updatedBy:    session.uid,
      })
      t.set(txRef, { type: 'checkout', itemId, eventId, qty, actorUid: session.uid,
                     at: FieldValue.serverTimestamp(), parentTxId: null, /* + denormalized fields */ })
    })
    revalidatePath(`/events/${eventId}`); revalidatePath('/inventory')
    return { ok: true, txId: txRef.id }
  } catch (e) {
    if (e instanceof BizError) return { ok: false, error: e.message }
    throw e
  }
}
```

**Three protections stacked:**
1. Server-side transaction with explicit check — primary defense
2. Firestore security rule enforces `availableQty >= 0` on client writes (Admin SDK bypasses)
3. Client-side disable button when `availableQty - inFlight <= 0` — UX only

### Firestore rules sketch

```js
match /inventory/{itemId} {
  allow read: if request.auth != null;
  allow create, delete: if isAdmin();
  allow update: if isAdmin()
    && request.resource.data.availableQty is number
    && request.resource.data.availableQty >= 0
    && request.resource.data.availableQty <= request.resource.data.totalQty;
}
match /transactions/{txId} {
  allow read: if request.auth != null;
  allow create, update, delete: if false;  // Server-only via Admin SDK
}
function isAdmin() { return request.auth.token.role == 'admin'; }
```

### Concurrent staff scenario

A and B both want qty 5, only 7 available:
- Firestore serializes transactions; first wins (7 → 2).
- Second sees `available=2`, throws "Only 2 available."
- `onSnapshot` pushes `availableQty=2` to both clients in ~100–300ms; UI auto-corrects.

### Offline-safe writes

Stock-changing writes go through Server Actions → **Firestore offline queue does NOT help**.

**MVP:** require online for scan operations. Show "Offline — reconnect to scan" banner.
**Phase 3:** queue scans in IndexedDB locally + replay via background sync.

Reads (browsing) DO work offline via Firestore IndexedDB cache.

---

## Folder structure

```
app/
├── (auth)/                          # Route group — auth shell (no nav)
│   ├── layout.tsx                   # Minimal centered card
│   ├── login/page.tsx               # Client — Web SDK signIn
│   ├── forgot-password/page.tsx
│   └── set-password/page.tsx
│
├── (app)/                           # Route group — main app shell
│   ├── layout.tsx                   # Server — verifySession(); renders nav
│   ├── unauthorized.tsx
│   │
│   ├── dashboard/page.tsx           # Server — active events + alerts
│   │
│   ├── inventory/
│   │   ├── page.tsx
│   │   ├── new/page.tsx             # Admin-only
│   │   ├── [itemId]/
│   │   │   ├── page.tsx
│   │   │   └── edit/page.tsx        # Admin-only
│   │   ├── _components/
│   │   │   ├── inventory-grid.tsx   # 'use client'
│   │   │   ├── item-form.tsx
│   │   │   └── item-row.tsx
│   │   └── _actions.ts              # 'use server'
│   │
│   ├── events/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   ├── [eventId]/
│   │   │   ├── page.tsx
│   │   │   ├── edit/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   ├── checkin/page.tsx
│   │   │   └── _components/
│   │   └── _actions.ts
│   │
│   ├── scan/                        # Dedicated scanner pages
│   │   ├── page.tsx                 # Mode toggle
│   │   ├── _components/
│   │   │   ├── scanner.tsx          # 'use client' — camera + ZXing
│   │   │   ├── event-picker.tsx
│   │   │   └── qty-entry.tsx
│   │   └── _actions.ts              # checkoutItem, checkinItem
│   │
│   ├── reports/
│   │   ├── stock/page.tsx
│   │   ├── out/page.tsx
│   │   ├── missing/page.tsx
│   │   ├── history/page.tsx
│   │   └── repurchase/page.tsx
│   │
│   ├── users/                       # Admin-only
│   │   ├── page.tsx
│   │   ├── invite/page.tsx
│   │   └── _actions.ts
│   │
│   └── settings/page.tsx
│
├── api/
│   └── auth/
│       ├── session/route.ts         # POST — create session cookie
│       └── logout/route.ts          # POST — revoke + clear
│
├── layout.tsx                       # Root layout
├── globals.css
├── error.tsx
├── not-found.tsx
└── page.tsx                         # Redirect /dashboard | /login

components/
├── ui/                              # shadcn primitives — via CLI
├── auth/auth-provider.tsx           # Client — onAuthStateChanged
├── layout/
│   ├── app-shell.tsx                # Server
│   ├── nav.tsx
│   └── user-menu.tsx
└── feature/
    ├── inventory-picker.tsx
    └── event-picker.tsx

lib/
├── firebase/
│   ├── client.ts                    # Web SDK init
│   └── admin.ts                     # Admin SDK — 'server-only'
├── auth/
│   ├── dal.ts                       # 'server-only' — verifySession (cache)
│   ├── roles.ts                     # 'server-only'
│   └── client-auth.ts               # 'use client'
├── data/                            # 'server-only' — read helpers
│   ├── inventory.server.ts
│   ├── events.server.ts
│   ├── transactions.server.ts
│   └── users.server.ts
├── hooks/                           # 'use client'
│   ├── use-inventory-live.ts
│   ├── use-event-items-out.ts
│   ├── use-current-user.ts
│   └── use-barcode-scanner.ts
├── schemas/                         # Zod — shared server↔client
├── types/                           # Shared TS types
├── mock/                            # PHASE 1 ONLY
└── utils.ts                         # cn() + helpers

proxy.ts                             # Next.js 16 (NOT middleware.ts)
firestore.rules
firestore.indexes.json
storage.rules
firebase.json
```

---

## Phase 2 build order (dependency-ordered)

### Block A — Foundation
1. Firebase project + envs. Auth (Email/Password), Firestore (native), Storage. Service account → env.
2. `lib/firebase/client.ts` + `lib/firebase/admin.ts`. Smoke test.
3. `firestore.rules` v1 — lockdown. Auth-required reads, no client stock writes.
4. Auth flow: login + session cookie + logout + `proxy.ts` cookie check + `verifySession()` DAL.
5. Forgot-password + set-password pages.
6. `app/(app)/layout.tsx` role gate.

### Block B — Users + roles
7. `users` schema + first admin seed.
8. Cloud Function `onWrite users/{uid}` → `setCustomUserClaims`.
9. DAL: extend `verifySession()` to return role from claims.
10. Admin user-management UI + `inviteUser` / `setUserRole`.

### Block C — Inventory CRUD
11. `inventory` schema + Zod types.
12. `firestore.rules` for inventory.
13. Inventory list page + grid (Server seed + `onSnapshot`).
14. Create/edit/delete Server Actions (admin-only). SKU uniqueness inside transaction.
15. Optional: photo upload to Storage.

### Block D — Events
16. `events` schema with team fields + `allowedStaff` denormalized.
17. Cloud Function to maintain `allowedStaff`.
18. Event list / detail / create / edit pages.
19. `firestore.rules` for events.
20. Team membership editor (admin-only).

### Block E — Scan-driven check-out
21. Scanner component. Camera permission, ZXing decode.
22. `checkoutItem` Server Action with transaction.
23. Scan flow UI: scanner → item lookup → event picker → qty entry → commit.
24. Optimistic UI via `useOptimistic`.
25. `transactions` collection rules.

### Block F — Scan-driven check-in
26. `checkinItem` Server Action. Decrements `outQty`, increments `availableQty`, creates `missingItems` doc if returned < checked-out.
27. Check-in scanner UI. Allow partial returns.
28. Missing-items dashboard `/reports/missing` with resolve action.

### Block G — Reports + history
29. Current-stock report.
30. Items-out report (`transactions where type='checkout' and parentTxId is null`).
31. Event history view (Server, paginated).
32. Item history view.

### Block H — Hardening
33. Audit all Server Actions for auth/role checks.
34. Add `error.tsx` / `loading.tsx` / `not-found.tsx` per segment.
35. `revalidatePath` audit after mutations.
36. Index audit vs `firestore.indexes.json`.
37. Offline messaging banner.
38. App Check enrollment (optional but recommended for prod).

---

## Open questions

1. Photo upload at item creation: blocking or optional? (Recommend optional for MVP.)
2. Multi-day events with intra-day cycles?
3. Partial returns? (Schema supports; recommend enable.)
4. Bulk operations ("check out 50 at once") — defer.
5. Notification on missing-item flag — dashboard only for MVP.
6. Confirm stale-token flow after role downgrade (revoke + re-login). Test explicitly.
7. App Check — defer to Block H.

---

## Critical reminders

- **`middleware.ts` is deprecated** in Next.js 16 → use **`proxy.ts`** (`node_modules/next/dist/docs/.../proxy.md`).
- **Proxy runs on Node.js runtime**, not Edge, in Next.js 16.
- **Server Actions are POST-reachable directly** — always re-verify auth/role inside each.
- **Layout auth checks aren't enough** because layouts don't re-render on intra-segment navigation. Auth checks belong in the DAL or close to the data.
- **`import 'server-only'`** in `lib/firebase/admin.ts` is mandatory — service-account credentials must never bundle to client.

---

## Sources

- Firebase: Manage Session Cookies; Custom Claims & Security Rules; Transactions & Batched Writes; Access Data Offline
- Next.js 16 local docs in `node_modules/next/dist/docs/01-app/`: `02-guides/authentication.md`, `02-guides/data-security.md`, `01-getting-started/05-server-and-client-components.md`, `01-getting-started/07-mutating-data.md`, `03-api-reference/03-file-conventions/proxy.md`, `03-api-reference/03-file-conventions/unauthorized.md`
