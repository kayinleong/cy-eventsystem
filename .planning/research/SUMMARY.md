# Research Summary — cy-eventsystem

**Synthesized:** 2026-05-24
**Sources:** `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`

---

## TL;DR

A Next.js 16 + React 19 + shadcn v4 + Firebase event-inventory app is well-trodden ground. The user's 9 requirements + 4 clarifications align with industry table stakes. Two cheap additions (lifecycle states, audit log) at the schema level are nearly free now and expensive to retrofit — **recommend baking them into v1**. Reservations / holds, kits, serial-asset tracking, photo evidence on damage — defer.

The four killer technical risks are: **(1)** negative-qty races in check-out, **(2)** missing Firestore composite indexes, **(3)** rules-misconfigured collection leaks, **(4)** Next 16's Server/Client boundary + the renamed `proxy.ts` (NOT `middleware.ts`). Mitigations exist for all four and belong in Phase 2's first slice.

---

## Stack (locked)

| Layer | Choice | Confidence |
|-------|--------|------------|
| Framework | Next.js **16.2.6**, App Router only, Turbopack default | HIGH |
| UI | React **19.2.4**, shadcn/ui **v4** (`radix-nova` / `neutral`), Tailwind **v4** (CSS-first, no config file), `lucide-react` | HIGH |
| Backend | Firebase Auth + Firestore + Storage. Web SDK **≥ 12.13** client, Admin SDK **≥ 13** server | HIGH |
| Auth integration | **`next-firebase-auth-edge` v1.12+** (Next 16-aware) | MEDIUM-HIGH |
| Forms | `react-hook-form` + Zod 4 + `@hookform/resolvers` | HIGH |
| Tables | TanStack Table v8 + shadcn data-table block | HIGH |
| Dates | `date-fns` v4 | HIGH |
| Toasts | `sonner` (shadcn-recommended) | HIGH |
| Theme | `next-themes` | HIGH |
| Scanner (camera) | `@yudiel/react-qr-scanner` (ZXing-backed) | MEDIUM-HIGH |
| Code generation | `bwip-js` (QR + 100+ formats) | HIGH |
| State management | **None** for global — Server Components + URL params + Firestore listeners + React state | HIGH |

**Avoid:** `middleware.ts` (renamed to `proxy.ts`), single-arg `revalidateTag`, sync `cookies()/headers()/params`, `next lint`, `reactfire`, `react-firebase-hooks`, individual `@radix-ui/*` packages (use unified `radix-ui`), `html5-qrcode` (iOS Safari issues), `tailwind.config.ts`, `moment`, Redux/Jotai.

---

## Features

### v1 — Table stakes (16 features)

9 user-requested + 4 clarifications captured + 2 strongly-recommended additions.

| # | Feature |
|---|---------|
| TS-01 | Item CRUD (name, SKU, qty, barcode/QR) |
| TS-02 | Event CRUD (name, date, location) |
| TS-03 | Check-out: decrement stock, atomic, prevent negative |
| TS-04 | Check-in: record returns, compute missing |
| TS-05 | Missing item + reason enum (Lost / Damaged / Not returned / Unknown) |
| TS-06 | Low-stock dashboard alert + repurchase suggestion list |
| TS-07 | Browser-based QR/barcode scanner |
| TS-08 | Dedicated `/scan` check-out + check-in pages (scanner-first) |
| TS-09 | Post-scan event picker (assign to Event A vs B) |
| TS-10 | Return-to-inventory flow on check-in |
| TS-11 | Multi-team assignment per event (primary + backup) |
| TS-12 | Reports: stock, items out, missing, history, repurchase |
| TS-13 | Roles: Admin / Staff |
| TS-14 | Admin-invite-only registration |
| **TS-15** | **Audit log / activity history** (added — cheap now, expensive to retrofit) |
| **TS-16** | **Item lifecycle states** (`available` / `checked_out` / `damaged` / `retired`) (added — prevents the "damaged on return" limbo) |

### Deferred to v2+ (15 differentiators)

Reservations / holds, kits/bundles, asset condition tracking, unique-asset mode, maintenance workflow, sub-locations, email/Slack notifications, e-sign agreements, mobile-native app, Gantt-style timeline, custom fields, CSV import (could pull into v1.5), overdue reminders (cheap — could include), cost/depreciation, per-event permissions.

### Anti-features (deliberately not building)

Customer-facing rental site, payment processing, multi-tenant SaaS, ERP/CRM integration, logistics/transport scheduling, multi-currency/tax/contracts, native iOS/Android in v1, AI demand forecasting, sub-rental, free public signup.

### UX patterns to borrow

- **Cheqroom "scan-to-cart"** — single confirm commits all scans atomically. Apply to both check-out and check-in pages.
- **EZRentOut Bluetooth scanner support** — same handler accepts camera `BarcodeDetector` events and Bluetooth handheld scanner keystrokes (ends with Enter).
- **Snipe-IT activity feed** on item detail page (chronological).
- **Low-stock badge in nav + dedicated alerts page** with "mark as ordered" — separates "I know" from "stock arrived."
- **Cheqroom missing-item form** — pre-fills returned qty, user decrements + picks reason; delta auto-flagged missing.

