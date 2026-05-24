# PROJECT.md — cy-eventsystem

## What This Is

A web-based **event inventory system** for tracking physical items (AV gear, marketing materials, demo units, displays, etc.) as they move out to events and come back. The system enforces non-negative stock invariants, captures missing-item reasons, and uses QR/barcode scanning to reduce manual entry errors.

**Single-tenant.** One organization, multiple events, two roles (Admin / Staff).

## Core Value

**Inventory truth across the event lifecycle.** When 10 items go out and 8 come back, the system knows what's missing, who took it, where it went, and why — and the stock numbers are correct without manual reconciliation.

If we get this wrong (stock numbers drift, items "stuck out" forever, race-condition double-counts), staff will keep paper notes and abandon the tool. Everything else is downstream of getting this right.

## Owner

| Field | Value |
|-------|-------|
| Owner slug | `kayinleong` |
| Email | ka.yin.leong@accenture.com |
| Claim format | `phase-kayinleong-NN`, `quick-kayinleong-NNN` |

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16.2.6 (App Router, Turbopack default) |
| UI runtime | React 19.2.4 |
| Components | shadcn/ui v4.8 (style: `radix-nova`, base: `neutral`, CSS variables) |
| Styling | Tailwind CSS v4 (CSS-first, no config file) |
| Icons | lucide-react |
| Language | TypeScript 5 (strict) |
| Backend | Firebase: Auth (email/password + session cookies), Firestore (native mode), Storage |
| Auth glue | `next-firebase-auth-edge` v1.12+ (Next.js 16-aware) |
| Forms | react-hook-form + Zod 4 |
| Tables | TanStack Table v8 + shadcn data-table block |
| Dates | date-fns v4 |
| Scanner | `@yudiel/react-qr-scanner` (ZXing) |
| QR generation | `bwip-js` (QR + 1D codes for labels) |
| Toasts | `sonner` |
| Theme | `next-themes` |
| State | None (Server Components + URL + Firestore listeners + React state) |

## Phasing (locked at init)

| Phase | ID | Goal |
|-------|----|----|
| 1 | `phase-kayinleong-01` | **UI POC** — full UI shell for every route, no backend wiring, mock data only |
| 2 | `phase-kayinleong-02` | **Functionality** — wire up Firebase Auth, Firestore, transactions, scanning, reports |

User requested exactly 2 phases. Phase 2 internally organized into blocks A–H but ships as a single phase deliverable.

## Sitemap (locked)

```
Auth (Client, Web SDK)
  /login                                  Sign in
  /forgot-password                        Send reset link
  /set-password                           Complete invite / reset (via Firebase signed link)
  (no /register — admin-invite only via /users/invite)

App shell (Server Components, role-gated)
  /                                       Dashboard — active events, low-stock alerts, overdue returns
  /inventory                              List + filter
  /inventory/new                          Add item (admin)
  /inventory/[id]                         Detail + history
  /inventory/[id]/edit                    Edit (admin)
  /events                                 List
  /events/new                             Create event (admin / team lead)
  /events/[id]                            Detail (assigned items, status)
  /events/[id]/edit                       Edit
  /events/[id]/checkout                   Check-out items for this event (scan-to-cart flow)
  /events/[id]/checkin                    Check-in items + missing flow
  /scan                                   Standalone scanner with mode toggle (check-out | check-in)
                                          - After scan: pick event → qty → confirm-all
  /reports/stock                          Current inventory stock
  /reports/out                            Items currently out for events
  /reports/missing                        Missing item list
  /reports/history                        Event inventory history
  /reports/repurchase                     Repurchase suggestions
  /users                                  Manage users + invite (admin only)
  /users/invite                           Invite form (admin only)
  /settings                               Profile + theme

API
  /api/auth/session                       POST — create session cookie from ID token
  /api/auth/logout                        POST — revoke + clear cookie

System files
  proxy.ts                                Optimistic auth cookie check (NOT middleware.ts)
  firestore.rules                         Versioned alongside code
  firestore.indexes.json                  Versioned
  storage.rules
  firebase.json
```

## Requirements

### Validated

(None yet — ship to validate. Phase 1 produces validated UI shells; Phase 2 validates the full loop.)

### Active

User-stated:
- [ ] Inventory CRUD with item name, SKU, qty, barcode/QR
- [ ] Event CRUD with name, date, location
- [ ] Item check-out per event (auto-decrement stock, prevent negative)
- [ ] Item check-in per event (compare checked-out vs returned)
- [ ] Missing-item tracking with reason enum (Lost / Damaged / Not returned / Unknown)
- [ ] Low-stock alert + repurchase suggestion list
- [ ] QR/barcode scanning during check-out and check-in
- [ ] Reports: current stock, items out, missing, event history
- [ ] Roles: Admin / Staff
- [ ] Admin-invite-only registration (no public signup)

User clarifications captured during questioning:
- [ ] Dedicated QR check-out and check-in pages (scanner-first)
- [ ] Post-scan event picker (assign to Event A vs Event B)
- [ ] Return-to-inventory flow on check-in
- [ ] Backup team support per event (multiple teams can act on one event)

Research-added (cheap now, expensive to retrofit):
- [ ] Item lifecycle states (`available` / `checked_out` / `damaged` / `retired`) — prevents the "damaged on return" limbo
- [ ] Audit log / activity history (per-item chronological feed)

