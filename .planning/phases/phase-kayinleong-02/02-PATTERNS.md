# PATTERNS.md — Phase 2 file mapping

**Generated:** 2026-05-25
**Source:** 02-CONTEXT.md `<code_context>` + scout of existing Phase 1 code (28 routes, 14 mock mutators, 25 useMockStore consumers, 15 lib/auth consumers)
**Scope:** Phase 2 replaces `lib/mock/*` with Firebase Auth + Firestore + Storage + 2 Cloud Functions. UI surface is frozen except for D-15 (photo field) and D-17 (cursor URLs).

> **Note on coverage.** The Phase 1 codebase is dense and well-structured: nearly every Phase 2 file has a direct Phase 1 analog because mock-store mutator signatures were deliberately designed to mirror Server Action shapes (Phase 1 KD #17 / D-02). For the small set of files with no analog (`proxy.ts`, `firestore.rules`, `firestore.indexes.json`, `functions/`, route handlers) we point to Next.js 16 bundled docs in `node_modules/next/dist/docs/01-app/` and Firebase docs — read those before writing.
>
> **Mandatory pre-read** per AGENTS.md: every Next-specific file requires opening the relevant `node_modules/next/dist/docs/01-app/03-api-reference/...` page first. Async cookies, async params, `proxy.ts` (not `middleware.ts`), and `revalidateTag(tag, profile)` are all post-training-data breakage points.

---

## 1. Reusable Patterns (Phase 1 → Phase 2 swap targets)

These are existing files whose **internal logic stays nearly identical**; only the data-source line changes.

| New/Modified File | Role | Data Flow | Phase 1 Analog | Pattern Excerpt (file:line) | Notes |
|-------------------|------|-----------|----------------|-----------------------------|-------|
| `app/(app)/layout.tsx` (modify) | Server Component / role gate | read | `app/(app)/layout.tsx:17-39` | Swap `requireSession` import from `@/lib/auth/mock-session` → `@/lib/auth/dal` | Body unchanged; only the imported helper differs. |
| `app/(app)/page.tsx` (modify) | Server Component (dashboard) | read | `app/(app)/page.tsx:17-46` | Swap `getMockSession` → `verifySession`; widgets stay client islands | Greeting logic unchanged. |
| `app/(app)/inventory/page.tsx` (modify) | Server Component (list shell) | read | `app/(app)/inventory/page.tsx:23-50` | Same. Plus pass `initialItems` prop to `<InventoryTable initial={...}/>` from Admin SDK call (research/ARCHITECTURE.md lines 295-310 SSR-seed pattern) | D-17: cursor URL contract change happens inside `<InventoryTable>`. |
| `app/(app)/inventory/new/page.tsx` (modify) | Server Component (admin-gated) | read | `app/(app)/inventory/new/page.tsx:13-26` | Swap `requireAdmin` import; rest unchanged | One-line import swap. |
| `app/(app)/inventory/[itemId]/page.tsx` (modify) | Server Component (detail) | read | `app/(app)/inventory/[itemId]/page.tsx:15-37` | Swap `getSnapshot/selectItemById` → `getItemServer(itemId)` (new helper in `lib/data/inventory.server.ts`) | `await params` and `notFound()` patterns unchanged. |
| `app/(app)/inventory/[itemId]/edit/page.tsx` (modify) | Server Component (admin-gated edit) | read | `app/(app)/inventory/[itemId]/edit/page.tsx:14-47` | Same swap pattern as detail page | D-15: pass `photoUrl` to `<ItemForm initial={...}>` (already wired). |
| `app/(app)/events/page.tsx` (modify) | Server Component | read | `app/(app)/events/page.tsx:24-56` | Swap `requireSession` import; pass `initial` to `<EventsTable>` | EVT-08 access projection now happens in `lib/data/events.server.ts`. |
| `app/(app)/events/[eventId]/page.tsx` (modify) | Server Component (detail + EVT-08 gate) | read | `app/(app)/events/[eventId]/page.tsx:17-50` | Swap `getSnapshot/selectEventById` → `getEventServer(eventId, session)` (Admin SDK + access check) | EVT-08 redirect logic moves into the helper for reuse. |
| `app/(app)/events/[eventId]/checkout/page.tsx` (modify) | Server Component (scoped checkout) | read | `app/(app)/events/[eventId]/checkout/page.tsx:29-66` | Same swap as event detail | Status-rejection redirect logic stays. |
| `app/(app)/events/[eventId]/checkin/page.tsx` (modify) | Server Component (scoped checkin) | read | `app/(app)/events/[eventId]/checkin/page.tsx` | Same | Plus initial open-checkouts fetch from server. |
| `app/(app)/events/[eventId]/edit/page.tsx` (modify) | Server Component (admin-gated edit) | read | `app/(app)/events/[eventId]/edit/page.tsx:14-` | Same | Admin SDK read of `events/{eventId}`. |
| `app/(app)/users/page.tsx` (modify) | Server Component (admin-only) | read | `app/(app)/users/page.tsx:18` | Swap `requireAdmin` import; pass `initialUsers` to `<UsersTable>` | Cursor pagination per D-17. |
| `app/(app)/users/invite/page.tsx` (modify) | Server Component (admin-only) | read | `app/(app)/users/invite/page.tsx:22` | One-line import swap | Form is the client child. |
| `app/(app)/settings/page.tsx` (modify) | Server Component | read | `app/(app)/settings/page.tsx:23-42` | Swap `getMockSession` → `verifySession` | Pattern identical. |
| `app/(app)/scan/page.tsx` (modify) | Client wrapper (camera/event-picker) | both | `app/(app)/scan/page.tsx` | Only the actor lookup inside `scan-session.tsx` swaps (see commit-pattern row below) | Camera substrate untouched. |
| `app/(app)/reports/stock/page.tsx` (modify) | Server Component | read | `app/(app)/reports/stock/page.tsx` | Cursor URL + Admin SDK initial fetch | Inherits D-17. |
| `app/(app)/reports/out/page.tsx` (modify) | Server Component | read | `app/(app)/reports/out/page.tsx` | Same | Query: `transactions where type='checkout' and parentTxId is null`. |
| `app/(app)/reports/history/page.tsx` (modify) | Server Component | read | `app/(app)/reports/history/page.tsx` | Same | Uses index `transactions(at desc)` per D-18. |
| `app/(app)/reports/missing/page.tsx` (modify) | Server Component | read | `app/(app)/reports/missing/page.tsx` | Same | Uses index `missingItems(status, at desc)` per D-18. |
| `app/(app)/reports/repurchase/page.tsx` (modify) | Server Component | read | `app/(app)/reports/repurchase/page.tsx` | Same | Surface unchanged. |
| `app/(app)/inventory/actions.ts` (NEW Server Actions file) | Server Actions: `createItem` / `updateItem` / `retireItem` / `adjustItemStock` / `updateLowStockThreshold` / `markLowStockOrdered` | mutate | `lib/mock/store.ts:333-389` (`createItem`, `updateItem`, `retireItem`) + `lib/mock/store.ts:619-639` (low-stock helpers) | Mutator bodies map 1:1; replace `state = Object.freeze(...)` with Firestore Admin SDK calls per research/ARCHITECTURE.md lines 320-351 | Wrap reads+writes in `runTransaction` for adjustStock (atomic invariant); `revalidatePath('/inventory')` after success; return `{ok:true, data}|{ok:false, error}` per research/ARCHITECTURE.md line 261. |
| `app/(app)/events/actions.ts` (NEW) | Server Actions: `createEvent` / `updateEvent` / `cancelEvent` | mutate | `lib/mock/store.ts:394-507` | Same 1:1 mapping; Cloud Function (D-02) maintains `allowedStaff` so Server Action body no longer recomputes it | Cancel-event reconciliation logic stays — runs inside a Firestore transaction with reconciliation writes. |
| `app/(app)/events/[eventId]/checkout/actions.ts` (NEW) | Server Action: `checkoutItem` (single line) + `commitCheckoutCart` (multi-line) | mutate (transactional) | `lib/mock/store.ts:108-188` (`checkout`) | `CheckoutResult` discriminated union shape stays; replace in-memory aggregate validation with Firestore `runTransaction` per research/ARCHITECTURE.md lines 320-351 | Inside transaction: `t.get(itemRef)` → check `availableQty >= qty` → `t.update(itemRef, {availableQty: increment(-qty)...})` + `t.set(txRef, ...)`. Same `failedLines` return shape so `useOptimistic` revert (Phase 1 D-13) works unchanged. |
| `app/(app)/events/[eventId]/checkin/actions.ts` (NEW) | Server Action: `checkinItem` / `commitCheckinCart` | mutate (transactional) | `lib/mock/store.ts:192-329` (`checkin`) | Same 1:1; missing-record creation moves into the same transaction (atomic with availableQty/outQty/damagedQty update) | `parentTxId` linking pattern unchanged. |
| `app/(app)/reports/missing/actions.ts` (NEW) | Server Action: `resolveMissing` | mutate | `lib/mock/store.ts:511-568` | Same 1:1; transaction wraps the missing-doc update + item-qty adjustment + follow-up `adjustment` transaction write | Wired to `<ResolveMissingSheet>`. |
| `app/(app)/users/actions.ts` (NEW) | Server Actions: `inviteUser` / `setUserRole` / `disableUser` | mutate | `lib/mock/store.ts:572-615` | `inviteUser` body: `admin.auth().createUser` → `admin.auth().generatePasswordResetLink` → `users/{uid}` doc write. Return `{ok:true, resetLink}` per D-09 even on email-delivery failure | `setUserRole` no longer recomputes `allowedStaff` — Cloud Function (D-02) does that on `users/{uid}` write. |
| `lib/auth/dal.ts` (NEW) | Server-only auth DAL | read | `lib/auth/mock-session.ts:25-52` | Same 3-function shape (`getSession`/`requireSession`/`requireAdmin`); body swaps `readMockSessionServer` → `next-firebase-auth-edge.getTokens()` per research/ARCHITECTURE.md lines 186-189 | Wrap each helper in `React.cache()` for per-request memoization (Claude's Discretion §). Add `import 'server-only'` at top. |
| `lib/hooks/use-inventory-live.ts` (NEW) | Client hook | read (real-time) | `lib/hooks/use-mock-store.ts:14-33` | Identical hook shape: `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` + `useMemo` derivation per Phase 1 D-01-02-A | Body swaps store subscription → Firestore `onSnapshot(query)` against cursor-paged slice (D-20). Initial state from `initial` prop (SSR seed). |
| `lib/hooks/use-events-live.ts` (NEW) | Client hook | read (real-time) | same | same | Scoped to current cursor page slice per D-20. |
| `lib/hooks/use-users-live.ts` (NEW) | Client hook | read (real-time) | same | same | Admin-only consumers. |
| `lib/hooks/use-missing-live.ts` (NEW) | Client hook | read (real-time) | same | same | Dashboard + reports. |
| `lib/hooks/use-current-user.ts` (REPLACE body, KEEP signature) | Client hook | read | `lib/hooks/use-current-user.ts:36-64` | Same `useSyncExternalStore` shell; swap `readMockSessionClient` → `onAuthStateChanged(auth, ...)` subscription per research/STACK.md line 287 | Signature `useCurrentUser(): Session | null` unchanged; all 13 consumers re-render correctly. |
| `lib/hooks/use-url-table-state.ts` (modify) | Client hook | read | `lib/hooks/use-url-table-state.ts:37-121` | Same URL grammar; add `cursor` to the destructured search params per D-17 (replaces `page`) | Add `setCursor(cursor: string|null)` setter; `setPage` deprecated/removed. |
| `components/feature/inventory/ItemForm.tsx` (modify) | Client component (form) | mutate (via action) | `components/feature/inventory/ItemForm.tsx:51-309` | Swap `createItem/updateItem` import → Server Action; wrap submit in `try/await/catch`; surface returned `error` via `setError("sku", ...)` for SKU collision (INV-02) | D-15: add `<input type="file" accept="image/*">` + 'Take photo' button (reuse ScannerWidget camera substrate at `components/feature/scan/ScannerWidget.tsx:97-153`); upload via Web SDK `firebase/storage` with `browser-image-compression` first per D-12. |
| `components/feature/inventory/RetireItemButton.tsx` (modify) | Client component | mutate | `components/feature/inventory/RetireItemButton.tsx` | Swap import to `retireItem` Server Action | AlertDialog destructive-confirm pattern unchanged. |
| `components/feature/events/EventForm.tsx` (modify) | Client component | mutate | `components/feature/events/EventForm.tsx` | Same swap | rhf + Zod + `<Controller>` for Select pattern unchanged. |
| `components/feature/events/CancelEventDialog.tsx` (modify) | Client component (destructive) | mutate | `components/feature/events/CancelEventDialog.tsx` | Same | AlertDialog destructive variant unchanged. |
| `components/feature/scan/scan-session.tsx` (modify) | Client context provider | mutate (cart commit) | `components/feature/scan/scan-session.tsx:213-241` (commit body) | Replace `checkout(...)` call with `await checkoutAction({eventId, lines})` (the Server Action). `CheckoutResult` shape and `useOptimistic` rollback path remain — research/ARCHITECTURE.md notes per "Phase 2's checkoutItem Server Action must return a result that useOptimistic can revert" (CONTEXT.md `<specifics>` last bullet) | All actor-lookup `seedUsers.find(...)` calls **delete** — Server Action derives actor from `verifySession()`. |
| `components/feature/scan/ScannerWidget.tsx` (no change) | Client component | none | `components/feature/scan/ScannerWidget.tsx:38-161` | Reused unchanged | Also referenced as the camera substrate for D-15 'Take photo' button. |
| `components/feature/scan/EventPickerDialog.tsx` (modify) | Client component | read | `components/feature/scan/EventPickerDialog.tsx:35-92` | Swap `useMockStore(...) + selectAccessibleEvents` → `useEventsLive(...)` filtered by accessible events | The shadcn Command typeahead pattern unchanged. |
| `components/feature/dashboard/KpiCards.tsx` (modify) | Client component | read (count aggregation) | `components/feature/dashboard/KpiCards.tsx:27-65` | **MATERIAL CHANGE per D-21:** replace `useMockStore(...).reduce(...)` with 4 Firestore `count()` aggregation queries on mount + on `revalidatePath('/')`. NOT real-time | Convert to Server Component that calls `lib/data/aggregations.server.ts` helpers and passes raw counts as props to a small client wrapper for the card layout. Or stay client and use `getCountFromServer(query)` on mount. |
| `components/feature/dashboard/ActiveEventsWidget.tsx` (modify) | Client component | read (real-time) | `components/feature/dashboard/ActiveEventsWidget.tsx:20-` | Swap `useMockStore(selectActiveEvents)` → `useEventsLive({status:'active', limit:5})` | List scoping per D-20. |
| `components/feature/dashboard/LowStockWidget.tsx` (modify) | Client component | read (real-time) + mutate | `components/feature/dashboard/LowStockWidget.tsx:30-98` | Swap selector → `useInventoryLive({where: availableQty <= threshold, limit:50})` per D-20; `markOrdered` calls Server Action instead of `markLowStockOrdered` mutator | Same Card/EmptyState chrome; admin-only `onClick` gate stays. |
| `components/feature/dashboard/OverdueReturnsWidget.tsx` (modify) | Client component | read (real-time) | `components/feature/dashboard/OverdueReturnsWidget.tsx` | Same swap | Uses `now()` instead of `PHASE_1_TODAY` constant. |
| `components/feature/dashboard/RecentActivityFeed.tsx` (modify) | Client component | read (real-time) | `components/feature/dashboard/RecentActivityFeed.tsx` | Swap selector → `useTransactionsLive(orderBy at desc, limit:20)` | Most recent slice subscribed via `onSnapshot`. |
| `components/feature/inventory/InventoryTable.tsx` (modify) | Client component | read (real-time) | `components/feature/inventory/InventoryTable.tsx:53-253` | Swap `useMockStore((s)=>s.items)` → `useInventoryLive(cursorPage)`; client-side filter still happens, but only within the 50-row cursor window per D-20 | Filter UI unchanged. TanStack `manualPagination: true` (D-17). |
| `components/feature/events/EventsTable.tsx` (modify) | Client component | read (real-time) | `components/feature/events/EventsTable.tsx` | Swap to `useEventsLive(cursorPage)`; EVT-08 access filtering happens server-side (Admin SDK) on initial fetch and via `where('allowedStaff', 'array-contains', uid)` on live subscription per D-18 | URL-sync table state unchanged. |
| `components/feature/users/UsersTable.tsx` (modify) | Client component | read (real-time) | `components/feature/users/UsersTable.tsx` | Swap to `useUsersLive(cursorPage)` | Admin-only via parent gate. |
| `components/feature/users/UserRoleSelectInline.tsx` (modify) | Client component | mutate | `components/feature/users/UserRoleSelectInline.tsx:30-` | Swap `setUserRole` import → `setUserRoleAction` Server Action; remove `seedUsers` actor lookup | `revalidatePath('/users')` server-side. |
| `components/feature/users/DisableUserButton.tsx` (modify) | Client component | mutate | `components/feature/users/DisableUserButton.tsx:34-` | Same | AlertDialog destructive confirm stays. |
| `components/feature/users/InviteUserSheet.tsx` (modify) | Client component (Sheet form) | mutate | `components/feature/users/InviteUserSheet.tsx:60-` | Swap to `inviteUserAction`; surface returned `resetLink` per D-09 in a Copy-link UI | Both `/users` Sheet AND `/users/invite` page version need the same swap. |
| `components/feature/missing/ResolveMissingSheet.tsx` (modify) | Client component (Sheet) | mutate | `components/feature/missing/ResolveMissingSheet.tsx:52-` | Swap to `resolveMissingAction` | UI surface unchanged. |
| `components/feature/reports/RepurchaseTable.tsx` (modify) | Client component | read+mutate | `components/feature/reports/RepurchaseTable.tsx:31-` | Swap `useMockStore` → `useInventoryLive`; swap `markLowStockOrdered` mutator → `markLowStockOrderedAction` Server Action | Same TanStack table chrome. |
| `components/feature/reports/HistoryTable.tsx` (modify) | Client component | read (real-time) | `components/feature/reports/HistoryTable.tsx:28-` | Swap to `useTransactionsLive(cursorPage)` | Index `transactions(at desc)` per D-18. |
| `components/feature/reports/StockReportTable.tsx`, `ItemsOutTable.tsx`, `MissingItemsTable.tsx` (modify) | Client components | read (real-time) | each respective file | Same swap pattern: replace mock-store hook with the matching live hook | All inherit D-17 cursor URLs. |
| `components/feature/auth/SignOutButton.tsx` (modify) | Client component | mutate (session revoke) | `components/feature/auth/SignOutButton.tsx:7-33` | Replace `clearMockSessionClient()` with `await fetch('/api/auth/logout', {method:'POST'})` then `router.push('/login')` | DropdownMenuItem destructive variant pattern unchanged. |
| `app/(auth)/login/page.tsx` (modify) | Server Component | none | `app/(auth)/login/page.tsx:13-30` | Remove `<SeedUsersDisclosure/>` (POC component deleted); keep `<LoginForm/>` import | One-line removal. |
| `app/(auth)/login/_components/login-form.tsx` (modify) | Client component | mutate (sign-in flow) | `app/(auth)/login/_components/login-form.tsx:44-66` (`onSubmit`) | Replace `seedUsers.find(...)` + `writeMockSessionClient(...)` with: `signInWithEmailAndPassword(auth, email, pw)` → `idToken = await user.getIdToken()` → `POST /api/auth/session {idToken}` → `router.push('/')` per research/ARCHITECTURE.md lines 170-176 | The rhf + Zod + `<Field>` primitives shell stays identical. UI-SPEC error copy stays. |
| `app/(auth)/forgot-password/page.tsx` (modify) | Client form route | mutate (reset link) | `app/(auth)/forgot-password/_components/...` | Replace toast-only stub with `sendPasswordResetEmail(auth, email)` from Web SDK + success toast per D-08 | Same `<Field>` form shell. |
| `app/(auth)/set-password/page.tsx` (modify) | Client form route | mutate (oobCode confirm) | `app/(auth)/set-password/_components/...` | Replace stub with `confirmPasswordReset(auth, oobCode, newPassword)` → `signInWithEmailAndPassword` → `router.push('/')` per D-08 (auto-sign-in) | `oobCode` from `useSearchParams().get('oobCode')`. |
| `app/(auth)/register/page.tsx` (modify or delete) | Client form route | n/a | `app/(auth)/register/page.tsx` | Per AUTH-06 + PROJECT.md: no public registration. Delete or redirect to `/login` | If kept as defensive 404, render an `EmptyState` pointing to admin invite. |

---

## 2. New Files (no Phase 1 analog — ship from Next.js 16 / Firebase docs)

| New File | Role | Data Flow | Notes / Authoritative source |
|----------|------|-----------|------------------------------|
| `proxy.ts` (repo root, NEW) | Node runtime proxy | request middleware | **Read first:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. Function must be named `proxy` (not `middleware`); Node runtime only — Edge unsupported in Next 16 per STACK.md line 20. Optimistic `__session` cookie presence check; redirect to `/login` if missing on protected matchers; redirect to `/` if present on auth routes. **Must NOT import Admin SDK** (research/ARCHITECTURE.md line 186 + CONTEXT.md `<code_context>` line 174). |
| `lib/firebase/admin.ts` (NEW) | Admin SDK singleton | n/a | **Read first:** Firebase Admin SDK docs. Start with `import 'server-only'`. Pattern: `if (!getApps().length) initializeApp({credential: cert(...)});` Export `auth()` and `firestore()` getters. Service-account credentials from `FIREBASE_SERVICE_ACCOUNT_*` env vars (gitignored). See research/STACK.md lines 269-272. |
| `lib/firebase/client.ts` (NEW) | Web SDK singleton | n/a | Module-scope `initializeApp({...NEXT_PUBLIC_FIREBASE_*})` guarded by `getApps().length`. Export `auth`, `db`, `storage`. Call `enableIndexedDbPersistence(db)` once per D-19 (try/catch the `failed-precondition` and `unimplemented` codes). |
| `lib/data/inventory.server.ts` (NEW) | Admin-SDK read helpers | read | `import 'server-only'`. Exports `getInventoryPage(cursor, limit=50, filters)`, `getItemServer(itemId)`. Returns plain JSON-serializable objects (no Firestore Timestamps in props — convert via `.toMillis()`). Used by Server Components for SSR seed. |
| `lib/data/events.server.ts` (NEW) | Admin-SDK read helpers | read | Same pattern. `getEventsPage(cursor, filters, session)` performs EVT-08 access filter server-side using `where('allowedStaff', 'array-contains', session.uid)` for staff, full read for admin. |
| `lib/data/users.server.ts` (NEW) | Admin-SDK read helpers | read | Same pattern. Admin-only consumers. |
| `lib/data/transactions.server.ts` (NEW) | Admin-SDK read helpers | read | Same pattern. Cursor-paginated for `/reports/history`. |
| `lib/data/missing.server.ts` (NEW) | Admin-SDK read helpers | read | Same pattern. Used by `/reports/missing`. |
| `lib/data/aggregations.server.ts` (NEW) | Admin-SDK count() helpers | read (aggregate) | Per D-21: 4 `count()` aggregations driving `<KpiCards>`. Pattern: `await adminDb.collection('events').where('status','==','active').count().get()` → `.data().count`. Not real-time; refetch on mount and after `revalidatePath('/')`. |
| `app/api/auth/session/route.ts` (NEW) | POST route handler | mutate | **Read first:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` + Firebase "Manage Session Cookies" docs. Body: `{idToken}` → `admin.auth().verifyIdToken(idToken)` → `admin.auth().createSessionCookie(idToken, {expiresIn: 5*24*60*60*1000})` → `(await cookies()).set('__session', sessionCookie, {httpOnly:true, secure:true, sameSite:'lax', maxAge: 5*24*60*60})`. `cookies()` is async in Next 16. |
| `app/api/auth/logout/route.ts` (NEW) | POST route handler | mutate | Verify cookie → `admin.auth().revokeRefreshTokens(uid)` → `(await cookies()).delete('__session')` → return 204. Pair with client `SignOutButton`. |
| `firestore.rules` (NEW) | Security rules | n/a | **Read first:** research/ARCHITECTURE.md lines 360-378 (rules sketch) + Firebase docs. Start with **deny-by-default skeleton** per D-06 mitigation (a). Per-collection rules per ARCHITECTURE.md: `inventory` admin-only writes with `availableQty >= 0` invariant; `transactions` write:false (Admin SDK only); `events` array-contains-any allowedStaff check; `users` self-read + admin-all; `missingItems` staff-read + admin-write. **No unit tests in v1** (D-06); manual Firebase Console Rules Playground audit at end of each block per D-06 mitigation (b/c). |
| `firestore.indexes.json` (NEW) | Composite-index manifest | n/a | Pre-declare per D-18: `transactions(eventId, at desc)`, `transactions(itemId, at desc)`, `transactions(actorUid, at desc)`, `transactions(type, at desc)`, `inventory(lifecycleState, category)`, `events(status, startDate)`, `events(allowedStaff array-contains-any, status)`, `missingItems(status, at desc)`. **INT-05 ban** on Firebase Console auto-create stands — never click the magic-link in dev. |
| `storage.rules` (NEW) | Storage security rules | n/a | Per D-13: `items/{itemId}/photo.jpg` — read `if request.auth != null`, write `if request.auth.token.role == 'admin'`. No public-read paths. |
| `firebase.json` (NEW or modify) | Firebase project config | n/a | Map rules + indexes paths so `firebase deploy --only firestore:rules,firestore:indexes,storage` finds them. Standard Firebase scaffold. |
| `scripts/seed-first-admin.ts` (NEW) | One-time CLI script | mutate (admin-only) | Per D-05: Admin SDK script that `createUser(email, password)` → `setCustomUserClaims(uid, {role:'admin'})` → `firestore.doc('users/{uid}').set({role:'admin', ...})`. Document run instructions in `PROJECT.md` Context section. Gitignored or env-gated to prevent accidental re-runs. |
| `functions/index.ts` (NEW Cloud Functions) | Firestore triggers | event-driven | Per D-02 **exactly 2 functions:** (1) `onWrite users/{uid}` → `admin.auth().setCustomUserClaims(uid, {role: newRole})` to mirror Firestore role into ID-token claims (research/ARCHITECTURE.md line 202). (2) `onWrite events/{id}` OR `onWrite users/{uid}` → recompute denormalized `event.allowedStaff = unique(admins ∪ teamLeads ∪ backupTeams)` (research/ARCHITECTURE.md line 114, ROADMAP Block D). **No scheduled functions, no email triggers** per D-02. |
| `functions/package.json` (NEW) | Functions deps | n/a | Standalone npm scope inside `functions/`. Deployed via `firebase deploy --only functions`. |
| `.env.local` (NEW, gitignored) | Environment config | n/a | Public keys (`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_APP_ID`) + private keys (`FIREBASE_SERVICE_ACCOUNT_*`). **Per global CLAUDE.md secrets hygiene — never `cat` this file into context.** |
| `lib/storage/upload-photo.ts` (NEW) | Client-side image upload helper | mutate | Per D-12: install `browser-image-compression`; resize max 1600px long edge + JPEG quality 0.85; upload to `items/{itemId}/photo.jpg` via Web SDK `firebase/storage`. Used by `<ItemForm>` (D-15). |
| `lib/auth/roles.ts` (NEW, optional) | Server-only role utilities | n/a | Per research/STACK.md line 110. Helper `isAdmin(session)`, `canEditEvent(session, event)` for centralized authorization checks. Used by Server Components and Server Actions. |

---

## 3. Files to DELETE (with affected import sites)

Every consumer below must be **rewritten** to use the replacement before the source file is deleted. Run the deletion in a single coordinated commit.

### `lib/mock/store.ts` (DELETE)

| Imports to rewrite | Replacement |
|--------------------|-------------|
| `app/(app)/inventory/[itemId]/edit/page.tsx:15` (`getSnapshot`) | `getItemServer(itemId)` from `lib/data/inventory.server.ts` |
| `app/(app)/events/[eventId]/page.tsx:18` (`getSnapshot`) | `getEventServer(eventId, session)` from `lib/data/events.server.ts` |
| `app/(app)/events/[eventId]/checkout/page.tsx:30` (`getSnapshot`) | same |
| `app/(app)/events/[eventId]/checkin/page.tsx:52` (`getSnapshot`) | same |
| `app/(app)/events/[eventId]/edit/page.tsx:15` (`getSnapshot`) | same |
| `app/(app)/inventory/[itemId]/page.tsx:15` (`getSnapshot`) | `getItemServer(itemId)` |
| `app/(app)/users/invite/_components/invite-user-page-form.tsx:50` (`inviteUser`) | `inviteUserAction` Server Action from `app/(app)/users/actions.ts` |
| `app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx:55` (`checkin`) | `commitCheckinCartAction` from `app/(app)/events/[eventId]/checkin/actions.ts` |
| `components/feature/inventory/ItemForm.tsx:27` (`createItem, updateItem, getSnapshot`) | `createItemAction`, `updateItemAction` from `app/(app)/inventory/actions.ts`; SKU uniqueness check moves into the Server Action (returns `{ok:false, error}` if collision) |
| `components/feature/inventory/RetireItemButton.tsx:33` (`retireItem`) | `retireItemAction` |
| `components/feature/scan/scan-session.tsx:37` (`checkout, getSnapshot`) | `commitCheckoutCartAction`; live item lookup uses `useInventoryLive` |
| `components/feature/users/InviteUserSheet.tsx:60` (`inviteUser`) | `inviteUserAction` |
| `components/feature/users/UserRoleSelectInline.tsx:30` (`setUserRole`) | `setUserRoleAction` |
| `components/feature/users/DisableUserButton.tsx:34` (`disableUser`) | `disableUserAction` |
| `components/feature/events/EventForm.tsx:35` (`createEvent, updateEvent`) | `createEventAction`, `updateEventAction` from `app/(app)/events/actions.ts` |
| `components/feature/events/CancelEventDialog.tsx:46` (`cancelEvent`) | `cancelEventAction` |
| `components/feature/missing/ResolveMissingSheet.tsx:52` (`resolveMissing`) | `resolveMissingAction` from `app/(app)/reports/missing/actions.ts` |
| `components/feature/dashboard/LowStockWidget.tsx:27` (`markLowStockOrdered`) | `markLowStockOrderedAction` |
| `components/feature/reports/RepurchaseTable.tsx:32` (`markLowStockOrdered`) | same |
| `components/feature/settings/LowStockThresholdsCard.tsx:39` (`updateLowStockThreshold`) | `updateLowStockThresholdAction` |
| `lib/hooks/use-mock-store.ts:22` (`subscribe, getSnapshot, getServerSnapshot, StoreSnapshot`) | hook file deleted entirely (see below) |

### `lib/mock/selectors.ts` (DELETE)

| Imports to rewrite | Replacement |
|--------------------|-------------|
| `app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx:54` (`selectOpenCheckoutsForEvent`) | `getOpenCheckoutsForEventLive(eventId)` from new `lib/hooks/use-transactions-live.ts` |
| `components/feature/scan/EventPickerDialog.tsx:31` (`selectAccessibleEvents`) | `useEventsLive({accessibleTo: session, status:['planned','active']})` |
| `components/feature/scan/scan-session.tsx:36` (`selectItemBySku`) | `useInventoryLive` consumers do the `.find(i => i.sku === ...)` inline; for live one-off lookup use `getItemBySkuLive(sku)` helper |
| `components/feature/dashboard/KpiCards.tsx:25` (`selectActiveEvents, selectLowStockItems, selectOpenMissing`) | `count()` aggregations in `lib/data/aggregations.server.ts` per D-21 |
| `components/feature/dashboard/ActiveEventsWidget.tsx:21` (`selectActiveEvents`) | `useEventsLive({status:'active', limit:5})` |
| `components/feature/dashboard/OverdueReturnsWidget.tsx:20` (`selectOverdueEvents`) | `useEventsLive({status:'active', endDateBefore: now()})` |
| `components/feature/dashboard/LowStockWidget.tsx:26` (`selectLowStockItems`) | `useInventoryLive({whereLowStock: true, limit:50})` |
| `components/feature/dashboard/RecentActivityFeed.tsx:25` (`selectRecentActivity`) | `useTransactionsLive({orderBy:'at desc', limit:20})` |
| `components/feature/events/EventsTable.tsx:25` (`selectAccessibleEvents`) | `useEventsLive(cursorPage, {accessibleTo: session})` |
| `components/feature/events/EventDetail.tsx:37` (`selectUserByUid`) | `useUserByUid(uid)` hook (cached single-doc subscription) OR pass actor names via SSR seed |
| `components/feature/events/EventAssignedItemsTab.tsx:17` (`selectOpenCheckoutsForEvent`) | `useTransactionsLive({eventId, type:'checkout', openOnly:true})` |
| `components/feature/events/CancelEventDialog.tsx:45` (`selectOpenCheckoutsForEvent`) | same |
| `components/feature/events/EventHistoryTab.tsx:19` (`selectTransactionsForEvent`) | `useTransactionsLive({eventId, orderBy:'at desc'})` |
| `components/feature/inventory/ItemHistoryTab.tsx:18` (`selectTransactionsForItem`) | `useTransactionsLive({itemId, orderBy:'at desc'})` |
| `components/feature/reports/ItemsOutTable.tsx:25` (`selectItemsOut`) | server-side query `transactions where type='checkout' and parentTxId is null` joined with `inventory`; cursor-paginated |
| `app/(app)/inventory/[itemId]/edit/page.tsx:16` (`selectItemById`) | `getItemServer(itemId)` |
| `app/(app)/events/[eventId]/page.tsx:19` (`selectEventById`) | `getEventServer(eventId, session)` |
| `app/(app)/events/[eventId]/checkout/page.tsx:31` (`selectEventById`) | same |
| `app/(app)/events/[eventId]/checkin/page.tsx:56` (selectors) | same + `getOpenCheckoutsForEventServer` |
| `app/(app)/events/[eventId]/edit/page.tsx:16` (`selectEventById`) | same |
| `app/(app)/inventory/[itemId]/page.tsx:16` (`selectItemById`) | `getItemServer(itemId)` |

### `lib/mock/users.ts` + other `lib/mock/*.ts` seeds (DELETE)

| Imports to rewrite | Replacement |
|--------------------|-------------|
| All `seedUsers.find(u => u.uid === session.uid)` calls (15 occurrences across feature components) | **DELETE entirely.** Phase 2 Server Actions derive actor from `verifySession()` server-side — clients no longer pass an actor argument. Each affected component needs the actor-resolution block removed from `onSubmit`/`onClick` handlers. Affected: `ItemForm`, `EventForm`, `CancelEventDialog`, `LowStockWidget`, `LowStockThresholdsCard`, `RepurchaseTable`, `ResolveMissingSheet`, `RetireItemButton`, `DisableUserButton`, `InviteUserSheet`, `InviteUserPageForm`, `UserRoleSelectInline`, `scan-session`, `checkin-form`. |
| `app/(auth)/login/_components/login-form.tsx:20` (`seedUsers.find`) | Replaced by Firebase `signInWithEmailAndPassword` per Login swap row above. |
| `app/(auth)/login/_components/seed-users-disclosure.tsx:13` | Component **deleted entirely** (see below). |

### `lib/mock/cookie.ts` (DELETE)

| Imports to rewrite | Replacement |
|--------------------|-------------|
| `lib/auth/mock-session.ts:17` (`readMockSessionServer`) | File deleted; replaced by `lib/auth/dal.ts` |
| `components/feature/auth/SignOutButton.tsx:12` (`clearMockSessionClient`) | `POST /api/auth/logout` |
| `components/feature/auth/PhaseOnePocRoleSwitcher.tsx:18` (`readMockSessionClient, writeMockSessionClient`) | Component **deleted entirely** (see below). |
| `app/(auth)/login/_components/login-form.tsx:21` (`writeMockSessionClient`) | `POST /api/auth/session {idToken}` |
| `lib/hooks/use-current-user.ts:26` (`readMockSessionClient`) | `onAuthStateChanged(auth, callback)` subscription |

### `lib/auth/mock-session.ts` (DELETE)

| Imports to rewrite (15 occurrences) | Replacement |
|--------------------------------------|-------------|
| `app/(app)/layout.tsx:17` (`requireSession`) | `requireSession` from `lib/auth/dal.ts` (same export name; one-line import path swap) |
| `app/(app)/settings/page.tsx:23` (`getMockSession`) | `getSession` (or `verifySession`) from `lib/auth/dal.ts` |
| `app/(app)/page.tsx:17` (`getMockSession`) | same |
| `app/(app)/inventory/page.tsx:23` (`getMockSession`) | same |
| `app/(app)/inventory/[itemId]/page.tsx:17` (`getMockSession`) | same |
| `app/(app)/inventory/[itemId]/edit/page.tsx:14` (`requireAdmin`) | `requireAdmin` from `lib/auth/dal.ts` |
| `app/(app)/inventory/new/page.tsx:13` (`requireAdmin`) | same |
| `app/(app)/users/page.tsx:18` (`requireAdmin`) | same |
| `app/(app)/users/invite/page.tsx:22` (`requireAdmin`) | same |
| `app/(app)/events/page.tsx:24` (`requireSession`) | `requireSession` from `lib/auth/dal.ts` |
| `app/(app)/events/new/page.tsx:14` (`requireAdmin`) | `requireAdmin` from `lib/auth/dal.ts` |
| `app/(app)/events/[eventId]/page.tsx:17` (`requireSession`) | same |
| `app/(app)/events/[eventId]/checkout/page.tsx:29` (`requireSession`) | same |
| `app/(app)/events/[eventId]/edit/page.tsx:14` (`requireSession`) | same |
| `app/(app)/events/[eventId]/checkin/page.tsx:51` (`requireSession`) | same |

### `lib/hooks/use-mock-store.ts` (DELETE)

All 25 consumers above (every `import { useMockStore } from "@/lib/hooks/use-mock-store"`) rewrite to the matching per-collection live hook: `useInventoryLive`, `useEventsLive`, `useUsersLive`, `useTransactionsLive`, `useMissingLive`.

### `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` (DELETE)

| Imports to rewrite | Replacement |
|--------------------|-------------|
| `components/feature/shell/UserMenu.tsx:25` (`PhaseOnePocRoleSwitcher`) + line 75 usage | **Remove both lines.** No replacement — role switching is no longer a UI affordance; admins promote/demote via `/users` page. UserMenu loses one block. |

### `app/(auth)/login/_components/seed-users-disclosure.tsx` (DELETE)

| Imports to rewrite | Replacement |
|--------------------|-------------|
| `app/(auth)/login/page.tsx:15` (`SeedUsersDisclosure`) + line 27 usage | **Remove both lines.** No replacement. Login page only renders `<LoginForm/>` after the header. |

### `app/(app)/unauthorized/page.tsx` (KEEP)

Not deleted; `lib/auth/dal.ts`'s `requireAdmin` continues to `redirect('/unauthorized')` on role mismatch.

---

## 4. High-leverage code excerpts

These five excerpts encode the **load-bearing patterns** the planner should reference verbatim in PLAN actions. Each is short, concrete, and shows exactly what the Phase 2 file must produce.

### A. useSyncExternalStore live hook shape (the slot all 25 mock-store consumers swap into)

**Phase 1 source:** `lib/hooks/use-mock-store.ts:14-33`

```typescript
"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  type StoreSnapshot,
} from "@/lib/mock/store";

// Subscribe to the raw store snapshot — getSnapshot/getServerSnapshot return
// the same frozen `state` reference until a mutation rebuilds it, so
// useSyncExternalStore's identity check is satisfied. We then derive the slice
// via useMemo. This avoids the infinite-loop trap where a selector that
// returns `.filter(...)` / `.map(...)` produces a fresh array reference on
// every getSnapshot call.
export function useMockStore<T>(selector: (snapshot: StoreSnapshot) => T): T {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => selector(snapshot), [snapshot, selector]);
}
```

**Phase 2 target:** Each `lib/hooks/use-<entity>-live.ts` keeps the same `useSyncExternalStore + useMemo` shell. Internally it manages a module-scoped `state` updated by an `onSnapshot(query, snap => { state = freeze(snap.docs.map(toEntity)); emit(); })` subscriber. The signature is `useInventoryLive(cursorPage, filters) → InventoryItem[]`. Components do not change.

### B. Server Action shape (the slot all 14 mock-store mutators swap into)

**Phase 1 source:** `lib/mock/store.ts:108-188` (`checkout` mutator)

```typescript
export type CheckoutResult =
  | { ok: true; txIds: string[] }
  | { ok: false; error: string; failedLines?: { itemId: string; available: number }[] };

export function checkout(args: {
  eventId: string;
  lines: { itemId: string; qty: number }[];
  actor: UserDoc;
}): CheckoutResult {
  // CO-05 — refuse atomically if any line would drive availableQty < 0.
  // ... validation ...
  if (failedLines.length > 0) {
    return { ok: false, error: "Not enough stock", failedLines };
  }
  // ... mutation, emit() ...
  return { ok: true, txIds: newTxs.map((t) => t.id) };
}
```

**Phase 2 target:** `app/(app)/events/[eventId]/checkout/actions.ts`

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { verifySession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { CheckoutCartSchema } from "@/lib/schemas/transaction";
// Same CheckoutResult type — keeps useOptimistic rollback in scan-session.tsx working.
import type { CheckoutResult } from "@/lib/types/transaction";

class BizError extends Error {}

export async function commitCheckoutCartAction(input: {
  eventId: string;
  lines: { itemId: string; qty: number }[];
}): Promise<CheckoutResult> {
  const session = await verifySession();          // research/ARCHITECTURE.md line 188
  const parsed = CheckoutCartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  // EVT-08 access check (admin or member of allowedStaff)
  const eventSnap = await adminDb.doc(`events/${input.eventId}`).get();
  if (!eventSnap.exists) return { ok: false, error: "Event not found" };
  const event = eventSnap.data()!;
  if (session.role !== "admin" && !event.allowedStaff.includes(session.uid)) {
    return { ok: false, error: "Not allowed for this event" };
  }

  const newTxIds: string[] = [];
  try {
    await adminDb.runTransaction(async (t) => {
      const failedLines: { itemId: string; available: number }[] = [];
      const itemSnaps = await Promise.all(
        input.lines.map((l) => t.get(adminDb.doc(`inventory/${l.itemId}`))),
      );
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const item = itemSnaps[i].data();
        if (!item || item.lifecycleState === "retired") {
          failedLines.push({ itemId: line.itemId, available: 0 });
        } else if (item.availableQty < line.qty) {
          failedLines.push({ itemId: line.itemId, available: item.availableQty });
        }
      }
      if (failedLines.length > 0) throw new BizError(JSON.stringify({ failedLines }));

      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const item = itemSnaps[i].data()!;
        const txRef = adminDb.collection("transactions").doc();
        newTxIds.push(txRef.id);
        t.update(adminDb.doc(`inventory/${line.itemId}`), {
          availableQty: FieldValue.increment(-line.qty),
          outQty: FieldValue.increment(line.qty),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        });
        t.set(txRef, {
          type: "checkout", itemId: line.itemId, itemSku: item.sku, itemName: item.name,
          eventId: input.eventId, eventName: event.name, qty: line.qty,
          actorUid: session.uid, actorName: session.displayName,
          at: FieldValue.serverTimestamp(), parentTxId: null,
        });
      }
    });
  } catch (e) {
    if (e instanceof BizError) {
      const { failedLines } = JSON.parse(e.message);
      return { ok: false, error: "Not enough stock", failedLines };
    }
    throw e;
  }

  revalidatePath(`/events/${input.eventId}`);
  revalidatePath("/inventory");
  return { ok: true, txIds: newTxIds };
}
```

**Why this excerpt is load-bearing:** The `CheckoutResult` discriminated-union shape is identical to Phase 1's `checkout` mutator return. `components/feature/scan/scan-session.tsx:218-226` already destructures `result.failedLines` to surface per-line errors via `toast.error`. **No change required in `scan-session.tsx` beyond the import-source line.** This is the literal payoff of Phase 1 KD #17 (mock mutators mirror Server Action shapes).

### C. Server Component → Client Component SSR seed pattern

**Phase 1 source:** `app/(app)/inventory/[itemId]/page.tsx:30-37`

```typescript
export default async function ItemDetailPage({ params }: RouteProps) {
  const { itemId } = await params;
  const item = selectItemById(getSnapshot(), itemId);
  if (!item) notFound();
  const session = await getMockSession();
  const isAdmin = session?.role === "admin";
  return <ItemDetail item={item} isAdmin={isAdmin} />;
}
```

**Phase 2 target:**

```typescript
// app/(app)/inventory/[itemId]/page.tsx — Server Component
import { verifySession } from "@/lib/auth/dal";
import { getItemServer } from "@/lib/data/inventory.server";

export default async function ItemDetailPage({ params }: RouteProps) {
  const session = await verifySession();          // EVT-08-style gate happens here
  const { itemId } = await params;
  const item = await getItemServer(itemId);       // Admin SDK read
  if (!item) notFound();
  const isAdmin = session.role === "admin";
  // ItemDetail is a Client Component that subscribes via useInventoryItemLive(itemId, item)
  // — `item` is the SSR seed, the hook takes over after hydration. Kills the
  // "no data → flash → data" jank per research/ARCHITECTURE.md line 310.
  return <ItemDetail initial={item} isAdmin={isAdmin} />;
}
```

The Client Component receives `initial` and seeds its `useSyncExternalStore` snapshot from that prop on first paint. Subsequent renders come from `onSnapshot`. **Identical structural pattern repeats in 11 Server Component pages** (every page row in §1 above).

### D. Auth DAL with React.cache (the load-bearing piece of Block A)

**Phase 1 source:** `lib/auth/mock-session.ts:25-52`

```typescript
export async function getMockSession(): Promise<Session | null> {
  return readMockSessionServer();
}

export async function requireSession(): Promise<Session> {
  const session = await getMockSession();
  if (!session || session.disabled) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/unauthorized");
  return session;
}
```

**Phase 2 target:** `lib/auth/dal.ts`

```typescript
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getTokens } from "next-firebase-auth-edge";  // v1.12+ per D-01 spike gate
import { adminAuth } from "@/lib/firebase/admin";
import type { Session } from "@/lib/types/session";

// React.cache → per-request memoization. A Server Component, a Server Action,
// and the (app)/layout can all call verifySession() in the same request and
// the cookie is verified only once.
export const verifySession = cache(async (): Promise<Session | null> => {
  const tokens = await getTokens(/* cookieName: "__session", ... */);
  if (!tokens) return null;
  // research/ARCHITECTURE.md line 188 — verifySessionCookie(..., true) checks revocation
  const decoded = await adminAuth().verifySessionCookie(tokens.token, true);
  // Custom claims sync'd by Cloud Function onWrite users/{uid} per D-02
  return {
    uid: decoded.uid,
    email: decoded.email!,
    displayName: decoded.name ?? "",
    role: (decoded.role as "admin" | "staff") ?? "staff",
    disabled: false,  // tokens revoked above if disabled
  };
});

