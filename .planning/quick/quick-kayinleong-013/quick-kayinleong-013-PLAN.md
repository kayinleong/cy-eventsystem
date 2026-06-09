---
phase: quick-kayinleong-013
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/types/transaction.ts
  - lib/hooks/use-transactions-live.ts
  - lib/data/transactions.server.ts
  - lib/data/events.server.ts
  - app/(app)/scan/actions.ts
  - components/feature/events/EventAssignedItemsTab.tsx
  - app/(app)/delivery-orders/[doId]/page.tsx
  - components/feature/inventory/ItemDetail.tsx
  - app/(app)/inventory/[itemId]/page.tsx
autonomous: false
requirements: [quick-kayinleong-013]
user_setup: []

must_haves:
  truths:
    - "Scanning a GROUP barcode in Scan → Location sets each member item's current (group) location WITHOUT changing its home inventory.location."
    - "Scanning an individual ITEM barcode in Scan → Location still updates that item's home inventory.location (unchanged behavior)."
    - "Each group-location move is still logged as one `type:\"location\"` transaction per member, carrying the new location value, stamped eventId/eventName/deliveryOrderId."
    - "Delivery-order detail shows a 'Current location' column (latest location-tx value scoped to that DO), alongside the existing home-location 'Location' column."
    - "Event → Assigned items shows each checked-out item's current (group) location, derived from the event's location transactions."
    - "Inventory item detail shows a 'Current location' row when it exists AND differs from the home location."
    - "quick-012 history (Location rows in Item/Event/DO) still renders; the new `location` field reads back null on pre-existing rows."
  artifacts:
    - path: "lib/types/transaction.ts"
      provides: "location field on TransactionDoc"
      contains: "location: string | null"
    - path: "app/(app)/scan/actions.ts"
      provides: "group branch no longer writes inventory.location; carries tx location value via locationTxFields()"
    - path: "app/(app)/delivery-orders/[doId]/page.tsx"
      provides: "Current location column from latest location tx scoped to deliveryOrderId"
    - path: "components/feature/events/EventAssignedItemsTab.tsx"
      provides: "current (group) location derived from event location transactions"
    - path: "components/feature/inventory/ItemDetail.tsx"
      provides: "Current location row (conditional on existence + difference from home)"
  key_links:
    - from: "app/(app)/scan/actions.ts group branch"
      to: "transactions collection"
      via: "batch.set location tx with location value; NO batch.update(inventory)"
      pattern: "type:\\s*\"location\""
    - from: "app/(app)/delivery-orders/[doId]/page.tsx"
      to: "transactions where deliveryOrderId == doId"
      via: "Admin SDK query ordered by at desc, filter type==location in code"
      pattern: "deliveryOrderId"
    - from: "components/feature/inventory/ItemDetail.tsx"
      to: "latest location tx for item"
      via: "currentLocation prop from page server-fetch"
      pattern: "currentLocation"
---

<objective>
Introduce a per-group "current location" concept that is distinct from each item's permanent home location, WITHOUT adding a new data record. An item's "current location" is derived from the transaction stream: it is the `location` value of that item's latest `type:"location"` transaction (consistent with `lib/types/transaction.ts`'s stated philosophy that inventory fields are projections of the transaction stream).

The behavior reversal: a GROUP-barcode Location scan must STOP writing `inventory/{itemId}.location` (the home location) and instead record the move only in the transaction stream. An individual ITEM-barcode Location scan is UNCHANGED — it still sets the home location (an individual scan IS a home-location change) and additionally carries the new tx `location` value.

Three surfaces gain a "current location" display sourced from the latest location tx per item: the Delivery-order detail page, the Event → Assigned items tab, and the Inventory item detail page (alongside, not replacing, the home location).

Purpose: the user distinguishes "master item" (home location, must stay unchanged on a group scan) from "item in group" (where it currently is as part of this checkout group). The data model currently conflates both into one `inventory.location` field; this plan separates the two via the existing transaction log.

