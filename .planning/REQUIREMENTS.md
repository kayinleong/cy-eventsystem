# REQUIREMENTS.md — cy-eventsystem v1

**Status:** Locked at init. Traceability updated by ROADMAP.

---

## v1 Requirements

### Authentication & User Management

- [x] **AUTH-01** — User can sign in with email + password (Firebase Auth)
- [x] **AUTH-02** — User session persists across visits via `__session` cookie (5-day expiry, server-revocable)
- [x] **AUTH-03** — User can request a password-reset link from `/forgot-password` (Firebase signed link)
- [x] **AUTH-04** — User can set their initial password via `/set-password?oobCode=...` (handles both invite and forgot-password flows)
- [x] **AUTH-05** — User can sign out from any page; session cookie is revoked and cleared
- [x] **AUTH-06** — No public registration route exists; `/register` returns 404
- [x] **AUTH-07** — Admin can invite a new user by entering email + role + displayName at `/users/invite`; invitee receives a Firebase password-reset link via email and can set their password
- [x] **AUTH-08** — Admin can change a user's role (`admin` ↔ `staff`); the change propagates to custom claims within one ID-token refresh (≤1h) or immediately on next sign-in
- [x] **AUTH-09** — Admin can disable a user; disabled users cannot sign in and their existing sessions are revoked
- [x] **AUTH-10** — Non-admin users see no admin-only navigation entries or buttons; direct URL access to admin-only routes renders an unauthorized page

### Inventory Management

- [x] **INV-01** — Admin can create an inventory item with name, SKU (unique), totalQty, unit, optional category, optional notes, optional photo
- [x] **INV-02** — SKU collisions are prevented at write time (transaction asserts uniqueness)
- [x] **INV-03** — Admin can edit an item's name, category, notes, unit, photo
- [x] **INV-04** — Admin can edit `totalQty` only via an "adjust stock" flow that writes an `adjustment` transaction with a required reason
- [x] **INV-05** — Admin can soft-delete an item (set `retired` lifecycle state); item disappears from check-out pickers but remains visible in history reports
- [x] **INV-06** — Anyone signed in can view the inventory list with current `availableQty`, `outQty`, and lifecycle state badge
- [x] **INV-07** — Inventory list is filterable by category, lifecycle state, low-stock flag, and free-text on name/SKU
- [x] **INV-08** — Anyone signed in can view an item detail page showing current stock breakdown and full chronological transaction history
- [x] **INV-09** — Item lifecycle states are explicit: `available` / `checked_out` (partial — some out, some still here) / `damaged` (came back broken) / `retired` (written off)
- [x] **INV-10** — Items can have a generated QR label printed from the detail page (encodes the SKU)

### Event Management

- [x] **EVT-01** — Admin or team lead can create an event with name, startDate, endDate, location, optional description, primary `teamLeads`, optional `backupTeams`
- [x] **EVT-02** — Event status lifecycle: `planned` → `active` → `completed` / `cancelled`; admin or team lead can transition between adjacent states  _(amendment: status now derived from dates per commit b23c449; `planned`/`active`/`completed` computed from startDate/endDate vs now; `cancelled` set explicitly via `cancelEvent` action — eliminates a class of stale-status bugs)_
- [x] **EVT-03** — Anyone signed in can view the event list; defaults to filter by status=active; sortable by startDate
- [x] **EVT-04** — Anyone signed in can view an event detail page showing assigned items (checked-out, returned, missing), team membership, and transaction history for the event
- [x] **EVT-05** — Admin can edit any event's metadata; team lead can edit only events they lead
- [x] **EVT-06** — Admin can cancel an event; cancellation requires reconciling open check-outs (each item marked `returned` / `lost` / `still_with_owner`)
- [x] **EVT-07** — Events with `endDate < today` and `status == active` surface in an "Overdue returns" dashboard widget
- [x] **EVT-08** — Staff can only act on (check-out / check-in for) events where they are a member of `teamLeads` or `backupTeams`; admins can act on any event

### Check-Out (Items Going Out)