export async function requireSession(): Promise<Session> {
  const session = await verifySession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/unauthorized");
  return session;
}
```

**Why this excerpt is load-bearing:** Same three exports as Phase 1 — `getSession` / `requireSession` / `requireAdmin`. Same return type (`Session`). **The 15 callsites listed in §3 only change their import path** (`@/lib/auth/mock-session` → `@/lib/auth/dal`). Layout files, admin-gated pages, and admin-gated Server Actions remain shape-identical.

### E. proxy.ts shape (the one truly new file with no Phase 1 analog)

**Source:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:27-39` + research/ARCHITECTURE.md lines 178-189

```typescript
// proxy.ts — repo root. NOT middleware.ts (renamed in Next 16).
// Optimistic auth check ONLY. Admin SDK CANNOT run here (Edge default would
// fail; Node runtime works but Admin SDK is server-only and proxy runs per-
// request — verifySessionCookie() is too expensive for every request including
// prefetches). Per request verification happens in lib/auth/dal.ts.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/set-password"];

export function proxy(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Anonymous user hitting a protected route → /login.
  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed-in user hitting an auth route → /.
  if (session && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude API routes, static assets, image optimization.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)"],
};
```

**Notes:** Function MUST be named `proxy` (or default export). `config.matcher` must skip `/api/auth/*` so the session-cookie creation route handler is reachable for anonymous POST. Node.js runtime by default in Next 16 — no `runtime: 'edge'` config.

