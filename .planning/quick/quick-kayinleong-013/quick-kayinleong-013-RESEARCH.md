# quick-kayinleong-013 — RESEARCH: Group-barcode Location write targets the wrong item

**Researched:** 2026-06-09
**Domain:** Scan → Location check-in flow; group-barcode → inventory location write.
**Confidence:** HIGH on the data model & code paths; MEDIUM on which of two data-condition root causes the user hit (needs one Firestore read to disambiguate — see "Decisive check").

---

## Root cause (lead)

**There is no "master item" vs "item in group" at the data layer.** Every inventory item is exactly one `inventory/{itemId}` document, and **`itemId === sku === Firestore doc id`** is an invariant of this codebase:

- Items are created with `adminDb.collection("inventory").doc(data.sku)` — `app/(app)/inventory/actions.ts:53`.
- Read-back maps `id: snap.id` and `sku: snap.id` — `lib/data/inventory.server.ts:48-49`.

A `checkoutGroups` doc carries a denormalized `itemLines: { itemId, itemSku, itemName, qty }[]` snapshot — `lib/types/checkout-group.ts:11-26`. The group's `itemLines[].itemId` is supposed to BE that same `inventory/{id}` doc id.

The Location write path (`updateItemsLocationAction`, group branch) is **structurally correct**: it expands `group.itemLines[].itemId` and writes `location` to `inventory/{itemId}` for each — `app/(app)/scan/actions.ts:182-200`. It does NOT write to a "master." So the symptom "master got klcc, member stayed one utama" can only mean **the `itemId` stored in the group's `itemLines` resolves to a different inventory doc than the physical item the user calls the 'item in group.'**

In other words: the wrong document is selected **at group-creation time** (the `itemId` baked into `checkoutGroups.itemLines` is the "master's" id), not in the resolver or the writer. Two concrete mechanisms can produce this, ranked:

### Hypothesis A (most likely): the group's `itemLines[].itemId` literally points to the master's inventory doc.
The cart line `itemId` is set in `addLine` from the resolved live-inventory item's `.id` — `components/feature/scan/scan-session.tsx:378` (`itemId: item.id`). Resolution order there is: SKU match → **`item.id === trimmed`** → `externalBarcode === trimmed` (`:323-325`). If the "master" and the "item in group" are two distinct inventory docs that share an `externalBarcode`, OR the user scanned/typed a value during checkout that matched the master's SKU/id, the cart line — and therefore the group's `itemLines[].itemId` — captured the **master's** id. At Location time the group then faithfully writes to the master and never touches the member. The member is untouched because it was never in `itemLines`.

### Hypothesis B (possible): resolution-order collision in `updateItemsLocationAction` Step 1/2.
`updateItemsLocationAction` resolves the scanned value in this order — `app/(app)/scan/actions.ts:78, 103-107, 133`:
1. `inventory.doc(barcodeValue)` (Step 1, :78) — exact doc-id/SKU.
2. `inventory.where("externalBarcode","==",barcodeValue)` (Step 2, :103).
3. `checkoutGroups.doc(barcodeValue)` (Step 3, :133).

A group barcode is a Firestore auto-id, so Steps 1–2 will normally miss and Step 3 wins. BUT if the **master item's `externalBarcode` (or SKU) equals the value encoded in the scanned group label**, Step 1/2 short-circuits and writes ONLY the master as a single `resolvedAs: "item"` update (:82-99) — never reaching the group expansion. This exactly reproduces "master → klcc, member unchanged." The scanned payload comes from `PrintLabelButton`, whose value is `externalBarcode?.trim() || sku` — `components/feature/inventory/PrintLabelButton.tsx:45`; the group label passes `sku={groupId}` with no externalBarcode (`DODetailActions.tsx:168-169`, `CheckoutGroupDialog.tsx:321-324`), so the group QR encodes the group id. Collision only bites if a master item's SKU/externalBarcode happens to equal that group id string — unlikely for auto-ids, but possible if the user is scanning an **item** label (master) while believing it's the group, or if externalBarcode data is dirty.