Output: additive `location` field on `TransactionDoc`; group-branch write reversal in `updateItemsLocationAction`; current-location display on three surfaces. No new Firestore index, no rules change, no client `checkoutGroups` reads.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/quick-kayinleong-013/CLAIM.md
@.planning/quick/quick-kayinleong-013/quick-kayinleong-013-RESEARCH.md
@.planning/quick/quick-kayinleong-012/CLAIM.md
@./CLAUDE.md
@./AGENTS.md

# This task touches Next.js 16 App-Router server actions and server components.
# Per AGENTS.md, READ the relevant guide in node_modules/next/dist/docs/ before
# touching any framework surface. The action already uses `revalidatePath` and
# `"use server"`; server components already `await params`. No NEW App-Router
# API is introduced — but confirm against the docs, do not assume training-data
# Next.js behavior.

<interfaces>
<!-- Extracted from the codebase. Executor should use these directly. -->

TransactionDoc — lib/types/transaction.ts:21-44 (deliveryOrderId at :43 is the
exact precedent for adding the new `location` field as the LAST field):
```typescript
export type TransactionDoc = {
  id: string;
  type: TransactionType;        // includes "location" (quick-012)
  itemId: string;
  itemSku: string;
  itemName: string;
  eventId: string | null;
  eventName: string | null;
  qty: number;
  actorUid: string;
  actorName: string;
  actorRoleAtTimeOfAction: UserRole;
  at: string;
  notes: string;
  parentTxId: string | null;
  clientTxId: string | null;
  deliveryOrderId: string | null; // quick-012 — add `location` immediately after this
};
```

The THREE tx-shaping sites that build a TransactionDoc and must map the new field:
1. lib/hooks/use-transactions-live.ts:55-75 — client `toTx(d)`. Field mapped as
   `deliveryOrderId: data.deliveryOrderId ?? null` at :73.
2. lib/data/transactions.server.ts:75-95 — server `toTx(snap)`. Field mapped as
   `deliveryOrderId: d.deliveryOrderId ?? null` at :93.
3. lib/data/events.server.ts — NOTE: there is NO named `toTx` here. The TransactionDoc
   shape is built INLINE inside `getOpenCheckoutsForEventServer` at :204-223
   (`deliveryOrderId: dt.deliveryOrderId ?? null` at :222). Map `location` there.
   (CLAIM.md called this an "events.server.ts toTx" — confirm by reading; it is the
   inline mapper, not a named helper.)

updateItemsLocationAction — app/(app)/scan/actions.ts:49-210:
- `locationTxFields()` helper at :63-75 — shared fields for every location tx.
  Does NOT currently include `location`. The string value to store is the action's
  `location` param (already destructured at :57, already used in the inventory
  writes and in `txNote` at :62).
- Step 1 (item / SKU-doc-id branch): :78-100. Writes inventory.location at :82-86,
  tx at :87-95, revalidates at :97-98. UNCHANGED behavior (still writes home location).
- Step 2 (item / externalBarcode branch): :103-130. Same shape as Step 1.
  UNCHANGED behavior.
- Step 3 (GROUP branch): :133-206. Per-member loop at :183-199 currently does BOTH
  `batch.update(inventory/{itemId}, {location, updatedAt, updatedBy})` (:185-189)
  AND `batch.set(transactions, {...locationTxFields(), itemId, ..., eventId,
  eventName, deliveryOrderId})` (:190-198). Revalidates at :201-204
  (`revalidatePath("/inventory")` + per-item `revalidatePath("/inventory/{itemId}")`).

EventAssignedItemsTab — components/feature/events/EventAssignedItemsTab.tsx (full file):
- Subscribes `const allTxs = useTransactionsLive({ eventId, limit: 100 })` (:99).
  Group location txs carry eventId, so they are ALREADY in this stream.
