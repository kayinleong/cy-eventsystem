---
phase: quick-kayinleong-006
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/types/checkout-group.ts
  - lib/schemas/checkout-group.ts
  - app/(app)/events/[eventId]/checkout/actions.ts
  - app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx
  - app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx
  - components/feature/scan/scan-session.tsx
  - firestore.rules
  - firestore.indexes.json
autonomous: true
requirements:
  - quick-kayinleong-006

must_haves:
  truths:
    - "After a successful checkout, a dialog appears offering group barcode generation"
    - "User can choose one barcode for all items or split into N groups (2-10)"
    - "Each group barcode is created as a Firestore checkoutGroups document"
    - "Each group shows a printable label using the existing PrintLabelButton"
    - "Skipping the dialog navigates to the event page normally"
    - "Firestore rules enforce that only event members can create checkoutGroups documents"
  artifacts:
    - path: lib/types/checkout-group.ts
      provides: CheckoutGroupDoc type
      exports: [CheckoutGroupDoc]
    - path: lib/schemas/checkout-group.ts
      provides: Zod input schema for createCheckoutGroupAction
      exports: [CreateCheckoutGroupInputSchema, CreateCheckoutGroupInput]
    - path: app/(app)/events/[eventId]/checkout/actions.ts
      provides: createCheckoutGroupAction Server Action
      exports: [createCheckoutGroupAction, CreateCheckoutGroupResult]
    - path: app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx
      provides: Post-checkout group barcode dialog component
      exports: [CheckoutGroupDialog, CommitSuccessPayload]
    - path: components/feature/scan/scan-session.tsx
      provides: onCommitSuccess callback prop + deferred navigation
    - path: firestore.rules
      provides: checkoutGroups collection rule block
    - path: firestore.indexes.json
      provides: checkoutGroups eventId + createdAt composite index
  key_links:
    - from: checkout-client.tsx
      to: scan-session.tsx
      via: onCommitSuccess prop
      pattern: "onCommitSuccess"
    - from: CheckoutGroupDialog.tsx
      to: createCheckoutGroupAction
      via: direct import + await call
      pattern: "createCheckoutGroupAction"
    - from: CheckoutGroupDialog.tsx
      to: PrintLabelButton
      via: import + render per group
      pattern: "PrintLabelButton"
---

<objective>
Add post-checkout group barcode generation: after a successful checkout, surface a dialog where the user can generate one barcode (for all items) or split into N groups. Each group creates a Firestore `checkoutGroups` document and renders a printable label using the existing `PrintLabelButton` infrastructure.

Purpose: Enables physical grouping of checked-out items for transport and scanning at check-in (quick-007/quick-008 foundation).
Output: 2 new type/schema files, 1 modified Server Action file, 1 new dialog component, 2 modified files (scan-session, checkout-client), updated firestore.rules + firestore.indexes.json.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/quick-kayinleong-006/quick-kayinleong-006-RESEARCH.md
@.planning/STATE.md
</context>

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From components/feature/scan/scan-session.tsx (current ScanSessionProvider props):
```typescript
export function ScanSessionProvider({
  initialMode = "checkout",
  initialEvent = null,
  children,
}: {
  initialMode?: ScanMode;
  initialEvent?: EventDoc | null;
  children: React.ReactNode;
})

export type ScanCartLine = {
  itemId: string;
  itemSku: string;
  itemName: string;
  qty: number;
  // (other fields — read the full type definition)
}
```

From app/(app)/events/[eventId]/checkout/actions.ts (existing export):
```typescript
// commitCheckoutCartAction returns:
type CheckoutResult =
  | { ok: true; txIds: string[] }
  | { ok: false; failedLines: FailedLine[] }
```

From components/feature/inventory/PrintLabelButton.tsx:
```typescript
// Reusable as-is — pass group doc ID as sku, group label as name
<PrintLabelButton sku={groupId} name={groupLabel} />
```

