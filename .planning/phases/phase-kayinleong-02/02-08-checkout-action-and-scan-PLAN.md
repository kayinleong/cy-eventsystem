---
phase: phase-kayinleong-02
plan: 08
type: execute
wave: 8
depends_on:
  - 05
  - 07
files_modified:
  - app/(app)/events/[eventId]/checkout/actions.ts
  - app/(app)/events/[eventId]/checkout/page.tsx
  - app/(app)/scan/page.tsx
  - components/feature/scan/scan-session.tsx
  - components/feature/scan/EventPickerDialog.tsx
  - components/feature/scan/ScanCartPanel.tsx
  - components/feature/events/EventAssignedItemsTab.tsx
autonomous: false
requirements:
  - CO-01
  - CO-02
  - CO-03
  - CO-04
  - CO-05
  - CO-06
  - CO-07
  - CO-08
  - CO-09
  - CO-10
  - SCN-01
  - SCN-02
  - SCN-03
  - SCN-04
  - SCN-05
  - SCN-06
  - INT-01
  - INT-02
  - INT-03
  - INT-04
  - AUD-01
  - AUD-02
  - AUD-03
  - NFR-06

must_haves:
  truths:
    - "commitCheckoutCartAction is the marquee atomic transaction: read all items, assert availableQty >= qty for each, then decrement + write transactions docs, all in one runTransaction (CO-04, CO-05, INT-01)."
    - "Action returns CheckoutResult discriminated union matching Phase 1's shape so the existing useOptimistic + revert path in scan-session.tsx works unchanged (CO-06)."
    - "Action runs verifySession + EVT-08 check (event.allowedStaff.includes(uid) OR role==='admin') before any read."
    - "Per-line transactions doc written for each cart line (preserving original cart shape in history per AUD-01)."
    - "Inside transaction, isLowStock updated atomically per RESEARCH P11."
    - "scan-session.tsx swaps store.checkout commit body for the Server Action; useOptimistic + revert path unchanged."
    - "All seedUsers.find(...) actor lookups removed from scan-session.tsx."
    - "EventPickerDialog uses useEventsLive filtered to status in ('planned', 'active') and accessible-to-session per EVT-08."
    - "Bluetooth scanner integration (keystroke listener) preserved from Phase 1 — CO-10."
    - "revalidatePath called for /events/[id], /inventory, /, /reports/out, /reports/history."
    - "Manual rules audit covers /events read access (via array-contains) + /transactions write deny."
  artifacts:
    - path: "app/(app)/events/[eventId]/checkout/actions.ts"
      provides: "commitCheckoutCartAction Server Action with marquee transactional checkout logic"
      contains: "runTransaction"
    - path: "components/feature/scan/scan-session.tsx"
      provides: "Updated commit handler calling Server Action; useOptimistic unchanged"
      contains: "commitCheckoutCartAction"
  key_links:
    - from: "components/feature/scan/scan-session.tsx"
      to: "app/(app)/events/[eventId]/checkout/actions.ts"
      via: "commitCheckoutCartAction({eventId, lines}); CheckoutResult drives toast + useOptimistic revert"
      pattern: "commitCheckoutCartAction"
    - from: "app/(app)/events/[eventId]/checkout/actions.ts"
      to: "transactions collection (audit row per cart line)"
      via: "Inside runTransaction, tx.set on transactions/{newId} per parsed.data.lines (preserves original cart shape per AUD-01)"
      pattern: "tx.set\\(adminDb.collection\\(\"transactions\"\\)"
---