- `useItemLocations(itemIds)` (:48-93) currently subscribes to inventory docs and
  returns itemId→HOME location (`data.location`). Render uses `locationMap.get(t.itemId)`
  at :147-151.

DO detail — app/(app)/delivery-orders/[doId]/page.tsx (full file):
- Server component, Admin SDK. `fetchItemSummaries` (:107-122) returns
  {id,name,sku,location} where `location` is the HOME location from inventory.
- Items table at :245-282. Existing "Location" header at :253, home-location cell at
  :275-277. `doc.id` is `doId`.

ItemDetail — components/feature/inventory/ItemDetail.tsx (full file):
- Props at :43-51. Details `<dl>` at :130-194; existing home "Location" row at :131-138
  (`item.location`).
- Page app/(app)/inventory/[itemId]/page.tsx (full file): server component, fetches
  item via `getItemServer` and renders `<ItemDetail item=.. isAdmin=.. deliveryOrders=.. />`
  at :72-74. `itemId` available at :66.

Existing Firestore indexes (firestore.indexes.json) — CONFIRMED present, REUSE these:
- transactions(itemId ASC, at DESC, __name__ DESC) — lines 323-341.
- transactions(deliveryOrderId ASC, at DESC, __name__ DESC) — lines 254-272.
firestore.rules: `transactions` allow get,list if isSignedIn() (:82) — reliably
client-readable. Do NOT add a new index; do NOT change rules.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add `location` to TransactionDoc + map in all 3 builders + reverse the group-branch write</name>
  <files>lib/types/transaction.ts, lib/hooks/use-transactions-live.ts, lib/data/transactions.server.ts, lib/data/events.server.ts, app/(app)/scan/actions.ts</files>
  <action>
This is the data + write-path task (atomic commit 1). Five files.

1. **lib/types/transaction.ts** — Add a new field to `TransactionDoc` immediately
   after `deliveryOrderId: string | null;` (the field is currently the last one,
   :43). Add:
   ```typescript
   // quick-kayinleong-013 — the new location value recorded by a `location`
   // transaction (the per-group "current location" of the item). Null on
   // non-location transactions and on cleared locations.
   location: string | null;
   ```
   Mirror EXACTLY how quick-012 documented + added `deliveryOrderId`.

2. **lib/hooks/use-transactions-live.ts** — In `toTx` (:55-75), add
   `location: data.location ?? null,` (place next to the existing
   `deliveryOrderId: data.deliveryOrderId ?? null` at :73).

3. **lib/data/transactions.server.ts** — In `toTx` (:75-95), add
   `location: d.location ?? null,` (next to `deliveryOrderId: d.deliveryOrderId ?? null`
   at :93).

4. **lib/data/events.server.ts** — There is NO named `toTx` here. Find the INLINE
   TransactionDoc construction inside `getOpenCheckoutsForEventServer` (:204-223,
   the `return { id: d.id, type: ..., deliveryOrderId: dt.deliveryOrderId ?? null }
   as TransactionDoc`). Add `location: dt.location ?? null,` to that object literal
   (next to `deliveryOrderId` at :222). tsc will fail if any TransactionDoc
   construction site is missed — that is the safety net.