From firestore.rules (existing isMember helper):
```javascript
function isMember(eventDoc) {
  return isSignedIn() && (
    isAdmin()
    || request.auth.uid in eventDoc.data.allowedStaff
  );
}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Type, schema, and Server Action — checkoutGroups foundation</name>
  <files>
    lib/types/checkout-group.ts,
    lib/schemas/checkout-group.ts,
    app/(app)/events/[eventId]/checkout/actions.ts,
    firestore.rules,
    firestore.indexes.json
  </files>
  <action>
**lib/types/checkout-group.ts** — Create the document type:

```typescript
import type { FieldValue } from "firebase-admin/firestore";

export type CheckoutGroupItemLine = {
  itemId: string;
  itemSku: string;
  itemName: string;
  qty: number;
};

export type CheckoutGroupDoc = {
  id: string;                  // == Firestore doc ID; also the barcode payload
  eventId: string;             // for rule enforcement + future queries
  txIds: string[];             // transaction IDs from commitCheckoutCartAction
  itemLines: CheckoutGroupItemLine[];  // denormalized at write time (AUD-01 pattern)
  label: string;               // human-readable, e.g. "Group 1 of 2 — Spring Demo"
  createdAt: FieldValue | Date;
  createdBy: string;           // session.uid
};
```

**lib/schemas/checkout-group.ts** — Zod schema for the Server Action input. Use Zod 4 top-level constructors per D-01-01-C (no `z.string().min()` deprecated chains — use `z.string().min(1)` is fine; `z.email()` / `z.url()` are the Zod 4 top-level forms that replaced the deprecated string chain forms):

```typescript
import { z } from "zod";

const CheckoutGroupItemLineSchema = z.object({
  itemId: z.string().min(1),
  itemSku: z.string().min(1),
  itemName: z.string().min(1),
  qty: z.number().int().positive(),
});

export const CreateCheckoutGroupInputSchema = z.object({
  eventId: z.string().min(1),
  txIds: z.array(z.string().min(1)).min(1),
  itemLines: z.array(CheckoutGroupItemLineSchema).min(1),
  label: z.string().min(1).max(120),
});

export type CreateCheckoutGroupInput = z.infer<typeof CreateCheckoutGroupInputSchema>;
```

**app/(app)/events/[eventId]/checkout/actions.ts** — Append a second export below the existing `commitCheckoutCartAction`. Do NOT modify the existing export. Add:

```typescript
// ---- createCheckoutGroupAction (quick-kayinleong-006) ----
import { CreateCheckoutGroupInputSchema, type CreateCheckoutGroupInput } from "@/lib/schemas/checkout-group";
// (import is already at top of file — move if needed; otherwise add alongside existing imports)

export type CreateCheckoutGroupResult =
  | { ok: true; groupId: string }
  | { ok: false; error: string };

