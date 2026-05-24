# REQUIREMENTS.md — cy-eventsystem v1

**Status:** Locked at init. Traceability updated by ROADMAP.

---

## v1 Requirements

### Authentication & User Management

- [ ] **AUTH-01** — User can sign in with email + password (Firebase Auth)
- [ ] **AUTH-02** — User session persists across visits via `__session` cookie (5-day expiry, server-revocable)
- [ ] **AUTH-03** — User can request a password-reset link from `/forgot-password` (Firebase signed link)
- [ ] **AUTH-04** — User can set their initial password via `/set-password?oobCode=...` (handles both invite and forgot-password flows)
- [ ] **AUTH-05** — User can sign out from any page; session cookie is revoked and cleared
- [ ] **AUTH-06** — No public registration route exists; `/register` returns 404
- [ ] **AUTH-07** — Admin can invite a new user by entering email + role + displayName at `/users/invite`; invitee receives a Firebase password-reset link via email and can set their password
- [ ] **AUTH-08** — Admin can change a user's role (`admin` ↔ `staff`); the change propagates to custom claims within one ID-token refresh (≤1h) or immediately on next sign-in
- [ ] **AUTH-09** — Admin can disable a user; disabled users cannot sign in and their existing sessions are revoked
- [ ] **AUTH-10** — Non-admin users see no admin-only navigation entries or buttons; direct URL access to admin-only routes renders an unauthorized page

### Inventory Management

- [ ] **INV-01** — Admin can create an inventory item with name, SKU (unique), totalQty, unit, optional category, optional notes, optional photo
- [ ] **INV-02** — SKU collisions are prevented at write time (transaction asserts uniqueness)
- [ ] **INV-03** — Admin can edit an item's name, category, notes, unit, photo
- [ ] **INV-04** — Admin can edit `totalQty` only via an "adjust stock" flow that writes an `adjustment` transaction with a required reason
- [ ] **INV-05** — Admin can soft-delete an item (set `retired` lifecycle state); item disappears from check-out pickers but remains visible in history reports
- [ ] **INV-06** — Anyone signed in can view the inventory list with current `availableQty`, `outQty`, and lifecycle state badge
- [ ] **INV-07** — Inventory list is filterable by category, lifecycle state, low-stock flag, and free-text on name/SKU
- [ ] **INV-08** — Anyone signed in can view an item detail page showing current stock breakdown and full chronological transaction history
- [ ] **INV-09** — Item lifecycle states are explicit: `available` / `checked_out` (partial — some out, some still here) / `damaged` (came back broken) / `retired` (written off)
- [ ] **INV-10** — Items can have a generated QR label printed from the detail page (encodes the SKU)

### Event Management

- [ ] **EVT-01** — Admin or team lead can create an event with name, startDate, endDate, location, optional description, primary `teamLeads`, optional `backupTeams`
- [ ] **EVT-02** — Event status lifecycle: `planned` → `active` → `completed` / `cancelled`; admin or team lead can transition between adjacent states
- [ ] **EVT-03** — Anyone signed in can view the event list; defaults to filter by status=active; sortable by startDate
- [ ] **EVT-04** — Anyone signed in can view an event detail page showing assigned items (checked-out, returned, missing), team membership, and transaction history for the event
- [ ] **EVT-05** — Admin can edit any event's metadata; team lead can edit only events they lead
- [ ] **EVT-06** — Admin can cancel an event; cancellation requires reconciling open check-outs (each item marked `returned` / `lost` / `still_with_owner`)
- [ ] **EVT-07** — Events with `endDate < today` and `status == active` surface in an "Overdue returns" dashboard widget
- [ ] **EVT-08** — Staff can only act on (check-out / check-in for) events where they are a member of `teamLeads` or `backupTeams`; admins can act on any event

### Check-Out (Items Going Out)

