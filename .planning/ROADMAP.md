# ROADMAP — cy-eventsystem v1

**Locked at init:** exactly 2 phases, per user requirement.

| Phase | ID | Name | Goal |
|-------|----|----|------|
| 1 | `phase-kayinleong-01` | **UI POC** | Every route renders end-to-end with mock data. No Firebase. Stakeholders can click through the full app and approve the surface before backend cost. |
| 2 | `phase-kayinleong-02` | **Functionality** | Wire Firebase Auth + Firestore + transactions + scanning. Replace mocks with real data. Ship a working v1. |

---

## Phase 1 — UI POC (`phase-kayinleong-01`)

**Goal:** Full UI shell for every page in the locked sitemap, navigable end-to-end with typed mock data. No Firebase calls. No real auth. Forms validate inputs but do not persist.

**UI hint:** yes (this is a pure frontend phase)

### Mapped requirements

Every UI surface that AUTH/INV/EVT/CO/CI/MIS/REP/RP/SCN/AUD requires must exist as a page or component in this phase, rendered against mock data. Specifically:

- AUTH-01, AUTH-03, AUTH-04, AUTH-05, AUTH-06 → `/login`, `/forgot-password`, `/set-password`, sign-out button, missing `/register`
- AUTH-07, AUTH-08, AUTH-09, AUTH-10 → `/users`, `/users/invite`, role-edit modal, disabled-user badge, unauthorized page
- INV-01..10 → `/inventory`, `/inventory/new`, `/inventory/[id]`, `/inventory/[id]/edit`, lifecycle-state badge, QR-label print preview
- EVT-01..08 → `/events`, `/events/new`, `/events/[id]`, `/events/[id]/edit`, status badge, overdue-returns dashboard widget, cancel-event reconciliation modal shell
- CO-01..10 → `/events/[id]/checkout` (scan-to-cart UI), scan-cart panel, qty stepper, error banner shell
- CI-01..08 → `/events/[id]/checkin` (pre-populated return-qty form), missing-reason dropdown, partial check-in support
- MIS-01..04 → `/reports/missing`, resolve modal (`found` / `writtenOff`)
- REP-01..07 → `/reports/stock`, `/reports/out`, `/reports/history`, `/reports/repurchase`, shared filter bar, pagination
- RP-01..04 → low-stock dashboard widget, nav badge, "mark as ordered" action shell
- SCN-01..06 → `/scan` standalone scanner with mode toggle, manual-entry fallback, torch toggle, debounce + feedback (real camera + decode, scanned value logged only)
- AUD-01..04 → audit feed component used on item-detail and event-detail pages
- NFR-01..05, NFR-08, NFR-09 (Phase 1 portions)

### Plans (13 plans across 4 waves)

**Wave 1 — Foundation (parallel)**
- [x] 01-01-stack-types-schemas-PLAN.md — Install deps, scaffold 27 shadcn components, create entity types + Zod schemas — _completed 2026-05-24 (commits d8f9a6a, e5548bd)_
- [x] 01-02-mock-data-store-PLAN.md — Seed data (30 items/6 events/5 users/~80 transactions/6 missing), in-memory store with 14 mutators, selectors, cookie helpers, hooks — _completed 2026-05-24 (commits feacb89, 7d45c17)_
- [x] 01-03-shell-primitives-PLAN.md — ThemeProvider/Toaster wiring, StatusBadge, QtyStepper, generic DataTable wrapper with URL sync, EmptyState, PageHeader — _completed 2026-05-24 (commits 0ed298d, 491ec34)_

**Wave 2 — Auth spine (depends on Wave 1)**
- [x] 01-04-auth-shell-role-gate-PLAN.md — /login, /forgot-password, /set-password, /register (404), (app)/layout role gate, sidebar, top bar, breadcrumbs, role switcher — _completed 2026-05-24 (commits 4eac7cf, 2d00a01)_

**Wave 3 — Feature blocks (parallel; depends on Waves 1+2)**
- [x] 01-05-dashboard-PLAN.md — / dashboard with 4 KPI cards + 4 widgets — _completed 2026-05-24 (commits 539dc09, 6813762)_
- [ ] 01-06-inventory-PLAN.md — /inventory list + new + detail (with QR label + retire) + edit
- [ ] 01-07-events-PLAN.md — /events list + new + detail (with assigned items + history tabs) + edit + cancel reconciliation dialog
- [ ] 01-08-scanner-and-scan-page-PLAN.md — /scan standalone scanner + scan-session context + cart + event picker + manual entry
- [ ] 01-09-checkout-flow-PLAN.md — /events/[id]/checkout per-event scoped scan flow
- [ ] 01-10-checkin-flow-PLAN.md — /events/[id]/checkin with pre-populated lines + damaged/missing tracking
- [ ] 01-11-reports-PLAN.md — /reports/{stock,out,history,missing,repurchase} + ResolveMissingSheet
- [ ] 01-12-users-settings-PLAN.md — /users (admin-only) with role-edit + disable, /users/invite, /settings with theme + low-stock thresholds

