# Pitfalls Research — cy-eventsystem

**Researched:** 2026-05-24
**Stack:** Next.js 16.2.6 + React 19.2.4 + shadcn/ui v4 (radix-nova/neutral) + Tailwind v4 + Firebase
**Domain:** Event-based physical inventory tracking with QR/barcode scanning

> **Phase legend** — Phase 1 (UI) | Phase 2 (Functionality)

---

## Critical (project-killers)

### C1. Negative quantity from concurrent check-outs

**Goes wrong:** Two staff scan the same SKU. Both read `available: 3`, both decrement to `2`, save. You debited 1 but checked out 2.

**Why lethal:** Inventory truth is the entire product promise.

**Prevention:**
- Every stock movement goes through a Firestore **transaction** (`runTransaction`), never `set/update` with a pre-read value.
- Inside the transaction, re-assert: `if (available < requested) throw`.
- Append-only **movements** ledger as source of truth; counter on item doc is a cache, updated atomically.
- Hard-block in **Firestore Rules**: `request.resource.data.availableQty >= 0`.

**Phase:** 2

### C2. Missing Firestore composite indexes only fail in production

**Goes wrong:** Query like `where('eventId', '==', x).where('status', '==', 'out').orderBy('checkedOutAt')` works locally with 5 docs; production throws `FAILED_PRECONDITION: The query requires an index`.

**Prevention:**
- Define every composite index in `firestore.indexes.json`; deploy via `firebase deploy --only firestore:indexes`. Never click the auto-create console link.
- Maintain a "queries inventory" doc; cross-check before merging.
- Integration tests against emulator with >1000 docs surface index errors in CI.

**Phase:** 2

### C3. Security Rules forgotten on a collection = full data leak

**Goes wrong:** New collection ships; rules file not updated; someone adds `allow read, write: if request.auth != null` to unblock dev; ex-staff with stale account exfiltrates entire history.

**Warning signs:** Rules with `if request.auth != null` on anything not strictly user-public.

**Prevention:**
- Treat `firestore.rules` as **the** authorization layer. Client-side checks are cosmetic.
- Deny-by-default skeleton — every collection has an explicit `match` block.
- Rules unit tests with `@firebase/rules-unit-testing` for every collection: anonymous denied, regular user denied admin docs, cross-tenant denied.
- Phase 2 checkpoint: rules audit of every collection.

**Phase:** 2

### C4. Server/client auth state hydration flash + lying server renders

**Goes wrong:** Server renders "Sign in" UI because Firebase Auth is client-only. Client hydrates from IndexedDB, knows user is logged in, flashes correct UI 200–800ms later. Worse: Server Component fetches Firestore without auth context, either crashes (rules deny) or succeeds (rules too loose).

**Prevention:**
- Use `next-firebase-auth-edge` to mint a session cookie from the Firebase ID token via `proxy.ts`. Server Components read auth from cookie via Admin SDK.
- OR keep auth-gated UI in Client Components inside `<Suspense fallback={<Skeleton/>}>`.
- Never render `"You are signed in as X"` server-side without verifying the session cookie.
- Use `experimental_taintObjectReference` on user records so accidental serialization triggers a build error.

**Phase:** 2

### C5. Items "stuck out" from cancelled/forgotten events bloat reports

**Goes wrong:** Event cancelled with 47 items checked-out; nobody runs check-in; six months later report still shows them; repurchase engine recommends buying more.

**Prevention:**
- Explicit lifecycle: `draft → active → completed → cancelled → archived`. Cancellation forces reconciliation: each item marked `returned` / `lost` / `still_with_owner`.
- Nightly Cloud Function flags `active` events that ended >N days ago → admin reconciliation queue.
- "Items currently out" defaults to filter by active events; separate "Stale checkouts" report admins must clear.

**Phase:** 2

### C6. Firebase Admin SDK on Edge runtime (won't work)

**Goes wrong:** Developer puts Admin SDK in `proxy.ts` or marks a route `runtime: 'edge'`. Admin SDK depends on Node crypto/net — build succeeds in dev, throws at runtime.

