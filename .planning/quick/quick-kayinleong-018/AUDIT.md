# Telegram Bot Stats Audit — cy-eventsystem

**Date:** 2026-06-09  
**Scope:** Firestore data model, existing stats/aggregations, Firebase Admin SDK setup, API routes, server actions, auth helpers, deployment config, and dependencies.

---

## 1. Firestore Data Model / Collections

### Collections & Key Fields

| Collection | Doc ID | Key Fields |
|---|---|---|
| **inventory** | SKU (equals `id` per PROJECT.md key decision #14) | `id`, `sku`, `name`, `category` (Audio/Lighting/Display/Marketing), `totalQty`, `availableQty`, `outQty`, `damagedQty`, `unit`, `location`, `brand`, `externalBarcode`, `photoUrl`, `notes`, `lifecycleState` (available/checked_out/damaged/retired), `lowStockThreshold`, `lowStockOrderedAt`, `isLowStock` (derived boolean), `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deliveryOrderIds[]` |
| **events** | auto-UUID | `id`, `name`, `startDate`, `endDate`, `status` (planned/active/completed/cancelled), `location`, `description`, `teamLeads[]`, `backupTeams[]`, `allowedStaff[]` (denormalized union), `plannedItems` (Record<itemId, {plannedQty, notes}>), `createdAt`, `createdBy`, `closedAt`, `closedBy` |
| **transactions** | auto-UUID | `id`, `type` (checkout/checkin/adjustment/missing/location), `itemId`, `itemSku`, `itemName`, `eventId` (nullable), `eventName` (nullable), `qty`, `actorUid`, `actorName` (denormalized snapshot), `actorRoleAtTimeOfAction` (denormalized snapshot), `at`, `notes`, `parentTxId` (for checkin→checkout links per CI-08), `clientTxId`, `deliveryOrderId` (nullable, for location txs), `location` (nullable, new location value from location tx) |
| **checkoutGroups** | auto-UUID == barcode payload (quick-kayinleong-006) | `id`, `eventId`, `txIds[]`, `itemLines[]` ({itemId, itemSku, itemName, qty}), `label`, `createdAt`, `createdBy`, `location` (per-group physical location, quick-kayinleong-015) |
| **deliveryOrders** | auto-UUID | `id`, `vendor`, `fileUrl`, `filePath`, `originalFilename`, `contentType`, `doType` (internal/external-outbound/external-inbound), `sourceType` (manual/checkout), `eventId` (nullable, for checkout-sourced DOs), `itemIds[]`, `itemLines[]` ({itemId, itemName, itemSku, qty}), `checkoutGroupIds[]`, `notes`, `uploadedAt`, `uploadedBy` |
| **missingItems** | auto-UUID | `id`, `itemId`, `itemName`, `eventId`, `eventName`, `qty`, `reason` (Lost/Damaged/Not returned/Unknown), `reportedBy`, `reportedByName` (denormalized snapshot), `reportedAt`, `status` (open/found/writtenOff), `resolvedAt`, `resolvedBy`, `parentCheckinTxId` |
| **users** | Firebase UID | `uid`, `email`, `displayName`, `role` (admin/staff), `disabled`, `createdAt`, `createdBy`, `lastLoginAt` |

**Firestore Schema File:** `/lib/types/item.ts:16-62`, `/lib/types/event.ts:10-28`, `/lib/types/transaction.ts:21-48`, `/lib/types/checkout-group.ts:18-31`, `/lib/types/delivery-order.ts:21-41`, `/lib/types/missing-item.ts:12-28`, `/lib/types/user.ts:9-20`

---

## 2. Existing Stats / Aggregations / Selectors

### Dashboard KPIs (lib/data/aggregations.server.ts:40-54)

- **getDashboardKpis()** → Returns `{totalItems, itemsOut, lowStockCount, activeEvents}`
  - `totalItems`: count(inventory WHERE lifecycleState != "retired") — line 43
  - `itemsOut`: count(inventory WHERE outQty > 0) — line 44
  - `lowStockCount`: count(inventory WHERE isLowStock == true) — line 45
  - `activeEvents`: count(events WHERE status == "active") — line 46
  - **Billing:** 4 aggregation queries per dashboard load (not real-time)

- **getLowStockCount()** → Single count(inventory WHERE isLowStock == true) — line 62
  - Used for nav badge (RP-03), re-queried on every layout render

### Report Pages & Data Fetchers

| Report | Page | Fetcher | Stats Returned | Filters |
|---|---|---|---|---|
| **Stock** | `/reports/stock` | `getInventoryPage()` (lib/data/inventory.server.ts:74-100) | Current active items: name, sku, category, availableQty, outQty, damagedQty, totalQty, lowStockThreshold, lifecycle state | category, lifecycleState, isLowStock (default: exclude retired) |
| **Items Out** | `/reports/out` | `getTransactionsPage({filters: {type: "checkout"}})` (lib/data/transactions.server.ts:108-147) | Items currently checked out + checkin resolution status (per-group reference) | eventId, type=checkout (client-side filters to exclude items with checkin parentTxId) |
| **Missing** | `/reports/missing` | `getMissingPage()` (lib/data/missing.server.ts) | Open missing-item records: itemName, eventName, qty, reason, reportedBy, reportedAt, status | status (default: "open"), eventId |
| **Repurchase** | `/reports/repurchase` | `getInventoryPage({filters: {isLowStock: true}})` | Items below threshold: all inventory fields | isLowStock == true |
| **History** | `/reports/history` | `getTransactionsPage()` | Global transaction log: itemName, eventName, qty, type, actorName, at, notes | type, eventId, itemId, actorUid (single-axis filters; multi-axis falls back to client-side) |

### Key Computed Stats Referenceable from Telegram Bot

1. **Total inventory count (active)** → `getDashboardKpis().totalItems`
2. **Items currently out** → `getDashboardKpis().itemsOut`
3. **Low-stock items (repurchase candidates)** → `getDashboardKpis().lowStockCount`
4. **Active events count** → `getDashboardKpis().activeEvents`
5. **Per-event checkout count** → count(transactions WHERE type="checkout" AND eventId="X" AND parentTxId IS NULL)
6. **Per-event missing-item count** → count(missingItems WHERE eventId="X" AND status="open")
7. **Per-item checkout history** → transactions filtered by itemId + type
8. **Per-item location trail** → transactions filtered by itemId + type="location" + deliveryOrderId
9. **Unresolved missing items** → missingItems WHERE status="open"
10. **Items with delivery-order history** → inventory.deliveryOrderIds

---

## 3. Firebase Admin SDK Setup

**File:** `/lib/firebase/admin.ts:1-58`

### Initialization Pattern (Singleton)

```typescript
// Lines 31-37: initializeApp with credential + projectId + storageBucket
const app: App = getApps()[0] ?? initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId,
  storageBucket,
});
```

### Environment Variables Required (Server-Only)

| Env Var | Purpose | Line |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Admin SDK project ID | 21 |
| `FIREBASE_CLIENT_EMAIL` | Service account email | 22 |
| `FIREBASE_PRIVATE_KEY` | Private key (double-quoted, literal \n) | 25 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Cloud Storage bucket | 27-29 |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public Firebase API key | (for auth middleware in proxy.ts) |

**Private key handling:** `FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")` at runtime (line 26)

### Exports

```typescript
export { app as adminApp, adminAuth, adminDb, adminStorage };
```

- `adminAuth`: Firebase Admin Auth instance (for `verifyIdToken`, `revokeRefreshTokens`)
- `adminDb`: Firestore Admin instance (for `runTransaction`, `collection().get()`)
- `adminStorage`: Cloud Storage Admin instance

### Can Route Handlers Use adminDb?

**Yes.** The Admin SDK is server-only (line 6: `import "server-only"`), so it can be imported in:
- Server Actions (`"use server"`)
- Route handlers (`app/api/*/route.ts` with default Node runtime)
- Shared server-only modules (`.server.ts` suffix)

---

## 4. Existing API Route Handlers

| Path | File | HTTP Method | Purpose | Runtime |
|---|---|---|---|---|
| `/api/auth/session` | `app/api/auth/session/route.ts:20-22` | POST | No-op stub (auth middleware intercepts at proxy level) | Node (default) |
| `/api/auth/logout` | `app/api/auth/logout/route.ts:36-56` | POST | Revoke refresh tokens + clear `__session` cookie (AUTH-09) | Node (default) |
| `/api/auth/expire-session` | `app/api/auth/expire-session/route.ts:40-66` | GET | Clear session cookie + redirect to /login (used by DAL when revoked) | Node (default) |

### Route Handler Pattern

- **Request body read:** `await request.json()` (standard Next.js)
- **Response:** `NextResponse.json({...}, {status: 200})` or `NextResponse.next()`
- **Middleware auth:** `next-firebase-auth-edge` proxy (proxy.ts) intercepts `/api/auth/*` before handlers run
- **Cookies:** Read via `await cookies()` (Next 16 async API)

---

## 5. Server Actions Pattern

**Location:** `app/(app)/<route>/actions.ts` with `"use server"` directive

### Representative Example (app/(app)/inventory/actions.ts:40-60)

```typescript
export async function createItem(input: unknown): Promise<ActionResult<{itemId: string}>> {
  // 1. Auth gate
  const session = await requireAdmin();
  
  // 2. Zod validation
  const parsed = CreateItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", errors: parsed.error.flatten().fieldErrors };
  }
  
  // 3. Firestore transaction (Admin SDK)
  try {
    await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(docRef);
      if (existing.exists) throw new Error("SKU_EXISTS");
      // ... tx.set(), tx.update() calls
    });
    
    // 4. Revalidate cache
    revalidatePath("/");
    
    return { ok: true, itemId: docRef.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

### Pattern Components

- **Auth gates:** `requireSession()` (lines 125-129 in lib/auth/dal.ts), `requireAdmin()` (lines 140-144)
  - Both use `getTokens()` from `next-firebase-auth-edge` to decode `__session` cookie
  - Both check refresh-token revocation (AUTH-09)
  - Redirect to `/api/auth/expire-session` on invalid session

- **Validation:** Zod schema (e.g., `CreateItemSchema` from lib/schemas/item.ts)

- **Data-layer calls:** Direct `adminDb` imports + `runTransaction()` for atomic updates

- **Cache revalidation:** `revalidatePath()` to refresh SSR pages after mutation

---

## 6. Auth/Session Helpers

**File:** `/lib/auth/dal.ts:56-144`

### Exports

| Function | Signature | Behavior |
|---|---|---|
| `verifySession()` | `async () => Session \| null` | Decode `__session` cookie, verify ID token (checkRevoked=true), hydrate role/displayName from users/{uid} if missing, return null if revoked/disabled |
| `getSession()` | alias to `verifySession()` | Phase 1 parity name |
| `requireSession()` | `async () => Session` | Call `verifySession()`, redirect to `/api/auth/expire-session?reason=session-invalid` if null |
| `requireAdmin()` | `async () => Session` | Call `requireSession()`, redirect to `/unauthorized` if not admin |

### Session Type

```typescript
type Session = {
  uid: string;
  email: string;
  displayName: string;
  role: "admin" | "staff";
  disabled: false;
};
```

### Cookie Decoding (lines 25-37)

```typescript
const COOKIE_OPTS = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: "__session",
  cookieSignatureKeys: [
    process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!,
    process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!,
  ],
  serviceAccount: { projectId, clientEmail, privateKey },
};
```

### Important: Telegram Webhook Limitation

- Telegram webhook requests will **NOT have the `__session` cookie** (no browser context)
- Solution: Create a separate **API key / token auth** mechanism OR call Firestore via service account (already loaded in `adminDb`)
- `requireSession()` / `requireAdmin()` **cannot be used** in webhook route handlers without alternative auth

---

## 7. Deployment Config

### Node & Build

- **Next.js version:** 16.2.6 (package.json:27)
- **Node.js:** Likely Node 18+ (tsconfig, esm support)
- **Build command:** `npm run build` (package.json:7)
- **Start command:** `npm run start` (package.json:8)

### next.config.ts (line 3-5)

Empty — no special overrides. Defaults to Next 16 behavior (server components, edge middleware optional).

### netlify.toml

**Not found.** Deployment likely uses Netlify's Next.js build preset (auto-detects).

### Environment Variables Referenced (No Values, Names Only)

**Public (bundled client-side):**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_APP_URL` (invite/reset link redirect URL)