export async function createCheckoutGroupAction(
  input: CreateCheckoutGroupInput
): Promise<CreateCheckoutGroupResult> {
  const session = await requireSession();
  // EVT-08 gate — admin OR uid ∈ allowedStaff
  const eventSnap = await adminDb.collection("events").doc(input.eventId).get();
  if (!eventSnap.exists) return { ok: false, error: "Event not found" };
  const eventData = eventSnap.data() as { allowedStaff?: string[]; role?: string };
  const isAdmin = session.role === "admin";
  const isMember = Array.isArray(eventData.allowedStaff) && eventData.allowedStaff.includes(session.uid);
  if (!isAdmin && !isMember) return { ok: false, error: "Access denied" };

  // Validate input
  const parsed = CreateCheckoutGroupInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  // Write document
  const groupRef = adminDb.collection("checkoutGroups").doc();
  await groupRef.set({
    id: groupRef.id,
    eventId: parsed.data.eventId,
    txIds: parsed.data.txIds,
    itemLines: parsed.data.itemLines,
    label: parsed.data.label,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: session.uid,
  });

  return { ok: true, groupId: groupRef.id };
}
```

Note: `requireSession`, `adminDb`, and `FieldValue` are already imported in the file. Verify the existing import block at the top of `actions.ts` and add `CreateCheckoutGroupInputSchema` to the imports only if not present. Check the existing import for `FieldValue` — it may already be `import { FieldValue } from "firebase-admin/firestore"` or similar.

**firestore.rules** — Locate the end of the existing rule blocks (before the final closing `}`). Add a new block for `checkoutGroups`:

```javascript
// -------- checkoutGroups (quick-kayinleong-006) --------
// Admin or event member can create; immutable after creation.
// Any signed-in user can read (scanners resolve group IDs at check-in, quick-008).
match /checkoutGroups/{groupId} {
  allow get, list: if isSignedIn();
  allow create: if isSignedIn()
    && isMember(get(/databases/$(database)/documents/events/$(request.resource.data.eventId)));
  allow update, delete: if false;
}
```

**firestore.indexes.json** — Add composite index for future `eventId` + `createdAt DESC` queries (quick-007/quick-008 preparedness). Append to the `indexes` array:

```json
{
  "collectionGroup": "checkoutGroups",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "eventId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" },
    { "fieldPath": "__name__", "order": "DESCENDING" }
  ]
}
```

Read the current `firestore.indexes.json` first to confirm the exact array structure before appending.
  </action>
  <verify>
    <automated>cd /Users/ka.yin.leong/Documents/cy-eventsystem && npx tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `lib/types/checkout-group.ts` exists with `CheckoutGroupDoc` and `CheckoutGroupItemLine` exported
    - `lib/schemas/checkout-group.ts` exists with `CreateCheckoutGroupInputSchema` exported
    - `actions.ts` exports `createCheckoutGroupAction` and `CreateCheckoutGroupResult` without modifying `commitCheckoutCartAction`
    - `firestore.rules` contains the `checkoutGroups` rule block
    - `firestore.indexes.json` contains the `checkoutGroups` composite index
    - `tsc --noEmit` passes with no new errors
  </done>
</task>

<task type="auto">
  <name>Task 2: CheckoutGroupDialog component + checkout-client + scan-session wiring</name>
  <files>
    app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx,
    app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx,
    components/feature/scan/scan-session.tsx
  </files>
  <action>
**components/feature/scan/scan-session.tsx** — Add `onCommitSuccess` prop and defer navigation.

Read the current `ScanSessionProvider` props interface and `commit()` function body. Make the following targeted changes:

1. Define `CommitSuccessPayload` type (export it — used in CheckoutGroupDialog):
```typescript
export type CommitSuccessPayload = {
  cart: ScanCartLine[];
  txIds: string[];
  eventId: string;
};
```

2. Add optional prop to `ScanSessionProvider`:
```typescript
onCommitSuccess?: (payload: CommitSuccessPayload) => void;
```

3. Inside `commit()`, on `result.ok === true`, BEFORE `setCart([])`:
```typescript
const cartSnapshot = [...cart]; // capture before clearing
clearPersisted();
if (onCommitSuccess) {
  onCommitSuccess({ cart: cartSnapshot, txIds: result.txIds, eventId: selectedEvent.id });
  // Caller controls navigation — do NOT call router.push here
} else {
  router.push(`/events/${selectedEvent.id}`);
  router.refresh();
}
setCart([]);
setIsCommitting(false);
```

Verify the exact location of `setCart([])` and `router.push` in the existing commit success path (RESEARCH §1 verified at lines 393–429). Restructure that block so the existing behavior is preserved when `onCommitSuccess` is not provided.

---

**app/(app)/events/[eventId]/checkout/_components/CheckoutGroupDialog.tsx** — Create the new component:

```
"use client";
```

Props:
```typescript
type CheckoutGroupDialogProps = {
  payload: CommitSuccessPayload;    // from scan-session
  eventName: string;                // shown in group labels, e.g. "Spring Demo"
  onDone: () => void;               // called after all groups created (or skipped)
};
```

Internal state machine (two steps):

**Step 1 — "Generate group barcodes?"**
- Default: `splitCount = 1` (one barcode for all items)
- Input: shadcn `Input` type="number" min=1 max=10 with label "Number of groups"
  - Use the shadcn Input component; no need for QtyStepper here — a plain number input with bounds is sufficient
- Show a preview of how many item lines go into each group (compute via `splitLines` below)
- "Generate" button: disabled while creating; shows loading spinner when `isCreating`
- "Skip" button: calls `onDone()` immediately (navigates to event page without creating groups)

**Step 2 — Preview + print**
- For each group in `groups` (array of `{ groupId: string; label: string; itemLines: ... }`):
  - Show group label (e.g., "Group 1 of 2 — Spring Demo")
  - `<PrintLabelButton sku={group.groupId} name={group.label} />`
- "Done" button: calls `onDone()`

**Split algorithm** (pure function, top of file):
```typescript
function splitLines(
  lines: CommitSuccessPayload["cart"],
  n: number
): CommitSuccessPayload["cart"][] {
  const groups: CommitSuccessPayload["cart"][] = Array.from({ length: n }, () => []);
  lines.forEach((line, i) => groups[i % n].push(line));
  return groups;
}
```

**Group label construction:**
```typescript
function buildGroupLabel(groupIndex: number, totalGroups: number, eventName: string): string {
  if (totalGroups === 1) return eventName;
  return `Group ${groupIndex + 1} of ${totalGroups} — ${eventName}`;
}
```

**"Generate" handler:**
1. Set `isCreating = true`
2. Compute split: `const splitGroups = splitLines(payload.cart, splitCount)`
3. For each split group, call `createCheckoutGroupAction({...})` — call them in parallel via `Promise.all`
4. If ALL succeed: move to step 2 with `groups` state populated
5. If ANY fails: `toast.error("Failed to create group barcode. Try again.")`, stay on step 1
6. Set `isCreating = false`

**Important — Pitfall 3 from RESEARCH:** Only render `PrintLabelButton` after `createCheckoutGroupAction` returns `{ ok: true, groupId }`. Do not render it before.

**Dialog structure:** Use a controlled Dialog (`open` always true — parent controls visibility via `payload` nullability). No DialogTrigger. `onOpenChange` is a no-op (user must use "Skip" or "Done" to close).

```tsx
<Dialog open>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Group barcodes</DialogTitle>
    </DialogHeader>
    {/* step 1 or step 2 content */}
  </DialogContent>