<objective>
**Block E — Scan check-out.** The marquee plan. Ship `commitCheckoutCartAction` per RESEARCH §5.1 (atomic transaction with CO-04/CO-05 invariant). Wire scan-session.tsx + scan page + per-event scoped checkout page to call it. The `useOptimistic` revert path from Phase 1 D-13/D-14 works unchanged because the Server Action returns the same `CheckoutResult` shape per CONTEXT.md `<specifics>` last bullet + PATTERNS §4 excerpt B.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-02/02-CONTEXT.md
@.planning/phases/phase-kayinleong-02/02-RESEARCH.md
@.planning/phases/phase-kayinleong-02/02-PATTERNS.md
@.planning/phases/phase-kayinleong-02/02-05-inventory-data-layer-and-actions-PLAN.md
@.planning/phases/phase-kayinleong-02/02-07-events-data-and-cloud-function-PLAN.md
@.planning/phases/phase-kayinleong-01/01-08-scanner-and-scan-page-SUMMARY.md
@.planning/phases/phase-kayinleong-01/01-09-checkout-flow-SUMMARY.md
@firestore.rules
@functions/src/syncAllowedStaff.ts
@components/feature/scan/scan-session.tsx
@components/feature/scan/ScannerWidget.tsx
@components/feature/scan/EventPickerDialog.tsx
@components/feature/scan/ScanCartPanel.tsx
@components/feature/scan/ScanHeader.tsx
@components/feature/scan/ManualEntryInput.tsx
@components/feature/events/EventAssignedItemsTab.tsx
@app/(app)/events/[eventId]/checkout/page.tsx
@app/(app)/scan/page.tsx
@lib/mock/store.ts
@lib/types/transaction.ts
@lib/schemas/transaction.ts
@lib/auth/dal.ts
@lib/firebase/admin.ts
@lib/data/events.server.ts
@lib/data/inventory.server.ts
@lib/hooks/use-inventory-live.ts
@lib/hooks/use-events-live.ts
@lib/schemas/item.ts