**Next.js 16 specific:** `proxy.ts` runs on **Node.js runtime; edge is NOT supported in proxy** (verified in `node_modules/next/dist/docs/.../version-16.md`).

**Prevention:**
- Initialize Admin SDK once in `lib/firebase-admin.ts` guarded by `if (!getApps().length)`.
- Client SDK in browser, Admin SDK in Server Components / Server Actions / Route Handlers / `proxy.ts`. Never mix.
- ESLint or CI grep failing if `firebase-admin` imported from a file with `'use client'` or `runtime: 'edge'`.

**Phase:** 2

---

## By category

### Inventory/event domain

**Orphan transactions (items checked-out to wrong event then "returned")**
- Every check-in must specify the event. Add explicit "transfer to another event" flow rather than silent moves.
- Phase: 2

**Items returned to wrong location**
- Enumerated `locations` collection. On check-in, default to item's home location; if elsewhere, prompt confirm + log + surface in "misfiled items" report.
- Phase: 2

**SKU/barcode collisions**
- Use `sku` (or `barcode`) as the document ID in `inventory` collection — Firestore enforces uniqueness. Scans become O(1) `getDoc(doc(db, 'inventory', code))`.
- For multiple physical units per SKU: `inventory/{sku}` + `inventory/{sku}/units/{serial}` subcollection.
- Bulk import: dry-run, surface conflicts, admin confirms each.
- Phase: 2

**Missing-item reconciliation: "Unknown" accountability**
- "Lost item" form requires: (a) event during which it went missing, (b) actor who last had it (auto-filled, editable), (c) free-text note. Generate `lost_item_report` doc with snapshot of last 5 movements. Admin must review and accept/escalate.
- Phase: 2

**Partial check-ins (5 out, 3 in, 2 still out)**
- Movements ledger handles naturally — checkout `qty: -5`, check-in `qty: +3`, state is `sum(movements)`. UI shows derived counts. "Reconcile remaining" lets admin mark outstanding as `lost` / `still_with_owner` / `damaged_disposed`.
- Phase: 2

**Cancelled events with checked-out items** — see C5.

**"Lost forever" vs "still out" — stale records**
- Status is **derived**, not stored. Item is "out" if it has unresolved movements against an active event. Reports filter by event status. Explicit `permanently_lost` reason code excludes from active inventory.
- Phase: 2

**Repurchase suggestions that flap**
- Reorder eval on **scheduled Cloud Function** (nightly) or rolling window (>24h low). Store as `reorder_suggestion` docs with `status` (`pending` / `acknowledged` / `dismissed` / `ordered`). Add "suppress for N days" admin toggle.
- Phase: 2

---

### Firebase/Firestore

**Missing composite indexes** — see C2.

**Forgotten security rules** — see C3.

**Real-time listener cost runaway**
- Listeners are charged per document including initial sync. Always paginate (`.limit(50)`) and scope (`.where('eventId', '==', x)`).
- Listeners disconnected >30 min are re-billed as fresh queries. Detach on blur/unmount.
- Reports use one-shot `getDocs`, not listeners.
- Phase: 2

**Auth hydration race** — see C4.

**Mixing Admin SDK and Client SDK on server**
- Two separate files: `lib/firebase/client.ts` (Web SDK) and `lib/firebase/admin.ts` (Admin, `import 'server-only'`). Never cross.
- Phase: 2

**Firestore transaction limits**
- Transactions: max 500 document writes; same-doc max ~1 write/sec sustained.
- Bulk ops use `writeBatch` chunked into 400, `Promise.allSettled` between.
- Hot counters → distributed counters (N shards, increment random, read = sum).
- Phase: 2

**Custom claims require force-refresh of ID token**
- After server-side claim change, client's existing ID token has old claims for up to ~1h (default TTL).
- Force refresh: `await user.getIdToken(true)` then `getIdTokenResult()`.
- Pattern: write `users/{uid}/_claims_updated_at` doc on role change; client subscribes and force-refreshes when newer than `iat`.
- Document in admin runbook.
- Phase: 2