**Wave 4 — Verification gate**
- [ ] 01-13-verification-gate-PLAN.md — Build/lint/typecheck/smoke + acceptance demo human-verify checkpoint

### Success criteria

1. Every route in the locked sitemap renders without console errors in `next dev`.
2. The app is navigable end-to-end: a user can move from login → dashboard → inventory list → item detail → event list → event detail → checkout flow → checkin flow → reports → users, using only the UI (no manual URL editing).
3. Every form renders with typed mock defaults, validates with Zod, and shows error states.
4. `npm run build` succeeds; `tsc --noEmit` passes; ESLint passes.
5. The scanner page captures live camera input and decodes QR/barcodes — scanned values appear on screen but are not persisted. Manual-entry fallback works.
6. shadcn theme tokens (radix-nova/neutral, 19 expected vars) are verified present in `app/globals.css` for both `:root` and `.dark`; dark-mode toggle works via `next-themes`.

### Out of scope for Phase 1

- Firebase project setup, `.env.local`, Admin SDK
- Real auth / session cookies / `proxy.ts` cookie verification
- Server Actions writing to Firestore
- Real-time `onSnapshot` listeners
- Firestore rules, indexes, transactions
- Cloud Functions
- Email delivery for invites

---

## Phase 2 — Functionality (`phase-kayinleong-02`)

**Goal:** Replace all mocks with Firebase. Stand up Auth, Firestore (rules + indexes + transactions), Cloud Functions for role claims, and the scan/check-in/check-out atomic flows. Ship a working v1.

**UI hint:** no (UI surface frozen from Phase 1 — changes only by explicit decision)

### Mapped requirements

All v1 requirements not delivered in Phase 1 land here, plus the functional half of every UI delivered in Phase 1.

**Block A — Foundation:** AUTH-01..06, NFR-06, NFR-07, NFR-08, INT-04

- Firebase project + envs; `lib/firebase/client.ts` + `lib/firebase/admin.ts` (`import 'server-only'`)
- `firestore.rules` v1 lockdown
- Login flow + `/api/auth/session` + session cookie
- `proxy.ts` cookie check
- `verifySession()` DAL (React.cache wrapped)
- Forgot-password + set-password live
- `(app)/layout.tsx` role gate via DAL

**Block B — Users + roles:** AUTH-07..10, INT-04

- `users` collection schema + first admin manual seed
- Cloud Function `onWrite users → setCustomUserClaims`
- DAL returns role from claims
- `/users` admin UI; `inviteUser`, `setUserRole`, `disableUser` Server Actions
- Email delivery via Firebase password-reset link (built-in)

**Block C — Inventory CRUD:** INV-01..10, INT-01..03

- `inventory` schema (SKU = doc ID); Zod in `lib/schemas/inventory.ts`
- Firestore rules for inventory (admin write, all read, no client stock writes)
- List page (Server seed + Client `onSnapshot`)
- Create/edit/delete Server Actions (admin-only) inside transactions
- Item detail + chronological audit feed (real data from `transactions`)
- QR label generation via `bwip-js`

**Block D — Events:** EVT-01..08, INT-04

- `events` schema with `teamLeads`, `backupTeams`, `allowedStaff` (denormalized)
- Cloud Function maintains `allowedStaff` on team changes
- Event list / detail / create / edit pages
- Rules: `allowedStaff array-contains-any` gates reads; admin/team-lead writes
- Team membership editor (admin-only)
- Overdue dashboard widget query

**Block E — Scan check-out:** CO-01..10, SCN-01..06, INT-01..03, AUD-01..04

- Scanner component (`@yudiel/react-qr-scanner` ZXing-backed)
- `checkoutItem` Server Action: Zod validate → access check → Firestore transaction → invariant assert → write `transactions` log → revalidate
- Scan-to-cart UI on both `/scan?mode=checkout` and `/events/[id]/checkout`
- Optimistic UI via `useOptimistic`; reverts on server reject
- Bluetooth scanner support (treat keystrokes as scan input)
- Manual-entry fallback wired

**Block F — Scan check-in:** CI-01..08, MIS-01..04, AUD-01..04

