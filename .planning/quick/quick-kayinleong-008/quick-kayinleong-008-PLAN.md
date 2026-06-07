---
phase: quick-kayinleong-008
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/feature/scan/scan-session.tsx
  - components/feature/scan/ScannerWidget.tsx
  - app/(app)/scan/page.tsx
  - app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx
autonomous: true
requirements:
  - quick-008: reject group barcodes in checkin mode with clear error toast

must_haves:
  truths:
    - "Scanning a checkoutGroups Firestore ID on /scan in checkin mode shows an error toast and does not add the code to the cart"
    - "Scanning a valid item barcode in checkin mode still works identically to before"
    - "Scanning in checkout mode is completely unaffected (no Firestore read, no latency)"
    - "TypeScript and lint pass with the async addLine signature change"
  artifacts:
    - path: "components/feature/scan/scan-session.tsx"
      provides: "async addLine with mode-gated checkoutGroups guard"
      contains: "mode === \"checkin\""
    - path: "components/feature/scan/ScannerWidget.tsx"
      provides: "awaited addLine call"
  key_links:
    - from: "scan-session.tsx addLine"
      to: "checkoutGroups/{trimmed}"
      via: "getDoc from firebase/firestore (client SDK)"
      pattern: "getDoc.*checkoutGroups"
---

<objective>
Guard `addLine` in `scan-session.tsx` against checkout-group barcodes during check-in mode.

Purpose: A staff member scanning a group barcode label (Firestore auto-ID from `checkoutGroups`) at a check-in session currently gets a generic "Item not recognized" error. The fix adds a Firestore `getDoc` probe that fires only when (a) the scan is in checkin mode and (b) the value is not found in the inventory index. If the doc exists in `checkoutGroups`, a precise error toast fires and the code is rejected.