---

## Architecture

### Firestore collections

| Collection | Role |
|------------|------|
| `users/{uid}` | role, displayName, disabled, timestamps |
| `inventory/{itemId}` | name, sku (unique), totalQty, availableQty, outQty (projection), photoUrl, lifecycle state |
| `events/{eventId}` | name, dates, location, status (`planned`/`active`/`completed`/`cancelled`), teamLeads, backupTeams, **`allowedStaff` (denormalized union)** |
| `transactions/{txId}` | append-only ledger; type (checkout/checkin/adjustment/missing), itemId+denormalized name, eventId, qty, actor, timestamp, parentTxId |
| `missingItems/{missingId}` | flagging table; qty, reason, status (open/found/writtenOff), parentCheckinTxId |

**Hybrid lifecycle:** `transactions` is source of truth (immutable); `inventory.availableQty/outQty` is a mutable projection updated atomically inside each transaction. O(1) reads + full audit.

### Auth + authz

- Firebase session cookies (`__session`) via `next-firebase-auth-edge`. `httpOnly`, `sameSite: lax`, expiresIn 5d.
- `proxy.ts` (NOT middleware.ts) — optimistic cookie check only.
- Server Components / Server Actions — `verifySession()` from DAL with `verifySessionCookie(cookie, true)` (revocation check).
- Role storage: **hybrid** — Firestore `users.role` is source of truth; mirrored to custom claims via Cloud Function `onWrite`. Rules use `request.auth.token.role`.
- Defense in depth: proxy (optimistic) → Layout/Server Component (`verifySession`) → Server Action (re-verify per action) → Firestore Rules (final gate).
- Admin-invite-only: no public `/register`. Server Action `inviteUser()` calls `createUser` + `generatePasswordResetLink` (Firebase's built-in signed link — don't roll custom tokens).

### Next.js patterns

- Server Components by default. `'use client'` only at small leaves (scanner, real-time grid, form widgets, login/forgot-pw client pages, theme toggle, nav menus).
- Server Actions for all mutations. Mandatory in every action: `'use server'` → `verifySession()` → role check → Zod validation → transaction → `revalidatePath()` → typed return.
- Real-time data: Server Component does initial fetch (Admin SDK) and seeds props; Client Component subscribes via `onSnapshot` and takes over after hydration. Kills "flash" jank.

### Folder structure

```
app/(auth)/                — Auth pages (Client, Web SDK)
app/(app)/                 — Main shell with verifySession() gate
  dashboard/               — Server
  inventory/               — Server list + Client grid + Server Actions
  events/[id]/             — Server detail + checkout/checkin sub-routes
  scan/                    — Client scanner; Server Actions for commits
  reports/                 — Server (aggregated)
  users/                   — Admin-only
  settings/
app/api/auth/              — session create + logout Route Handlers
proxy.ts                   — Next 16 (NOT middleware.ts)
lib/firebase/client.ts     — Web SDK init
lib/firebase/admin.ts      — Admin SDK + `import 'server-only'`
lib/auth/dal.ts            — verifySession + role helpers
lib/data/*.server.ts       — Admin SDK read helpers
lib/hooks/                 — Real-time hooks (use-inventory-live, etc.)
lib/schemas/               — Zod
lib/types/                 — Shared types
lib/mock/                  — PHASE 1 ONLY
firestore.rules            — Versioned
firestore.indexes.json     — Versioned
```

---

## Critical pitfalls (project-killers)

| ID | Pitfall | Mitigation | Phase |
|----|---------|------------|-------|
| C1 | Negative-qty race in concurrent check-out | Firestore `runTransaction` + invariant assert; `availableQty >= 0` security rule; client button disable | 2 |
| C2 | Missing composite indexes only fail in prod | `firestore.indexes.json` committed; deploy via CLI; integration tests with >1000 docs | 2 |
| C3 | Rules forgotten on a collection = full data leak | Deny-by-default skeleton; `@firebase/rules-unit-testing` for every collection; rules audit checkpoint | 2 |
| C4 | Server/client auth state hydration flash + lying server renders | `next-firebase-auth-edge` session cookie OR Client+`<Suspense>` for auth-gated UI; never render personalized UI server-side without cookie verify | 2 |
| C5 | Items "stuck out" from cancelled/forgotten events bloat reports | Event lifecycle (`draft→active→completed→cancelled→archived`); cancellation forces reconciliation; nightly Cloud Function flags stale active events | 2 |
| C6 | Firebase Admin SDK on Edge runtime fails | Admin SDK only in `lib/firebase/admin.ts` with `import 'server-only'`; never in `proxy.ts` despite Node default (Edge unsupported in proxy anyway in Next 16) | 2 |

---

## Key Phase 1 (UI POC) considerations

