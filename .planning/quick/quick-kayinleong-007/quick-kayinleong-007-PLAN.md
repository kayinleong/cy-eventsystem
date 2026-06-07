---
phase: quick-kayinleong-007
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/feature/scan/scan-session.tsx
  - components/feature/scan/ScannerWidget.tsx
  - components/feature/scan/LocationPanel.tsx
  - app/(app)/scan/actions.ts
  - app/(app)/scan/page.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Staff can switch to a Location tab on /scan"
    - "Scanning an item barcode (SKU or externalBarcode) shows a preview of the matched item(s) before location is entered"
    - "Scanning a group barcode shows a preview of all items in the group before location is entered"
    - "Staff types a free-text location and taps Update location to commit"
    - "Firestore inventory docs are updated with the new location value"
    - "Success toast is shown and the panel resets for the next scan"
    - "Unrecognised barcodes show an inline error — no crash"
  artifacts:
    - path: "components/feature/scan/LocationPanel.tsx"
      provides: "Self-contained location scan UI with preview and submit"
    - path: "app/(app)/scan/actions.ts"
      provides: "updateItemsLocationAction Server Action"
      exports: ["updateItemsLocationAction", "UpdateItemsLocationResult"]
  key_links:
    - from: "components/feature/scan/LocationPanel.tsx"
      to: "app/(app)/scan/actions.ts"
      via: "updateItemsLocationAction call on confirm"
      pattern: "updateItemsLocationAction"
    - from: "app/(app)/scan/page.tsx"
      to: "components/feature/scan/LocationPanel.tsx"
      via: "mode === 'location' conditional render"
      pattern: "mode.*location"
---

<objective>
Add a third "Location" tab to the /scan page that lets staff scan an individual
item barcode (SKU or externalBarcode) or a group barcode (checkoutGroups doc ID),
shows a preview of resolved items, accepts a free-text location, and batch-updates
the location field on all affected inventory docs via a new Server Action.

Purpose: Staff can update where items are stored without going to each inventory
detail page.

Output: New `LocationPanel` component, new `app/(app)/scan/actions.ts` Server
Action, widened `ScanMode` type, third tab wired in scan page, `ScannerWidget`
patched to operate without a selected event.
</objective>

<execution_context>
@/Users/ka.yin.leong/.claude/get-shit-done/workflows/execute-plan.md
@/Users/ka.yin.leong/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/ka.yin.leong/Documents/cy-eventsystem/.planning/STATE.md
@/Users/ka.yin.leong/Documents/cy-eventsystem/CLAUDE.md

<interfaces>
<!-- Key types and contracts extracted from codebase for executor. -->

From components/feature/scan/scan-session.tsx:
```typescript
// Current ScanMode — must be widened to include "location"
export type ScanMode = "checkout" | "checkin";

export type ScanSessionContextValue = {
  mode: ScanMode;
  setMode: (m: ScanMode) => void;
  selectedEvent: EventDoc | null;
  selectEvent: (event: EventDoc) => void;
  endSession: () => void;
  cart: ScanCartLine[];
  addLine: (skuOrId: string) => { ok: true } | { ok: false; reason: string };
  removeLine: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;
  commit: () => Promise<void>;
  isCommitting: boolean;
};

// ScanSessionProvider props:
{
  initialMode?: ScanMode;
  initialEvent?: EventDoc | null;
  onCommitSuccess?: (payload: CommitSuccessPayload) => void;
  children: React.ReactNode;
}
```

From components/feature/scan/ScannerWidget.tsx:
```typescript
// Current signature — needs eventRequired prop added
export function ScannerWidget({ paused = false }: { paused?: boolean })

// Critical: line 98 — isPaused currently gates on !selectedEvent
const isPaused = paused || !active || !selectedEvent || !!permissionError;
// For location mode this must become:
// const isPaused = paused || !active || (!eventRequired && false || (eventRequired && !selectedEvent)) || !!permissionError;
// i.e. when eventRequired=false, selectedEvent absence does NOT pause

// Line 191 in the tap-to-start placeholder:
disabled={!selectedEvent}   // must be disabled={eventRequired && !selectedEvent}
// Line 186 copy: "Pick an event below before scanning." — must only show when eventRequired=true
```