Output: Modified `scan-session.tsx` (async addLine + guard), updated callers in `ScannerWidget.tsx`, `scan/page.tsx`, and `checkout-client.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/ka.yin.leong/Documents/cy-eventsystem/.planning/STATE.md
@/Users/ka.yin.leong/Documents/cy-eventsystem/.planning/quick/quick-kayinleong-008/quick-kayinleong-008-RESEARCH.md

<interfaces>
<!-- Extracted from scan-session.tsx — key types and call sites the executor needs. -->

From components/feature/scan/scan-session.tsx (lines 176–190):
```typescript
export type ScanSessionContextValue = {
  // ...
  addLine: (skuOrId: string) => { ok: true } | { ok: false; reason: string };
  // ...
};
```

Current addLine signature (line 310–311):
```typescript
const addLine = useCallback(
  (skuOrId: string): { ok: true } | { ok: false; reason: string } => {
```

Insertion point (lines 324–331) — add guard BETWEEN item lookup failure and existing "Item not recognized" toast:
```typescript
if (!item) {
  // >>> INSERT GROUP BARCODE GUARD HERE (mode === "checkin" only) <<<
  toast.error("Item not recognized", { ... });
  return { ok: false, reason: "Item not recognized" };
}
```

useCallback dependency array (line 377):
```typescript
  [items, mode],
```
`db` from firebase client is a module-level singleton — do NOT add it to the dependency array.

From firestore.rules (lines 95–99):
```
match /checkoutGroups/{groupId} {
  allow get, list: if isSignedIn();
  ...
}
```
Confirms: no rules change needed — authenticated users can already read checkoutGroups docs.

Callers of addLine (all three must be awaited):
- components/feature/scan/ScannerWidget.tsx line 136: `addLine(value);`
- app/(app)/scan/page.tsx line 88: `onSubmit={(sku) => addLine(sku)}`
- app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx line 61: `onSubmit={(sku) => addLine(sku)}`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make addLine async, add mode-gated group barcode guard, update all callers</name>
  <files>
    components/feature/scan/scan-session.tsx,
    components/feature/scan/ScannerWidget.tsx,
    app/(app)/scan/page.tsx,
    app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx
  </files>
  <action>
**Step 1 — scan-session.tsx: make addLine async and add the guard**

1. Add client SDK imports at the top of the file (after existing imports):
   ```typescript
   import { doc, getDoc } from "firebase/firestore";
   import { db } from "@/lib/firebase/client";
   ```

2. Update `ScanSessionContextValue` type (line 183):
   ```typescript
   addLine: (skuOrId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
   ```

3. Update the `addLine` `useCallback` signature (line 310–311):
   ```typescript
   const addLine = useCallback(
     async (skuOrId: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
   ```

4. Insert the group barcode guard AFTER the item lookup (`if (!item) {`) but BEFORE the existing "Item not recognized" toast. The guard is strictly mode-gated to `"checkin"`:
   ```typescript
   if (!item) {
     // Guard: only in checkin mode — check if this is a checkoutGroups Firestore ID.
     // Group barcodes are auto-IDs with no reliable format heuristic, so a Firestore
     // probe is the only authoritative check (per quick-kayinleong-008 research).
     if (mode === "checkin") {
       const groupSnap = await getDoc(doc(db, "checkoutGroups", trimmed));
       if (groupSnap.exists()) {
         toast.error(
           "Group barcodes cannot be used for check-in. Please scan individual item barcodes.",
         );
         return { ok: false, reason: "Group barcode" };
       }
     }
     // UI-SPEC "No scan match" copy verbatim.
     toast.error("Item not recognized", {
       description:
         "This code isn't in inventory. Check the label or enter the SKU manually.",
     });
     return { ok: false, reason: "Item not recognized" };
   }
   ```

5. The `useCallback` dependency array stays `[items, mode]` — `db` is a module-level singleton, not React state.

**Step 2 — ScannerWidget.tsx: await the call**

Find the line `addLine(value);` (line 136 approx) inside the scan handler function.
Make the handler `async` and await the call:
```typescript
} else {
  await addLine(value);
}
```
The outer handler function containing this line must be made `async` if it isn't already.

**Step 3 — scan/page.tsx: await the onSubmit handler**

Find the ManualEntryInput prop (line 88 approx):
```typescript
onSubmit={(sku) => addLine(sku)}
```
Change to an async arrow function:
```typescript
onSubmit={async (sku) => { await addLine(sku); }}
```

**Step 4 — checkout-client.tsx: await the onSubmit handler**

Find the ManualEntryInput prop (line 61 approx):
```typescript
onSubmit={(sku) => addLine(sku)}
```
Change to:
```typescript
onSubmit={async (sku) => { await addLine(sku); }}
```
Note: The guard is mode-gated internally — checkout mode will not trigger the Firestore read. This change is purely to satisfy the TypeScript async signature.
  </action>
  <verify>
    <automated>cd /Users/ka.yin.leong/Documents/cy-eventsystem && npx tsc --noEmit && npm run lint</automated>
  </verify>
  <done>
    - `addLine` has return type `Promise&lt;{ ok: true } | { ok: false; reason: string }&gt;`
    - Guard fires only when `mode === "checkin"` AND item not found in inventory
    - `toast.error("Group barcodes cannot be used for check-in. Please scan individual item barcodes.")` is the exact error message used
    - All three callers (`ScannerWidget`, `scan/page.tsx`, `checkout-client.tsx`) await the call
    - `tsc --noEmit` exits 0, `npm run lint` exits 0
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Firestore | `getDoc` uses the authenticated user's session — rules require `isSignedIn()`, which is enforced by the Firestore SDK automatically |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-008-01 | Information Disclosure | `addLine` Firestore probe | accept | `getDoc` on a non-existent doc returns `exists()=false` without error; no document data is returned if the group doc is found — only `exists()` is checked. No PII exposed. |
| T-008-02 | Denial of Service | Rapid checkin-mode scans triggering getDoc | accept | Guard fires only on `!item` (inventory miss), which is an error branch. Legitimate scans (item found) incur zero extra reads. Rapid bad scans would need to repeatedly miss inventory AND send valid checkoutGroup IDs — already a degenerate case. |
</threat_model>

<verification>
1. `npx tsc --noEmit` — exit 0
2. `npm run lint` — exit 0 (only pre-existing TanStack/rhf warnings allowed)
3. Manual smoke: on `/scan` in checkin mode, scanning a string that matches a `checkoutGroups` doc ID should produce the prescribed toast and not add to cart
4. Manual smoke: on `/scan` in checkout mode, scanning the same ID should produce "Item not recognized" (no group check)
</verification>

<success_criteria>
- Group barcode Firestore probe is mode-gated to checkin only
- Prescribed error message fires exactly as specified
- All callers await the async addLine
- TypeScript and lint pass clean
- Checkout mode scan latency is unchanged (no extra Firestore read on the happy path)
</success_criteria>

<output>
After completion, create `.planning/quick/quick-kayinleong-008/quick-kayinleong-008-SUMMARY.md` per the summary template.
</output>
