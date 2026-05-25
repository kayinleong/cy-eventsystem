# Phase 2: Functionality — Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 replaces every `lib/mock/*` call site in the existing UI with real Firebase Auth + Firestore + 2 Cloud Functions + Storage. Wires `proxy.ts` (NOT `middleware.ts`) for optimistic cookie verification, the `verifySession()` DAL for server-side re-verification, every Server Action with role + event-membership checks, and ships `firestore.rules` + `firestore.indexes.json` against a single live Firebase project. The UI surface from Phase 1 is **frozen** — changes only by explicit decision recorded here.

Phase 2 internally organized into ROADMAP Blocks A–H (Foundation, Users + roles, Inventory CRUD, Events, Scan check-out, Scan check-in, Reports + repurchase, Hardening) but ships as a single phase deliverable.

**Out of scope (deferred to v2):** Reservations/holds, kits/bundles, unique-asset/serial tracking, asset condition tracking with photos, maintenance workflow, sub-locations, email/Slack notifications for low-stock+overdue, bulk CSV import, per-event Staff permissions, calendar/Gantt view, custom fields, damage photo on missing-item form.

</domain>

<decisions>
## Implementation Decisions

### De-risk strategy (Block A foundation)

- **D-01:** Run a **1-day spike** on `next-firebase-auth-edge` v1.12+ before any Block A work commits. Throwaway `proxy.ts` + login Server Action + cookie round-trip against a scratch namespace/project. Per STATE.md Q5 (recommended).
- **D-02:** **Cloud Functions scope = exactly 2 functions in v1:**
  - `onWrite(users/{uid})` → `setCustomUserClaims(uid, { role })` to mirror Firestore role to ID token claims (KD #9).
  - `onWrite(events/{id})` OR `onWrite(users/{uid})` → maintain denormalized `event.allowedStaff` union (admins + teamLeads + backupTeams). ROADMAP Block D requirement.
  - No scheduled functions. No email-trigger functions. No nightly stale-event scanner (PITFALLS C5 mitigation deferred to v2 or manual ops).
- **D-03:** **Single Firebase project** for everything (prod). No staging environment, no per-developer dev projects. Local `npm run dev` writes to the live Firestore. Sole developer per PROJECT.md — data contention is zero.
- **D-04:** **No Firebase Emulator Suite** for dev or local testing. All dev iteration hits the live project.
- **D-05:** First admin user via **`scripts/seed-first-admin.ts`** — a one-time Admin SDK script that `createUser` → `setCustomUserClaims({role:'admin'})` → writes `users/{uid}` doc with `role:'admin'`. Run manually after Firebase project provision. Documented in PROJECT.md Context section + this CONTEXT.md.
- **D-06:** **AMENDMENT — `firestore.rules` unit tests are SKIPPED in v1.** Reverses ROADMAP success criterion #6 ("rules unit tests pass for every collection"). PITFALLS C3 (rules-misconfig data leak) is acknowledged unmitigated. CHANGELOG entry required per global CLAUDE.md docs gate. Mitigations applied instead: **(a)** deny-by-default skeleton at the top of `firestore.rules`; **(b)** mandatory manual rules audit checkpoint at end of Blocks C, D, E, F, G — each block's CLAIM.md Verification section must enumerate which rule paths were tested + how; **(c)** Firebase Console Rules Playground used for any non-trivial rule before deploy. v2 may add `@firebase/rules-unit-testing` against an ephemeral emulator-per-test (the library spins one up internally — compatible with D-04's "no parallel emulator process" stance).

### Email delivery scope (Block B users + invites)

- **D-07:** **Email provider = Firebase built-in only.** `admin.auth().generatePasswordResetLink(email, actionCodeSettings)` returns a signed time-limited URL that Firebase delivers via its default template. No SendGrid, no Resend, no transactional email service in v1. Branding stays Firebase-stock (acceptable for internal ops tool).
- **D-08:** After `/set-password` success (oobCode confirmed via `confirmPasswordReset`), immediately call `signInWithEmailAndPassword` with the just-set credentials and redirect to `/` (auto-sign-in). Same UX for invite and forgot-password flows (Firebase doesn't distinguish the oobCode source). AUTH-04 contract met without a two-step redirect.
- **D-09:** **Failed email delivery handling:** the `inviteUser` Server Action returns the generated reset URL in its response payload (both success AND failure paths). `/users/invite` UI shows the URL with a 'Copy link' button after submit. If email delivery fails (or just doesn't arrive), admin can share via Slack/SMS/direct-message. AUTH-07 contract fulfilled even if Firebase email infra has issues.
- **D-10:** **Low-stock + overdue-event email notifications stay v2-deferred.** v1 surfaces them only via:
  - Dashboard widget (low-stock + overdue-returns cards) — Phase 1 surface already in place.
  - Nav badge (low-stock count) per RP-03 — Phase 1 surface already in place.
  - No daily digest, no real-time email triggers.

### Photo / Storage scope (Block C inventory)

- **D-11:** **Photo source = file upload + dedicated 'Take photo' button.** The form on `/inventory/new` and `/inventory/[id]/edit` has both `<input type='file' accept='image/*'>` and a 'Take photo' button that triggers inline `getUserMedia` capture. Reuse the camera-permission + error-handling pattern already established in `components/feature/scan/ScannerWidget.tsx` (D-01-08 from Phase 1). The 'Take photo' button is on mobile by default; renders on desktop too if `navigator.mediaDevices.getUserMedia` is available.
- **D-12:** **Client-side image processing before upload:** install `browser-image-compression` (~10KB), resize to max 1600px on long edge, compress to JPEG quality 0.85. Caps Storage cost at ~150-300KB per photo. Prevents 12MB iPhone uploads. Apply uniformly to camera capture and file-upload paths.
- **D-13:** **Storage rules:**
  - Path: `items/{itemId}/photo.jpg`.
  - `read`: `request.auth != null` (any signed-in user).
  - `write`: `request.auth.token.role == 'admin'` (admins only — mirrors INV-03).
  - No public-read paths.
- **D-14:** **Photo lifecycle = replace-only.** Editing an item with a new photo overwrites the same Storage path (`items/{itemId}/photo.jpg`). No "Remove photo" affordance, no versioning, no orphan cleanup job. Retiring an item (INV-05 / `lifecycleState='retired'`) leaves the photo in place; only deleting the Firestore doc would orphan it (which the v1 surface doesn't expose).
- **D-15:** **UI SURFACE AMENDMENT:** Phase 1 inventory forms (`/inventory/new` + `/inventory/[id]/edit`) shipped WITHOUT a photo field (the Phase 1 ItemForm covered name/SKU/totalQty/unit/category/notes only). Phase 2 ADDS the photo field to both forms. Justified by INV-01 + INV-03 (REQUIREMENTS.md explicit) — Phase 1 deferred this surface to Phase 2 in practice. ROADMAP Phase 2 "UI hint: no" override approved here.

### Scale + indexing (Block C/D/E/F/G query architecture)

- **D-16:** **Operational scale assumption = growth-ready:** Year 1 plateau projection of 5000+ inventory items, 100+ events (active + historical), ~5-10 internal users. All query, listener, and aggregation strategies design for this scale, not the Phase 1 mock seed (30 items).
- **D-17:** **Pagination = Firestore cursor (`startAfter`) everywhere.** URL contract on every list page changes from Phase 1's `?page=N` to `?cursor=xxx` (opaque cursor blob). Server Component reads the page-N slice via Admin SDK with `.limit(50).startAfter(decoded)`; Client Component takes over via `onSnapshot` on the same page slice. TanStack Table sets `manualPagination: true`. Affected pages: `/inventory`, `/events`, `/users`, `/reports/{stock, out, history, missing, repurchase}`. **REP-06 (shareable filter URLs) still holds** — the URL is the cursor; "go to specific page 7" UX is lost. "Page N of M" replaced with prev/next-only (no total count).
- **D-18:** **Composite indexes = pre-declare from research + grow reactively.** Block A ships `firestore.indexes.json` with the obvious indexes derived from research/ARCHITECTURE.md:
  - `transactions(eventId, at desc)` for event audit feeds
  - `transactions(itemId, at desc)` for item audit feeds
  - `transactions(actorUid, at desc)` for history filter
  - `transactions(type, at desc)` for history filter
  - `inventory(lifecycleState, category)` for inventory filters
  - `events(status, startDate)` for event list default sort
  - `events.allowedStaff array-contains-any + status` for EVT-08 staff filter
  - `missingItems(status, at desc)` for /reports/missing
  
  New queries flagged with FAILED_PRECONDITION in dev get added to `firestore.indexes.json` + redeployed. **INT-05 explicit ban on console auto-create stands** — never click the auto-create link.
- **D-19:** **Firestore offline persistence enabled globally.** Call `enableIndexedDbPersistence(db)` once in `lib/firebase/client.ts`. RES-01 (offline read) + RES-03 (in-progress scan-cart survives reload) fulfilled. RES-02 (offline banner + scanner disable on `!navigator.onLine`) wired in Block H. Scan check-out + check-in pages disable themselves when offline because stock decrements would race the queued writes on reconnect.
- **D-20:** **Real-time listeners scoped to current cursor page only.** `onSnapshot` subscribes to the 50-row visible window of each list page. Navigating to next page tears down old listener + spins up a new one. Avoids the fan-out cost of a full-collection live subscription at 5000+ items. Dashboard widget listeners (low-stock count, overdue events) are also scoped (e.g., `where(availableQty <= threshold).limit(50)`).
- **D-21:** **Dashboard KPI cards backed by Firestore `count()` aggregations.** Each of the 4 KPIs (`totalItems`, `itemsOut`, `lowStockCount`, `activeEvents`) issues one `count()` aggregation query per dashboard load. Aggregations are NOT real-time — dashboard refetches on navigation/refresh. Replaces Phase 1's `s.items.reduce(...)` pattern which dies at 5000+ items. KPIs do not subscribe via listener; they re-query on mount + on `revalidatePath('/')` after mutations.

### Claude's Discretion

- Server Action file structure: `app/<route>/actions.ts` co-located with each route per CLAUDE.md.
- `verifySession()` DAL implementation lives at `lib/auth/dal.ts`; wraps `verifySessionCookie(cookie, true)` (with revocation check) + uses `React.cache()` for per-request memoization.
- Cursor encoding for `?cursor=xxx`: base64-encoded JSON of the `startAfter` field values (e.g., `{name: "X", id: "abc"}`). Opaque to clients; decoded server-side.
- Optimistic UI pattern via `useOptimistic` already wired in Phase 1's scan-cart — Phase 2 only swaps the commit destination (mock store → Server Action).
- Error UX for Server Action rejections: `sonner` toasts (Phase 1 pattern) + inline form errors via rhf's `setError`. Generic copy ("Couldn't save — try again.") for unexpected errors; specific copy for known failures (CO-05 stock-insufficient: "Only N available; reduce quantity.").
- Error-boundary structure: per-segment `error.tsx` / `loading.tsx` / `not-found.tsx` per ROADMAP Block H.
- `revalidatePath` after every mutation in every Server Action; calls scoped to the affected path (e.g., `revalidatePath('/inventory')` after item create).
- App Check enrollment per ROADMAP Block H: recommended but planner-discretion; if enabled, configure reCAPTCHA Enterprise + add to `lib/firebase/client.ts` + Storage rules.
- `experimental_taintObjectReference` on user records per PITFALLS C4 — recommended but planner-discretion; defends against accidental session serialization to client bundles.
- Plan structure: ROADMAP lists 8 blocks (A–H); planner decides whether each block is 1 plan or split (estimate 12–15 plans total across 3–4 waves).

### Folded Todos

(None — no pending todos surfaced as relevant to this phase.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level (always)

- `CLAUDE.md` — Owner slug protocol, claim-before-start, regression rules, docs gate, secrets hygiene, stack constraints, file location rules (`lib/firebase/`, `lib/dal/`, `app/<route>/actions.ts`, etc.).
- `AGENTS.md` — Next.js 16 breaking-change warning. **Read `node_modules/next/dist/docs/` before writing any Next.js-specific code.** Critical for proxy.ts (not middleware.ts), async cookies/headers/params, revalidateTag two-arg signature, parallel-route defaults.
- `.planning/PROJECT.md` — Project identity. 20 key decisions including stack (KD #1), hybrid lifecycle data model (KD #7), session cookies via auth-edge (KD #8), hybrid roles claims+Firestore (KD #9), defense-in-depth auth (KD #10), proxy.ts not middleware.ts (KD #11), Cache Components OFF (KD #12), Document ID = SKU (KD #14), 5 scanner formats (KD #15), mock data wholesale replaced (KD #17).
- `.planning/REQUIREMENTS.md` — All v1 requirements with IDs. Phase 2 actives: AUTH-01..10, INV-01..10, EVT-01..08, CO-01..10, CI-01..08, MIS-01..04, REP-01..07, RP-01..04, SCN-01..06, AUD-01..04, INT-01..05, RES-01..04, NFR-01..03, NFR-05..09. **Phase 2 will need a REQUIREMENTS.md amendment to record D-06 (rules unit tests skipped — NFR/INT impact).**
- `.planning/ROADMAP.md` §"Phase 2 — Functionality" — Mapped requirements per Block A-H, success criteria, out-of-scope list. **D-06 amends success criterion #6 — see Decisions above. D-15 amends "UI surface frozen" — see Decisions above. D-17 amends Phase 1 URL contract — see Decisions above.**
- `.planning/STATE.md` — Phase tracker, accumulated Phase 1 decisions (D-01-01-A through D-01-12-D), and Phase 2 Open Clarifications (Q1-Q5, all now resolved by this CONTEXT.md).

### Phase 1 locked contracts (frozen surface)

- `.planning/phases/phase-kayinleong-01/01-CONTEXT.md` — Phase 1 implementation decisions, especially D-02 (mock store mirrors Firestore data model — Phase 2 is a data-source swap), D-13 to D-16 (scanner integration; reusable patterns).
- `.planning/phases/phase-kayinleong-01/01-UI-SPEC.md` — **APPROVED visual contract.** All 6 dimensions PASS. Spacing, typography, color, status palette, copy contract, registry safety. Phase 2 inherits this contract; D-15 adds a photo field to inventory forms but otherwise UI surface is frozen.
- `.planning/phases/phase-kayinleong-01/01-PATTERNS.md` — Phase 1 codebase patterns (component composition, form patterns, table patterns). The "patterns to reuse" anchor for Phase 2 planning.
- `.planning/phases/phase-kayinleong-01/CLAIM.md` — Phase 1 verification record; cross-reference for "what's already built" understanding.

### Phase 1 plan summaries — implementation reference

Each Phase 2 block has a Phase 1 antecedent. Planner reads the relevant SUMMARY before planning:

- `01-01-stack-types-schemas-SUMMARY.md` — Entity types + Zod schemas already in place. Phase 2 Server Actions import these schemas as-is. **Block A reference.**
- `01-02-mock-data-store-SUMMARY.md` — Mock store API with 14 mutators mapped to mutator-name→Server-Action signatures. Each mutator becomes a Server Action; signatures align 1:1 by Phase 1 design (KD #17). **Blocks C, D, E, F, G reference.**
- `01-03-shell-primitives-SUMMARY.md` — DataTable + URL-sync hooks. Phase 2 modifies `useUrlTableState` to handle `?cursor=` instead of `?page=` per D-17. **Block C, D, G reference.**
- `01-04-auth-shell-role-gate-SUMMARY.md` — Mock `mock_session` cookie shape designed to mirror Firebase `__session` shape. Phase 2 swaps `readMockSessionClient()` → `verifySession()` from DAL. PhaseOnePocRoleSwitcher + SeedUsersDisclosure get DELETED. **Block A reference.**
- `01-05-dashboard-SUMMARY.md` — KpiCards `reduce()` pattern dies at scale; Phase 2 swaps to Firestore `count()` aggregations per D-21. **Block G reference.**
- `01-06-inventory-SUMMARY.md` — Inventory list/new/detail/edit surface. Phase 2 swaps `store.createItem/updateItem/retireItem` → Server Actions; D-15 adds photo field. **Block C reference.**
- `01-07-events-SUMMARY.md` — Events list/new/detail/edit + cancel reconciliation. Phase 2 swaps mutators + ADDS Cloud Function trigger for `allowedStaff` recompute. **Block D reference.**
- `01-08-scanner-and-scan-page-SUMMARY.md` — Scanner widget + scan-session context + cart + event-picker. Phase 2 swaps `store.checkout` → `checkoutItem` Server Action; cart commit is now atomic Firestore transaction. **Block E reference.**
- `01-09-checkout-flow-SUMMARY.md` + `01-10-checkin-flow-SUMMARY.md` — Per-event scoped flows. Same swap pattern. **Blocks E + F reference.**
- `01-11-reports-SUMMARY.md` — 5 report tables with URL-synced filters. D-17 cursor migration affects each. **Block G reference.**
- `01-12-users-settings-SUMMARY.md` — `/users` admin + invite + `/settings`. Phase 2 swaps `store.inviteUser/setUserRole/disableUser` → Server Actions; invite calls `generatePasswordResetLink` per D-07/D-09. **Block B reference.**
- `01-13-verification-gate-SUMMARY.md` — Phase 1 acceptance gate. Phase 2 will have a similar verification gate; D-06 changes the rules-unit-test gate to a manual rules-audit checkpoint.

### Technical research

- `.planning/research/STACK.md` — Locked library versions with confidence levels. **Next.js 16 breaking-change matrix** (proxy.ts, async cookies, revalidateTag signature, parallel-route defaults). Read before writing any Next-specific code.
- `.planning/research/ARCHITECTURE.md` — Firestore collections schema (`users`, `inventory`, `events`, `transactions`, `missingItems`). Cloud Function patterns. Folder structure for `lib/firebase/`, `lib/auth/`, `lib/data/`, `lib/hooks/`.
- `.planning/research/FEATURES.md` — Per-feature implementation patterns and library recommendations.
- `.planning/research/PITFALLS.md` — **Critical reading.** C1 (negative-qty races), C2 (missing indexes), C3 (rules misconfig — D-06 leaves this PARTIALLY UNMITIGATED), C4 (auth hydration), C5 (stuck-out items), C6 (Admin SDK on Edge). Plus per-category traps for ZXing iOS Safari, Firestore tx retry semantics, session-cookie revocation timing.
- `.planning/research/SUMMARY.md` — Cross-cutting synthesis; "Quick wins to bake in immediately" list (Document ID = SKU, serverTimestamp everywhere, etc.).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets (Phase 1 → Phase 2 swap targets)

- **`lib/mock/store.ts`** — 14 mutators with signatures designed to mirror Server Action shapes. Phase 2 maps each to a Server Action in `app/<route>/actions.ts`:
  - `store.signIn / signOut` → `/api/auth/session` + `/api/auth/logout` route handlers
  - `store.inviteUser / setUserRole / disableUser` → `app/(app)/users/actions.ts`
  - `store.createItem / updateItem / adjustItemStock / retireItem / updateLowStockThreshold / markLowStockOrdered` → `app/(app)/inventory/actions.ts`
  - `store.createEvent / updateEvent / cancelEvent` → `app/(app)/events/actions.ts`
  - `store.checkout / checkin` → `app/(app)/events/[id]/checkout/actions.ts` + `app/(app)/events/[id]/checkin/actions.ts`
  - `store.resolveMissing` → `app/(app)/reports/missing/actions.ts`
- **`lib/types/<entity>.ts`** — 5 entity types already mirror Firestore data model per Phase 1 D-02. Re-use as Firestore document types in `lib/data/` Admin SDK helpers.
- **`lib/schemas/<entity>.ts`** — 12 Zod 4 schemas. Server Actions import unchanged for validation.
- **`lib/hooks/use-mock-store.ts`** — Replace with Firestore live hooks (one per collection): `use-inventory-live.ts`, `use-events-live.ts`, etc. Hook signature stays the same (`useInventoryLive(cursorPage) → InventoryItem[]`); only the data source changes.
- **`components/feature/scan/ScannerWidget.tsx`** — Camera permission + iOS-specific error copy + tap-to-start pattern. **Reuse for D-11's 'Take photo' button on inventory forms.**
- **`components/feature/table/DataTable*.tsx`** — Generic DataTable wrapper + URL-sync pagination. Phase 2 modifies pagination to cursor-based (D-17). Filter/sort URL params survive unchanged.
- **`lib/auth/`** — Phase 1 has mock auth helpers (`mock-session.ts`, `read-mock-session-*.ts`). Phase 2 ADDS `dal.ts` with `verifySession()` + `requireSession()` + `requireAdmin()`. Mock helpers get DELETED.
- **`components/feature/auth/SignOutButton.tsx`** — Server Action call already wired in Phase 1; Phase 2 swaps the action body to `revokeRefreshTokens` + `cookies().delete('__session')`.
- **`app/(app)/layout.tsx`** — Role gate reads mock cookie. Swap to `await verifySession()` from DAL.

### Established patterns

- **shadcn v4 `<Field>` primitives** for all forms (Phase 1 D-01-04-B). Phase 2 forms follow the same shape.
- **`<Controller>` for Select / RadioGroup** in rhf forms (Phase 1 D-01-06-B). Same for any new selects in Phase 2.
- **`useSyncExternalStore`-based hooks** with raw-slice + `useMemo` derivation pattern (Phase 1 D-01-02-A, D-01-03-A, D-01-10-C, D-01-11-A, D-01-12-A). Phase 2 Firestore hooks follow the same shape to avoid React 19's `react-hooks/set-state-in-effect` rule.
- **Server Component does initial fetch → Client takes over via subscription** (research/SUMMARY.md). Phase 1 used this for mock store; Phase 2 uses it for Firestore (Admin SDK seed + Web SDK `onSnapshot`).
- **Optimistic UI via `useOptimistic`** on scan-cart (Phase 1 D-13/D-14, contract pre-wired CO-06). Phase 2 only swaps the commit destination.
- **`router.push + router.refresh()` after mutations** (Phase 1 D-01-06-C). Phase 2 adds `revalidatePath()` server-side; client-side router calls stay the same.
- **`bwip-js` for QR label generation** — already client-side in Phase 1 (`/inventory/[id]` print preview). Stays unchanged in Phase 2.
- **`sonner` for toast notifications** + variant="destructive" on AlertDialog actions (Phase 1 D-01-04-F, D-01-06-F, D-01-11-E). Same toast/dialog patterns for Phase 2 Server Action errors.

### Integration points (where new code connects)

- **`proxy.ts` at repo root** (NEW in Phase 2) — Optimistic `__session` cookie check; passes through if present, redirects to `/login` if not. NEVER imports Admin SDK (Edge unsupported in proxy per Next 16; also Admin SDK is server-only). Node.js runtime explicitly.
- **`lib/firebase/client.ts`** (NEW) — Web SDK init + `enableIndexedDbPersistence` per D-19.
- **`lib/firebase/admin.ts`** (NEW) — Admin SDK init with `import 'server-only'`. Guarded by `if (!getApps().length)`. Used by Server Actions, Route Handlers, Server Components for trusted reads.
- **`lib/auth/dal.ts`** (NEW) — `verifySession()` + `requireSession()` + `requireAdmin()` wrapped in `React.cache()` for per-request memoization. Used by every (app) Server Component and Server Action.
- **`lib/data/<entity>.server.ts`** (NEW) — Admin SDK read helpers (server-only). Imported by Server Components for initial-fetch + hydration to Client Components.
- **`lib/hooks/use-<entity>-live.ts`** (NEW per collection) — Web SDK `onSnapshot`-backed hooks. Subscribe to cursor-paged slices per D-20.
- **`app/api/auth/session/route.ts`** (NEW) — POST creates `__session` cookie from ID token via auth-edge.
- **`app/api/auth/logout/route.ts`** (NEW) — POST revokes refresh tokens + clears cookie.
- **`firestore.rules`** (NEW) — Deny-by-default skeleton; per-collection rules; rules audit checkpoint at end of each block (D-06 manual audit).
- **`firestore.indexes.json`** (NEW) — Pre-declared per D-18.
- **`storage.rules`** (NEW) — Storage rules per D-13.
- **`scripts/seed-first-admin.ts`** (NEW) — Admin SDK script per D-05. Gitignored or env-gated.
- **`.env.local`** (NEW, gitignored) — All `NEXT_PUBLIC_FIREBASE_*` client config + `FIREBASE_SERVICE_ACCOUNT_*` server private keys.
- **`functions/` directory** (NEW) — 2 Cloud Functions per D-02. Deployed via `firebase deploy --only functions`.

### Code that gets DELETED in Phase 2

- **`lib/mock/` entire directory** — wholesale replacement per KD #17. All call sites switch to Server Actions or live hooks.
- **`lib/auth/mock-session.ts`** + **`lib/auth/read-mock-session-*.ts`** — replaced by `lib/auth/dal.ts` with real session verification.
- **`components/feature/auth/PhaseOnePocRoleSwitcher.tsx`** — POC affordance; no role-switching in real auth.
- **`components/feature/auth/SeedUsersDisclosure.tsx`** — POC affordance on `/login`; no seed users in prod.
- **`app/(auth)/login/page.tsx`** mock-user lookup — replaced with `signInWithEmailAndPassword` + ID-token round-trip to `/api/auth/session`.

</code_context>

<specifics>
## Specific Ideas

- **Phase 1 deliberately designed mock-store mutator signatures to mirror Server Action shapes** (Phase 1 KD #17 + 01-CONTEXT.md D-02). Phase 2 is a data-source swap, not a UI rewrite. The planner should leverage this 1:1 mapping aggressively to reduce plan count.
- **The mock cookie shape (`{uid, displayName, email, role, disabled}`) mirrors Firebase `__session` decoded shape** (Phase 1 D-05). The `(app)/layout.tsx` role-gate logic stays; only the cookie-decoder swaps. This is the load-bearing decision for Block A's auth wire-up.
- **Stakeholder approved Phase 1 acceptance demo end-to-end** with 0 console errors (STATE.md, 2026-05-25). Phase 2 must preserve this visual fidelity — no regression in UX is acceptable. UI surface frozen, with two explicit amendments: photo field on inventory forms (D-15) + cursor URLs replacing `?page=N` (D-17).
- **PITFALLS C3 (rules misconfig data leak) is the highest unmitigated risk** after D-06's rules-unit-test skip. The planner must include a mandatory "rules audit + manual playground verification" task as the final task of each block that introduces rules (Blocks A, C, D, E, F, G). Each block's CLAIM.md Verification section must enumerate the rules tested.
- **First-day spike on `next-firebase-auth-edge` v1.12** (D-01) gates all of Block A. If the spike reveals incompatibility with Next 16.2.6, planner reverts to lower-level Firebase Admin SDK session-cookie management. Spike artifacts live in `.planning/spikes/next-firebase-auth-edge-v1.12/` per GSD convention.
- **Cloud Function deployment surface:** `functions/` directory committed to repo; Cloud Functions deployed independently of the Next.js app via `firebase deploy --only functions`. Same Firebase project per D-03. No emulator per D-04 — Functions are tested by deploying to the live project and triggering them via writes.
- **`/inventory/[id]` QR label print preview** stays client-side `bwip-js` per Phase 1. Phase 2 does not change this; the SKU encoding stays QR-format per KD #15.
- **Phase 1's `useOptimistic` scan-cart wiring** (D-13/D-14) already handles the CO-06 contract. Phase 2's `checkoutItem` Server Action must return a result that `useOptimistic` can revert cleanly on CO-05 stock-rejection — failed lines surface in the toast.error description.

</specifics>

<deferred>
## Deferred Ideas

Items raised during discussion that belong elsewhere or are explicitly out of v1 scope.

### Rolled back during discussion

- **Low-stock + overdue-event email digest** — initially considered for v1, rolled back to v2-deferred per D-10. Conflict with "Required only" Cloud Functions scope (D-02) and "Firebase built-in only" email provider (D-07) was the trigger.
- **Pre-declare-exhaustively index strategy** — considered but rejected in favor of pre-declare-from-research + grow reactively (D-18).
- **Versioned photo history (last N photos)** — considered for INV-03 history; rejected in favor of replace-only (D-14). Reconsider in v2 if asset-condition tracking lands.

### v2 candidates surfaced incidentally

- **Damage photo on missing-item form** — REQUIREMENTS.md v2-deferred (confirmed).
- **`@firebase/rules-unit-testing` against ephemeral emulator-per-test** — v2 mitigation for D-06 skip if the manual audit reveals gaps.
- **App Check enrollment** — recommended in research/PITFALLS but planner-discretion; if not enabled in Phase 2, becomes a v2 hardening.
- **Nightly stale-active-event scanner Cloud Function** — PITFALLS C5 mitigation deferred; manual ops handles it in v1 (admins reconcile via /reports/out).
- **Sharded counters** for high-write surfaces — not needed in v1 per growth-ready-but-not-extreme assumption.
- **Multi-region Firestore** — single-region default; reconsider if user base goes multi-geo.
- **CI/CD pipeline for Firebase deployments** — `firebase deploy` from developer machine in v1; CI/CD setup is v2.

### Reviewed Todos (not folded)

(None — no pending todos cross-referenced for this phase.)

</deferred>

---

*Phase: 02-functionality*
*Context gathered: 2026-05-25*