**Both hypotheses converge on the same fix direction:** make the write authoritative on group-expanded member ids and prove `itemLines` integrity. A & B are distinguished by one Firestore read (below).

---

## Decisive check (do this first in the fix)

Read the actual `checkoutGroups/{scannedId}` doc the user scanned and inspect `itemLines[].itemId`:
- If `itemId` == the **master's** doc id → **Hypothesis A** (bad data baked at group creation). Fix is at creation/resolution, plus a data correction for the existing group.
- If `itemLines` contains the **member's** correct id but the master still changed → **Hypothesis B** (resolution-order short-circuit in `updateItemsLocationAction`), confirm the master's `externalBarcode`/`sku` against the scanned value.

This is a `console.log`/one-off admin read, not a schema change.

---

## Fix surface (minimal)

Primary file: **`app/(app)/scan/actions.ts`** — `updateItemsLocationAction` (`:49-210`).

1. **Disambiguate resolution priority (covers Hyp. B).** A scanned value that is a valid `checkoutGroups` doc id must be treated as a GROUP even if it coincidentally matches an item SKU/externalBarcode. Two safe options:
   - (Preferred, scoped) The Location panel already knows what it resolved (`resolveLocationBarcodeAction` returns `resolvedAs: "item" | "group"` — `:45-46, 288`). Thread that classification into `updateItemsLocationAction` (add an optional `resolvedAs`/`expectGroup` arg) and, when it's a group, **skip Steps 1–2** and go straight to the `checkoutGroups` branch. Keeps the existing branches intact for individual-item check-in.
   - (Alternative) Reorder so `checkoutGroups.doc(barcodeValue)` is checked **before** the inventory SKU/externalBarcode lookups. Lower-risk per-call but changes resolution semantics globally — verify it can't slow or mis-resolve item-only scans.

2. **Verify/repair `itemLines` integrity (covers Hyp. A).** If the decisive check shows `itemLines[].itemId` pointing at the master, the defect is upstream in group creation (`scan-session.tsx:378` cart `itemId`, fed through `CheckoutGroupDialog.tsx:135-140`). The minimal in-scope fix is at the write boundary: when expanding a group, **re-read each `inventory/{itemId}` and confirm it exists**; the action already loops member ids (`:183-199`) — add an `itemSnap.exists` guard and skip/report missing members instead of silently writing nothing. The bad existing group doc itself needs a one-off data correction (out of code scope; flag for the user).

3. **No change needed** to: `LocationPanel.tsx` (submits the raw scanned `barcode` at `:141` and faithfully renders `resolvedAs` from the resolver), `resolveLocationBarcodeAction` (read-only preview, correct group expansion at `:268-289`), the transaction/history layer from quick-012.

Estimated change: ~15–40 LOC in `scan/actions.ts` (+ optional one extra arg threaded from `LocationPanel.tsx:140-143`), plus a one-off data fix for the affected group doc.

---

## Trace evidence (file:line)

| Step | Location | What it does |
|------|----------|--------------|
| Data model | `lib/types/item.ts:16-62` | `InventoryItem.id` == doc id == sku; single doc per item. No master/member concept. |
| id==sku invariant | `app/(app)/inventory/actions.ts:53`; `lib/data/inventory.server.ts:48-49` | doc created at `.doc(sku)`; read back `id=sku=snap.id`. |
| Group doc shape | `lib/types/checkout-group.ts:11-26` | `itemLines[] = {itemId, itemSku, itemName, qty}` denormalized at write. |
| Group creation | `scan-session.tsx:378` → `CheckoutGroupDialog.tsx:135-140` → `events/[eventId]/checkout/actions.ts:255-290` | cart `itemId: item.id` flows verbatim into `itemLines[].itemId`. **Origin of Hyp. A bad data.** |
| Scanned payload | `PrintLabelButton.tsx:45` (`externalBarcode \|\| sku`); group label `DODetailActions.tsx:168-169`, `CheckoutGroupDialog.tsx:321-324` (`sku={groupId}`) | group QR encodes the group id. |
| Panel submit | `LocationPanel.tsx:140-143` | passes raw scanned `barcode` as `barcodeValue`; never resends a resolved id. |
| Resolve (preview) | `resolveLocationBarcodeAction` `scan/actions.ts:220-292`; group expand `:268-289` | read-only; returns member ids from `itemLines`. Correct. |
| **Write (group)** | `updateItemsLocationAction` group branch `scan/actions.ts:133-206`; member write loop `:183-199` | writes `inventory/{itemId}` for each `itemLines[].itemId`. Correct IF `itemLines` ids are right. |
| **Write (item short-circuit)** | `scan/actions.ts:78-100` (Step 1) and `:103-130` (Step 2) | exact-id / externalBarcode match writes ONE item and returns. **Hyp. B reproduction site.** |