From lib/types/item.ts:
```typescript
export interface InventoryItem {
  id: string;       // === sku (PROJECT.md key decision #14)
  sku: string;
  name: string;
  externalBarcode: string;  // "" when absent
  location: string;
  // ... other fields
}
```

From lib/types/checkout-group.ts:
```typescript
export interface CheckoutGroupDoc {
  id: string;       // Firestore auto-ID, 20-char alphanumeric
  itemLines: CheckoutGroupItemLine[];
  // ...
}
export interface CheckoutGroupItemLine {
  itemId: string;
  itemSku: string;
  itemName: string;
  qty: number;
}
```

From app/(app)/inventory/actions.ts (Admin SDK pattern):
```typescript
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
// adminDb.writeBatch() for multi-doc writes
// adminDb.collection("inventory").doc(id) for single doc
```

From lib/auth/dal.ts:
```typescript
// Staff-accessible: requireSession()
// Admin-only: requireAdmin()
// Location update is staff-accessible → use requireSession()
```

From app/(app)/scan/page.tsx (current Tabs structure):
```tsx
<Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
  <TabsList>
    <TabsTrigger value="checkout">Check out</TabsTrigger>
    <TabsTrigger value="checkin">Check in</TabsTrigger>
  </TabsList>
</Tabs>
```

Barcode resolution order in Server Action (per research Pitfall 4):
1. adminDb.collection("inventory").doc(barcodeValue).get()  — O(1) SKU == doc ID
2. adminDb.collection("inventory").where("externalBarcode", "==", barcodeValue).limit(1).get()
3. adminDb.collection("checkoutGroups").doc(barcodeValue).get()
4. If all miss → { ok: false, error: "Barcode not recognised" }
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Server Action + ScanMode widen + ScannerWidget patch</name>
  <files>
    app/(app)/scan/actions.ts
    components/feature/scan/scan-session.tsx
    components/feature/scan/ScannerWidget.tsx
  </files>
  <action>
**1a. Create `app/(app)/scan/actions.ts`** (new file):