5. **app/(app)/scan/actions.ts** — three edits:
   a. `locationTxFields()` (:63-75): add `location,` to the returned object so EVERY
      location tx (item branches AND group branch) carries the new location value.
      The `location` string is already in scope (destructured at :57). For type
      consistency with `location: string | null`, store the value as written — the
      Zod schema already constrains it to a string (`z.string().max(100)`), so an
      empty string for "cleared" is acceptable; do NOT coerce "" to null here unless
      you also adjust the displays' "differs from home" logic. Keep it simple: store
      `location` verbatim.
   b. GROUP branch per-member loop (:183-199): **REMOVE the
      `batch.update(adminDb.collection("inventory").doc(itemId), { location,
      updatedAt, updatedBy })` call (:185-189).** KEEP the `batch.set(transactions...)`
      write (:190-198) exactly as-is (it already spreads `locationTxFields()` which
      now carries `location`, and stamps eventId/eventName/deliveryOrderId). The batch
      now contains ONLY transaction writes for the group case — still ONE atomic
      `batch.commit()` (:200). This is the behavior reversal: group scans no longer
      touch home locations.
   c. GROUP branch revalidates (:201-204): **REMOVE `revalidatePath("/inventory")`
      and the per-item `revalidatePath("/inventory/${itemId}")` loop** — the group
      scan no longer changes the home inventory list/detail, so those revalidations
      are no longer warranted. ADD revalidations for the surfaces that now show the
      derived current location off this move: `revalidatePath("/delivery-orders")`
      and, if `deliveryOrderId` was resolved, `revalidatePath(\`/delivery-orders/${deliveryOrderId}\`)`;
      also `revalidatePath("/inventory/${itemId}")` per item IS still useful because
      the Item detail page (Task 3) reads the latest location tx server-side and will
      now show a Current location row — so KEEP the per-item
      `revalidatePath("/inventory/${itemId}")` loop but REMOVE the bare
      `revalidatePath("/inventory")` (the list shows home location, unchanged by a
      group scan). Net: item-detail revalidation stays (current-location row needs
      it), list revalidation goes, DO revalidation added. The Event tab is a live
      client subscription (no revalidate needed).
   d. Step 1 + Step 2 (item branches, :78-130): leave the `batch.update(inventory...)`
      home-location writes and their `revalidatePath` calls UNCHANGED. They now also
      carry the tx `location` value automatically via the updated `locationTxFields()`.

Per global minimal-change rule: do not refactor the resolution order or the resolver;
do not touch quantity fields (location txs stay qty:0); keep the group batch atomic.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
- `TransactionDoc` has `location: string | null` as a field; all 3 tx-shaping sites
  (client toTx, server toTx, events.server inline mapper) map it with `?? null`.
- `locationTxFields()` returns `location`.
- Group branch (Step 3) contains NO `batch.update(inventory...)` and NO
  `revalidatePath("/inventory")` bare call; it still writes one location tx per member
  in a single atomic batch, and still revalidates per-item `/inventory/{itemId}` +
  `/delivery-orders` (+ the specific DO when resolved).
- Item branches (Step 1/2) unchanged except they now carry the tx `location` value.
- `npx tsc --noEmit` exits 0 (proves no TransactionDoc construction site was missed).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Current-location displays on all three surfaces (DO detail, Event tab, Item detail)</name>
  <files>app/(app)/delivery-orders/[doId]/page.tsx, components/feature/events/EventAssignedItemsTab.tsx, components/feature/inventory/ItemDetail.tsx, app/(app)/inventory/[itemId]/page.tsx</files>
  <action>
This is the display task (atomic commit 2). Four files. "Current location" of an item
= the `location` value of its latest `type:"location"` transaction. Read
`node_modules/next/dist/docs/` for any App-Router server-component data-fetch pattern
you are unsure about before editing the server components.

1. **app/(app)/delivery-orders/[doId]/page.tsx** (server component, Admin SDK):
   - Add a helper, e.g. `fetchCurrentLocationsForDO(doId: string): Promise<Map<string,string>>`.
     Query: `adminDb.collection("transactions").where("deliveryOrderId","==",doId)
     .orderBy("at","desc").get()`. This REUSES the existing
     `transactions(deliveryOrderId, at desc)` composite index (firestore.indexes.json
     :254-272) — do NOT add a `.where("type","==","location")` clause (that would
     require a new composite index). Instead filter `data.type === "location"` IN CODE.
     Because the query is ordered `at desc`, iterate the docs and for each itemId record
     the FIRST (latest) location tx's `location` value only if not already set. Return
     itemId→location string (skip null/empty values so the column shows "—").
   - In `DeliveryOrderDetailPage` (:132+), call this in the existing `Promise.all`
     (:137-140) alongside `fetchItemSummaries` + `fetchUploaderName`, keyed by `doId`.
   - In the items table (:245-282): add a new `<th>Current location</th>` header next to
     the existing "Location" header (:253) and a corresponding `<td>` cell rendering
     `currentLocMap.get(item.id) || "—"`. KEEP the existing "Location" column (home
     location from fetchItemSummaries) — this adds a column, does not replace one.

