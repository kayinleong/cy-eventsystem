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

## Verification
**Automated**
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors, 12 warnings (all pre-existing TanStack/React-
  Compiler `incompatible-library` warnings in report/table components; none in
  files touched by this claim).
- `npm run build` → exit 0, all 28 routes compiled.

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
- **Open data caveat (Concern 1):** the code paths for group resolution in
  Location vs check-in mode are identical and the rules already permit client
  reads, so the reported "not recognised" is one of: (a) a swallowed `getDoc`
  error (e.g. an auth-readiness race) — now surfaced as a retry message +
  console error; (b) a group with empty `itemLines` — now treated as a
  recognised, submittable group; or (c) a genuinely missing/orphaned
  `checkoutGroups` doc — which no client patch can resolve and would surface as
  "Group has no items." on submit. If the symptom persists after this fix,
  capture the browser console error (now logged) to distinguish (a) from (c).