**Emulator drift from production rules**
- Single source of truth `firestore.rules` for both. CI runs `firebase emulators:exec --only firestore "npm test"` against the same file shipped to prod.
- Never use `RulesTestEnvironment.withSecurityRulesDisabled` outside seed scripts.
- Deploy-gate diffs `firestore.rules` and `firestore.indexes.json` against last-deployed.
- Phase: 2

---

### Next.js 16

**RSC vs Client boundary mistakes**
- Default Server Components. Push `'use client'` to the smallest leaf. Data fetching = server; `onClick`, `useState`, `useEffect`, browser APIs = client.
- Phase: 1 (architecture set here) + 2

**Server Actions misuse**
- Server Actions are for **mutations**, not live data. For real-time updates, use Firestore `onSnapshot` listener.
- After mutation, action calls `updateTag('items')` to expire cached server data.
- Phase: 2

**Caching changes (Cache Components / PPR)** — verified from `01-getting-started/08-caching.md` + `02-guides/upgrading/version-16.md`:
- Decide upfront whether to enable `cacheComponents: true` in `next.config.ts`. **Recommend OFF** for this app — most pages are user-specific dashboards.
- `revalidateTag` now requires second arg: `revalidateTag('items', 'max')`. Single-arg form errors.
- `updateTag(tag)` (no second arg, Server-Actions only) for read-your-writes after mutation.
- `cacheLife` and `cacheTag` now stable (no `unstable_` prefix).
- `cookies()`, `headers()`, `params`, `searchParams` async-only. Always `await`.
- Phase: 1 (`next.config.ts` decision) + 2

**Edge runtime + Admin SDK** — see C6.

**`middleware.ts` is renamed to `proxy.ts` in Next.js 16**
- Copy-pasting from 2025 blogs with `middleware.ts` / `runtime: 'edge'` is wrong.
- Codemod `npx @next/codemod@canary upgrade latest` handles rename.
- `proxy` runs Node.js runtime — edge not supported.
- Phase: 2

**`'use client'` over-spreading kills RSC benefits**
- Every component imported by a Client Component is also client. Audit the tree; client islands should be small leaves.
- Pass server-fetched data down as props rather than re-fetching client-side.
- Phase: 1

**Async dynamic APIs**
- Always `await params`, `await cookies()`, `await headers()`. Use `PageProps<'/items/[id]'>` from `npx next typegen`.
- Phase: 1 + 2

---

### shadcn/Tailwind v4