2. **components/feature/events/EventAssignedItemsTab.tsx** (client):
   - The component already has `allTxs = useTransactionsLive({ eventId, limit: 100 })`
     (:99). Group location txs carry eventId so they are in this stream.
   - Add a `useMemo` that builds itemId→current location from `allTxs`: filter
     `t.type === "location"`, and because the hook orders `at desc` (newest first),
     take the FIRST location tx per itemId; store its `t.location` value (skip
     null/empty). Call it e.g. `currentLocationMap`.
   - REPLACE the home-location display: remove the `useItemLocations` hook usage
     (:48-93 + the `locationMap` call at :118 + its render at :147-151) and render the
     CURRENT (group) location instead — this tab is the "item in group" view the user
     means. Render `currentLocationMap.get(t.itemId)` in the same `<p className="text-xs
     text-muted-foreground">` slot, only when present. Do NOT add a client
     `checkoutGroups` read; do NOT add an inventory `getDoc` (the quick-012 regression).
     You MAY delete the now-unused `useItemLocations` helper + its firebase/firestore
     imports if nothing else uses them (confirm by reading the file — it is the only
     consumer). Removing the inventory subscription also removes the
     `where(documentId(),"in",ids)` 30-item limit footgun.
   - If you prefer to keep `useItemLocations` to ALSO show home location, that is
     allowed, but the user's stated intent is the current/group location on this tab —
     prefer replacing.

3. **components/feature/inventory/ItemDetail.tsx** (client component, props only):
   - Add an optional prop `currentLocation?: string | null` to the props type (:43-51).
   - In the Details `<dl>` (:130-194), add a "Current location" `<div>` row (mirroring
     the existing "Location" row at :131-138) that renders ONLY when `currentLocation`
     is truthy AND `currentLocation !== item.location` (do not show it when it equals
     the home location — avoids redundant noise). Label: "Current location".

4. **app/(app)/inventory/[itemId]/page.tsx** (server component, Admin SDK):
   - Add a helper, e.g. `fetchCurrentLocation(itemId: string): Promise<string | null>`.
     Query: `adminDb.collection("transactions").where("itemId","==",itemId)
     .orderBy("at","desc").limit(...).get()`. REUSE the existing
     `transactions(itemId, at desc)` composite index (firestore.indexes.json :323-341).
     Do NOT add `.where("type","==","location")` (new index); filter
     `data.type === "location"` in code and take the FIRST (latest) match's `location`.
     A small `.limit(20)` is a reasonable scan bound (location txs are interleaved with
     checkout/checkin rows; 20 covers the realistic recent window — if no location tx
     in the window, return null and the row simply won't render). Returning null when
     none found is correct.
   - In `ItemDetailPage` (:65-74), call this (it can join the existing awaits) and pass
     `currentLocation={...}` into `<ItemDetail ... />`.

General: no new Firestore index — every query above reuses an existing composite index
with in-code `type` filtering. No firestore.rules change. Admin SDK stays server-side
(DO page + item page); the Event tab uses the existing client `useTransactionsLive`
subscription only (no new client collection reads).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint</automated>
  </verify>
  <done>
- DO detail page renders a "Current location" column (latest location-tx value scoped to
  the DO via deliveryOrderId), alongside the unchanged home "Location" column.
- Event Assigned-items tab shows each item's current (group) location derived from the
  event's location transactions; no client checkoutGroups/inventory reads added (or the
  inventory read removed).