---

## 5. Shared Patterns (cross-cutting)

These apply to every relevant file in §1 — call them out in PLAN actions instead of duplicating.

### Authentication entry-point

**Source:** `lib/auth/dal.ts` (excerpt D above).
**Apply to:** every (app) Server Component (15 files), every Server Action (8 action files), every API route handler (2 files).
**Rule:** First line after function signature is `const session = await verifySession();` (Server Components / API routes) or `const session = await requireSession();` (Server Actions). Admin-only actions use `requireAdmin()`.

### Server Action result contract

**Source:** research/ARCHITECTURE.md line 261 + Phase 1 `CheckoutResult` shape.
**Apply to:** every Server Action across 8 action files.
**Rule:** Return type `{ ok: true; data?: T } | { ok: false; error: string; ...details }`. Use Zod `.safeParse` on input; return `{ok:false, error: zodIssuesToMessage(parsed.error)}` on validation fail. Catch known errors (BizError) and return as `{ok:false}`; let unknown errors throw for the framework to surface.

### Revalidation contract

**Source:** Claude's Discretion §, CONTEXT.md line 81.
**Apply to:** every Server Action.
**Rule:** `revalidatePath(<affected-path>)` after every successful mutation. Multi-path mutations (e.g., checkout affects both `/events/{id}` and `/inventory`) call `revalidatePath` once per affected path. **Use `updateTag(tag)` instead of `revalidateTag` when read-your-writes is needed inside the same action** per STACK.md line 22.