---

## Regression surface (must keep working)

- **Individual-item Location check-in** — the Step 1/Step 2 item branches (`:78-130`) must still write the single scanned item. Don't break them when adding group-priority.
- **Check-out group resolution shares the same `checkoutGroups` + `itemLines` shape.** Don't alter `itemLines` schema or `createCheckoutGroupAction` (`events/[eventId]/checkout/actions.ts:255-290`); a change there ripples into checkout, DO detail (`delivery-orders/[doId]/page.tsx`), and check-in.
- **Location transaction stamping (quick-012)** must remain: one `location` tx per affected item, in the SAME batch, with `eventId/eventName/deliveryOrderId` for groups (`scan/actions.ts:62-75, 158-199`). If you skip a missing member, also skip its tx so history stays truthful.
- **Atomic batch** — group write is a single `adminDb.batch()` committed once (`:182, :200`); keep it atomic (all members + their txs, or none).
- **Check-in mode rejects group barcodes** (`scan-session.tsx:331-338`); Location mode intentionally accepts them. Don't cross-contaminate.

---

## Gotchas (per CLAUDE.md / AGENTS.md)

- **Admin SDK on server only.** All resolution/writes here run in `"use server"` actions with `adminDb` + `requireSession()` (`scan/actions.ts:27-30, 52, 223`). Do NOT reintroduce a client Web-SDK `getDoc` (that was the quick-012 regression). The fix stays server-side.
- **Next.js 16 breaking changes** — server actions, `revalidatePath` already used correctly here; no new App-Router API needed for this fix. Read `node_modules/next/dist/docs/` before touching any framework surface.
- **Three-layer quantity invariant is NOT engaged by Location updates** — `qty: 0` location txs (`:64`), no `availableQty`/`outQty` mutation. The fix must not introduce quantity math; it only touches the `location` field + audit tx.
- **`array-contains` on `checkoutGroupIds`** (DO attribution, `:169-173`) needs no composite index (single-field auto-index) — unchanged.
- **Don't widen the fix** (global rule): this is a targeted resolution/data-integrity bug. No refactor of the resolver, no schema changes beyond an optional threaded arg. Data correction of the existing bad group doc is a separate, user-confirmed step.

---

## Open questions (for planner / user)

1. **Which hypothesis?** Run the Decisive check on the user's actual group + master ids before coding. A → fix data + add member-existence guard; B → fix resolution priority. (Both fixes are compatible and small; can ship together.)
2. **Existing bad group doc** (if Hyp. A): does the user want a one-off correction of `itemLines[].itemId` for the affected group, or just forward-fix so new groups are correct?
3. **Master/member sharing an `externalBarcode`?** If two inventory items legitimately share an externalBarcode, that is a data-quality issue beyond this claim — flag separately.

---

## Sources

- Codebase reads (HIGH): `app/(app)/scan/actions.ts`, `components/feature/scan/LocationPanel.tsx`, `components/feature/scan/scan-session.tsx`, `app/(app)/events/[eventId]/checkout/actions.ts`, `app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx`, `app/(app)/inventory/actions.ts`, `lib/data/inventory.server.ts`, `lib/types/{item,checkout-group}.ts`, `lib/schemas/checkout-group.ts`, `components/feature/inventory/PrintLabelButton.tsx`, `components/feature/delivery-orders/DODetailActions.tsx`.
- Prior claim (HIGH): `.planning/quick/quick-kayinleong-012/{CLAIM,AUDIT,PLAN}.md`.