- ItemDetail renders a "Current location" row only when it exists and differs from the
  home location; page server-fetches it via the reused transactions(itemId, at) index.
- `npx tsc --noEmit` exits 0; `npm run lint` reports no NEW errors (pre-existing
  TanStack/React-Compiler warnings are out of scope).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
The full feature is implemented and the automated gates have been run by the executor:
- `npx tsc --noEmit` → expected exit 0
- `npm run lint` → expected 0 new errors (pre-existing warnings acceptable)
- `npm run build` → expected exit 0, all routes compile

The behavior change: GROUP-barcode Location scans no longer mutate `inventory.location`
(home location); the move lives only in the transaction stream and surfaces as a derived
"current location" on the DO detail page, the Event → Assigned items tab, and the
Inventory item detail page. Individual-item Location scans are unchanged.
  </what-built>
  <how-to-verify>
These steps REQUIRE a running Firebase environment + auth and CANNOT be run from the
planning/execution session. Run them manually:

1. Start the app against a real Firebase project (`npm run dev`) and sign in.
2. **Home location preserved (the core fix):** Note an item's home location on
   `/inventory/[itemId]` (the "Location" row). Scan that item's GROUP barcode in
   Scan → Location, set location to e.g. "klcc", submit. Re-open `/inventory/[itemId]`:
   the "Location" row (home) MUST be UNCHANGED, and a "Current location: klcc" row MUST
   now appear (it shows only because it differs from home).
3. **Individual-item scan still changes home:** Scan an individual ITEM barcode in
   Scan → Location, set "store-room", submit. `/inventory/[itemId]` "Location" (home)
   MUST now read "store-room" (unchanged behavior). No separate "Current location" row
   should show (current == home).
4. **DO detail current-location column:** Open the DO whose group you scanned in step 2
   at `/delivery-orders/[doId]`. The items table MUST show both a "Location" (home,
   unchanged) and a "Current location" (= "klcc") column.
5. **Event tab:** Open `/events/[eventId]` for that group's event, Assigned items tab.
   Each checked-out member item MUST show the current (group) location "klcc".
6. **History intact (quick-012 regression):** Confirm a "Location" history row still
   appears in Item history, Event history (group), and the DO History card, with the
   new note. Pre-existing location rows must still render (their `location` field reads
   back null — they just have no value to show).
7. Confirm NO `checkoutGroups` permission-denied error in the browser console (the
   quick-012 trap) — the Event tab must not read checkoutGroups or inventory client-side.