- [x] **CO-01** — From an event detail page, an authorized user can open a check-out screen scoped to that event
- [x] **CO-02** — From the standalone `/scan?mode=checkout` page, a user can scan an item barcode/QR, pick the destination event from a filtered list (only events they have access to and that are `planned` or `active`), enter quantity, and add to a scan-cart
- [x] **CO-03** — Multiple items can accumulate in the scan-cart; user can adjust or remove cart entries before committing
- [x] **CO-04** — Submitting the cart commits all items atomically — a single Firestore transaction that decrements every item's `availableQty`, increments `outQty`, and writes one `checkout` transaction per cart line
- [x] **CO-05** — System refuses to check out a quantity that would drive `availableQty` below 0; the entire cart commit fails with a clear error indicating which line(s) were insufficient
- [x] **CO-06** — Optimistic UI shows the reduced `availableQty` immediately on cart-add and reverts cleanly on server rejection
- [x] **CO-07** — Scanner debounces duplicate reads of the same value within 1.5s; provides audible + haptic feedback on successful scan
- [x] **CO-08** — Scanner has a manual-entry fallback input (typed SKU) used when camera is unavailable
- [x] **CO-09** — Scanner accepts QR Code, Code 128, EAN-13, UPC-A, and Data Matrix formats
- [x] **CO-10** — Bluetooth handheld scanners (which act as keyboards) input into the same handler as the camera scanner

### Check-In (Items Returning)

- [x] **CI-01** — From an event detail page, an authorized user can open a check-in screen pre-populated with the event's open check-out lines
- [x] **CI-02** — From `/scan?mode=checkin`, a user can scan an item; the system matches it to the user's accessible open check-outs and routes them to the right event check-in screen
- [x] **CI-03** — For each open line, the returned-qty field defaults to the originally checked-out qty; user decrements if anything didn't come back
- [x] **CI-04** — When `returnedQty < checkedOutQty`, the user must select a missing-reason from the enum (`Lost` / `Damaged` / `Not returned` / `Unknown`) before the line can be committed
- [x] **CI-05** — Returned-quantity flows back into `inventory.availableQty` atomically with the check-in transaction
- [x] **CI-06** — Damaged returns go into the `damaged` lifecycle bucket on the item, not back into `available`
- [x] **CI-07** — Partial check-ins are supported: a check-out of qty 5 can be reconciled across multiple check-in transactions (e.g., 3 in, 2 in later)
- [x] **CI-08** — Each check-in transaction records a `parentTxId` pointing at the original check-out so history can be linked

### Missing Item Tracking

- [x] **MIS-01** — When check-in marks items as missing (any non-zero delta), a `missingItems` record is created with item, event, qty, reason, reporter, and `parentCheckinTxId`
- [x] **MIS-02** — `/reports/missing` lists all open missing-item records, filterable by event, item, reason, date range, status
- [x] **MIS-03** — Admin can resolve a missing-item record by marking it `found` (returns qty to available stock) or `writtenOff` (decrements `totalQty`)
- [x] **MIS-04** — Resolving a record writes a follow-up transaction so the audit trail remains complete

### Reports

- [x] **REP-01** — `/reports/stock` shows every active item with current `availableQty`, `outQty`, `damagedQty`, threshold, low-stock flag
- [x] **REP-02** — `/reports/out` shows items currently checked out across all active events (excludes completed/cancelled events by default)
- [x] **REP-03** — `/reports/missing` shows open missing-item records (see MIS-02)
- [x] **REP-04** — `/reports/history` shows the global transaction log with filters: date range, event, item, actor, action type
- [x] **REP-05** — `/reports/repurchase` shows items below their low-stock threshold plus a list of items frequently flagged missing/damaged (suggesting repurchase)
- [x] **REP-06** — Every report exposes filters as URL query params so views are shareable and bookmarkable
- [x] **REP-07** — Reports paginate at 50 rows per page

### Low Stock & Repurchase Alerts

- [x] **RP-01** — Each item has a configurable `lowStockThreshold` (admin-editable; defaults to 0 = no alert)
- [x] **RP-02** — Dashboard shows a "Low stock" widget listing items where `availableQty <= lowStockThreshold`
- [x] **RP-03** — Nav shows a badge with the count of low-stock items when > 0
- [x] **RP-04** — Admin can mark a low-stock item as "ordered" — moves it off the active alert list without changing inventory until the next manual receipt

### Scanning UX

- [x] **SCN-01** — `/scan` is a dedicated standalone scanner page with a mode toggle (check-out / check-in)
- [x] **SCN-02** — Scanner uses the rear camera by default (`facingMode: { ideal: 'environment' }`)
- [x] **SCN-03** — Camera permission errors render iOS-specific re-enable instructions
- [x] **SCN-04** — Scan-to-cart flow keeps the camera open between scans; cart is visible on-screen for review before commit
- [x] **SCN-05** — Torch toggle is available where the device exposes it (Chrome Android; iOS Safari does not)
- [x] **SCN-06** — Manual-entry fallback (typed SKU) is always reachable from the scanner page

### Audit Log