**Theme variable mismatches with radix-nova + neutral**
- Verify `app/globals.css` defines all expected tokens: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`. Both `:root` and `.dark`.
- `npx shadcn@latest diff` before customizing.
- Phase: 1

**Tailwind v4 `@theme` + dark mode gotchas**
- CSS-first — no `tailwind.config.ts`. All theme in `app/globals.css`.
- CSS vars at `:root` (not inside `@layer base`).
- Use `@theme inline { --color-background: var(--background); }` to map CSS vars into Tailwind utilities. Without this, `bg-background` doesn't generate.
- Don't double-wrap with `hsl()` — pick one storage form.
- Dark mode = override tokens in `.dark { ... }`. `dark:` variant enabled by default in v4.
- Phase: 1

**shadcn CLI v4 registry breaking changes**
- Feb 2026 moved to **unified `radix-ui` package**. Already present here (`^1.4.3`).
- New components import from `radix-ui` directly. For older components, `npx shadcn@latest migrate radix`.
- Use `--dry-run --diff` flags before adding to a customized project.
- Phase: 1

**tw-animate-css vs tailwindcss-animate**
- Already correct (`tw-animate-css ^1.4.0`). Verify `@import "tw-animate-css";` near top of `app/globals.css`.
- Phase: 1

---

### Barcode/QR scanning

**iOS Safari camera permissions + PWA quirks**
- `getUserMedia` requires iOS 13.4+ for standalone PWA. Browser mode is more lenient.
- `<video>` must have `playsinline` (and `autoplay muted`) — iOS fullscreens otherwise.
- Denied permission requires manual re-enable in Settings. Detect `NotAllowedError` and show iOS-specific instructions modal.
- Test on real iPhone, not simulator.
- Phase: 2

**HTTPS requirement for getUserMedia**
- `localhost`/`127.0.0.1` exempt. Any other origin must be HTTPS.
- Local network testing: `mkcert` + `next dev --experimental-https`.
- Production solved by Firebase Hosting / Vercel HTTPS defaults.
- Document loudly in README.
- Phase: 2

**Mirror/reverse image on front camera**
- Default `facingMode: { ideal: 'environment' }`. If front needed, apply `transform: scaleX(-1)` to preview only, pass original stream to decoder.
- Phase: 2

**Continuous scan debouncing**
- Decoders fire ~30Hz. After successful read, ignore same value for ≥1.5–2s.
- Feedback: vibration (`navigator.vibrate(50)`) + audible beep + visual checkmark.
- Batch scan flow: persistent list of scanned items on screen + "Confirm All" button — allows removing accidental scans before transaction commit.
- Phase: 2

**Bad lighting / blur**
- Torch via `MediaStreamTrack.getCapabilities().torch` (Chrome Android — iOS Safari doesn't expose).
- Enable 1D + 2D formats simultaneously (zxing-js all formats).
- **Manual entry fallback** input is the single most-loved feature when camera fails.
- Phase: 2

**Battery drain in long sessions**
- Stop the camera stream (`stream.getTracks().forEach(t => t.stop())`) on navigate-away — not just hide video.
- "Tap to scan" mode: camera off, tap → on for 5s, scans, stops.
- Skip frames via `scanDelay` prop.
- Phase: 2

**Format strategy (QR vs barcode)**
- Recommend: **QR for new items** (encode item doc ID; denser; tolerates damage), keep 1D enabled for legacy.
- Library config: enable `QR_CODE, CODE_128, EAN_13, UPC_A, DATA_MATRIX`.
- Optional: encode deep link (`https://app.example.com/i/<sku>`) so any general scanner lands in the app.
- Phase: 2 (format decision affects Phase 1 if labels designed alongside UI)

---

### Auth/roles

**Admin-invite registration: leakage, expiry, replay**
- Use Firebase's built-in `generatePasswordResetLink` (already signed + time-limited). Don't roll your own tokens.
- If custom tokens needed: single-use, server-validated, TTL 24–72h, `invites/{token}` doc with `{ emailHash, expiresAt, usedAt, createdBy }`. On accept, mark `usedAt` in same transaction as user-doc creation.
- Bind invite to email; rate-limit accept per IP; audit-log all invite creates.
- Phase: 2

**Role check only on client**
- Every Server Action and Cloud Function re-verifies role from verified ID token claims. Client UI hiding is cosmetic. Rules enforce on direct DB writes.
- `assertAdmin()` helper at top of every admin-only Server Action.
- Phase: 2

**Forgotten Firestore rules** — see C3.

**Session token expiry mid-scan (long flow)**
- ID tokens have fixed 1-hour TTL. Client SDK auto-refreshes when page active; backgrounded pages may have stale tokens on foreground.
- Right before committing: `await user.getIdToken()` (cheap; returns cached if valid; refreshes silently if expired).
- **Persist in-progress scan list to IndexedDB** so re-auth doesn't lose work. Re-hydrate after re-auth.
- Phase: 2

---

### UX

**Modal-heavy CRUD on mobile**
- Mobile (<768px): promote create/edit to full-page routes. Use `<Sheet/>` (bottom-sheet) for short forms; full-page for longer. Don't nest dialogs.
- Phase: 1

**Forms losing state on accidental navigation**
- Auto-save drafts to IndexedDB on every change, keyed by route + user. Restore on mount. Clear on submit. Show "Draft restored" toast.
- `beforeunload` only for genuinely-destructive cases.
- Phase: 1 (UX pattern) + 2 (storage layer)

**Confirmation dialogs ignoring bulk destructive operations**
- Single-item destructive: standard confirm.
- Bulk destructive: type-the-verb or count ("Type DELETE", "Type the number 47"). Friction is the feature.
- Inventory-affecting ops require admin + double confirmation + audit log entry with diff.
- Phase: 1 (pattern) + 2 (audit log)