### Real-time listener scoping

**Source:** D-20 (CONTEXT.md line 70).
**Apply to:** every `lib/hooks/use-<entity>-live.ts` (4 new hooks).
**Rule:** `onSnapshot` subscribes to the **50-row visible window** of the current cursor page only — never a full-collection live subscription. Cursor change → tear down old listener → mount new one. Dashboard widget listeners also scoped (e.g., `where(availableQty <= threshold).limit(50)`).

### Form pattern (rhf + Zod + shadcn v4 `<Field>`)

**Source:** `components/feature/inventory/ItemForm.tsx:51-309` (full reference) + Phase 1 D-01-04-B.
**Apply to:** every form in Phase 2 (login, forgot-password, set-password, invite, item-form, event-form, missing-resolve, low-stock-threshold).
**Rule:** Use shadcn v4 `<Field> / <FieldLabel> / <FieldError>` primitives directly with rhf `register()`. Use `<Controller>` for `<Select>` and `<RadioGroup>`. NEVER import from `@/components/ui/form` (does not exist in radix-nova v4 registry).

### Error UX pattern

**Source:** Claude's Discretion §, CONTEXT.md line 79.
**Apply to:** every form / mutation surface.
**Rule:** Use `sonner` toasts. Generic copy "Couldn't save — try again." for unknown errors; specific copy for known business errors (e.g., "Only N available; reduce quantity."). Surface inline field errors via rhf's `setError("fieldName", { message })` when the Server Action returns `{ok:false, fieldErrors}`. AlertDialog with `variant="destructive"` for irreversible confirmations.

