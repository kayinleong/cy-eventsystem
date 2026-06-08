# Claim: quick-kayinleong-012
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-08
- status: done
- completed: 2026-06-08
- summary: Fix barcode-not-recognised in Location check-in scan mode; surface check-in location updates in history across event, item, and DO modules.

## What will change
Audit findings in AUDIT.md; plan in PLAN.md. Three atomic commits:
1. Bug: minimal `LocationPanel.tsx` patch so group barcodes resolve instead of
   false "not recognised".
2. History data: `"location"` transaction type + `deliveryOrderId`;
   `updateItemsLocationAction` writes location transactions (event/DO stamped
   for group resolutions); new `transactions(deliveryOrderId, at)` index;
   `useTransactionsLive` deliveryOrderId scope.
3. History display: location label/tone/verb in Item & Event tabs; new DO
   history tab on the DO detail page.

Confirmed decisions: minimal client patch / group-link attribution / precise
DO history (stamped deliveryOrderId + index + tab).

## What has changed
- **Commit 42dd45e** (bug): `components/feature/scan/LocationPanel.tsx` now
  tracks `recognised`/`lookupError` so a resolved group barcode (even with an
  empty `itemLines` snapshot) is submittable, a swallowed `getDoc` error is
  surfaced as a retry message + `console.error`, and only a genuinely unknown
  code shows "Barcode not recognised". Submit enables on `recognised`, not on
  preview-item count.
- **Commit 223e2b6** (history data): `"location"` added to `TransactionType`;
  `deliveryOrderId` added to `TransactionDoc` (mapped in all 3 `toTx` builders);
  `updateItemsLocationAction` writes one `location` transaction per affected
  item in the same batch as the inventory update — group resolutions stamp
  `eventId`/`eventName` + the owning `deliveryOrderId` (best-effort), item
  barcodes leave them null; `useTransactionsLive` gained a `deliveryOrderId`
  scope; added `transactions(deliveryOrderId, at)` index.
- **Commit cbe6178** (history display): `"location"` label/tone in
  `status-to-tone.ts`; `actionVerb("location")` + qty suppression in
  `ItemHistoryTab` & `EventHistoryTab`; new `DOHistoryTab` rendered as a
  History card on the DO detail page.
- **Commit 5417392** (follow-up after runtime test): root cause of the
  "not recognised" report confirmed — the client `getDoc(checkoutGroups/{id})`
  throws `FirebaseError: Missing or insufficient permissions`. Diagnosis: the
  deployed Firestore rules predate the local `firestore.rules` `checkoutGroups`
  read allowance (client inventory/transaction reads work, only checkoutGroups
  denied → stale deployment), compounded by the client read not being gated on
  auth readiness. Added read-only `resolveLocationBarcodeAction` (Admin SDK,
  server session) mirroring the update resolver, and switched `LocationPanel`
  to it — preview now resolves regardless of deployed-rule state or auth
  timing. Removed the `firebase/client` + `firebase/firestore` imports from the
  panel. The earlier minimal client patch (Commit 42dd45e) remains as the
  error/empty-group UX layer on top of the now-reliable resolution.

## Verification
**Automated** (re-run after the 5417392 follow-up)
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors, 12 warnings (all pre-existing TanStack/React-
  Compiler warnings in report/table components; none in files touched by this
  claim).
- `npm run build` → exit 0, all 28 routes compiled.

**Runtime**
- Browser console confirmed the pre-fix failure path: `[LocationPanel]
  checkoutGroups lookup failed: FirebaseError: Missing or insufficient
  permissions.` (the error our Commit-42dd45e logging surfaced). The 5417392
  follow-up moves resolution to the Admin SDK, removing the client read.

**Regression surface audited (per diff hunk)**
- `TransactionDoc` field add (`deliveryOrderId`): the two server `toTx`
  builders (`lib/data/transactions.server.ts`, `lib/data/events.server.ts`) and
  the client `toTx` (`use-transactions-live.ts`) were all updated to map it
  (`?? null`). Existing tx writers (checkout/checkin/missing/adjustment) build
  plain Firestore objects — not typed as `TransactionDoc` — so they were not
  forced to change; their rows read back `deliveryOrderId: null`. tsc confirms
  no other construction site broke.
- Location-update inventory write behavior unchanged: the `location` +
  `updatedAt` + `updatedBy` writes are identical; tx writes are additive and
  share the same atomic batch (matches the app's audit-log invariant).
- Group event/DO attribution is wrapped in try/catch → a lookup miss yields
  null, never blocking the location update.
- `array-contains` on `checkoutGroupIds` needs no composite index (single-field
  auto-index) — verified against the rest of indexes.json.
- LocationPanel submit guard: individual-item and populated-group previews are
  unchanged (recognised + items shown); only the empty-group and error paths
  changed.

**Requires deploy / manual confirmation (cannot be done from this session)**
- `firebase deploy --only firestore:indexes` to build the new
  `transactions(deliveryOrderId, at)` index before DO history queries return
  data in production.
- Manual UI check (needs Firebase env + auth): Scan → Location, scan a DO group
  barcode → preview resolves (no false "not recognised") → submit updates
  location; confirm a "Location" row appears in Item history, Event history
  (group barcode), and the new DO history card.
- **Concern 1 — RESOLVED at root.** Runtime test proved the cause was a client
  Firestore permission denial on `checkoutGroups` (stale deployed rules + an
  ungated client read). The 5417392 follow-up resolves the preview server-side
  (Admin SDK), so the feature no longer depends on the client read. Recommended
  hygiene (not required for the fix): `firebase deploy --only firestore:rules`
  so the deployed rules match `firestore.rules`.
- **Separate issue observed (NOT in this claim's scope):** the auth middleware
  logged `[auth proxy error] ... Key for the RS256 algorithm must be one of
  type KeyObject, CryptoKey, or JSON Web Key. Received an instance of
  Uint8Array` at `proxy.ts:24`. This is a `next-firebase-auth-edge` cookie-key
  config problem, unrelated to the location fix. Flagged for a separate claim.

