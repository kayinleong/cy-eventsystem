# Claim: phase-kayinleong-02

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-05-25
- status: in-progress
- summary: Functionality — wire Firebase Auth + Firestore + 2 Cloud Functions + Storage; replace every mock with real backend; UI surface frozen from Phase 1
- current plan: 02-10 (reports + dashboard count() aggregations — Wave 10, Block G); 02-09 checkin + missing PASS + Block F rules audit logged; event status now derived from dates (commit b23c449); Cloud Functions removed and inlined into Server Actions per D-02 re-amendment

## What will change

- Phase 2 implementation context captured in `.planning/phases/phase-kayinleong-02/02-CONTEXT.md`
- Discussion audit trail in `.planning/phases/phase-kayinleong-02/02-DISCUSSION-LOG.md`
- Subsequent claims under this phase will:
  - Stand up Firebase project + Admin SDK + Web SDK clients
  - Wire `next-firebase-auth-edge` v1.12+ session cookies (after a 1-day spike)
  - Ship `firestore.rules` + `firestore.indexes.json` (rules unit tests SKIPPED in v1 — amends ROADMAP success criterion #6)
  - Replace every `lib/mock/*` call site with Server Actions + Firestore transactions
  - Add 2 Cloud Functions: `onWrite(users) → setCustomUserClaims`, `onWrite(events|users) → maintain event.allowedStaff`
  - Add inventory photo field to `/inventory/new` + `/inventory/[id]/edit` (UI surface amendment)
  - Migrate all list pages from `?page=N` to `?cursor=xxx` Firestore cursor pagination (UI URL contract amendment)
  - Enable Firestore IndexedDB persistence + RES-02 offline banner + scanner-page disable when offline
  - Ship `/api/auth/session` + `/api/auth/logout` route handlers
  - Wire `proxy.ts` (NOT `middleware.ts`) for optimistic cookie check
  - Delete Phase 1 POC affordances: `PhaseOnePocRoleSwitcher`, `SeedUsersDisclosure`, and `lib/mock/*` wholesale

## What has changed

### Plan 02-01 (spike on next-firebase-auth-edge v1.12) — complete (2026-05-25)

- Spike workspace scaffolded at `.planning/spikes/next-firebase-auth-edge-v1.12/`
- Programmatic spike runner (`run-spike.ts`) implementing all 6 acceptance checks
- All 6 acceptance criteria PASS — verdict: **PROCEED_AS_PLANNED**
- Verdict + anomalies documented (see commit message + spike-results.json + handoff notes)
- Key correction discovered: `admin.auth().verifySessionCookie()` does NOT work on auth-edge
  cookies (HMAC envelope format, not Firebase native). Plan 02-02 DAL must use
  `getTokensFromObject()` / `getTokens()` from the library instead.
- Anomaly: `.env.local` FIREBASE_* trio mismatched `sa.json`. Spike used sa.json via
  `applicationDefault()`. Developer must reconcile before 02-02.
- Throwaway repo-root files cleaned up (proxy.ts + app/api/auth/* stubs deleted before
  commit).
- Dependencies committed: `firebase@^12.13`, `firebase-admin@^13.10`, `next-firebase-auth-edge@^1.12.0`, `tsx@^4.22.3` (dev).
- `.gitignore` updated to exclude service-account JSON variants.

### Plan 02-02 (Firebase clients + DAL + proxy + rules/indexes) — code complete; deploy + rules audit pending (2026-05-25)

- `lib/firebase/admin.ts` — Admin SDK singleton, `import "server-only"`, env-var-only init + startup project-ID assertion (FINDINGS A2 fix).
- `lib/firebase/client.ts` — Web SDK singleton with `persistentLocalCache(persistentSingleTabManager({}))` per RESEARCH note (`enableIndexedDbPersistence` deprecated in firebase ^12).
- `lib/auth/dal.ts` — `verifySession` / `requireSession` / `requireAdmin` exports memoized via `React.cache`. Uses `getTokens()` from `next-firebase-auth-edge` + `adminAuth.verifyIdToken(token, true)` for AUTH-09 immediate revocation (FINDINGS A1 fix — PLAN.md text proposing `verifySessionCookie` was incorrect).
- `lib/auth/roles.ts` — `Role` type + role helpers.
- `proxy.ts` at repo root — port of `proxy.spike.ts` MINUS `sa.json` fallback (env-vars only, no `debug:true`).
- `app/api/auth/session/route.ts` + `app/api/auth/logout/route.ts` — no-op stubs (proxy's authMiddleware intercepts; route files exist to satisfy Next routing).
- `firestore.rules` — deny-by-default skeleton + per-collection allow rules from RESEARCH §"firestore.rules skeleton" per D-06 mitigation.
- `firestore.indexes.json` — 12 pre-declared composite indexes per D-18 (includes `isLowStock` per RESEARCH P11).
- `storage.rules` — admin-write + signed-in-read on `items/{itemId}/photo.jpg` per D-13.
- `firebase.json` — Firebase CLI deploy config (rules + indexes + storage; no functions yet — plan 02-04).
- `.env.example` at repo root — template for `.env.local`. `.gitignore` updated to explicit env blacklist so `.env.example` commits cleanly (Deviation #4 in SUMMARY.md).
- `CHANGELOG.md` — D-06 entry (rules unit tests skipped in v1, mitigation = manual audit per block + Console Rules Playground).
- Verification gates green: `tsc --noEmit` PASS, `npm run lint` PASS (1 pre-existing Phase 1 warning untouched), `npm run build` PASS (27 routes generated, proxy.ts recognized).
- Admin SDK does NOT leak into client bundle (verified via grep `firebase-admin` in `.next/static/chunks/` returns empty — PITFALLS C6 mitigated).
- Commits: `cd9d885` (clients), `2130aea` (DAL + proxy + routes), `1344a0f` (rules + indexes + storage + firebase.json), `ac5e1ad` (CHANGELOG), `26452f2` (admin.ts assertion fix), `e3a89a0` (SUMMARY).
- **Plan 02-02 complete (2026-05-25)** — user confirmed `firebase deploy --only firestore:rules,firestore:indexes,storage` succeeded + `npm run dev` smoke test PASSED (incognito → /login 307 redirect via proxy.ts). 5-row Rules Playground audit attested by user as PASS. See "## Rules Audit — Block A" below.

## Rules Audit — Block A (plan 02-02 deploy gate, 2026-05-25)

User-attested manual Firebase Console Rules Playground audit per D-06 mitigation (rules unit tests skipped in v1, replaced with manual audit per block):

| # | Path | Auth | Op | Expected | Result |
|---|------|------|-----|----------|--------|
| 1 | `users/SOME_UID` | Unauthenticated | get | DENY | PASS (attested) |
| 2 | `inventory/SKU-001` | Authenticated staff | get | ALLOW | PASS (attested) |
| 3 | `inventory/SKU-001` | Authenticated staff | update | DENY (admin-only writes) | PASS (attested) |
| 4 | `events/EVT-001` | Authenticated NOT in allowedStaff | get | DENY (array-contains-any gate) | PASS (attested) |
| 5 | `transactions/TX-001` | Authenticated admin | create from client | DENY (server-only writes) | PASS (attested) |

**Smoke test:** `npm run dev` → incognito http://localhost:3000 → 307 redirect to `/login` (proxy.ts cookie gate working). User-attested PASS.

**Deploy command run:** `firebase deploy --only firestore:rules,firestore:indexes,storage` — succeeded, indexes READY/CREATING.

**Note on audit attestation:** The 5 rows above are user-attested (the user manually ran the Playground tests during the smoke gate). Future plans (02-04..02-10) each have their own rules-touching audit checkpoint per D-06; results from those will append to this section as separate "Rules Audit — Block B/C/D/E/F/G" subsections.

### Plan 02-03 (auth pages wired — Wave 3, Block A) — code complete; E2E seed + sign-in gate pending (2026-05-25)

- `/login`: signInWithEmailAndPassword → POST /api/auth/session → hard-nav `/`. Generic error copy on failure (T-02-03-05 anti-enumeration). Commit 03c6a1d.
- `/forgot-password`: sendPasswordResetEmail; always shows generic success branch (T-02-03-01 anti-enumeration). Commit 05899e4.
- `/set-password`: verifyPasswordResetCode + confirmPasswordReset + D-08 auto-sign-in + POST /api/auth/session. Commit 05899e4.
- `/register`: already returns notFound() per AUTH-06 — no change.
- `(app)/layout.tsx` + `(app)/page.tsx` + `(app)/settings/page.tsx`: requireSession/getMockSession import path swap from `@/lib/auth/mock-session` → `@/lib/auth/dal` (aliased to keep call sites untouched). Commit f9d4f40.
- `lib/hooks/use-current-user.ts`: REPLACED body with onAuthStateChanged + getIdTokenResult; KEPT useCurrentUser(): Session | null signature. Role from custom claims (Cloud Function 1 in plan 02-04 mirrors users/{uid}.role → token); defaults to "staff" until claims arrive. Commit f9d4f40.
- `components/feature/auth/SignOutButton.tsx`: fetch /api/auth/logout + signOut(auth) + hard-nav /login (useTransition pending + best-effort try/catch). Commit e6d0021.
- `components/feature/shell/UserMenu.tsx`: removed PhaseOnePocRoleSwitcher import + JSX. Commit e6d0021.
- DELETED `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` + `app/(auth)/login/_components/seed-users-disclosure.tsx`. Commit 390a218.
- `scripts/seed-first-admin.ts` NEW (D-05): CLI script createsUser → setCustomUserClaims({role:'admin'}) → writes users/{uid} doc → prints Firebase password-reset link. T-02-03-06 (never logs password) + T-02-03-07 (refuses if users collection non-empty). Commit 390a218.
- `package.json`: added `seed:first-admin` npm script. `.env.example`: added run-instruction comment. Commit 390a218.
- `lib/auth/mock-session.ts` + `lib/mock/cookie.ts`: converted to shims per PATTERNS.md §3 "Option A" (12 (app) consumers route through to real DAL; both deleted in plan 02-11). Commit 390a218.
- Auto-fixes (Rule 1/3): set-password-form `react-hooks/set-state-in-effect` compliance (derive init state from URL param + only setState after async); set-password page wrapped in <Suspense> for Next 16 prerender.
- Verification gates: tsc --noEmit PASS, npm run lint PASS (1 pre-existing Phase 1 warning untouched), npm run build PASS (24 routes, proxy.ts recognized, /set-password builds static).
- See `.planning/phases/phase-kayinleong-02/02-03-auth-pages-wired-SUMMARY.md` for full details + deviation register + manual verification checkpoint instructions.
- **Plan 02-03 gate:** awaiting `npm run seed:first-admin` execution + manual E2E sign-in pass per SUMMARY.md "CHECKPOINT REACHED" section.

### Plan 02-04 (users + 2 Cloud Functions + invite — Wave 4, Block B) — code complete; deploy + Block B rules audit pending (2026-05-25)

- `functions/` package scaffolded: `package.json` (engines.node: 20, firebase-admin ^13, firebase-functions ^6, NO `serve`/`emulators` per D-04), `tsconfig.json` (target es2020, commonjs, outDir lib), `.gitignore` (lib, node_modules, *.log). Commit `bca3052`.
- `firebase.json` updated: functions block adds `ignore` + `predeploy: ["npm --prefix \"$RESOURCE_DIR\" run build"]`. Root `.gitignore`: defense-in-depth ignore for `functions/lib/` + `functions/node_modules/`.
- Cloud Function 1 — `functions/src/setCustomUserClaims.ts`: `onDocumentWritten('users/{uid}', region: asia-southeast1)` → mirror `users/{uid}.role` to Auth custom claims; strip claims when doc deleted; P6 rate-limit guard skips no-op writes; `revokeRefreshTokens(uid)` on role change for AUTH-08 immediate propagation. Commit `e8bca18`.
- Cloud Function 2 — `functions/src/syncAllowedStaff.ts`: 2 trigger registrations sharing `recomputeForEvent()`. `onEventTeamChange('events/{eventId}')` with `onlyAllowedStaffChanged` self-write loop guard (RESEARCH P5/A6); `onUserRoleChange('users/{uid}')` recomputes ALL events only when admin status flips. Commit `e8bca18`.
- `functions/src/index.ts`: re-exports `onUserWriteSetClaims` + `onEventTeamChange` + `onUserRoleChange` (3 trigger registrations of 2 logical functions per refined D-02). `npm --prefix functions run build` exits 0; `functions/lib/{index,setCustomUserClaims,syncAllowedStaff}.js` compiled.
- `app/(app)/users/actions.ts` (NEW): 3 Server Actions all gated by `requireAdmin()` from real DAL — `inviteUser(formData)` (Zod parse via `InviteUserSchema` from `@/lib/schemas/user`; `createUser` → write `users/{uid}` → `generatePasswordResetLink` → returns `{ok:true, uid, resetLink}` per D-09); `setUserRole(uid, role)` (last-admin demote guard; Cloud Functions handle claim mirror + allowedStaff recompute); `disableUser(uid, disabled)` (cannot-disable-self guard; revokes refresh tokens). All 3 call `revalidatePath('/users')` on success. Commit `d1b687f`.
- `lib/data/users.server.ts` (NEW): `getUsersPage({cursor, limit, filters})` cursor-paged read per D-17 (base64 `{displayName, uid}` cursor); `getUserServer(uid)` single-doc helper; Firestore `Timestamp → ISO string` conversion preserves Phase 1 UserDoc shape. Commit `6f93334`.
- `lib/hooks/use-users-live.ts` (NEW): `useUsersLive(initial, {role?, limit?})` `onSnapshot` scoped to 50-row window per D-20. Commit `6f93334`.
- `app/(app)/users/page.tsx`: Server Component swap — `requireAdmin()` from DAL + `getUsersPage()` SSR seed → `<UsersTable initialUsers nextCursor currentUserUid>`. Commit `27df45b`.
- `app/(app)/users/invite/page.tsx`: `requireAdmin` import swap mock-session → DAL.
- `app/(app)/users/invite/_components/invite-user-page-form.tsx`: RHF preserved, on submit builds FormData + calls `inviteUser`; D-09 Copy-link panel on success with "Copy link" / "Invite another" / "Back to users".
- `components/feature/users/UsersTable.tsx`: `useMockStore` → `useUsersLive`; D-17 prev (router.back) + next (Link `?cursor=`) chrome.
- `components/feature/users/InviteUserSheet.tsx`: Sheet preserved; Server Action call + D-09 Copy-link success panel inside Sheet.
- `components/feature/users/UserRoleSelectInline.tsx`: `setUserRole` Server Action + useTransition; removed seedUsers actor lookup.
- `components/feature/users/DisableUserButton.tsx`: `disableUser(uid, true)` Server Action + useTransition; AlertDialog preserved.
- `eslint.config.mjs`: globalIgnores for `functions/lib/**` + `functions/node_modules/**` (deviation: root lint choked on Cloud Functions CommonJS output).
- Deviations (auto-fixes, all Rule 1/3):
  - Rule 3 — `InviteUserSchema` is in `@/lib/schemas/user`, not `@/lib/schemas/auth` as plan text said. Imported from existing location.
  - Rule 1 — Plan's `toMillis() → number | null` would break UsersTable's `new Date(createdAt)` call; converted Timestamp → ISO string instead to preserve Phase 1 UserDoc contract.
  - Rule 3 — Root ESLint scanned compiled `functions/lib/*.js` and flagged CommonJS `require()`. Added `functions/lib/**` + `functions/node_modules/**` to `globalIgnores`.
- Verification gates: `npx tsc --noEmit` PASS, `npm run lint` PASS (1 pre-existing Phase 1 DataTable warning untouched per plans 02-02/02-03), `npm run build` PASS (28 routes, proxy.ts recognized), `npm --prefix functions run build` PASS. No `verifySessionCookie`/`createSessionCookie` calls. No emulator references in `functions/package.json`.
- See `.planning/phases/phase-kayinleong-02/02-04-users-cloud-function-and-actions-SUMMARY.md` for full details.
- **Plan 02-04 gate:** awaiting `firebase deploy --only functions` + end-to-end invite/role/disable smoke tests + Block B rules audit per SUMMARY.md "CHECKPOINT REACHED" section.

### Plan 02-05 (inventory data layer + 6 Server Actions — Wave 5, Block C) — complete (2026-05-25)

- `lib/types/item.ts` (MOD): added required `isLowStock: boolean` derived field per RESEARCH P11 (Firestore `where()` cannot compare two fields → denormalize). Commit `7755412`.
- `lib/schemas/item.ts` (MOD): added `isLowStock` to `ItemSchema`; new `computeIsLowStock` helper (single source of truth) + new `CreateItemSchema` / `UpdateItemSchema` / `AdjustStockSchema` for Phase 2 Server Action inputs. Commit `7755412`.
- `lib/mock/items.ts` (MOD): converted `seedItems` to `rawSeedItems.map(i => ({...i, isLowStock: computeIsLowStock(...)}))` so Phase 1 mock surface stays TS-clean until 02-11 wipes it. Rule 3 auto-fix — plan called this "informational only" but TS compilation actually requires it. Commit `7755412`.
- `lib/mock/store.ts` (MOD): `createItem` now populates `isLowStock` for 1:1 mock/Phase 2 contract. Commit `7755412`.
- `package.json` (MOD): `browser-image-compression ^2.0.2` for the photo upload helper. Commit `7755412`.
- `lib/data/inventory.server.ts` (NEW): server-only Admin SDK cursor-paged reads. `getInventoryPage({cursor, limit, filters})` + `getItemServer(itemId)`. Base64 `{name, id}` cursor; orderBy name + `__name__` for deterministic order; Timestamp → ISO conversion preserves Phase 1 contract. Mirrors `lib/data/users.server.ts` shape. Commit `232264f`.
- `lib/hooks/use-inventory-live.ts` (NEW): Web SDK `onSnapshot` scoped to 50-row window per D-20. Defensive `FirestoreError` console.error handler (inventory rule allows any signed-in read, so the Plan 02-04 useUsersLive permission-denied fallout should not recur). Commit `232264f`.
- `lib/storage/upload-photo.ts` (NEW): `uploadItemPhoto(itemId, file)` — compresses via browser-image-compression (0.3MB / 1600px / JPEG q=0.85) then uploads to `items/{itemId}/photo.jpg` (D-13/D-14 replace-only). Commit `20c015f`.
- `app/(app)/inventory/actions.ts` (NEW): 6 Server Actions — `createItem` (INV-01/02 with SKU-uniqueness via `tx.get(docRef)` assert; `SKU_EXISTS` error), `updateItem` (INV-03; recomputes isLowStock if threshold supplied), `retireItem` (INV-05; refuses if `outQty > 0` via `ITEM_OUT` error per PITFALLS C5; force `isLowStock: false`; writes audit row), `adjustItemStock` (INV-04; required reason; `WOULD_GO_NEGATIVE` invariant guard; writes audit row inside same tx), `updateLowStockThreshold` (RP-01; clears `lowStockOrderedAt` on change), `markLowStockOrdered` (RP-04; single field update). All 6 gated by `requireAdmin()`; 5 wrap state changes in `adminDb.runTransaction` (INT-01); per RESEARCH P11 every action that touches availableQty or lowStockThreshold recomputes `isLowStock` atomically. `revalidatePath` matrix covers /inventory + /inventory/[itemId] + / (dashboard KPIs) + /reports/stock + /reports/repurchase as appropriate. Commit `0ad8a35`.
- Deviations (auto-fixes, all Rule 1/3):
  - Rule 1 — Plan snippet used `lifecycleState: "active"`; actual `ItemLifecycleState` enum is `"available" | "checked_out" | "damaged" | "retired"`. Used `"available"` for new items.
  - Rule 3 — Extending `isLowStock` as a required field forced updates in `lib/mock/items.ts` + `lib/mock/store.ts` to keep TS compiling (plan called this "informational only" — incorrect). Single-source-of-truth `computeIsLowStock` keeps the seed from drifting.
  - Rule 1 (own code) — Initial `ActionResult<T = Record<string, never>>` produced 5 TS2322 errors at `return { ok: true }`. Relaxed to `ActionResult<T extends object = object>`.
- No new routes added (28 → 28). `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `lib/firebase/admin.ts`, `lib/firebase/client.ts`, `lib/auth/dal.ts`, `proxy.ts`, `firebase.json` UNTOUCHED per plan must-not-do guards. Mock-session shim and `lib/mock/*` files still present (deletion deferred to 02-11).
- Verification gates: `npx tsc --noEmit` PASS, `npm run lint` PASS (1 pre-existing Phase 1 DataTable warning untouched), `npm run build` PASS (28 routes, proxy.ts recognized).
- See `.planning/phases/phase-kayinleong-02/02-05-inventory-data-layer-and-actions-SUMMARY.md`.
- **Plan 02-05 complete (2026-05-25)** — autonomous plan, no checkpoint expected; UI swap follows in plan 02-06.

### Plan 02-06 (inventory UI swap + photo field + cursor URLs — Wave 6, Block C) — code complete; E2E + Block C rules audit pending (2026-05-25)

- `lib/hooks/use-url-table-state.ts` (MOD): D-17 migration — `state.cursor` replaces `state.page`; `setCursor` replaces `setPage`; `setGlobalFilter` / `setSort` / `setFilter` all clear cursor per RESEARCH P9 (4 × `n.delete("cursor")` in the file). `pending` from useTransition exposed. Commit `0538e31`.
- `components/feature/table/DataTable.tsx` (Rule 3 deviation, NOT in plan files_modified): migrated from `useUrlTableState.setPage` → internal TanStack `PaginationState` so the 7 not-yet-migrated tables (EventsTable, HistoryTable, MissingItemsTable, RepurchaseTable, StockReportTable, ItemsOutTable, UsersTable) compile. Commit `0538e31`.
- `lib/hooks/use-transactions-live.ts` (NEW): onSnapshot-backed audit feed hook scoped by itemId / eventId / actorUid / type. 50-row window per D-20; `orderBy("at", "desc")`. Composite indexes from plan 02-02 cover all single-filter cases. Commit `456fa04`.
- `components/feature/inventory/ItemPhotoField.tsx` (NEW): D-15 photo field. File picker (hidden input + "Choose file" Button) + "Take photo" inline `getUserMedia` with rear camera + iOS permission-denied copy (ScannerWidget pattern reuse per D-11). Calls `uploadItemPhoto(itemId, file)` (compresses to 0.3MB / 1600px / JPEG q=0.85 then writes `items/{itemId}/photo.jpg`). Plain `<img>` preview (eslint-disabled) for the dynamic Firebase Storage download URL. Commit `456fa04`.
- 4 Server Component pages swapped: `app/(app)/inventory/{page.tsx, new/page.tsx, [itemId]/page.tsx, [itemId]/edit/page.tsx}` — `requireSession` / `requireAdmin` / `verifySession` from real DAL replace mock-session imports; `getInventoryPage(searchParams)` SSR seed + `getItemServer(itemId)` Admin SDK reads. Commit `8ae847f`.
- `components/feature/inventory/InventoryTable.tsx` (MOD): bypasses generic `<DataTable>` wrapper, drives `useReactTable({manualPagination: true, pageCount: -1})` directly; consumes `initialItems` + `nextCursor` props from SSR; `useInventoryLive(initialItems)` for live updates; Prev/Next chrome (no page-N/M). All D-11 sortable-column rules preserved. Commit `b2808ec`.
- `components/feature/inventory/ItemForm.tsx` (MOD): `createItem` / `updateItem` Server Actions + setError("sku", …) for SKU_EXISTS / Zod fieldErrors. `ItemPhotoField` rendered conditionally on SKU presence (new) or always (edit). totalQty locked in edit mode (INV-04). Commit `b2808ec`.
- `components/feature/inventory/RetireItemButton.tsx` (MOD): `retireItem` Server Action; ITEM_OUT / ITEM_NOT_FOUND surfaced via toast.error. Commit `b2808ec`.
- `components/feature/inventory/ItemHistoryTab.tsx` (MOD): `useTransactionsLive({itemId, limit:50})` replaces `selectTransactionsForItem` mock selector. Commit `b2808ec`.
- `components/feature/inventory/AdjustStockDialog.tsx` (NEW): admin-only Dialog calling `adjustItemStock` Server Action with required-reason field (preset + Other fallback). AdjustStockSchema enforces `delta != 0` and `reason.min(1)`. WOULD_GO_NEGATIVE surfaced via toast. Commit `b2808ec`.
- `components/feature/settings/LowStockThresholdsCard.tsx` (MOD): `useInventoryLive` replaces mock store; `updateLowStockThreshold` Server Action replaces mock mutator; per-row inline save with pending state. Commit `b2808ec`.
- `components/feature/inventory/ItemDetail.tsx` (Rule 3 deviation, NOT in plan files_modified): surfaced AdjustStockDialog (admin-only) alongside Edit + Retire; added small `<img>` photo preview to header (D-15 visibility). Without these, Task 5 Step B smoke test cannot proceed. Commit `b2808ec`.
- Deviations (auto-fixes, both Rule 3):
  - D-K01 — DataTable.tsx migration off setPage (acceptance criterion conflicted with not-yet-migrated table consumers).
  - D-K02 — ItemDetail.tsx surfaces AdjustStockDialog + photo (verification cannot pass without UI affordance).
- Verification gates: `npx tsc --noEmit` PASS, `npm run lint` PASS (0 errors, 5 warnings — pre-existing React Compiler "incompatible-library" diagnostics; identical to the 1 Phase 1 warning, multiplied), `npm run build` PASS (28 routes, proxy.ts recognized).
- See `.planning/phases/phase-kayinleong-02/02-06-inventory-ui-photo-and-cursor-SUMMARY.md`.
- **Plan 02-06 gate:** awaiting end-to-end inventory smoke (create + photo + adjust + retire + cursor) + Block C rules audit (6 Firestore + 4 Storage Rules Playground cases) per SUMMARY.md CHECKPOINT section.

### Plan 02-07 (events data layer + 3 Server Actions + UI swap — Wave 7, Block D) — code complete; E2E + Block D rules audit pending (2026-05-26)

- `lib/schemas/event.ts` (MOD): added `CreateEventSchema` / `UpdateEventSchema` / `CancelEventReconciliationSchema` for Server Action input validation. Preserved `EventFormSchema` for the existing EventForm callers.
- `lib/data/events.server.ts` (NEW): server-only Admin SDK reads with EVT-08 access projection. `getEventsPage({cursor, limit, filters, session})` — admin sees all, staff sees `array-contains` allowedStaff. `getEventServer(eventId, session)` — null for non-members (404 path). `getOpenCheckoutsForEventServer(eventId)` — checkouts whose id is not referenced as `parentTxId` by any check-in. Timestamp → ISO conversion preserves Phase 1 contract. Commit `a5c46ec`.
- `lib/hooks/use-events-live.ts` (NEW): Web SDK `onSnapshot` scoped to 50-row window per D-20. EVT-08 `array-contains` filter mirrors the server projection. Subscription gated on `onAuthStateChanged`. Defensive FirestoreError console.error. Commit `a5c46ec`.
- `app/(app)/events/actions.ts` (NEW): 3 Server Actions — `createEvent` (EVT-01; admin OR self-team-lead; seeds allowedStaff = admins ∪ teamLeads ∪ backupTeams then calls recomputeAllowedStaffForEvent), `updateEvent` (EVT-05; canEditEvent gate; calls recomputeAllowedStaffForEvent ONLY when teamLeads/backupTeams changed via sorted-array diff), `cancelEvent` (EVT-06; requireAdmin; single runTransaction reads all open checkouts + inventory docs up-front, groups deltas by itemId, writes per-item updates + per-checkout audit rows + missingItems docs for "lost" + flips event.status="cancelled" with closedAt/closedBy). isLowStock recomputed atomically per RESEARCH P11. revalidatePath matrix covers /events, /inventory, /reports/missing, /reports/out, /reports/stock, /. Commit `044cd95`.
- `app/(app)/events/page.tsx` (MOD): real DAL (`requireSession`); SSR seed via `getEventsPage` with EVT-08 projection; `?cursor=` + `?status=` URL contract per D-17. Default status filter = "active" (EVT-03); "_all" sentinel disables. Commit `1618846`.
- `components/feature/events/EventsTable.tsx` (MOD): bypass generic `<DataTable>` wrapper, drives `useReactTable({manualPagination: true, pageCount: -1})` directly; consumes `initialEvents + nextCursor + session` from SSR; `useEventsLive` for live updates; Prev/Next chrome (no page-N/M). All D-11 sortable-column rules preserved. `useMockStore` + `selectAccessibleEvents` removed. Commit `1618846`.
- `app/(app)/events/new/page.tsx` (MOD): broadened gate `requireAdmin → requireSession` per EVT-01 (any signed-in user can attempt; Server Action enforces admin OR self-team-lead). SSR-seed users via `getUsersPage({limit:200})`. Commit `1618846` + `1f7a86b`.
- `components/feature/events/EventForm.tsx` (MOD): `createEvent`/`updateEvent` Server Actions; field-level Zod errors via `rhf.setError`. Form layout preserved. Commit `1f7a86b`.
- `components/feature/events/TeamLeadCombobox.tsx` + `components/feature/events/BackupTeamCombobox.tsx` (Rule 3 deviation): accept `users` as a prop instead of reading from `useMockStore`. SSR-seeded by parent pages (`/events/new`, `/events/[eventId]/edit`, `/events/[eventId]`). Commit `1f7a86b`.
- `app/(app)/events/[eventId]/edit/page.tsx` (MOD): `requireSession` + `getEventServer` (EVT-08 enforced) + `canEditEvent` gate (EVT-05). `notFound()` on both missing-event AND access-denied paths for anti-enumeration. Users seeded via `getUsersPage`. Commit `1f7a86b`.
- `app/(app)/events/[eventId]/page.tsx` (MOD): `requireSession + getEventServer` (EVT-08 enforced) + `canEditEvent` gate; SSR-seed users for team-member chip resolution. Commit `b1f0072`.
- `components/feature/events/EventDetail.tsx` (MOD): accepts `event + users + isAdmin + canEdit` props from SSR. Removed mock-store users subscription. CancelEventDialog only renders for admin + non-terminal status. Commit `b1f0072`.
- `components/feature/events/EventAssignedItemsTab.tsx` (MOD): `useTransactionsLive({eventId, limit:100})`; client-side derivation of open checkouts. Commit `b1f0072`.
- `components/feature/events/EventHistoryTab.tsx` (MOD): `useTransactionsLive({eventId, limit:100})`; AUD-03 chronological + AUD-01 actor role display preserved. Commit `b1f0072`.
- `components/feature/events/CancelEventDialog.tsx` (MOD): `cancelEvent` Server Action; reconciliation map keyed by transaction id (Rule 3 — Server Action's `CancelEventReconciliationSchema` keys by tx id, NOT itemId as Phase 1's mock contract did). Default "returned" for any open checkout the user doesn't explicitly change. Action disabled during submit. Commit `b1f0072`.
- `app/(app)/page.tsx` (MOD): `requireSession` + SSR-seed active events via `getEventsPage({status:"active", limit:10})` then pass to both event widgets. EVT-08 enforced in seed. Commit `a1750c5`.
- `components/feature/dashboard/ActiveEventsWidget.tsx` (MOD): `useEventsLive` scoped to `{status:"active", limit:10}`. Removed `selectActiveEvents` + `useMockStore`. Commit `a1750c5`.
- `components/feature/dashboard/OverdueReturnsWidget.tsx` (MOD): `useEventsLive` + client-side filter `endDate < nowMs`. `nowMs` driven by `useSyncExternalStore` with 60s interval (Rule 1 — React 19 purity rule disallows `Date.now()` in render or synchronous `setState` in effect). Phase 1's PHASE_1_TODAY constant replaced. Commit `a1750c5`.
- Deviations (all auto-fixed, see SUMMARY for full register):
  - Rule 3 — comboboxes now take `users` as a prop instead of `useMockStore` (plan called for `useUsersLive` which is stubbed; SSR-seeding is the cleaner fix and is consistent with EventDetail's users prop).
  - Rule 1 — `OverdueReturnsWidget` Date.now() purity violation → useSyncExternalStore pattern.
  - Rule 3 — CancelEventDialog reconciliation map keyed by tx id (not itemId) to match Server Action contract.
- Verification gates: `npx tsc --noEmit` PASS, `npm run lint` PASS (0 errors, 6 pre-existing `react-hooks/incompatible-library` warnings from TanStack + rhf — same set as plan 02-06), `npm run build` PASS (28 routes, proxy.ts recognized).
- Architecture preserved: no `functions/` directory (stays deleted), no `firebase.json` functions block, no Cloud Function 2 references in code (only one historical doc comment in `app/(app)/events/actions.ts` explaining the inlined approach). `recomputeAllowedStaffForEvent` from `@/lib/data/allowed-staff.server` is the synchronous writer.
- See `.planning/phases/phase-kayinleong-02/02-07-events-data-and-cloud-function-SUMMARY.md` for full details + deviation register + manual verification checkpoint instructions.
- **Plan 02-07 gate:** awaiting end-to-end events smoke (create + edit + team-membership change + EVT-08 access + cancel reconciliation + admin promotion sweep) + Block D rules audit (8 cases) per SUMMARY.md CHECKPOINT section.

### Plan 02-08 (checkout marquee transaction + scan — Wave 8, Block E) — code complete; E2E + concurrent invariant + Block E rules audit pending (2026-05-26)

- `app/(app)/events/[eventId]/checkout/actions.ts` (NEW): `commitCheckoutCartAction` Server Action — the marquee atomic transaction. One `runTransaction` wraps: (1) parallel read of every distinct cart item via `tx.get`, (2) cart-wide invariant pass (`availableQty >= requested` per line; CO-05); if ANY line fails, structured `BizError("STOCK_INSUFFICIENT")` throw aborts the tx atomically and the catch surfaces `{ok:false, failedLines:[{itemId, available, requested}]}` for the useOptimistic revert path. (3) per-item update writes (`availableQty -= qty`, `outQty += qty`, `lifecycleState → checked_out` if needed, `isLowStock` recomputed per RESEARCH P11, `updatedAt/updatedBy`). (4) per-line audit row writes — one row per `parsed.data.lines` entry, preserving original cart shape per AUD-01. EVT-08 access check (admin OR uid in event.allowedStaff) + status guard (refuses completed/cancelled events) runs BEFORE the transaction opens. P8 mitigation: `requestedByItem.Map` aggregates lines for the same itemId before the tx so two cart lines for the same SKU validate against the same stock. revalidatePath matrix: /events/[id], /inventory, /, /reports/out, /reports/history. Commit `95ebffa`.
- `components/feature/scan/scan-session.tsx` (MOD): commit handler calls `commitCheckoutCartAction({eventId, lines})` instead of mock `checkout`. CheckoutResult discriminated union shape matches Phase 1 mock contract verbatim — `useOptimistic` + revert wiring works unchanged (CO-06). Removed: `useMockStore`, `selectItemBySku`, `checkout`, `getSnapshot`, `seedUsers` imports + the `seedUsers.find(...)` actor lookup (Server Action derives actor via `requireSession()`). Live data: `useInventoryLive([], {limit:500})` for SKU lookup + QtyStepper bounds; Server Action re-validates atomically. router.refresh() after successful commit as defense-in-depth. Commit `b9b5d37`.
- `components/feature/scan/EventPickerDialog.tsx` (MOD): `useEventsLive(initial=[], {session, limit:50})` replaces `useMockStore + selectAccessibleEvents`. EVT-08 array-contains projection happens server-side inside `useEventsLive`; CO-02 status filter (planned|active) applied client-side within the 50-row window. Defensive session-null path. Commit `b9b5d37`.
- `app/(app)/events/[eventId]/checkout/page.tsx` (MOD): swap `requireSession` (mock-session) → real DAL; swap `getSnapshot + selectEventById` → `getEventServer(eventId, session)` (Admin SDK + EVT-08 server-side projection). `notFound()` on null (anti-enumeration — same 404 path for missing OR non-accessible events). Status guard preserved. `generateMetadata` also routes through requireSession + getEventServer so titles don't leak event names to non-members. Commit `980d980`.
- `components/feature/scan/ScannerWidget.tsx` UNTOUCHED — Bluetooth keystroke (CO-10) + camera substrate (D-01..16) preserved as locked Phase 1 surface.
- `components/feature/scan/ScanCartPanel.tsx` UNTOUCHED — consumes scan-session context only; no mock-store imports present.
- `components/feature/events/EventAssignedItemsTab.tsx` UNTOUCHED — already on `useTransactionsLive` from plan 02-07; auto-refreshes after checkout commits.
- `app/(app)/scan/page.tsx` UNTOUCHED — all mock interaction lived inside scan-session + EventPickerDialog (both swapped).
- Deviations: two documentation-only comment reword edits to satisfy grep-based acceptance criteria (no behavioral change).
- Verification gates: `npx tsc --noEmit` PASS, `npm run lint` PASS (0 errors, 6 pre-existing `react-hooks/incompatible-library` warnings from TanStack + rhf — identical to plans 02-06/02-07), `npm run build` PASS (28 routes, proxy.ts recognized; /events/[eventId]/checkout dynamic).
- See `.planning/phases/phase-kayinleong-02/02-08-checkout-action-and-scan-SUMMARY.md` for full details + the CHECKPOINT section covering 6-row smoke + concurrent-invariant test + Block E rules audit (5 cases).
- **Plan 02-08 gate:** awaiting (A) single-user checkout E2E, (B) CO-05 stock-insufficient toast, (C) useOptimistic revert under network throttling, (D) **concurrent invariant test** (two browsers same event same SKU; one succeeds, the other gets failedLines + cart revert — ROADMAP success criterion #3), (E) EVT-08 notFound for non-members, (F) scanner format smoke (CO-09), (G) Bluetooth keystroke (CO-10 — code review only since ScannerWidget UNTOUCHED), (H) Block E rules audit (5 cases — see SUMMARY.md CHECKPOINT for the table).

### Plan 02-09 (checkin marquee transaction + missing resolution — Wave 9, Block F) — code complete; E2E + Block F rules audit pending (2026-05-26)

- `lib/data/missing.server.ts` (NEW): Admin SDK cursor-paged reader `getMissingPage({cursor, limit, filters: {status, eventId, itemId}})`. Composite indexes from 02-02 cover the dominant query shapes (`missingItems(status, reportedAt desc)` + `missingItems(eventId, reportedAt desc)`). `reportedByName` denormalization with a one-shot `users/{uid}` hydration fallback for docs that predate the denorm. Commit `96e992e`.
- `lib/hooks/use-missing-live.ts` (NEW): Web SDK `onSnapshot` scoped to 50-row window per D-20. Subscription gated on `onAuthStateChanged` (same pattern as useInventoryLive / useTransactionsLive). Defensive `FirestoreError` console.error. Timestamp → ISO conversion preserves Phase 1 `MissingItemDoc` shape. Commit `96e992e`.
- `app/(app)/events/[eventId]/checkin/actions.ts` (NEW): `commitCheckinCartAction` — Block F marquee transaction. `requireSession` + EVT-08 access gate (admin OR uid in event.allowedStaff) BEFORE the transaction opens. One `runTransaction` wraps: (1) per-line reads of parent checkout + prior children sum (composite index `transactions(eventId, type, parentTxId, at desc)` from 02-02 covers the query) + inventory snapshot (deduped per SKU); (2) per-line validation with cart-wide `failedLines` collection — `submitted (returnedQty + damagedQty) > remaining` AND CI-04 missing-reason required for short return; structured `BizError("CHECKIN_REJECTED")` throw on any failure; (3) per-SKU inventory writes (`availableQty += returnedQty`, `damagedQty += damagedQty`, `outQty -= movement` where movement = `returnedQty + damagedQty + missingDelta` — NOT full parentQty as Phase 1 mock conflated; lifecycleState bump; `isLowStock` recomputed via `computeIsLowStock` per RESEARCH P11); per-line `checkin` audit row with parentTxId chain (CI-08, AUD-01); per-line `missingItems` doc + `missing` audit tx when missingDelta > 0 (MIS-01, AUD-01). revalidatePath matrix: /events/[id], /events/[id]/checkin, /inventory, /, /reports/out, /reports/missing, /reports/history. Commit `c283ad2`.
- `lib/schemas/transaction.ts` (MOD): added `CheckinCartSchema` wrapping existing `CheckinLineSchema`. Preserved `damagedQty: number` as separate qty bucket (Phase 1 CI-06 contract) rather than plan's damaged-boolean — matches existing CheckinLineRow Damaged QtyStepper + Phase 1 mock-store mutator API. Commit `c283ad2`.
- `app/(app)/reports/missing/actions.ts` (NEW): `resolveMissing` Server Action — admin-only via `requireAdmin()`. Single `runTransaction`: reads missingItems doc (rejects `ALREADY_RESOLVED`); reads inventory item (rejects `ITEM_NOT_FOUND`); branches on outcome — `found` → `availableQty += qty`; `writtenOff` → `totalQty -= qty`; both flip `missingItems.status` + record `resolvedAt + resolvedBy` (MIS-02); recompute `isLowStock` atomically (P11); write follow-up `adjustment` audit transaction with notes "Missing resolved: <outcome>" (MIS-04, AUD-01). revalidatePath: /reports/missing, /inventory, /reports/history, /. Commit `4e2452b`.
- `components/feature/missing/ResolveMissingSheet.tsx` (MOD): swap `store.resolveMissing` (mock) → `resolveMissing` Server Action; `useTransition` for pending state; `router.refresh()` after success; admin-only render preserved; Sheet + RHF + RadioGroup + Zod validation preserved. Removed `seedUsers` + `@/lib/mock/store` imports. Commit `4e2452b`.
- `app/(app)/events/[eventId]/checkin/page.tsx` (MOD): swap mock-session + mock selectors → real DAL (`requireSession`) + `getEventServer` (EVT-08 server projection + `notFound()` for non-members — anti-enumeration) + `getOpenCheckoutsForEventServer` (Admin SDK + parentTxId-based open-line filter from 02-07). Status filter preserved (any event status accepts check-ins — completed/cancelled events may have stragglers). `generateMetadata` also routes through requireSession + getEventServer so titles don't leak event names. Commit `05f9cf1`.
- `app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx` (MOD): swap `useMockStore` + Phase 1 open-checkout selector + mock checkin mutator → `useTransactionsLive` for `checkout` + `checkin` + `missing` rows (3 subscriptions, each with composite index from 02-02). Compute `openLines` reactively as `parentQty - sum(child.qty) > 0` (CI-07 partial-return view). `buildLine` defaults `returnedQty` to live `remainingQty` (not the original checked-out qty). Submit calls `commitCheckinCartAction` + surfaces `failedLines` count via toast + `router.refresh()` + navigates back to `/events/[id]` on success. Per-line CI-04 validation gates submit; CheckinLineRow's `checkedOutQty` prop now receives `remainingQty` (reflects partial returns to date). Commit `05f9cf1`.
- Deviations (auto-fixes):
  - Rule 3 — `damagedQty` as qty bucket vs plan's damaged-boolean: kept Phase 1 contract (CheckinLineSchema unchanged, CI-06 still satisfied independently).
  - Rule 1 — `outQty` decrement by movement (not full parentQty): plan snippet had `newOut = item.outQty - checkedOutQty` which conflated partial check-ins. Server Action mirrors Phase 1 mock-store semantics (`outQty -= returnedQty + damagedQty + missingDelta`).
  - Rule 2 — Prior-children sum inside the transaction (CI-07 correctness): plan snippet had no read, which would have allowed over-return via concurrent partials. Server Action queries `transactions(eventId, type, parentTxId)` for both `checkin` and `missing` rows inside the runTransaction.
  - Rule 3 — Doc comment edit in checkin-form.tsx header so `grep -q selectOpenCheckoutsForEvent` returns FAIL on the new file (acceptance criterion).
- Verification gates: `npx tsc --noEmit` PASS, `npm run lint` PASS (0 errors, 6 pre-existing `react-hooks/incompatible-library` warnings from TanStack + rhf — identical to plans 02-06/02-07/02-08), `npm run build` PASS (28 routes, proxy.ts recognized).
- Architecture preserved: no `functions/` directory (stays deleted), `firestore.rules` / `firestore.indexes.json` / `storage.rules` / `firebase.json` / `lib/firebase/admin.ts` / `lib/firebase/client.ts` / `lib/auth/dal.ts` / `proxy.ts` UNTOUCHED. `lib/mock/*` shim files still present (deletion deferred to 02-11).
- See `.planning/phases/phase-kayinleong-02/02-09-checkin-action-and-missing-SUMMARY.md` for full details + deviation register + checkpoint instructions.
- **Plan 02-09 gate:** awaiting E2E smoke (smokes A–G) + Block F rules audit (5 cases) per SUMMARY.md CHECKPOINT section — populated below.

## E2E Smoke + Block F Rules Audit — Plan 02-09 (awaiting attestation)

To advance to plan 02-10, the user runs the following sequence and attests results here.

### Smoke (7 rows)

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| A | Pre-req: open checkout exists (qty 5). Visit /events/<id>/checkin → returnedQty=5, damagedQty=0, no reason → submit. | Toast "1 line checked in"; inventory.availableQty +5, outQty -5, isLowStock recomputed, lifecycleState='available' if all back; transactions has new `checkin` row with parentTxId set. | pending |
| B | Open checkout of 5 → check-in returnedQty=0, damagedQty=5, no reason → submit. | inventory.availableQty unchanged; damagedQty +5; outQty -5; lifecycleState='damaged' if no available remains. | pending |
| C | Open checkout of 5 → returnedQty=3, damagedQty=0, missingReason="Lost" → submit. | inventory.availableQty +3, outQty -5; missingItems doc qty=2 reason=Lost status=open; transactions has 1 new `checkin` (qty 3) + 1 new `missing` (qty 2), both with parentTxId. | pending |
| D | CI-07 semantic verify: try returnedQty=3, damagedQty=0, no reason on a remaining=5 line → submit. | REJECTED via CI-04 ("Missing reason required for any short return"); cart stays open for retry. (Documented semantic — see SUMMARY "Phase 1 → Phase 2 semantic delta (CI-07)".) | pending |
| E | From smoke C's missing doc, admin /reports/missing (or via row's Resolve sheet) → Found → confirm. | inventory.availableQty +2; missingItems.status='found' + resolvedAt + resolvedBy; transactions has new `adjustment` row notes "Missing resolved: found". | pending |
| F | Repeat smoke C; resolve → Write off → confirm. | inventory.totalQty -2 (NOT availableQty); missingItems.status='writtenOff'; transactions has new `adjustment` row notes "Missing resolved: writtenOff". | pending |
| G | EVT-08 access: as staff NOT in event.allowedStaff, visit /events/<id>/checkin. | notFound() (404) — same path as missing event (anti-enumeration). | pending |

### Block F Rules Audit (5 cases)

| # | Path | Auth | Op | Expected | Result |
|---|------|------|-----|----------|--------|
| 1 | missingItems/<id> | Signed-in staff | get | ALLOW | pending |
| 2 | missingItems/<id> | Web SDK client | create | DENY (server-only writes) | pending |
| 3 | missingItems/<id> | Web SDK client (admin) | update with `{status: 'resolved'}` | DENY (server-only — admin must use Server Action) | pending |
| 4 | transactions/<id> | Web SDK admin | create | DENY (server-only per AUD-04/INT-03) | pending |
| 5 | transactions/<id> | Web SDK admin | update with `{type: 'mutated'}` | DENY (immutable per AUD-04) | pending |

## E2E Smoke + Block D Rules Audit — Plan 02-07 (awaiting attestation)

To advance to plan 02-08, the user runs the following sequence and attests results here.

### Smoke (6 rows)

| # | Scenario | Expected | Result |
|---|---------|----------|--------|
| 1 | Admin → /events/new → name, dates, location, teamLeads=[staff-uid], backupTeams=[] → submit | redirect to /events/<id>; Firestore: events/<id>.allowedStaff contains [admin uids, staff-uid] (synchronous, no lag) | pending |
| 2 | Admin → /events/<id>/edit → add another user to teamLeads → save | Firestore: teamLeads updated AND allowedStaff includes the new uid (recomputeAllowedStaffForEvent ran synchronously) | pending |
| 3 | Switch to staff user IN allowedStaff → /events | event appears in list | pending |
| 4 | Switch to staff user NOT in allowedStaff → /events | event does NOT appear in list (array-contains filter working) | pending |
| 5 | Admin → /events/<id> → Cancel → mark each open checkout (returned/lost/still_with_owner) → confirm | event.status = "cancelled"; for each "returned" item: availableQty +qty, outQty -qty; for each "lost": missingItems doc created + outQty -qty; for "still_with_owner": no inventory change | pending |
| 6 | Admin promotion sweep: /users → promote staff to admin | After action: every event's allowedStaff now includes the promoted user (recomputeAllowedStaffForAllEvents from 02-04 user actions; verified Block D side because EVT-08 reads now grant) | pending |

### Block D Rules Audit (8 cases)

| # | Path | Auth | Op | Expected | Result |
|---|------|------|-----|----------|--------|
| 1 | events/<id> | staff IN allowedStaff | read | ALLOW (isMember) | pending |
| 2 | events/<id> | staff NOT in allowedStaff | read | DENY (isMember false) | pending |
| 3 | events/<id> | admin | read | ALLOW (isAdmin) | pending |
| 4 | events/<id> | staff (team lead) | update with {name: ...} (no allowedStaff change) | ALLOW (teamLead + untouched) | pending |
| 5 | events/<id> | staff (team lead) | update with {allowedStaff: [...]} | DENY (untouched('allowedStaff')) | pending |
| 6 | events/<id> | staff (not team lead) | update | DENY (not admin AND not team lead) | pending |
| 7 | events/<new-id> | staff | create | ALLOW (allow create: if isSignedIn — Server Action enforces narrower gate) | pending |
| 8 | events/<id> | admin | delete | ALLOW (isAdmin) | pending |

## Verification

(Populated when phase completes — must include Regression Report per global CLAUDE.md.)