### Cursor URL contract (D-17)

**Source:** D-17 (CONTEXT.md line 57) + Claude's Discretion §.
**Apply to:** every list-page table (`InventoryTable`, `EventsTable`, `UsersTable`, all 5 reports tables).
**Rule:** URL has `?cursor=<base64-encoded JSON>` not `?page=N`. TanStack table `manualPagination: true`. Pagination chrome shows prev/next only — no "Page N of M". Filter/sort/search URL params (`?q=`, `?status=`, `?category=`) unchanged from Phase 1.

### Server-only guard

**Source:** research/STACK.md line 188.
**Apply to:** `lib/firebase/admin.ts`, `lib/auth/dal.ts`, `lib/auth/roles.ts`, every `lib/data/<entity>.server.ts`.
**Rule:** First line: `import "server-only";`. Build will fail if a client component accidentally imports these modules — exactly the desired behavior.

---

## 6. Metadata

**Analog search scope:** `app/`, `components/`, `lib/`, `node_modules/next/dist/docs/01-app/`.
**Files scanned:** ~85 source files across Phase 1 codebase + 1 Next 16 docs page (`proxy.md`).
**Pattern extraction date:** 2026-05-25.
**Mock-store consumers identified:** 25 `useMockStore` imports + 60 mock-store/selector/cookie imports across 32 files.
**Coverage:** ~38 modified files with exact in-repo analogs; ~18 new files with no Phase 1 analog (pointed at Next 16 docs + Firebase docs); 6 files deleted with all import sites enumerated.