<interfaces>
```typescript
// app/(app)/events/[eventId]/checkout/actions.ts
export type CheckoutResult =
  | { ok: true; txIds: string[] }
  | { ok: false; error: string; failedLines?: { itemId: string; available: number; requested: number }[] };

export async function commitCheckoutCartAction(input: {
  eventId: string;
  lines: { itemId: string; qty: number }[];
}): Promise<CheckoutResult>;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: commitCheckoutCartAction — the marquee transaction</name>
  <files>app/(app)/events/[eventId]/checkout/actions.ts</files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §5.1 lines 1148-1278 (FULL implementation — copy verbatim, adapt to project's CheckoutResult type location)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §4 excerpt B (lines 286-364 — RESEARCH-derived excerpt with CheckoutResult contract)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"P8: Transaction read-then-write doesn't see same-tx writes" lines 1942-1944
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"P11 isLowStock denorm drift"
    - lib/mock/store.ts lines 108-188 (Phase 1 `checkout` mutator — match its CheckoutResult shape exactly)
    - lib/types/transaction.ts (TransactionDoc type + CheckoutResult type if Phase 1 exported it; else define in actions.ts)
    - lib/schemas/transaction.ts (CheckoutCartSchema — verify exists, create if missing)
    - lib/schemas/item.ts (computeIsLowStock from 02-05)
  </read_first>
  <action>
    Verify `lib/schemas/transaction.ts` exports `CheckoutCartSchema`. If missing add:

    ```typescript
    import { z } from "zod";
    export const CheckoutCartSchema = z.object({
      eventId: z.string().min(1),
      lines: z.array(z.object({
        itemId: z.string().min(1),
        qty: z.number().int().positive(),
      })).min(1, "Cart cannot be empty"),
    });
    ```

    Create `app/(app)/events/[eventId]/checkout/actions.ts`:

    ```typescript
    "use server";
    // app/(app)/events/[eventId]/checkout/actions.ts
    // Per RESEARCH §5.1 + PATTERNS §4 excerpt B. The marquee transactional Server Action.
    // CO-04 (atomic), CO-05 (invariant cart-wide), CO-06 (revert via CheckoutResult shape).

    import { requireSession } from "@/lib/auth/dal";
    import { adminDb } from "@/lib/firebase/admin";
    import { FieldValue } from "firebase-admin/firestore";
    import { revalidatePath } from "next/cache";
    import { CheckoutCartSchema } from "@/lib/schemas/transaction";
    import { computeIsLowStock } from "@/lib/schemas/item";

    export type CheckoutResult =
      | { ok: true; txIds: string[] }
      | { ok: false; error: string; failedLines?: { itemId: string; available: number; requested: number }[] };

    class BizError extends Error {}

    export async function commitCheckoutCartAction(input: {
      eventId: string;
      lines: { itemId: string; qty: number }[];
    }): Promise<CheckoutResult> {
      const session = await requireSession();
      const parsed = CheckoutCartSchema.safeParse(input);
      if (!parsed.success) return { ok: false, error: "Invalid cart" };

      // EVT-08 access check
      const eventRef = adminDb.collection("events").doc(input.eventId);
      const eventSnap = await eventRef.get();
      if (!eventSnap.exists) return { ok: false, error: "Event not found" };
      const event = eventSnap.data()!;

      const isAdmin = session.role === "admin";
      const isMember = (event.allowedStaff as string[] | undefined)?.includes(session.uid) === true;
      if (!isAdmin && !isMember) return { ok: false, error: "Not authorized for this event" };
      if (event.status === "completed" || event.status === "cancelled") {
        return { ok: false, error: `Event is ${event.status}` };
      }

      // P8 mitigation — aggregate per item BEFORE the transaction (cart may have
      // two lines for the same itemId; runTransaction reads a single fresh snapshot
      // per ref so we must dedupe inputs).
      const requestedByItem = new Map<string, number>();
      for (const line of parsed.data.lines) {
        requestedByItem.set(line.itemId, (requestedByItem.get(line.itemId) ?? 0) + line.qty);
      }
      const itemIds = Array.from(requestedByItem.keys());
      const itemRefs = itemIds.map((id) => adminDb.collection("inventory").doc(id));

      const txIds: string[] = [];

      try {
        await adminDb.runTransaction(async (tx) => {
          const itemSnaps = await Promise.all(itemRefs.map((ref) => tx.get(ref)));

          // Invariant pass — CO-05 cart-wide
          const failed: { itemId: string; available: number; requested: number }[] = [];
          for (let i = 0; i < itemSnaps.length; i++) {
            const snap = itemSnaps[i];
            if (!snap.exists) {
              failed.push({ itemId: itemIds[i], available: 0, requested: requestedByItem.get(itemIds[i])! });
              continue;
            }
            const data = snap.data()!;
            if (data.lifecycleState === "retired") {
              failed.push({ itemId: itemIds[i], available: 0, requested: requestedByItem.get(itemIds[i])! });
              continue;
            }
            const available = data.availableQty as number;
            const requested = requestedByItem.get(itemIds[i])!;
            if (available < requested) {
              failed.push({ itemId: itemIds[i], available, requested });
            }
          }
          if (failed.length > 0) {
            const err = new BizError("STOCK_INSUFFICIENT");
            (err as any).failed = failed;
            throw err;
          }

          // Apply decrements + isLowStock denorm (P11) — per-item update
          for (let i = 0; i < itemSnaps.length; i++) {
            const snap = itemSnaps[i];
            const item = snap.data()!;
            const qty = requestedByItem.get(itemIds[i])!;
            const newAvailable = item.availableQty - qty;
            const newOut = item.outQty + qty;
            // Lifecycle: items become "checked_out" if any qty out and not all in
            const newLifecycle =
              newAvailable === 0
                ? "checked_out"
                : newAvailable < item.totalQty
                ? "checked_out"
                : item.lifecycleState;

            const isLowStock = computeIsLowStock({
              availableQty: newAvailable,
              lowStockThreshold: item.lowStockThreshold ?? 0,
            });

            tx.update(itemRefs[i], {
              availableQty: newAvailable,
              outQty: newOut,
              lifecycleState: newLifecycle,
              isLowStock,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: session.uid,
            });
          }

          // Per-line audit row — preserve original cart shape per AUD-01
          for (const line of parsed.data.lines) {
            const idx = itemIds.indexOf(line.itemId);
            const item = itemSnaps[idx].data()!;
            const txRef = adminDb.collection("transactions").doc();
            txIds.push(txRef.id);
            tx.set(txRef, {
              type: "checkout",
              itemId: line.itemId,
              itemSku: item.sku,
              itemName: item.name,
              eventId: input.eventId,
              eventName: event.name,
              qty: line.qty,
              actorUid: session.uid,
              actorName: session.displayName,
              actorRoleAtTimeOfAction: session.role,
              at: FieldValue.serverTimestamp(),
              notes: "",
              parentTxId: null,
              clientTxId: null,
            });
          }
        });
      } catch (err) {
        if (err instanceof BizError && err.message === "STOCK_INSUFFICIENT") {
          return {
            ok: false,
            error: "One or more items are out of stock.",
            failedLines: (err as any).failed,
          };
        }
        throw err;
      }

      // Block H revalidate matrix per RESEARCH §8.5
      revalidatePath(`/events/${input.eventId}`);
      revalidatePath("/inventory");
      revalidatePath("/");
      revalidatePath("/reports/out");
      revalidatePath("/reports/history");
      return { ok: true, txIds };
    }
    ```
  </action>
  <acceptance_criteria>
    - `head -1 "app/(app)/events/[eventId]/checkout/actions.ts" | grep -q '"use server"'` succeeds.
    - `grep -q "export async function commitCheckoutCartAction" "app/(app)/events/[eventId]/checkout/actions.ts"` succeeds.
    - `grep -q "await requireSession()" "app/(app)/events/[eventId]/checkout/actions.ts"` succeeds.
    - `grep -q "allowedStaff" "app/(app)/events/[eventId]/checkout/actions.ts"` succeeds (EVT-08).
    - `grep -q "runTransaction" "app/(app)/events/[eventId]/checkout/actions.ts"` succeeds.
    - `grep -q "STOCK_INSUFFICIENT" "app/(app)/events/[eventId]/checkout/actions.ts"` succeeds (CO-05).
    - `grep -q "failedLines" "app/(app)/events/[eventId]/checkout/actions.ts"` succeeds (CO-05 / CO-06 revert payload).
    - `grep -q "computeIsLowStock" "app/(app)/events/[eventId]/checkout/actions.ts"` succeeds (P11).
    - `grep -q "requestedByItem" "app/(app)/events/[eventId]/checkout/actions.ts"` succeeds (P8 aggregation).
    - `grep -q "actorRoleAtTimeOfAction" "app/(app)/events/[eventId]/checkout/actions.ts"` succeeds (AUD-01 snapshot).
    - `[ "$(grep -c revalidatePath 'app/(app)/events/[eventId]/checkout/actions.ts')" -ge "5" ]`.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>head -1 "app/(app)/events/[eventId]/checkout/actions.ts" | grep -q '"use server"' && grep -q "commitCheckoutCartAction" "app/(app)/events/[eventId]/checkout/actions.ts" && grep -q "runTransaction" "app/(app)/events/[eventId]/checkout/actions.ts" && grep -q "STOCK_INSUFFICIENT" "app/(app)/events/[eventId]/checkout/actions.ts" && grep -q "computeIsLowStock" "app/(app)/events/[eventId]/checkout/actions.ts" && npx tsc --noEmit</automated>
  </verify>
  <done>The marquee atomic Server Action. CO-04/CO-05/CO-06 satisfied at the data layer.</done>
</task>

<task type="auto">
  <name>Task 2: Swap scan-session.tsx commit to Server Action; EventPickerDialog uses live events</name>
  <files>
    components/feature/scan/scan-session.tsx,
    components/feature/scan/EventPickerDialog.tsx,
    components/feature/scan/ScanCartPanel.tsx
  </files>
  <read_first>
    - components/feature/scan/scan-session.tsx (FULL file — the useOptimistic wiring is critical, preserve it)
    - components/feature/scan/EventPickerDialog.tsx (Phase 1: uses selectAccessibleEvents from mock store)
    - components/feature/scan/ScanCartPanel.tsx (Phase 1: cart display + actions)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md lines 1282-1306 (commit pattern + useOptimistic revert excerpt)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 row "components/feature/scan/scan-session.tsx" — "All actor-lookup seedUsers.find(...) calls delete"
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 row "components/feature/scan/EventPickerDialog.tsx"
    - lib/hooks/use-events-live.ts (from 02-07)
    - lib/hooks/use-inventory-live.ts (from 02-05)
  </read_first>
  <action>
    **2.1 — `components/feature/scan/scan-session.tsx`:**

    Open the file. Locate the `commit` callback (around lines 213-241 per PATTERNS §1). Replace the body that calls `store.checkout(...)` with a call to `commitCheckoutCartAction`. The `useOptimistic` declaration stays. The `seedUsers.find(...)` actor lookup MUST be deleted.

    Critical excerpt (REPLACE current commit body):

    ```typescript
    "use client";
    import { commitCheckoutCartAction, type CheckoutResult } from "@/app/(app)/events/[eventId]/checkout/actions";
    import { useRouter } from "next/navigation";
    import { toast } from "sonner";
    // ... preserve all other imports including useOptimistic, useTransition, useState, etc. ...
    // REMOVE: import { checkout, getSnapshot } from "@/lib/mock/store";
    // REMOVE: import { seedUsers } from "@/lib/mock/users";

    // ... inside the provider component ...
    const router = useRouter();
    const commit = useCallback(async () => {
      if (!selectedEvent || cart.length === 0) return;
      setIsCommitting(true);
      // NOTE: useOptimistic state was already applied on addLine — cart shows
      // decremented availableQty optimistically. The Server Action either confirms
      // or returns failedLines, in which case we restore.
      const result: CheckoutResult = await commitCheckoutCartAction({
        eventId: selectedEvent.id,
        lines: cart.map((l) => ({ itemId: l.itemId, qty: l.qty })),
      });
      setIsCommitting(false);

      if (result.ok) {
        toast.success("Checked out", {
          description: `${result.txIds.length} line${result.txIds.length === 1 ? "" : "s"} committed`,
        });
        setCart([]);
        router.push(`/events/${selectedEvent.id}`);
      } else {
        // CO-05: surface failed lines via toast.error.description; keep cart
        // so user can adjust qty and retry. useOptimistic auto-reverts because
        // the underlying Firestore listener still shows the original availableQty.
        const failedSummary = result.failedLines
          ?.map((f) => `${f.itemId}: only ${f.available} available, requested ${f.requested}`)
          .join("; ") ?? "";
        toast.error(result.error, { description: failedSummary });
      }
    }, [cart, selectedEvent, router]);
    ```

    Delete ALL `seedUsers.find(...)` blocks anywhere in this file.

    **2.2 — `components/feature/scan/EventPickerDialog.tsx`:**

    Phase 1 imported `selectAccessibleEvents` from `lib/mock/selectors.ts`. Replace with `useEventsLive`:

    ```typescript
    "use client";
    import { useEventsLive } from "@/lib/hooks/use-events-live";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    // ... preserve Phase 1 imports: Command, Dialog, etc. ...

    export function EventPickerDialog({ open, onSelect, onClose }: {
      open: boolean;
      onSelect: (event: EventDoc) => void;
      onClose: () => void;
    }) {
      const session = useCurrentUser();
      // EVT-08: useEventsLive scopes via array-contains for staff; admin sees all
      const events = useEventsLive([], { session: session as any, limit: 50 });
      // Phase 1 filtered to planned + active — preserve:
      const accessibleEvents = events.filter(
        (e) => e.status === "planned" || e.status === "active",
      );

      // PRESERVE Phase 1 typeahead Command UI; render `accessibleEvents`.
      // No mock-store / seedUsers / selector imports remain.
    }
    ```

    **2.3 — `components/feature/scan/ScanCartPanel.tsx`:**

    Phase 1 likely renders cart lines + a Commit button. The Commit button calls `commit` from scan-session context. No mock-store imports remain. The line lookup (showing item name, available qty) should consume `useInventoryLive` for fresh available qty, NOT `useMockStore`. Verify the file's imports and swap as needed; preserve all chrome.
  </action>
  <acceptance_criteria>
    - `grep -q "commitCheckoutCartAction" components/feature/scan/scan-session.tsx` succeeds.
    - `grep -q "from \"@/lib/mock/store\"" components/feature/scan/scan-session.tsx` FAILS.
    - `grep -q "seedUsers" components/feature/scan/scan-session.tsx` FAILS.
    - `grep -q "useOptimistic\|optimisticCart\|optimistic" components/feature/scan/scan-session.tsx` succeeds (Phase 1 wiring preserved — CO-06).
    - `grep -q "useEventsLive" components/feature/scan/EventPickerDialog.tsx` succeeds.
    - `grep -q "selectAccessibleEvents" components/feature/scan/EventPickerDialog.tsx` FAILS.
    - `[ "$(grep -rE 'from \"@/lib/mock/store\"' components/feature/scan/ 2>/dev/null | wc -l)" = "0" ]`.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "commitCheckoutCartAction" components/feature/scan/scan-session.tsx && ! grep -q "from \"@/lib/mock/store\"" components/feature/scan/scan-session.tsx && grep -q "useEventsLive" components/feature/scan/EventPickerDialog.tsx && [ "$(grep -rE 'from \"@/lib/mock/store\"' components/feature/scan/ 2>/dev/null | wc -l)" = "0" ] && npm run build</automated>
  </verify>
  <done>scan-session.tsx, EventPickerDialog, ScanCartPanel all on Firebase. CO-06 useOptimistic revert preserved.</done>
</task>

<task type="auto">
  <name>Task 3: Per-event scoped /events/[eventId]/checkout page + scan/page.tsx</name>
  <files>
    app/(app)/events/[eventId]/checkout/page.tsx,
    app/(app)/scan/page.tsx,
    components/feature/events/EventAssignedItemsTab.tsx
  </files>
  <read_first>
    - app/(app)/events/[eventId]/checkout/page.tsx (Phase 1)
    - app/(app)/scan/page.tsx (Phase 1)
    - components/feature/events/EventAssignedItemsTab.tsx (Phase 1 — Reads selectOpenCheckoutsForEvent from mock)
    - lib/data/events.server.ts (getEventServer + getOpenCheckoutsForEventServer from 02-07)
    - lib/hooks/use-transactions-live.ts (from 02-06)
    - lib/auth/dal.ts
  </read_first>
  <action>
    **3.1 — `app/(app)/events/[eventId]/checkout/page.tsx`:** swap mock imports for real DAL + getEventServer. EVT-08 enforced by getEventServer; redirect to event detail if not allowed.

    ```typescript
    import { notFound, redirect } from "next/navigation";
    import { requireSession } from "@/lib/auth/dal";
    import { getEventServer } from "@/lib/data/events.server";
    import { ScanSessionProvider } from "@/components/feature/scan/scan-session";
    // ... preserve Phase 1 scoped-checkout chrome ...

    type RouteProps = { params: Promise<{ eventId: string }> };

    export default async function CheckoutPage({ params }: RouteProps) {
      const session = await requireSession();
      const { eventId } = await params;
      const event = await getEventServer(eventId, session); // EVT-08
      if (!event) notFound();
      if (event.status === "completed" || event.status === "cancelled") {
        redirect(`/events/${eventId}`); // Phase 1 status-rejection redirect preserved
      }
      return (
        <ScanSessionProvider mode="checkout" initialEvent={event}>
          {/* PRESERVE Phase 1 scan UI: ScannerWidget + ScanCartPanel + ManualEntryInput */}
        </ScanSessionProvider>
      );
    }
    ```

    **3.2 — `app/(app)/scan/page.tsx`:** Phase 1 standalone scanner; mode toggle stays. EventPicker uses `useEventsLive` (Task 2). Only the import of `selectAccessibleEvents` (Phase 1 mock selector) needs removal; the rest of the page is preserved.

    **3.3 — `components/feature/events/EventAssignedItemsTab.tsx`:** swap `selectOpenCheckoutsForEvent` from mock selectors → `useTransactionsLive({eventId, type: 'checkout'})` filtered client-side to only show checkouts without a corresponding check-in (parentTxId match).

    ```typescript
    "use client";
    import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";
    import { useMemo } from "react";

    export function EventAssignedItemsTab({ eventId }: { eventId: string }) {
      const checkouts = useTransactionsLive({ eventId, type: "checkout", limit: 200 });
      const checkins = useTransactionsLive({ eventId, type: "checkin", limit: 200 });
      const checkedInParents = useMemo(
        () => new Set(checkins.map((tx) => tx.parentTxId).filter(Boolean)),
        [checkins],
      );
      const openCheckouts = useMemo(
        () => checkouts.filter((tx) => !checkedInParents.has(tx.id)),
        [checkouts, checkedInParents],
      );
      // PRESERVE Phase 1 list rendering of openCheckouts
    }
    ```
  </action>
  <acceptance_criteria>
    - `grep -q "getEventServer" "app/(app)/events/[eventId]/checkout/page.tsx"` succeeds.
    - `grep -q "from \"@/lib/auth/dal\"" "app/(app)/events/[eventId]/checkout/page.tsx"` succeeds.
    - `grep -q "useTransactionsLive" components/feature/events/EventAssignedItemsTab.tsx` succeeds.
    - `grep -q "selectOpenCheckoutsForEvent" components/feature/events/EventAssignedItemsTab.tsx` FAILS.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "getEventServer" "app/(app)/events/[eventId]/checkout/page.tsx" && grep -q "useTransactionsLive" components/feature/events/EventAssignedItemsTab.tsx && ! grep -q "selectOpenCheckoutsForEvent" components/feature/events/EventAssignedItemsTab.tsx && npm run build</automated>
  </verify>
  <done>Checkout pages + assigned-items tab all on Firebase.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: E2E checkout flow + concurrent stock invariant test + Block E rules audit</name>
  <what-built>
    Server Action + UI fully wired. Time to test the marquee flow end-to-end + verify the CO-05 concurrent invariant per ROADMAP success criterion #3.
  </what-built>
  <how-to-verify>
    **A — Single-user checkout:**
    1. Sign in as admin. Have at least 2 items in inventory (totalQty: 5 each) + 1 event with admin in allowedStaff + status='planned'.
    2. /events/<id>/checkout. Scan an item (or manually enter SKU). Set qty=2. Add to cart.
    3. Scan another item. Add to cart.
    4. Click Commit. **Expected:** toast "Checked out — 2 lines committed". Redirected to /events/<id>.
    5. Firestore: inventory items have availableQty decremented; outQty incremented; transactions collection has 2 new docs with type='checkout'.

    **B — CO-05 invariant:**
    1. Create an item with totalQty=2. Checkout 2 → availableQty=0.
    2. Try to checkout 1 more. **Expected:** toast.error "One or more items are out of stock." with description "only 0 available, requested 1". Cart NOT cleared. Inventory unchanged.

    **C — useOptimistic revert (CO-06):**
    1. Use DevTools Network panel to artificially slow the response. Trigger commit.
    2. **Expected:** cart shows decrement immediately (optimistic), then if server rejects, the cart's visible qty bounces back when the Firestore listener re-renders.

    **D — Concurrent checkout (ROADMAP success #3):**
    1. Open 2 browser windows (private + regular). Sign in as admin in both.
    2. Both visit /events/<id>/checkout for the SAME event. Same item with availableQty=2.
    3. Both add the same item with qty=2 to cart.
    4. Both press Commit roughly simultaneously.
    5. **Expected:** ONE succeeds; the OTHER gets toast.error "One or more items are out of stock." availableQty=0 after. Firestore transactions: only ONE checkout doc per item. NO negative qty observed.

    **E — EVT-08:**
    1. Sign in as staff (not in allowedStaff for event X).
    2. Visit /events/X/checkout directly → expect /events/X to be the redirect target OR notFound (depending on getEventServer return).

    **F — Scanner formats:**
    1. /scan page → mode=checkout → scan a printed QR (encoding the SKU). Verify it parses.
    2. Try Code 128 / EAN-13 / Data Matrix per SCN-09 — your phone's barcode generator app.

    **G — Bluetooth keystroke scanner (CO-10):**
    1. If a hardware Bluetooth scanner is available, scan a code. **Expected:** keystrokes appear in the scan handler (same path as camera-decoded).
    2. If no hardware, simulate by typing fast into the manual-entry input.

    **H — Block E rules audit — `## Rules Audit — Block E` in CLAIM.md:**
    | # | Path | Auth? | Role | Op | Expected |
    |---|------|-------|------|-----|----------|
    | 1 | /transactions/new-tx | Yes | admin (via Admin SDK Server Action) | create | ALLOW (Admin SDK bypasses rules) — verify via successful Task A |
    | 2 | /transactions/new-tx | Yes | admin (via Web SDK client) | create | DENY (INT-03) |
    | 3 | /inventory/SKU-1 | Yes | staff (via Web SDK client) | update with availableQty: -1 | DENY (invariant) |
    | 4 | /events/X | Yes | staff in allowedStaff | read | ALLOW |
    | 5 | /inventory/SKU-1 | Yes | staff | read | ALLOW |

    Report PASS/FAIL each.
  </how-to-verify>
  <resume-signal>Type "checkout E2E + concurrent invariant PASS, rules audit logged" or describe failures.</resume-signal>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation |
|---|---|---|---|---|
| T-02-08-01 | Tampering | Concurrent checkout drives availableQty < 0 | mitigate | runTransaction read + invariant pass before writes; Firestore retries on conflict (ROADMAP success #3) |
| T-02-08-02 | Tampering | Cart with 2 lines for same item double-spends | mitigate | requestedByItem.Map aggregation BEFORE transaction (P8); single invariant check per item |
| T-02-08-03 | EoP | Staff checks out from event they don't belong to | mitigate | EVT-08 check at top of Server Action; firestore.rules events isMember(resource); getEventServer returns null on access fail |
| T-02-08-04 | Repudiation | Checkout not linked to actor | mitigate | actorUid + actorName + actorRoleAtTimeOfAction written in every transactions doc (AUD-01) |
| T-02-08-05 | Tampering | Client writes transactions directly | mitigate | firestore.rules transactions allow create/update/delete: if false (INT-03) — only Admin SDK can write |
| T-02-08-06 | Tampering | isLowStock denorm drift after checkout | mitigate | computeIsLowStock called atomically inside the same runTransaction per P11 |
| T-02-08-07 | Tampering | Retired item still checked out | mitigate | Server Action rejects lines where lifecycleState === "retired" |
| T-02-08-08 | DoS | Long cart with 100+ lines | accept | Firestore transaction limit is 500 docs; well within bounds; UI naturally restricts cart growth |
</threat_model>

<verification>
- commitCheckoutCartAction exists and runs atomic transaction with CO-05 invariant + isLowStock denorm + per-line audit.
- scan-session.tsx commit body uses the Server Action; useOptimistic + revert path preserved (CO-06).
- EventPickerDialog uses useEventsLive (EVT-08).
- /events/[id]/checkout page wired to real DAL + getEventServer.
- EventAssignedItemsTab uses useTransactionsLive.
- npm run build green.
- ROADMAP success #3 (concurrent checkout invariant) demonstrated.
- Block E rules audit (5+ cases) logged.
</verification>

<success_criteria>
- CO-01..10 all functional. CO-04 atomic. CO-05 invariant enforced. CO-06 optimistic + revert preserved. CO-10 Bluetooth keystroke path preserved.
- SCN-01..06 functional via Phase 1's existing scanner UX, now persisting via Server Action.
- INT-01 (atomic), INT-02 (rules invariant — verified in rules audit), INT-03 (no client writes to transactions), INT-04 (DAL gate).
- AUD-01..03 (audit row per checkout line + visible on item-detail + event-detail).
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-08-checkout-action-and-scan-SUMMARY.md` listing files, the concurrent-checkout test demonstration (transcript of two tabs), and Block E rules audit. <= 100 lines.
</output>