```typescript
"use server";

import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const UpdateItemsLocationSchema = z.object({
  barcodeValue: z.string().min(1),
  location: z.string().max(100),
});

export type UpdateItemsLocationResult =
  | { ok: true; updatedItemIds: string[]; resolvedAs: "item" | "group" }
  | { ok: false; error: string };

export async function updateItemsLocationAction(
  input: unknown,
): Promise<UpdateItemsLocationResult> {
  const session = await requireSession();
  const parsed = UpdateItemsLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { barcodeValue, location } = parsed.data;

  // Step 1: Try SKU / doc ID direct read (O(1) — SKU === doc ID per PROJECT.md)
  const itemSnap = await adminDb.collection("inventory").doc(barcodeValue).get();
  if (itemSnap.exists) {
    const batch = adminDb.writeBatch();
    batch.update(adminDb.collection("inventory").doc(barcodeValue), {
      location,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    });
    await batch.commit();
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${barcodeValue}`);
    return { ok: true, updatedItemIds: [barcodeValue], resolvedAs: "item" };
  }

  // Step 2: Try externalBarcode field match
  const extSnap = await adminDb
    .collection("inventory")
    .where("externalBarcode", "==", barcodeValue)
    .limit(1)
    .get();
  if (!extSnap.empty) {
    const doc = extSnap.docs[0];
    const batch = adminDb.writeBatch();
    batch.update(adminDb.collection("inventory").doc(doc.id), {
      location,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    });
    await batch.commit();
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${doc.id}`);
    return { ok: true, updatedItemIds: [doc.id], resolvedAs: "item" };
  }

  // Step 3: Try checkoutGroups doc ID
  const groupSnap = await adminDb
    .collection("checkoutGroups")
    .doc(barcodeValue)
    .get();
  if (groupSnap.exists) {
    const group = groupSnap.data() as { itemLines?: { itemId: string }[] };
    const itemIds = [
      ...new Set((group.itemLines ?? []).map((l) => l.itemId)),
    ];
    if (itemIds.length === 0) {
      return { ok: false, error: "Group has no items." };
    }
    const batch = adminDb.writeBatch();
    for (const itemId of itemIds) {
      batch.update(adminDb.collection("inventory").doc(itemId), {
        location,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      });
    }
    await batch.commit();
    revalidatePath("/inventory");
    for (const itemId of itemIds) {
      revalidatePath(`/inventory/${itemId}`);
    }
    return { ok: true, updatedItemIds: itemIds, resolvedAs: "group" };
  }

  return { ok: false, error: "Barcode not recognised." };
}
```

**1b. Widen `ScanMode` in `components/feature/scan/scan-session.tsx`:**

Change line 78:
```typescript
// Before:
export type ScanMode = "checkout" | "checkin";
// After:
export type ScanMode = "checkout" | "checkin" | "location";
```

Also update the sessionStorage validation guard at line 124 which checks
`parsed.mode !== "checkout" && parsed.mode !== "checkin"`. Widen it to:
```typescript
if (
  parsed.mode !== "checkout" &&
  parsed.mode !== "checkin" &&
  parsed.mode !== "location"
)
  return null;
```

**1c. Patch `ScannerWidget` to accept `eventRequired` prop:**

Change the function signature from:
```typescript
export function ScannerWidget({ paused = false }: { paused?: boolean })
```
to:
```typescript
export function ScannerWidget({
  paused = false,
  eventRequired = true,
}: {
  paused?: boolean;
  eventRequired?: boolean;
})
```

Update the `isPaused` computation (currently line 98):
```typescript
// Before:
const isPaused = paused || !active || !selectedEvent || !!permissionError;
// After:
const isPaused =
  paused ||
  !active ||
  (eventRequired ? !selectedEvent : false) ||
  !!permissionError;
```

Update the Start camera button `disabled` prop and the placeholder copy:
```tsx
// Before:
disabled={!selectedEvent}
// ...
{selectedEvent
  ? "Tap to start the camera."
  : "Pick an event below before scanning."}

// After:
disabled={eventRequired && !selectedEvent}
// ...
{!eventRequired || selectedEvent
  ? "Tap to start the camera."
  : "Pick an event below before scanning."}
```

All three changes in this task are pure additive/backward-compatible: existing
consumers that do not pass `eventRequired` retain current behaviour.
  </action>
  <verify>
    <automated>cd /Users/ka.yin.leong/Documents/cy-eventsystem && npx tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `app/(app)/scan/actions.ts` exists and exports `updateItemsLocationAction` + `UpdateItemsLocationResult`.
    - `ScanMode` union includes `"location"`.
    - `ScannerWidget` accepts `eventRequired?: boolean` (default `true`); existing call sites unchanged.
    - `npx tsc --noEmit` exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 2: LocationPanel component + scan page wiring</name>
  <files>
    components/feature/scan/LocationPanel.tsx
    app/(app)/scan/page.tsx
  </files>
  <action>
**2a. Create `components/feature/scan/LocationPanel.tsx`** (new file):

This component owns its own local state and does NOT use `ScanSessionProvider`'s
cart/commit model. It renders a scanner + manual entry for barcode capture, then
shows a preview of resolved items (from the `useInventoryLive` snapshot for
individual items, or an empty placeholder while a group resolve is pending), then
an `<Input>` for the free-text location.

```tsx
// quick-kayinleong-007 — Location-tracking scan panel.
//
// Does NOT participate in the ScanSessionProvider cart flow. Each scan is an
// immediate update — no cart accumulation. The panel holds its own local state:
//   pendingBarcode: the scanned value awaiting location entry
//   resolvedItems: preview list of { id, name, sku } resolved from snapshot
//   locationValue: the typed location string
//   status: idle | resolving | submitting | done | error
//
// Resolution UX per open question resolution:
//   - Show a preview of matched items BEFORE the user types a location.
//   - Individual items: resolved from useInventoryLive snapshot (instant).
//   - Group barcodes: not in the snapshot; show a "N items in this group"
//     placeholder using the Server Action's resolvedAs="group" response OR
//     do a client-side checkoutGroups getDoc for the preview (since the rule
//     allows isSignedIn reads). For simplicity and to avoid an extra client
//     import, the preview for groups is surfaced AFTER the Server Action
//     resolves (the action returns updatedItemIds which we display in a
//     success toast). For individual items the snapshot preview is immediate.
//
// Pitfall 3 avoidance: passes eventRequired={false} to ScannerWidget so the
// camera activates without a selected event.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { ScannerWidget } from "./ScannerWidget";
import { ManualEntryInput } from "./ManualEntryInput";
import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
import {
  updateItemsLocationAction,
  type UpdateItemsLocationResult,
} from "@/app/(app)/scan/actions";

type PreviewItem = { id: string; name: string; sku: string };

type PanelState =
  | { phase: "idle" }
  | { phase: "preview"; barcode: string; items: PreviewItem[] }
  | { phase: "submitting"; barcode: string; items: PreviewItem[] }
  | { phase: "done" };
```

State flow:
- `idle`: show scanner + manual entry, no barcode captured yet.
- `preview`: barcode was scanned and resolved from snapshot. Show item name(s)
  + location input + "Update location" button.
- `submitting`: Server Action in flight. Disable controls.
- `done`: transient — flash success then reset to idle after 1.5 s.

Implementation details:

The `handleBarcode(value: string)` callback:
1. Looks up `value` in `items` (from `useInventoryLive`) using the same three
   checks as `scan-session.addLine`: lowercase SKU match, exact ID match,
   externalBarcode match.
2. If found: sets state to `{ phase: "preview", barcode: value, items: [{ id, name, sku }] }`.
3. If not found: sets state to `{ phase: "preview", barcode: value, items: [] }`.
   An empty items list means "could be a group barcode or unknown — type
   location and confirm to find out".

The "Update location" button:
- Disabled when `locationValue.trim() === ""`.
- On click: set `phase: "submitting"`, call `await updateItemsLocationAction({ barcodeValue, location })`.
- On `ok: true`: show `toast.success("Location updated", { description: \`${result.updatedItemIds.length} item(s) → "${location}"\` })`, reset to idle.
- On `ok: false`: show `toast.error("Update failed", { description: result.error })`, return to preview state (user can re-try or change barcode by pressing "Scan different barcode").

The "Scan different barcode" button in preview/submitting state: resets to idle.

The ScannerWidget must receive `eventRequired={false}` so location scans work
without a selected event (see Pitfall 3 in research).

The ManualEntryInput's `onSubmit` calls `handleBarcode`.

The ScannerWidget dispatches to `useScanSession().addLine` internally — this
creates a problem: in location mode the barcode should NOT go into the cart.
Solution: provide a custom scan handler by wrapping with an `onScan`-like
override. However, `ScannerWidget` currently calls `useScanSession().addLine`
internally and does not accept an `onScan` override.

**Correct approach for Task 2:** Refactor `ScannerWidget` to accept an optional
`onScan?: (value: string) => void` prop. When `onScan` is provided it is called
instead of `addLine`. When absent, `addLine` is called (existing behaviour
unchanged). This is a small additive change to ScannerWidget that also belongs
in this task's `files` list — add `components/feature/scan/ScannerWidget.tsx`
to modified files.

Update ScannerWidget's `handleScan` function:
```typescript
function handleScan(results: IDetectedBarcode[]) {
  const value = results[0]?.rawValue;
  if (!value) return;
  const now = Date.now();
  if (
    lastValue.current &&
    lastValue.current.value === value &&
    now - lastValue.current.at < 1500
  ) {
    return;
  }
  lastValue.current = { value, at: now };
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(50);
  }
  if (onScan) {
    onScan(value);
  } else {
    addLine(value);
  }
}
```

Add `onScan?: (value: string) => void` to ScannerWidget's props type alongside
`paused` and `eventRequired`.

**LocationPanel full JSX structure:**
```tsx
export function LocationPanel() {
  const { items } = useInventoryLive([], { limit: 500 });
  const [state, setState] = useState<PanelState>({ phase: "idle" });
  const [locationValue, setLocationValue] = useState("");

  function handleBarcode(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const matched =
      items.find((i) => i.sku.toLowerCase() === lower) ??
      items.find((i) => i.id === trimmed) ??
      items.find((i) => i.externalBarcode !== "" && i.externalBarcode === trimmed);
    setState({
      phase: "preview",
      barcode: trimmed,
      items: matched ? [{ id: matched.id, name: matched.name, sku: matched.sku }] : [],
    });
    setLocationValue("");
  }

  async function handleSubmit() {
    if (state.phase !== "preview") return;
    const { barcode, items: previewItems } = state;
    setState({ phase: "submitting", barcode, items: previewItems });
    const result: UpdateItemsLocationResult = await updateItemsLocationAction({
      barcodeValue: barcode,
      location: locationValue.trim(),
    });
    if (result.ok) {
      toast.success("Location updated", {
        description: `${result.updatedItemIds.length} item(s) → "${locationValue.trim()}"`,
      });
      setState({ phase: "idle" });
      setLocationValue("");
    } else {
      toast.error("Update failed", { description: result.error });
      setState({ phase: "preview", barcode, items: previewItems });
    }
  }

  const isPreviewOrSubmitting =
    state.phase === "preview" || state.phase === "submitting";
  const isSubmitting = state.phase === "submitting";

  return (
    <div className="space-y-6">
      {/* Scanner — only visible in idle phase */}
      {state.phase === "idle" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <ScannerWidget
              eventRequired={false}
              onScan={handleBarcode}
            />
            <ManualEntryInput onSubmit={handleBarcode} disabled={false} />
          </div>
          <div className="rounded-lg border border-dashed p-6 flex flex-col items-center justify-center text-center gap-2">
            <MapPin className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Scan an item or group barcode to set its location.
            </p>
          </div>
        </div>
      ) : null}

      {/* Preview + location input */}
      {isPreviewOrSubmitting ? (
        <div className="rounded-lg border p-6 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Scanned barcode</p>
            <p className="font-mono text-sm text-muted-foreground break-all">
              {state.barcode}
            </p>
          </div>

          {/* Item preview */}
          {state.items.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Item{state.items.length > 1 ? "s" : ""} to update
              </p>
              <ul className="space-y-1">
                {state.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="size-4 text-green-500 shrink-0" />
                    <span>{item.name}</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {item.sku}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Could be a group barcode — confirm below to resolve.
            </p>
          )}

          {/* Location input */}
          <div className="space-y-2">
            <Label htmlFor="location-input">New location</Label>
            <Input
              id="location-input"
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value)}
              placeholder="e.g. Warehouse A, Shelf 3"
              maxLength={100}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || locationValue.trim() === ""}
            >
              {isSubmitting ? "Updating…" : "Update location"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setState({ phase: "idle" });
                setLocationValue("");
              }}
              disabled={isSubmitting}
            >
              Scan different barcode
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

**2b. Update `app/(app)/scan/page.tsx`:**

1. Import `LocationPanel`:
   ```typescript
   import { LocationPanel } from "@/components/feature/scan/LocationPanel";
   ```

2. Add a third `<TabsTrigger>` in the Tabs block:
   ```tsx
   <TabsTrigger value="location">Location</TabsTrigger>
   ```

3. Update the `PageHeader` description to handle `"location"` mode:
   ```tsx
   description={
     mode === "checkout"
       ? "Scan items to check them out."
       : mode === "checkin"
         ? "Scan items being returned."
         : "Scan to update item locations."
   }
   ```

4. Render `LocationPanel` when `mode === "location"`, replacing the existing
   scanner grid layout (which requires a selected event). The full conditional
   render in `ScanInner`:
   ```tsx
   {mode === "location" ? (
     <LocationPanel />
   ) : (
     <>
       <ScanHeader />
       {!selectedEvent ? (
         <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
           <p className="text-sm text-muted-foreground">
             Pick an event to begin scanning.
           </p>
           <Button onClick={() => setPickerOpen(true)}>Pick event</Button>
         </div>
       ) : null}
       <div className="grid gap-6 lg:grid-cols-2">
         <div className="space-y-3">
           <ScannerWidget />
           <ManualEntryInput
             onSubmit={(sku) => addLine(sku)}
             disabled={!selectedEvent}
           />
         </div>
         <ScanCartPanel />
       </div>
       <EventPickerDialog
         open={pickerOpen}
         onOpenChange={setPickerOpen}
         onSelect={(e) => selectEvent(e)}
       />
     </>
   )}
   ```

Note: `ScannerWidget` in the non-location block does NOT pass `onScan` — the
existing `addLine` path is preserved exactly.

Also update the `ScannerWidget.tsx` file to add the `onScan` prop (described
above in the LocationPanel section) — this change belongs to Task 2 since
LocationPanel is the consumer. Add `ScannerWidget.tsx` to this task's file
list if not already included.
  </action>
  <verify>
    <automated>cd /Users/ka.yin.leong/Documents/cy-eventsystem && npx tsc --noEmit 2>&1 | tail -20 && npm run lint 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `components/feature/scan/LocationPanel.tsx` exists and renders a scanner + preview + location input.
    - `/scan` page has three tabs: Check out, Check in, Location.
    - Switching to Location tab does not require a selected event.
    - TypeScript and ESLint pass with zero new errors.
    - `npm run build` exits 0 (run as final gate — confirms no SSR issues).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Server Action | `updateItemsLocationAction` accepts a barcode string and location from an untrusted client |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-007-01 | Spoofing | `updateItemsLocationAction` | mitigate | `requireSession()` at action entry; unauthenticated calls throw before any Firestore read |
| T-007-02 | Tampering | `location` field | mitigate | `z.string().max(100)` Zod schema rejects oversized input before any write |
| T-007-03 | Elevation of privilege | location update is staff-accessible | accept | Admin SDK bypasses Firestore rules; auth enforced by `requireSession()` inside the Server Action; consistent with existing staff-accessible actions (checkin) |
| T-007-04 | Information disclosure | barcode-not-found path | accept | Error message "Barcode not recognised." does not reveal whether the doc exists; same message for all non-match cases |
</threat_model>

<verification>
1. `npx tsc --noEmit` — exits 0.
2. `npm run lint` — exits 0, zero new warnings.
3. `npm run build` — exits 0, route count unchanged (no new routes added).
4. Visit `/scan` in dev: three tabs visible (Check out, Check in, Location).
5. Switch to Location tab: camera Start button enabled without picking an event.
6. Manual entry with a known SKU: item preview appears below the scanner.
7. Type a location and click "Update location": success toast and panel resets.
8. Manual entry with an unknown value: "Could be a group barcode" copy shown;
   confirm → "Barcode not recognised." error toast.
9. Existing Check out and Check in tabs: behaviour unchanged (scanner requires
   event, cart accumulates, commit works).
</verification>

<success_criteria>
- `/scan` page renders a third "Location" tab.
- Scanning a known item barcode shows the item name + SKU in preview before location entry.
- Submitting patches `location` on the Firestore inventory doc via `writeBatch`.
- Scanning a group barcode resolves and patches all items in the group.
- Unrecognised barcodes surface an error toast without crashing.
- `npm run build`, `tsc --noEmit`, `npm run lint` all pass with zero new errors.
- Existing checkout and checkin scan flows are unaffected.
</success_criteria>

<output>
After completion, create `.planning/quick/quick-kayinleong-007/quick-kayinleong-007-SUMMARY.md`
following the template at `@/Users/ka.yin.leong/.claude/get-shit-done/templates/summary.md`.

Update `.planning/quick/quick-kayinleong-007/CLAIM.md`:
- Set `status: done`
- Add `completed: 2026-06-07`
- Fill in the `## Verification` section with what was tested and what passed.

Update `.planning/STATE.md` to add a row for `quick-kayinleong-007` in the Quick Tasks table.
</output>