---

## PATTERN MAPPING COMPLETE

Phase 1's deliberate alignment of mock-store mutator signatures with Phase 2 Server Action shapes (KD #17 / D-02) is the highest-leverage reuse opportunity: 14 mutators map 1:1 to 14 Server Actions across 8 `actions.ts` files, and 25 `useMockStore` callsites become 25 calls to per-collection `use-<entity>-live.ts` hooks that keep the **exact** `useSyncExternalStore + useMemo` shell from `lib/hooks/use-mock-store.ts:14-33`. The auth swap is similarly mechanical — `lib/auth/dal.ts` exports the same three names (`getSession` / `requireSession` / `requireAdmin`) as `lib/auth/mock-session.ts`, so 15 import sites change only their import path. The truly novel files are `proxy.ts` (one Next.js 16 docs page), `firestore.rules` / `firestore.indexes.json` / `storage.rules` (research/ARCHITECTURE.md sketches), the two route handlers under `app/api/auth/` (Firebase session-cookie docs), and the 2 Cloud Functions in `functions/` (D-02 scope). The single material UI change is `KpiCards` switching from `.reduce()` selectors to Firestore `count()` aggregations per D-21, and `ItemForm` adding the photo field per D-15 using the existing `ScannerWidget` camera substrate. Everything else is a one-to-three line import swap inside otherwise unchanged components.