### Out of Scope

- **Customer-facing rental storefront** — internal ops tool only
- **Payment processing / invoicing** — items lent not sold; avoids PCI scope
- **Multi-tenant SaaS** — single-org deploy
- **Full ERP / accounting integration** — CSV export only if needed
- **CRM / customer management** — staff/team is captured in audit log; no external CRM
- **Logistics / transport scheduling** — event has location; that's it
- **Multi-currency, tax, contracts** — not a rental business product
- **Native iOS / Android apps in v1** — PWA with camera scanner is sufficient
- **AI demand forecasting** — cold-start problem; manual thresholds in v1
- **Sub-rental / borrowing from other orgs** — Rentman territory
- **Free public signup** — admin-invite only
- **Reservations / holds** (deferred to v2 — schema accommodates, behavior deferred)
- **Kits / bundles** (deferred to v2)
- **Unique-asset / serial tracking** (deferred to v2 — bulk-qty only in v1)
- **Email / Slack notifications** (deferred to v2 — dashboard badge + list in v1)
- **Calendar / Gantt timeline view** (deferred to v2)

## Key Decisions

| # | Decision | Rationale | Outcome |
|---|----------|-----------|---------|
| 1 | Phase split: exactly 2 phases (UI POC, Functionality) | User-stated preference; UI-first lets stakeholders see+approve full surface before backend cost | Pending (locked at init) |
| 2 | Admin-invite-only registration via Firebase password-reset link | Built-in signed time-limited URL — no custom invite-token surface to secure | Pending |
| 3 | Single-tenant deploy | Scope discipline; multi-tenant changes data model + rules + auth significantly | Pending |
| 4 | Bulk-qty model for inventory (no serials in v1) | User said "quantity available"; serial tracking is a v2 add via `is_serialized` flag | Pending |
| 5 | Item lifecycle states + audit log added to v1 | Schema-cheap now, schema-rewrite expensive later. Every competitor does this | Pending |
| 6 | Reservations deferred to v2 | Detect-at-checkout is acceptable for v1; schema designed so reservations slot in later | Pending |
| 7 | Hybrid lifecycle: immutable `transactions` ledger + mutable `inventory.availableQty` projection | O(1) reads + full audit | Pending |
| 8 | Firebase session cookies (`__session`) via `next-firebase-auth-edge` v1.12+, NOT raw ID tokens | Server-revocable, 5-day expiry vs 1-hour ID tokens, httpOnly | Pending |
| 9 | Role storage: hybrid (custom claims + Firestore `users.role`) | Claims for rules + cheap server checks; Firestore for queryable admin UI | Pending |
| 10 | Defense in depth for auth: proxy (optimistic) + DAL (verifySession) + Server Action (re-verify) + Firestore Rules | Server Actions are POST-reachable — single-layer auth is insufficient | Pending |
| 11 | `proxy.ts` not `middleware.ts` (Next.js 16 rename); Node.js runtime | Verified in local Next 16 docs; Edge unsupported in proxy | Pending |
| 12 | Cache Components / PPR OFF for v1 | App is user-specific dashboards — PPR adds complexity without measurable benefit | Pending |
| 13 | No global state library (no Redux/Zustand/Jotai in MVP) | Server Components + URL params + Firestore listeners + React state covers it | Pending |
| 14 | Document IDs for inventory = SKU | Free Firestore uniqueness + O(1) scan lookup | Pending |
| 15 | QR-first encoding for new labels; scanner accepts QR + Code 128 + EAN-13 + UPC-A + Data Matrix | QR denser + more damage-tolerant; legacy 1D codes still readable | Pending |
| 16 | Scanner library: `@yudiel/react-qr-scanner` (ZXing-backed) | Best React-first option; `html5-qrcode` has open iOS Safari issues | Pending |
| 17 | Mock data lives in `lib/mock/` during Phase 1; replaced wholesale in Phase 2 | Clean boundary; no leaked mocks in shipped code | Pending |
| 18 | UI follows shadcn `radix-nova` style + `neutral` base | Already in `components.json`; verify all 19 expected tokens present in `app/globals.css` | Pending |
| 19 | All planning docs committed to git (`commit_docs: true`) | Standard GSD posture for solo-owner repos | Pending |
| 20 | Phase IDs use `phase-kayinleong-NN`; quick tasks `quick-kayinleong-NNN` | Per global CLAUDE.md owner-slug rule (derived from `ka.yin.leong`) | Pending |

## Context

- Greenfield project. Repo was initialized with `npx create-next-app` (Next 16.2.6) and `npx shadcn init` (v4, radix-nova/neutral) before GSD bootstrap. `package.json` has `next@16.2.6`, `react@19.2.4`, `shadcn@^4.8.0`, `radix-ui@^1.4.3`, `tailwindcss@^4`, `lucide-react@^1.16.0`, `tw-animate-css@^1.4.0`.
- No `.env.local` yet; Firebase config will be added during Phase 2 Block A.
- No git history before this commit — `git init` ran at project start.
- Phase 1 expected to ship without ever touching `.env.local`, Firebase keys, or any networked backend.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions (update Outcome from Pending → Confirmed / Reversed)
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-24 after initialization*