**Private (server-only):**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `AUTH_COOKIE_SIGNATURE_KEY_CURRENT`
- `AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS`
- `USE_SECURE_COOKIES` (bool: true in prod, false in dev)

**Note:** `.env.example` lists these but is incomplete for early scripts (seed, repair-admin-claims).

---

## 8. Dependencies

**package.json:14-51**

### Telegram/HTTP-Related Libraries

**Present:**
- ✅ `firebase-admin@13.10.0` — Admin SDK (already in use for Firestore)

**NOT Present (will need to add):**
- ❌ `node-telegram-bot-api`, `telegraf`, `grammy` — choose one for Telegram bot
- ❌ `axios`, `node-fetch` — HTTP client (optional if bot library handles)

### Auth/Session Libraries

- ✅ `next-firebase-auth-edge@1.12.0` — Session cookie handling (already in use)
- ✅ `firebase@12.13.0` — Web SDK (for client, not bot)
- ✅ `firebase-admin@13.10.0` — Admin SDK

### Validation

- ✅ `zod@4.4.3` — Schema validation (already in use)

### UI/React (not relevant for bot, but noted)

- `react@19.2.4`, `react-dom@19.2.4`
- `next@16.2.6`
- `radix-ui@1.4.3`, `shadcn@4.8.0`
- `lucide-react@1.16.0`
- `react-hook-form@7.76.1`
- `@tanstack/react-table@8.21.3`
- `sonner@2.0.7` (toast notifications)