**Reports without filters**
- Every report ships with: date range (default last 30 days), event multi-select, location, actor, item category, action type. Filters as URL params (shareable).
- Aggregates >1000 docs use scheduled Cloud Function writing summary docs to `report_snapshots/{date}/`. Never aggregate client-side over large collections.
- Phase: 1 (UI scaffold with filter components) + 2 (data layer)

**No offline support at remote venues**
- Firestore Web SDK has offline persistence by default (web v9+). Verify enabled in `lib/firebase/client.ts`.
- Writes queue locally; sync on reconnect. **But:** optimistic local read returns local data; user sees scan succeed even if it later fails server-side.
- Tag offline writes with client-generated `pendingId`; show "syncing" badge; on sync-failure show "These 3 scans couldn't be saved — review" screen. Don't let staff think a scan succeeded when it didn't.
- PWA: service worker caches app shell. Next.js 16 has `progressive-web-apps.md` guide bundled.
- Phase: 1 (PWA manifest scaffold) + 2 (offline persistence config)

---

## Quick wins

5-minute fixes that prevent 50-hour debugging sessions:

- Set up `firestore.rules` + `firestore.indexes.json` in version control **day one** of Phase 2.
- `playsinline` + `muted` on every `<video>`.
- `facingMode: { ideal: 'environment' }` (rear camera).
- One Firebase Auth init module imported everywhere (avoids "already exists" in dev with Fast Refresh).
- `verifyIdToken()` in every Server Action that mutates data. No exceptions.
- All Firestore docs include `createdAt`, `updatedAt`, `createdBy`, `updatedBy` via `withTimestamps()` helper.
- `serverTimestamp()` for all timestamps; never `new Date()` from client (client clocks lie).
- Document IDs for items = the SKU. Free uniqueness, O(1) scan lookup.
- `npx next typegen` after route changes for `PageProps<'/route/[id]'>` types.
- `npx @next/codemod@canary upgrade latest` before any large refactor.
- `experimental.taintObjectReference` to prevent leaking user records to client.
- `<Suspense>` boundaries around every Firestore-data section in Server Components.
- Single `<ScannerModal/>` reused across the app, not 4 copies.
- `<input type="text" inputmode="numeric" pattern="[0-9]*"/>` on every numeric field — pulls right keyboard on mobile.
- `autoComplete="off"` on barcode/SKU inputs — iOS won't suggest random text.
- Log every movement with `actorUid`, `actorDisplayName` (denormalized snapshot), `actorRoleAtTimeOfAction`. Snapshot historical context.
- Soft-delete by default (`deletedAt` field; queries filter it out). Hard delete = separate admin action with grace period.

---

## Open questions

1. Single-tenant or multi-tenant? Changes rules + data model significantly.
2. Offline-tolerance requirement? Bad WiFi vs fully offline 8 hours have different complexity.
3. Existing barcodes vs new labels? Affects format support + label-printing scope.
4. Volume? 50×5 vs 5000×50 → different DB cost, aggregation, listener strategies.
5. Audit retention? GDPR right-to-be-forgotten flow?
6. Photo/file storage scope? Item photos? Damage attachments?
7. Repurchase flow: suggest only, or integrate with purchasing process?
8. Notifications channel: in-app, email, SMS, push (iOS PWA push has its own saga)?
9. Cache Components in Next 16: enable PPR from start or stay off? Recommend OFF until clear use-case.

---

## Sources

- Next.js 16 bundled docs (verified): `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`, `01-getting-started/08-caching.md`, `01-getting-started/05-server-and-client-components.md`, `01-app/02-guides/authentication.md`
- Firebase: Transaction Data Contention; Firestore Best Practices; Indexing; Custom Claims; Real-time Queries at Scale; Pricing; Rules Unit Tests
- next-firebase-auth-edge docs (Next.js 16 middleware page)
- shadcn/ui: Tailwind v4 setup; Unified Radix UI (Feb 2026); CLI v4 (Mar 2026)
- ZXing-js library; @yudiel/react-qr-scanner
- NetSuite: Causes of Inventory Discrepancies