</Dialog>
```

Import `PrintLabelButton` from `@/components/feature/inventory/PrintLabelButton`.
Import `createCheckoutGroupAction`, `CommitSuccessPayload` from their respective files.

---

**app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx** — Wire the dialog.

Read the current file first. Make these targeted changes:

1. Add import: `CommitSuccessPayload` from `scan-session`, `CheckoutGroupDialog` from `./CheckoutGroupDialog`
2. Add state: `const [groupPayload, setGroupPayload] = useState<CommitSuccessPayload | null>(null)`
3. Pass `onCommitSuccess` to `ScanSessionProvider`:
```tsx
<ScanSessionProvider
  initialMode="checkout"
  initialEvent={event}
  onCommitSuccess={(payload) => setGroupPayload(payload)}
>
```
4. Inside the JSX (outside `ScanSessionProvider` but inside the same fragment), add:
```tsx
{groupPayload && (
  <CheckoutGroupDialog
    payload={groupPayload}
    eventName={event.name}
    onDone={() => {
      setGroupPayload(null);
      router.push(`/events/${event.id}`);
      router.refresh();
    }}
  />
)}
```
5. `router` may already be imported. If not, add `const router = useRouter()` at the top of `CheckoutClient`.

Verify that `event.name` is the correct field name by reading the `EventDoc` type from `lib/types/event.ts`.
  </action>
  <verify>
    <automated>cd /Users/ka.yin.leong/Documents/cy-eventsystem && npx tsc --noEmit 2>&1 | tail -20 && npm run lint 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `CheckoutGroupDialog.tsx` exists with two-step flow (split picker → label print)
    - `scan-session.tsx` exports `CommitSuccessPayload` and `ScanSessionProvider` accepts `onCommitSuccess` prop
    - When `onCommitSuccess` is provided, navigation is deferred to the caller; when absent, behavior is unchanged
    - `checkout-client.tsx` renders `CheckoutGroupDialog` after successful commit, with Skip and Done paths both navigating to the event page
    - `tsc --noEmit` passes with no new errors
    - `npm run lint` passes with no new errors (pre-existing warnings acceptable)
  </done>
</task>

<task type="auto">
  <name>Task 3: Build verification and regression check</name>
  <files></files>
  <action>
Run the full verification suite and confirm all gates pass.

1. `npx tsc --noEmit` — must exit 0
2. `npm run lint` — must exit 0 errors (pre-existing TanStack/rhf warnings are out of scope)
3. `npm run build` — must exit 0; confirm route count is unchanged (32 routes expected — no new routes in this task)

If any gate fails, fix the root cause before proceeding. Do not mark complete with failing gates.

After all gates pass, update `.planning/quick/quick-kayinleong-006/CLAIM.md`:
- Status: `done`
- Completed date: today (2026-06-07)
- Add `## Verification` section listing:
  - What was tested (tsc, lint, build)
  - What passed (all three)
  - Regression surface: scan-session commit path, checkout-client rendering, no other checkout flows modified
  - What was ruled out: scan page (`/scan`) still works — `onCommitSuccess` is not passed there, so the existing `router.push` path is unchanged; checkin flow is untouched; inventory and other routes are untouched
  </action>
  <verify>
    <automated>cd /Users/ka.yin.leong/Documents/cy-eventsystem && npm run build 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `tsc --noEmit` exits 0
    - `npm run lint` exits 0 errors
    - `npm run build` exits 0, route count unchanged at 32
    - CLAIM.md updated to `status: done` with Verification section filled
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → createCheckoutGroupAction | Client passes eventId, txIds, itemLines, label — all untrusted until validated server-side |
| createCheckoutGroupAction → Firestore | Server Action writes after verifying membership; Firestore rules provide defense-in-depth |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-006-01 | Spoofing | createCheckoutGroupAction | mitigate | requireSession() at action entry; uid derived from server session cookie, not client input |
| T-006-02 | Elevation of Privilege | createCheckoutGroupAction EVT-08 gate | mitigate | Server Action reads event doc and checks allowedStaff before writing; Firestore rules apply isMember() via get() as second layer |
| T-006-03 | Tampering | checkoutGroups documents | mitigate | Firestore rule: `allow update, delete: if false` — documents are immutable after creation |
| T-006-04 | Information Disclosure | checkoutGroups read | accept | `allow get, list: if isSignedIn()` — any authenticated user can read; intentional design (scanner at check-in needs to resolve group IDs without knowing the event; group IDs contain no PII) |
| T-006-05 | Denial of Service | splitCount client input | mitigate | Dialog clamps splitCount to 1–10 in UI; Zod schema on server does not validate splitCount directly (server receives per-group calls), but each group write is independently validated |
</threat_model>