---

## 9. Key Takeaways for Telegram Bot Implementation

### Data Layer Reusability

1. **Aggregation functions** (getDashboardKpis, getLowStockCount) are pure async functions in `lib/data/aggregations.server.ts` — can be **imported directly into a route handler**.

2. **Pagination fetchers** (getInventoryPage, getTransactionsPage, getMissingPage, getEventsPage) are **callable from anywhere** — no Session required, but they need `adminDb` access (already set up).

3. **Server actions** use `requireSession()` internally — **cannot be called from a webhook** unless you add an API-key fallback or extract the Firestore-read logic into a `.server.ts` module.

### Route Handler for Webhook

```typescript
// app/api/telegram/webhook/route.ts (pseudocode)
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { getDashboardKpis } from "@/lib/data/aggregations.server";

export async function POST(request: NextRequest) {
  // 1. Verify Telegram signature (if using verification)
  // 2. Parse incoming message
  // 3. Query stats via adminDb or imported functions
  const kpis = await getDashboardKpis();
  // 4. Send Telegram reply via bot API
  // 5. Return 200
}
```

### Stats Menu (Queryable from Bot)

- `totalItems` — Total active inventory count
- `itemsOut` — Items currently checked out
- `lowStockCount` — Repurchase candidates
- `activeEvents` — Ongoing events
- Per-event checkout counts (custom query)
- Per-event missing-item counts (custom query)
- Recent transaction audit trail (recent checkouts/checkins)
- Item location history (transactions WHERE type="location")