- [x] **AUD-01** — Every state-changing action (check-out, check-in, stock adjustment, missing-flag, missing-resolve, user-role-change, event-create/edit/cancel) writes a transaction or audit record with `actorUid`, `actorDisplayName` snapshot, `actorRoleAtTimeOfAction` snapshot, and `serverTimestamp`
- [x] **AUD-02** — Item detail page shows a chronological audit feed of every transaction touching that item
- [x] **AUD-03** — Event detail page shows a chronological audit feed of every transaction within that event
- [x] **AUD-04** — Audit records are immutable; corrections happen via new compensating transactions

### Concurrency & Data Integrity

- [x] **INT-01** — All stock-changing operations use Firestore `runTransaction` with explicit invariant assertion (re-check inside the transaction)
- [x] **INT-02** — Firestore security rules enforce `availableQty >= 0` and `availableQty <= totalQty` on every update from a client (Admin SDK is server-trusted)
- [x] **INT-03** — Direct client writes to `transactions` are disallowed; only Admin SDK (Server Actions) can write to that collection
- [x] **INT-04** — Every Server Action calls `verifySession()` and enforces role + event-membership checks before any data write
- [x] **INT-05** — `firestore.indexes.json` is versioned in the repo and deployed via the Firebase CLI; no auto-create from the console

### Offline & Resilience