- [ ] **CO-01** — From an event detail page, an authorized user can open a check-out screen scoped to that event
- [ ] **CO-02** — From the standalone `/scan?mode=checkout` page, a user can scan an item barcode/QR, pick the destination event from a filtered list (only events they have access to and that are `planned` or `active`), enter quantity, and add to a scan-cart
- [ ] **CO-03** — Multiple items can accumulate in the scan-cart; user can adjust or remove cart entries before committing
- [ ] **CO-04** — Submitting the cart commits all items atomically — a single Firestore transaction that decrements every item's `availableQty`, increments `outQty`, and writes one `checkout` transaction per cart line
- [ ] **CO-05** — System refuses to check out a quantity that would drive `availableQty` below 0; the entire cart commit fails with a clear error indicating which line(s) were insufficient
- [ ] **CO-06** — Optimistic UI shows the reduced `availableQty` immediately on cart-add and reverts cleanly on server rejection
- [ ] **CO-07** — Scanner debounces duplicate reads of the same value within 1.5s; provides audible + haptic feedback on successful scan
- [ ] **CO-08** — Scanner has a manual-entry fallback input (typed SKU) used when camera is unavailable
- [ ] **CO-09** — Scanner accepts QR Code, Code 128, EAN-13, UPC-A, and Data Matrix formats
- [ ] **CO-10** — Bluetooth handheld scanners (which act as keyboards) input into the same handler as the camera scanner

### Check-In (Items Returning)

- [ ] **CI-01** — From an event detail page, an authorized user can open a check-in screen pre-populated with the event's open check-out lines
- [ ] **CI-02** — From `/scan?mode=checkin`, a user can scan an item; the system matches it to the user's accessible open check-outs and routes them to the right event check-in screen
- [ ] **CI-03** — For each open line, the returned-qty field defaults to the originally checked-out qty; user decrements if anything didn't come back
- [ ] **CI-04** — When `returnedQty < checkedOutQty`, the user must select a missing-reason from the enum (`Lost` / `Damaged` / `Not returned` / `Unknown`) before the line can be committed
- [ ] **CI-05** — Returned-quantity flows back into `inventory.availableQty` atomically with the check-in transaction
- [ ] **CI-06** — Damaged returns go into the `damaged` lifecycle bucket on the item, not back into `available`
- [ ] **CI-07** — Partial check-ins are supported: a check-out of qty 5 can be reconciled across multiple check-in transactions (e.g., 3 in, 2 in later)
- [ ] **CI-08** — Each check-in transaction records a `parentTxId` pointing at the original check-out so history can be linked

### Missing Item Tracking

- [ ] **MIS-01** — When check-in marks items as missing (any non-zero delta), a `missingItems` record is created with item, event, qty, reason, reporter, and `parentCheckinTxId`
- [ ] **MIS-02** — `/reports/missing` lists all open missing-item records, filterable by event, item, reason, date range, status
- [ ] **MIS-03** — Admin can resolve a missing-item record by marking it `found` (returns qty to available stock) or `writtenOff` (decrements `totalQty`)
- [ ] **MIS-04** — Resolving a record writes a follow-up transaction so the audit trail remains complete

### Reports

- [ ] **REP-01** — `/reports/stock` shows every active item with current `availableQty`, `outQty`, `damagedQty`, threshold, low-stock flag
- [ ] **REP-02** — `/reports/out` shows items currently checked out across all active events (excludes completed/cancelled events by default)
- [ ] **REP-03** — `/reports/missing` shows open missing-item records (see MIS-02)
- [ ] **REP-04** — `/reports/history` shows the global transaction log with filters: date range, event, item, actor, action type
- [ ] **REP-05** — `/reports/repurchase` shows items below their low-stock threshold plus a list of items frequently flagged missing/damaged (suggesting repurchase)
- [ ] **REP-06** — Every report exposes filters as URL query params so views are shareable and bookmarkable
- [ ] **REP-07** — Reports paginate at 50 rows per page

### Low Stock & Repurchase Alerts

- [ ] **RP-01** — Each item has a configurable `lowStockThreshold` (admin-editable; defaults to 0 = no alert)
- [ ] **RP-02** — Dashboard shows a "Low stock" widget listing items where `availableQty <= lowStockThreshold`
- [ ] **RP-03** — Nav shows a badge with the count of low-stock items when > 0
- [ ] **RP-04** — Admin can mark a low-stock item as "ordered" — moves it off the active alert list without changing inventory until the next manual receipt

### Scanning UX

- [ ] **SCN-01** — `/scan` is a dedicated standalone scanner page with a mode toggle (check-out / check-in)
- [ ] **SCN-02** — Scanner uses the rear camera by default (`facingMode: { ideal: 'environment' }`)
- [ ] **SCN-03** — Camera permission errors render iOS-specific re-enable instructions
- [ ] **SCN-04** — Scan-to-cart flow keeps the camera open between scans; cart is visible on-screen for review before commit
- [ ] **SCN-05** — Torch toggle is available where the device exposes it (Chrome Android; iOS Safari does not)
- [ ] **SCN-06** — Manual-entry fallback (typed SKU) is always reachable from the scanner page