- `checkinItem` Server Action: matches open checkouts, decrements `outQty`, increments `availableQty`, writes `transactions` log with `parentTxId`
- When returned < checked-out: creates `missingItems` doc with reason
- Damaged returns route to `damaged` lifecycle bucket, not `available`
- Partial check-ins supported across multiple transactions
- `/reports/missing` with admin resolve action (found → returns qty / writtenOff → decrement totalQty)

**Block G — Reports + repurchase:** REP-01..07, RP-01..04

- Current stock, items-out, missing, history, repurchase pages backed by real Firestore queries
- Filter bar wired to URL params
- Pagination at 50/page
- Low-stock threshold field on inventory; dashboard widget + nav badge live
- "Mark as ordered" Server Action

**Block H — Hardening:** NFR-02, NFR-03, NFR-05, RES-01..04, INT-05

- Server Action audit (every action has `verifySession()` + role check)
- `error.tsx` / `loading.tsx` / `not-found.tsx` per segment
- `revalidatePath` audit after every mutation
- Index audit vs `firestore.indexes.json`
- Offline banner on `!navigator.onLine`; disable scanner pages
- IndexedDB persistence for scan-cart (RES-03)
- PWA manifest verification (RES-04)
- App Check enrollment (optional; recommended for prod)

### Success criteria

1. An admin can sign in, invite a staff user via the UI, and the staff user receives an email password-reset link, sets a password, and signs in.
2. An admin can create an item, an event, assign team membership, and the staff user can check items out and back in for that event using the QR scanner — stock numbers match reality at every step.
3. Concurrent check-outs by two browsers cannot drive `availableQty` negative — Firestore transactions reject the second when stock is insufficient and the UI surfaces a clear error.
4. Missing items flagged at check-in appear in `/reports/missing`; admin can resolve them; resolution affects stock correctly.
5. The full UI from Phase 1 still renders correctly; UI surface has not regressed.
6. `firestore.rules` unit tests pass for every collection (anonymous denied, staff denied admin docs, cross-event denied, admin allowed).
7. `firestore.indexes.json` is in the repo and `firebase deploy --only firestore` succeeds without auto-create prompts.
8. `npm run build` succeeds; `tsc --noEmit` passes; ESLint passes.

### Out of scope for Phase 2 (i.e., v2 candidates)

Reservations/holds, kits/bundles, unique-asset serial tracking, asset condition tracking with photos, maintenance workflow, sub-locations, email/Slack notifications, bulk CSV import, per-event Staff permissions, calendar/Gantt view, custom fields.

---

## Dependencies

```
Phase 1 (UI POC)
  ↓  (UI surface frozen; mocks replaced wholesale)
Phase 2 (Functionality)
  Block A (Foundation)
    ↓
  Block B (Users + roles) ──┐
    ↓                       │
  Block C (Inventory CRUD)  │
    ↓                       │
  Block D (Events) ─────────┤
    ↓                       │
  Block E (Scan check-out) ─┤
    ↓                       │
  Block F (Scan check-in) ──┤
    ↓                       │
  Block G (Reports) ────────┤
    ↓                       │
  Block H (Hardening) ←─────┘
```

Blocks within Phase 2 are mostly sequential; G can start mid-F since the data is already flowing once F's writes work.

---

## Coverage check

Every REQ-ID from `REQUIREMENTS.md` is mapped to a phase above:

| REQ-IDs | Phase | Notes |
|---------|-------|-------|
| AUTH-01..06 | 1 (shell) + 2 (wired) | UI in 1; Firebase in 2 |
| AUTH-07..10 | 1 (shell) + 2 (wired) | Same |
| INV-01..10 | 1 (shell) + 2 (wired) | Same |
| EVT-01..08 | 1 (shell) + 2 (wired) | Same |
| CO-01..10 | 1 (shell) + 2 (wired) | Same |
| CI-01..08 | 1 (shell) + 2 (wired) | Same |
| MIS-01..04 | 1 (shell) + 2 (wired) | Same |
| REP-01..07 | 1 (shell) + 2 (wired) | Same |
| RP-01..04 | 1 (shell) + 2 (wired) | Same |
| SCN-01..06 | 1 (functional camera, no persist) + 2 (wired to actions) | Camera live in Phase 1 |
| AUD-01..04 | 1 (UI component) + 2 (real audit data) | Mock feed in Phase 1 |
| INT-01..05 | 2 only | Server-side |
| RES-01..04 | 2 only | Backend behavior |
| NFR-01..09 | Both | NFR-04 is Phase 1-only |

**Coverage: 100% of v1 requirements.**