Note: no `firebase deploy` is required — no new index and no rules change (both reuse
existing `transactions(itemId, at)` / `transactions(deliveryOrderId, at)` indexes already
declared, and quick-012's index deploy requirement is unchanged by this claim).
  </how-to-verify>
  <resume-signal>Type "approved" once the 7 manual checks pass, or describe any issue (e.g. home location changed on group scan, current-location column empty, console permission error).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → server action (`updateItemsLocationAction`) | scanned barcode + free-text location cross here; already gated by `requireSession()` + Zod (`z.string().max(100)`). |
| client → Firestore `transactions` read (Event tab, DO/Item via Admin SDK) | signed-in read (firestore.rules:82); no per-doc role check. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-013-01 | Tampering | group-branch write reversal in `updateItemsLocationAction` | mitigate | Keep the single atomic `batch.commit()` for the group case (all member location txs or none); do not split into multiple commits. Existing quick-012 invariant preserved. |
| T-013-02 | Information disclosure | new `location` value on `transactions` rows | accept | Location strings are free-text inventory-position labels (e.g. "klcc"); no PII. Read is already signed-in-only (firestore.rules:82). No new exposure surface. |
| T-013-03 | Tampering | derived "current location" relies on latest-tx-by-`at desc` | accept | `at` is a server timestamp (`FieldValue.serverTimestamp()`); ordering is server-authoritative. In-code `type=="location"` filtering after an indexed `at desc` query is read-only and cannot corrupt state. |
| T-013-04 | Denial of service | item-detail latest-location query scans interleaved tx types | mitigate | Bound the item-detail query with `.limit(20)` over the reused `transactions(itemId, at)` index rather than an unbounded scan; DO-scoped query is naturally bounded by one DO's tx count. |
</threat_model>

<verification>
Automated (run by executor after each task):
- `npx tsc --noEmit` → exit 0 (the type add forces every TransactionDoc construction site to map `location`; a miss fails the build).
- `npm run lint` → no NEW errors (12 pre-existing TanStack/React-Compiler warnings are out of scope per project scope boundary).
- `npm run build` → exit 0, all routes compile.

Manual (requires Firebase env + auth — cannot run from this session): the 7-step
human-verify checklist in Task 3.

Index/rules confirmation (done at plan time, re-confirm in the diff):
- No new entry added to `firestore.indexes.json` — both queries reuse
  `transactions(itemId, at desc)` (:323-341) and `transactions(deliveryOrderId, at desc)`
  (:254-272) with in-code `type` filtering.
- No change to `firestore.rules`.
</verification>

<success_criteria>
- Group-barcode Location scan leaves every member item's home `inventory.location`
  unchanged, while recording one location tx per member (carrying the new `location`
  value, stamped eventId/eventName/deliveryOrderId) in a single atomic batch.
- Individual-item Location scan still updates the home `inventory.location` (unchanged).
- "Current location" (latest location-tx value per item) is shown on the DO detail page,
  the Event → Assigned items tab, and the Inventory item detail page (the latter only
  when it differs from home).
- quick-012 history continues to render Location rows in Item/Event/DO; the additive
  `location` field reads back null on pre-existing rows.
- No new Firestore index, no firestore.rules change, no client `checkoutGroups`/inventory
  reads reintroduced.
- All three automated gates pass.
</success_criteria>

<regression_surface>
Call these out explicitly in the CLAIM.md Verification section (per global Regression
Prevention rule). Self-audit each diff hunk against this list:
- **Individual-item Location scan** (Step 1/2 branches, :78-130) must still update home
  `inventory.location` — DO NOT alter those branches except for the auto-carried tx
  `location` value via the shared helper.
- **quick-012 history rows** must still appear in Item/Event/DO history; the new
  `location` tx field is additive — existing rows read back null and must not break the
  feeds. Verify all non-location tx writers (checkout/checkin/missing/adjustment) are not
  typed as `TransactionDoc` (they build plain objects), so they are not forced to add
  `location`; their rows read back `location: null` via the `?? null` mappers.
- **DO detail existing "Location" (home) column** and **Event tab existing display** must
  not break — the DO page adds a column (does not replace the home one); the Event tab
  replaces home-location display with current-location display per user intent (confirm
  removal of `useItemLocations` doesn't leave dangling imports / lint errors).
- **Check-out group creation / itemLines schema** unchanged — this plan does not touch
  `createCheckoutGroupAction` or the `checkoutGroups`/`itemLines` shape.
- **`firestore.indexes.json`** — confirm in the diff that NO new index was added.
- **Atomicity** — the group location-tx batch must remain a single `batch.commit()`.
</regression_surface>

<output>
After completion, fill in `.planning/quick/quick-kayinleong-013/CLAIM.md`:
- `## What has changed` — per-commit summary (T1 data+write reversal, T2 displays).
- `## Verification` — the Regression Report: what was tested (automated gates + the diff
  self-audit against the regression surface above), what passed, what was ruled out and
  why (e.g. non-location tx writers unaffected; no new index; atomic batch preserved),
  and the manual UI checks that require a Firebase env (cannot run from this session).
- Flip `status: in-progress` → `done` only after the human-verify checkpoint is approved
  and the Regression Report is complete.
</output>