Pulled from PITFALLS — the ones that affect UI structure even when no backend is wired:

1. **`next.config.ts` Cache Components decision** — recommend OFF; pages are user-specific.
2. **Server vs Client boundary discipline** — set the pattern in Phase 1 layouts and forms. `'use client'` only at smallest leaves.
3. **`async params` / `cookies` / `headers`** — always `await`; use `npx next typegen`.
4. **Tailwind v4 token completeness** — verify `app/globals.css` has all 19 expected shadcn tokens at `:root` and `.dark`. Run `npx shadcn@latest diff` before customizing.
5. **shadcn CLI v4 `--dry-run --diff`** before adding components.
6. **`tw-animate-css` is the right package** (already present); `@import` near top of `globals.css`.
7. **Mobile UX:** full-page routes for create/edit on mobile (not modals); `<Sheet/>` for short forms. Numeric inputs with `inputmode="numeric" pattern="[0-9]*"`. `autoComplete="off"` on barcode/SKU.
8. **Draft auto-save UX pattern** — design forms so IndexedDB draft persistence can be added in Phase 2 without restructuring.
9. **Filter UX in reports** — every report page must have the filter chrome in place from Phase 1 (date range, event, location, actor, category, action type) even if not wired.
10. **PWA manifest scaffold** — drop `manifest.webmanifest` in Phase 1 so the offline-capable Phase 2 work has somewhere to land.

---

## Key Phase 2 (Functionality) build order

Dependency-ordered. Each block unlocks the next.

**Block A — Foundation:** Firebase project + envs, `client.ts`/`admin.ts`, `firestore.rules` lockdown, login + session cookie + logout, `proxy.ts` cookie check, `verifySession()` DAL, forgot-password + set-password, `(app)/layout.tsx` role gate.

**Block B — Users + roles:** `users` schema + first admin seed, Cloud Function `onWrite users → setCustomUserClaims`, DAL extension for role, admin user-management UI + `inviteUser` / `setUserRole`.

**Block C — Inventory CRUD:** `inventory` schema + Zod, rules for inventory, list page + grid (Server seed + `onSnapshot`), create/edit/delete Server Actions (admin-only) with SKU uniqueness inside transaction.

**Block D — Events:** `events` schema with team fields + `allowedStaff` denormalized, Cloud Function maintains `allowedStaff`, event list/detail/create/edit pages, rules for events, team membership editor (admin).

**Block E — Scan check-out:** scanner component (camera permissions, ZXing decode), `checkoutItem` Server Action with transaction + invariant, scan UI (scanner → item lookup → event picker → qty → commit), optimistic UI via `useOptimistic`, `transactions` collection rules.

**Block F — Scan check-in:** `checkinItem` Server Action (decrements outQty, increments availableQty, creates `missingItems` if returned < checked-out), check-in scanner UI allowing partial returns, missing-items dashboard `/reports/missing` with admin resolve.

**Block G — Reports + history:** current-stock report, items-out report, event history (paginated), item history.

**Block H — Hardening:** auth/role checks audit, `error.tsx` / `loading.tsx` / `not-found.tsx` per segment, `revalidatePath` audit, index audit, offline messaging banner, App Check enrollment (optional but recommended for prod).

---

## Decisions still open

1. **Single-tenant or multi-tenant?** (Assumed single — recommend confirming.)
2. **Bulk-qty vs unique-asset tracking** — user said "quantity" implying bulk. High-value items typically want serials. Recommend bulk-only for v1 with `is_serialized` flag added in v2.
3. **Existing barcodes vs new labels?** Affects format support (QR-only vs Code 128 + EAN-13 + etc.).
4. **Volume?** 50 × 5 vs 5000 × 50 → different DB cost + aggregation needs.
5. **Notification mechanism for low stock:** dashboard-only v1, email v2 — confirm.
6. **Photo storage scope** — item photos? Damage attachments?
7. **Repurchase flow:** suggest only, or integrate purchasing? (Recommend suggest-only.)
8. **`next-firebase-auth-edge` v1.12 stability** — validate with 1-day spike at start of Phase 2.
9. **Cache Components / PPR** — recommend OFF for v1.

None of these block Phase 1 (UI POC). All should be answered before Phase 2 starts in earnest.

---

## Quick wins to bake in immediately

- `firestore.rules` + `firestore.indexes.json` in version control on day one of Phase 2
- `playsinline` + `muted` on every `<video>`
- `facingMode: { ideal: 'environment' }`
- Document IDs for items = the SKU (free uniqueness + O(1) scan lookup)
- `serverTimestamp()` everywhere (not `new Date()`)
- All Firestore docs include `createdAt/updatedAt/createdBy/updatedBy`
- `verifyIdToken()` in every Server Action that mutates
- `<Suspense>` boundaries around every Firestore-data section
- One `<ScannerModal/>` reused across the app
- Soft-delete by default (`deletedAt` field, queries filter)
- Log every movement with actor snapshot (name + role at time of action)