### Auth Challenge

- Telegram webhook = **no Firebase session cookie**
- Solutions:
  - A) Add Telegram user ID → Firebase user mapping in a `telegramUsers` collection
  - B) Use a **static API key** (env var) for webhook validation
  - C) Use **Firebase Custom Claims** or **Firestore rules** to restrict bot queries to read-only aggregations

---

## Files Index

**Type Definitions:**
- `/lib/types/item.ts` — InventoryItem (line 16)
- `/lib/types/event.ts` — EventDoc (line 10)
- `/lib/types/transaction.ts` — TransactionDoc (line 21)
- `/lib/types/checkout-group.ts` — CheckoutGroupDoc (line 18)
- `/lib/types/delivery-order.ts` — DeliveryOrder (line 21)
- `/lib/types/missing-item.ts` — MissingItemDoc (line 12)
- `/lib/types/user.ts` — UserDoc (line 9)

**Data Layer:**
- `/lib/data/aggregations.server.ts` — getDashboardKpis, getLowStockCount (line 40, 61)
- `/lib/data/inventory.server.ts` — getInventoryPage (line 74)
- `/lib/data/transactions.server.ts` — getTransactionsPage (line 108)
- `/lib/data/missing.server.ts` — getMissingPage (lines 80+)
- `/lib/data/events.server.ts` — getEventsPage (lines 100+)
- `/lib/data/users.server.ts` — getUsersPage (referenced but not detailed)

**Auth:**
- `/lib/auth/dal.ts` — verifySession, getSession, requireSession, requireAdmin (lines 56–144)
- `/lib/auth/roles.ts` — isAdmin, canEditEvent (lines 16–33)

**Firebase Admin:**
- `/lib/firebase/admin.ts` — Admin SDK singleton (lines 1–58)

**Routes & Proxy:**
- `/proxy.ts` — next-firebase-auth-edge middleware config (lines 1–101)
- `/app/api/auth/session/route.ts` — POST stub (line 20)
- `/app/api/auth/logout/route.ts` — POST token revoke (line 36)
- `/app/api/auth/expire-session/route.ts` — GET cookie clear + redirect (line 40)

**Server Actions (Example):**
- `/app/(app)/inventory/actions.ts` — createItem, updateItem, etc. (line 40)
- `/app/(app)/events/actions.ts` — createEvent, updateEvent, cancelEvent (line 55)
- `/app/(app)/reports/missing/actions.ts` — resolveMissing (line 49)

**Config:**
- `/package.json` — Dependencies & scripts (lines 1–52)
- `/next.config.ts` — Next.js config (empty, lines 3–5)
- `/.env.example` — Env var documentation (lines 1–38)

---

**End of Audit**