### Audit Log

- [ ] **AUD-01** — Every state-changing action (check-out, check-in, stock adjustment, missing-flag, missing-resolve, user-role-change, event-create/edit/cancel) writes a transaction or audit record with `actorUid`, `actorDisplayName` snapshot, `actorRoleAtTimeOfAction` snapshot, and `serverTimestamp`
- [ ] **AUD-02** — Item detail page shows a chronological audit feed of every transaction touching that item
- [ ] **AUD-03** — Event detail page shows a chronological audit feed of every transaction within that event
- [ ] **AUD-04** — Audit records are immutable; corrections happen via new compensating transactions

### Concurrency & Data Integrity

- [ ] **INT-01** — All stock-changing operations use Firestore `runTransaction` with explicit invariant assertion (re-check inside the transaction)
- [ ] **INT-02** — Firestore security rules enforce `availableQty >= 0` and `availableQty <= totalQty` on every update from a client (Admin SDK is server-trusted)
- [ ] **INT-03** — Direct client writes to `transactions` are disallowed; only Admin SDK (Server Actions) can write to that collection
- [ ] **INT-04** — Every Server Action calls `verifySession()` and enforces role + event-membership checks before any data write
- [ ] **INT-05** — `firestore.indexes.json` is versioned in the repo and deployed via the Firebase CLI; no auto-create from the console

### Offline & Resilience

- [ ] **RES-01** — Browsing inventory and viewing events works offline (Firestore Web SDK's IndexedDB cache)
- [ ] **RES-02** — Scan operations require network; the UI shows an "Offline — reconnect to scan" banner when offline and disables the scanner page
- [ ] **RES-03** — In-progress scan-cart contents persist to IndexedDB so accidental navigation or token refresh doesn't lose them
- [ ] **RES-04** — PWA manifest is in place so the app is installable to home screen

### Non-Functional

- [ ] **NFR-01** — Stack: Next.js 16, React 19, shadcn/ui v4 (radix-nova/neutral), Tailwind v4, Firebase
- [ ] **NFR-02** — TypeScript strict; `npm run build` and `tsc --noEmit` both pass
- [ ] **NFR-03** — ESLint passes on every commit (flat config, no `next lint`)
- [ ] **NFR-04** — Phase 1 ships with zero Firebase calls and zero `.env.local` dependencies — every page renders against mocks in `lib/mock/`
- [ ] **NFR-05** — All routes render without console errors in `next dev`
- [ ] **NFR-06** — Server Action files contain `'use server'` and call `verifySession()` at the top
- [ ] **NFR-07** — `lib/firebase/admin.ts` imports `'server-only'`; service-account credentials never leave server bundle
- [ ] **NFR-08** — `proxy.ts` (not `middleware.ts`) handles optimistic auth cookie checks
- [ ] **NFR-09** — `next.config.ts` does not enable `cacheComponents` in v1

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

| REQ-ID Range | Phase |
|--------------|-------|
| AUTH-01..10 | Phase 2 — wired backend; Phase 1 ships matching UI shells |
| INV-01..10 | Phase 2 functionality; Phase 1 ships shells |
| EVT-01..08 | Phase 2 functionality; Phase 1 ships shells |
| CO-01..10 | Phase 2 functionality; Phase 1 ships shells |
| CI-01..08 | Phase 2 functionality; Phase 1 ships shells |
| MIS-01..04 | Phase 2 functionality; Phase 1 ships shells |
| REP-01..07 | Phase 2 functionality; Phase 1 ships shells |
| RP-01..04 | Phase 2 functionality; Phase 1 ships shells |
| SCN-01..06 | Phase 2 functionality; Phase 1 ships UI scaffold (camera widget can be functional even in Phase 1, but scanned values are logged, not persisted) |
| AUD-01..04 | Phase 2 — audit log writes are server-side; Phase 1 ships history feed UI against mocks |
| INT-01..05 | Phase 2 |
| RES-01..04 | Phase 2 |
| NFR-01..09 | Both phases (NFR-04 is Phase 1-specific) |

See `ROADMAP.md` for per-phase mapping.
