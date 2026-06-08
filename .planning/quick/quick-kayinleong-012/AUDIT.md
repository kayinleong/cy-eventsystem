# AUDIT — quick-kayinleong-012

Read-only audit (no code changed). Two concerns:
1. **Bug** — group barcode "not recognised" in Scan → Location mode.
2. **Feature** — show location-update history in Event, Item, and DO modules.

---

## Concern 1: Location-mode barcode lookup

### Symptom
In Scan → **Location** mode, scanning group barcode `btcjPeIZyw0vSoTmrDms` (Group 2 of DO "ADA 2026", id `Kl3eYFpOhPwcebgWlZ3R`) shows "Barcode not recognised — check the value and try again", even though that value is a real `checkoutGroups` doc ID.

### Evidence chain
- `checkoutGroups` doc **ID is the barcode payload** — `checkout/actions.ts:279` (`adminDb.collection("checkoutGroups").doc()` → `groupRef.id` returned as `groupId`).
- DO links groups via `checkoutGroupIds = arrayUnion(...groupIds)` — `delivery-orders/actions.ts:200`; the DO detail "Group Barcodes" list renders those exact IDs and encodes them in the QR (`DODetailActions.tsx:157-171`, `PrintLabelButton sku={gid}`). So the scanned value **is** a `checkoutGroups` doc ID.
- Firestore rules **allow** signed-in client reads of `checkoutGroups` — `firestore.rules:95` (`allow get, list: if isSignedIn()`). Permission is **not** the cause.
- Server action `updateItemsLocationAction` resolves correctly via admin SDK in 3 steps (SKU/docId → externalBarcode → checkoutGroups) — `scan/actions.ts:48-110`. The server would resolve this barcode.

### Root cause (code-level)
`LocationPanel.tsx` re-implements barcode resolution **client-side** and interprets the result more narrowly than the server:
- `LocationPanel.tsx:80` — `getDoc(doc(db,"checkoutGroups", trimmed))`.
- `:83` — builds preview items from `data.itemLines ?? []`.
- `:91-93` — **empty `catch {}` silently swallows any read error**, falling through to the unrecognised branch.
- `:96` + `:186-188` — renders "Barcode not recognised" whenever `state.items.length === 0`, conflating THREE distinct cases:
  - (a) genuinely unknown barcode,
  - (b) group **resolved** but `itemLines` empty/missing → zero preview items,
  - (c) `getDoc` threw and was swallowed.

By contrast, **check-in** mode (`scan-session.tsx:332-338`) uses the *identical* `getDoc` but only checks `groupSnap.exists()` — so it always detects the group (and rejects it). That asymmetry is why the same barcode is "recognised" in check-in but "not recognised" in Location.

### Minimal fix surface
Make the Location preview as authoritative as the server resolver. Either:
- **(A) Server-authoritative preview** — add a read-only resolve action (mirrors `scan/actions.ts:48-110` without writing) and call it from `LocationPanel`. Eliminates client/server divergence. ~40-60 LOC across `scan/actions.ts` + `LocationPanel.tsx`.
- **(B) Patch the client path** — in `LocationPanel.tsx`: treat `groupSnap.exists()` as recognised even when `itemLines` is empty; stop swallowing the `catch` (log + surface); distinguish "resolved group" from "unknown". ~20-30 LOC, `LocationPanel.tsx` only.

Files: `components/feature/scan/LocationPanel.tsx` (primary), optionally `app/(app)/scan/actions.ts`.

---

## Concern 2: Location-update history (Event / Item / DO)

### Existing history system
- Collection: `transactions/{txId}` — `lib/types/transaction.ts`. `TransactionType = "checkout"|"checkin"|"adjustment"|"missing"` (**no "location"**).
- Hook: `useTransactionsLive` scopes by itemId / eventId / actorUid / type — `lib/hooks/use-transactions-live.ts`.
- Renderers: `ItemHistoryTab` (itemId-scoped), `EventHistoryTab` (eventId-scoped). Labels via `status-to-tone.ts` (`statusToTone` / `statusToLabel`), verbs via local `actionVerb()` in each tab.
- Indexes present: `transactions(itemId, at)`, `transactions(eventId, at)`, etc. **No `deliveryOrderId` index.**
- **`updateItemsLocationAction` writes ZERO transactions today** (`scan/actions.ts` only `.update()`s inventory `location`).

### Per-module status
| Module | Status | What's needed |
|--------|--------|---------------|
| **Item** | PARTIAL | Add `"location"` to `TransactionType`; write a location tx per item in `updateItemsLocationAction`; add label/tone + `actionVerb`. Then it auto-renders in `ItemHistoryTab`. **Low.** |
| **Event** | PARTIAL | `EventHistoryTab` is eventId-scoped. Location updates carry an event **only when scanned via a group barcode** (the `checkoutGroups` doc has `eventId`). Stamp `eventId`/`eventName` on the location tx for group resolutions. Individual-item location updates have no event. **Low-Med.** |
| **DO** | MISSING | DO detail page has **no history UI at all**. Net-new section. Either query transactions by the DO's `itemIds` (imprecise — shows all item activity), or stamp a `deliveryOrderId` on location txs + add an index + query (precise, needs DO resolution from the group). **Med (~50-100 LOC ± index).** |

### Key linkage nuance
A location update is attributable to an event/DO **only when the scanned barcode is a group barcode**: group → `eventId` (on the checkoutGroups doc) → DO (the DO whose `checkoutGroupIds` contains the group). Individual item-barcode location updates have no event/DO context and can only appear in Item history.

---

## Key files
- `components/feature/scan/LocationPanel.tsx` — client Location preview; root cause of Concern 1.
- `app/(app)/scan/actions.ts` — `updateItemsLocationAction` (3-step resolver; writes no transaction).
- `components/feature/scan/scan-session.tsx` — check-in group probe (`:332`), the working comparison.
- `lib/types/transaction.ts` — `TransactionType` (needs `"location"`).
- `lib/hooks/use-transactions-live.ts` — live feed hook (no change needed).
- `components/feature/inventory/ItemHistoryTab.tsx`, `components/feature/events/EventHistoryTab.tsx` — history renderers (`actionVerb` switch).
- `components/feature/status/status-to-tone.ts` — label/tone map (add `"location"`).
- `app/(app)/delivery-orders/[doId]/page.tsx` + `DODetailActions.tsx` — DO detail; no history section.
- `lib/types/checkout-group.ts` — group doc (`eventId`, `itemLines`, `txIds`).
- `firestore.indexes.json` — would need `transactions(deliveryOrderId, at)` only if DO history uses a stamped id.

## Open questions (for user)
1. Concern 1 fix approach: server-authoritative resolve (A) vs client patch (B).
2. Concern 2 Event history: OK that only **group-barcode** location updates show in Event history (individual-item updates have no event)?
3. Concern 2 DO history: build a net-new DO history section? Precise (stamped `deliveryOrderId` + index) vs simple (query by DO's item set)?