<verification>
End-to-end smoke test sequence (manual, post-build):
1. Start dev server: `npm run dev`
2. Log in as admin → navigate to an active event → `/events/[id]/checkout`
3. Scan or manually enter 1+ items → click "Check out N items"
4. Confirm `CheckoutGroupDialog` appears (not immediate navigation to event page)
5. Default shows `splitCount = 1` → click "Generate" → step 2 renders with one group + `PrintLabelButton`
6. Click "Print" on the group label → print dialog appears with QR barcode
7. Click "Done" → navigates to event detail page
8. Repeat with `splitCount = 2` and 4+ items → confirm two groups created in Firestore
9. Click "Skip" → navigates to event detail page without creating any groups
10. Navigate to `/scan` (the standalone scan page) → complete a checkout → confirm it still navigates directly to event page (no dialog, `onCommitSuccess` not wired there)
</verification>

<success_criteria>
- Post-checkout dialog appears and offers single or split group barcode generation
- Each "Generate" call creates a Firestore `checkoutGroups` document with the correct fields
- `PrintLabelButton` renders and prints the group doc ID as a barcode
- "Skip" and "Done" both navigate to the event page
- `/scan` checkout path is unaffected (backward compat via missing `onCommitSuccess` prop)
- Firestore rules enforce that only event members can create `checkoutGroups` documents
- `tsc --noEmit`, `npm run lint`, `npm run build` all pass
</success_criteria>

<output>
After completion, create `.planning/quick/quick-kayinleong-006/quick-kayinleong-006-SUMMARY.md` following the template at `@$HOME/.claude/get-shit-done/templates/summary.md`.
</output>