- [x] **RES-01** — Browsing inventory and viewing events works offline (Firestore Web SDK's IndexedDB cache)
- [x] **RES-02** — Scan operations require network; the UI shows an "Offline — reconnect to scan" banner when offline and disables the scanner page
- [x] **RES-03** — In-progress scan-cart contents persist to IndexedDB so accidental navigation or token refresh doesn't lose them  _(implementation note: sessionStorage rather than IndexedDB — same persistence guarantee for the use case (page reload / token refresh / accidental navigation within the same browser session); IndexedDB v2 candidate if cross-tab persistence becomes required)_
- [x] **RES-04** — PWA manifest is in place so the app is installable to home screen  _(v1: manifest in place + Metadata API wired; v2 polish: real icon-192/icon-512 PNG artwork for Lighthouse PWA installability pass)_

### Non-Functional

- [x] **NFR-01** — Stack: Next.js 16, React 19, shadcn/ui v4 (radix-nova/neutral), Tailwind v4, Firebase
- [x] **NFR-02** — TypeScript strict; `npm run build` and `tsc --noEmit` both pass
- [x] **NFR-03** — ESLint passes on every commit (flat config, no `next lint`)
- [x] **NFR-04** — Phase 1 ships with zero Firebase calls and zero `.env.local` dependencies — every page renders against mocks in `lib/mock/`  _(Phase 1 commitment; satisfied at Phase 1 closure 2026-05-25; Phase 2 then replaced the mock layer wholesale per plan 02-11)_
- [x] **NFR-05** — All routes render without console errors in `next dev`
- [x] **NFR-06** — Server Action files contain `'use server'` and call `verifySession()` at the top
- [x] **NFR-07** — `lib/firebase/admin.ts` imports `'server-only'`; service-account credentials never leave server bundle
- [x] **NFR-08** — `proxy.ts` (not `middleware.ts`) handles optimistic auth cookie checks
- [x] **NFR-09** — `next.config.ts` does not enable `cacheComponents` in v1

---

## v2 Requirements (deferred)

These are explicitly out of v1 scope but acknowledged for forward-compatible schema design:

- Reservations / holds (prevent overlapping event allocations)
- Kits / bundles (composite items)
- Unique-asset / serial tracking (`is_serialized` flag per item)
- Asset condition tracking (good/fair/poor + photo)
- Maintenance / repair workflow
- Sub-locations / warehouse zones
- Email / Slack notifications for low stock and overdue returns
- Bulk CSV import for inventory
- Per-event Staff permissions (today: Staff has blanket access)
- Calendar / Gantt-style event timeline
- Custom fields per item type
- Damage photo on missing-item reason form

---

## Out of Scope (permanent — not v2 either)

- Customer-facing rental storefront / public booking
- Payment processing / invoicing
- Multi-tenant SaaS architecture
- Full ERP / accounting integration (SAP, NetSuite, QuickBooks) — CSV export only if needed
- CRM / customer management
- Logistics / transport scheduling
- Multi-currency, tax, contracts
- Native iOS / Android apps
- AI demand forecasting
- Sub-rental / borrowing from other organizations
- Public signup

---

## Traceability

Filled by ROADMAP. Each REQ-ID maps to exactly one phase.

| REQ-ID Range | Phase | Status |
|--------------|-------|--------|
| AUTH-01..10 | Phase 2 — wired backend; Phase 1 ships matching UI shells | done (2026-05-27) |
| INV-01..10 | Phase 2 functionality; Phase 1 ships shells | done (2026-05-27) |
| EVT-01..08 | Phase 2 functionality; Phase 1 ships shells | done (2026-05-27; EVT-02 amended — status derived from dates, commit b23c449) |
| CO-01..10 | Phase 2 functionality; Phase 1 ships shells | done (2026-05-27; concurrent invariant ROADMAP success criterion #3 verified 2-browser race) |
| CI-01..08 | Phase 2 functionality; Phase 1 ships shells | done (2026-05-27) |
| MIS-01..04 | Phase 2 functionality; Phase 1 ships shells | done (2026-05-27) |
| REP-01..07 | Phase 2 functionality; Phase 1 ships shells | done (2026-05-27; sub-nav added commit 319fa9c) |
| RP-01..04 | Phase 2 functionality; Phase 1 ships shells | done (2026-05-27) |
| SCN-01..06 | Phase 2 functionality; Phase 1 ships UI scaffold (camera widget can be functional even in Phase 1, but scanned values are logged, not persisted) | done (2026-05-27) |
| AUD-01..04 | Phase 2 — audit log writes are server-side; Phase 1 ships history feed UI against mocks | done (2026-05-27) |
| INT-01..05 | Phase 2 | done (2026-05-27; INT-05 reaffirmed via final indexes sync commit 315793a) |
| RES-01..04 | Phase 2 | done (2026-05-27; RES-03 implementation uses sessionStorage rather than IndexedDB — same guarantee for in-session use case, IndexedDB v2 if cross-tab needed; RES-04 v2 polish for real icon PNGs) |
| NFR-01..09 | Both phases (NFR-04 is Phase 1-specific) | done (2026-05-27; NFR-04 satisfied at Phase 1 closure 2026-05-25) |

See `ROADMAP.md` for per-phase mapping.

### Phase 2 amendments (locked in CHANGELOG.md + per-plan SUMMARYs)

Three ROADMAP/REQUIREMENTS amendments locked during Phase 2 discuss-phase + execution (also recorded in CHANGELOG.md under [Unreleased] / Decisions):

1. **D-06 — Firestore rules unit tests SKIPPED.** ROADMAP Phase 2 success criterion #6 amended. Replaced with manual rules-audit chain: 8 audits (one per Block A-G + final cross-collection in `rules-audit-final.md` — 48-row matrix). PITFALLS C3 acknowledged unmitigated; cumulative evidence reduces risk substantially but does not eliminate it. v2 candidate: introduce `@firebase/rules-unit-testing` once emulator + flake budget allow.
2. **D-15 — Inventory photo field.** UI surface frozen clause amended. `ItemPhotoField` component added to `/inventory/new` + `/inventory/[id]/edit` (camera + file-picker + client-side resize to 0.3MB / 1600px). Tracks INV-01 + INV-03's "optional photo" sub-requirement.
3. **D-17 — Cursor URL contract.** UI surface frozen clause amended. All list pages (`/inventory`, `/events`, `/users`, `/reports/*`) migrated from `?page=N` to `?cursor=xxx` per Firestore cursor pagination model. Page-N/M chrome replaced with Prev/Next.

### Execution-time architectural deviations (recorded in CHANGELOG.md + per-plan SUMMARYs)

Additional adjustments locked during Phase 2 execution that affect requirement implementation but do not change requirement scope:

- **D-02 re-amended (commit 93bf62d):** Cloud Functions removed entirely; logic inlined into Server Actions (`functions/` directory deleted in plan 02-07). Two logical functions (setCustomUserClaims + allowedStaff sync) run synchronously inside the affected actions via `recomputeAllowedStaffForEvent`. AUTH-08 still satisfied (custom claims mirrored synchronously + refresh tokens revoked).
- **D-19 corrected (`persistentLocalCache`):** `enableIndexedDbPersistence` is deprecated in firebase ^12; `lib/firebase/client.ts` uses `persistentLocalCache(persistentSingleTabManager({}))`. RES-01 satisfied via same IndexedDB-backed mechanism.
- **Storage write rule relaxed (commit 96cf12a):** Any signed-in user can write `items/{itemId}/photo.jpg` within size + content-type bounds; admin gate enforced upstream in Server Actions via `requireAdmin()`. INV-01/03 satisfied at app layer. v2 follow-up: re-tighten once Storage→Firestore cross-service eval lag reproducible.
- **EVT-02 status derived from dates (commit b23c449):** Instead of stored status with manual transitions, event status is computed from `startDate`/`endDate` vs current time. Eliminates a class of stale-status bugs while preserving the lifecycle vocabulary (planned/active/completed/cancelled) the requirement specifies.
- **Reports sub-nav added (commit 319fa9c):** Plan 02-10 added a reports sub-nav so users can switch between the 5 reports. Sidebar Reports stays highlighted across all `/reports/*` sub-pages. Satisfies REP-06's "shareable views" intent for navigation hygiene.
