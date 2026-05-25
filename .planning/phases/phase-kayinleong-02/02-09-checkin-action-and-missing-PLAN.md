---
phase: phase-kayinleong-02
plan: 09
type: execute
wave: 9
depends_on:
  - 08
files_modified:
  - app/(app)/events/[eventId]/checkin/actions.ts
  - app/(app)/events/[eventId]/checkin/page.tsx
  - app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx
  - app/(app)/reports/missing/actions.ts
  - components/feature/missing/ResolveMissingSheet.tsx
  - lib/data/missing.server.ts
  - lib/hooks/use-missing-live.ts
autonomous: false
requirements:
  - CI-01
  - CI-02
  - CI-03
  - CI-04
  - CI-05
  - CI-06
  - CI-07
  - CI-08
  - MIS-01
  - MIS-02
  - MIS-03
  - MIS-04
  - INT-01
  - INT-03
  - INT-04
  - AUD-01
  - AUD-02
  - AUD-03
  - NFR-06

must_haves:
  truths:
    - "commitCheckinCartAction wraps all per-line check-in logic in a single Firestore transaction (CI-05 atomic)."
    - "Each line: read parent checkout tx, compute missingDelta = parentQty - returnedQty, route returnedQty to availableQty OR damagedQty per damaged flag (CI-06), decrement outQty, write checkin tx with parentTxId (CI-08), write missing tx + missingItems doc if missingDelta > 0 (MIS-01, CI-04)."
    - "Partial check-ins supported: a single parentTxId can be checked-in across multiple actions (CI-07) — sum check-ins by parentTxId at read time."
    - "Missing reason enum {Lost, Damaged, Not returned, Unknown} required when returnedQty < parentQty (CI-04)."
    - "resolveMissing Server Action: admin-only; 'found' returns qty to availableQty; 'writtenOff' decrements totalQty; both write follow-up transactions (MIS-03, MIS-04)."
    - "isLowStock denorm updated atomically in checkin transaction per RESEARCH P11."
    - "lib/data/missing.server.ts + lib/hooks/use-missing-live.ts ship for /reports/missing reads."
    - "Manual rules audit covers missingItems collection access + transactions write deny."
  artifacts:
    - path: "app/(app)/events/[eventId]/checkin/actions.ts"
      provides: "commitCheckinCartAction transactional check-in"
      contains: "parentTxId"
    - path: "app/(app)/reports/missing/actions.ts"
      provides: "resolveMissing admin Server Action"
      contains: "requireAdmin"
    - path: "lib/data/missing.server.ts"
      provides: "Admin SDK cursor-paged missing items reader"
      contains: "missingItems"
    - path: "lib/hooks/use-missing-live.ts"
      provides: "Web SDK onSnapshot hook for /reports/missing"
      contains: "onSnapshot"
  key_links:
    - from: "app/(app)/events/[eventId]/checkin/actions.ts"
      to: "transactions + missingItems collections"
      via: "Single runTransaction writes inventory update + checkin tx + (if missingDelta>0) missingItems doc + missing tx (atomic per MIS-01)"
      pattern: "missingItems.*FieldValue.serverTimestamp"
    - from: "app/(app)/reports/missing/actions.ts resolveMissing"
      to: "inventory + transactions"
      via: "Found → tx.update(item, {availableQty: + delta}) + write 'checkin' adjustment tx; writtenOff → tx.update(item, {totalQty: -delta}) + write 'adjustment' tx"
      pattern: "type: \"adjustment\""
---

<objective>
**Block F — Scan check-in + missing items.** Ship `commitCheckinCartAction` per RESEARCH §6.1 + `resolveMissing` per RESEARCH §6.2. Each transaction reconciles a checked-out line: returnedQty routes to availableQty (or damagedQty per CI-06), missingDelta creates a missingItems doc + missing transaction. Partial check-ins (CI-07) work by chained parentTxId references summed at read time.
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
@.planning/phases/phase-kayinleong-02/02-08-checkout-action-and-scan-PLAN.md
@.planning/phases/phase-kayinleong-01/01-10-checkin-flow-SUMMARY.md
@.planning/phases/phase-kayinleong-01/01-11-reports-SUMMARY.md
@firestore.rules
@firestore.indexes.json
@app/(app)/events/[eventId]/checkin/page.tsx
@app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx
@components/feature/missing/ResolveMissingSheet.tsx
@lib/firebase/admin.ts
@lib/firebase/client.ts
@lib/auth/dal.ts
@lib/types/transaction.ts
@lib/types/missing-item.ts
@lib/schemas/transaction.ts
@lib/schemas/missing-item.ts
@lib/schemas/item.ts
@lib/mock/store.ts
@lib/mock/selectors.ts
@lib/data/inventory.server.ts
@lib/data/events.server.ts
@lib/hooks/use-transactions-live.ts

<interfaces>
```typescript
// app/(app)/events/[eventId]/checkin/actions.ts
type CheckinResult = { ok: true; txIds: string[]; missingIds: string[] } | { ok: false; error: string };

export async function commitCheckinCartAction(input: {
  eventId: string;
  lines: {
    itemId: string;
    parentTxId: string;
    returnedQty: number;
    missingReason?: "Lost" | "Damaged" | "Not returned" | "Unknown";
    damaged?: boolean;
  }[];
}): Promise<CheckinResult>;

// app/(app)/reports/missing/actions.ts
export async function resolveMissing(input: {
  missingId: string;
  resolution: "found" | "writtenOff";
}): Promise<{ ok: true } | { ok: false; error: string }>;

// lib/data/missing.server.ts
export async function getMissingPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: { status?: "open"|"resolved"; eventId?: string; itemId?: string };
}): Promise<{ missing: MissingItemDoc[]; nextCursor: string | null }>;

// lib/hooks/use-missing-live.ts
export function useMissingLive(initial: MissingItemDoc[], opts?: {status?:"open"|"resolved"; limit?: number}): MissingItemDoc[];
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: commitCheckinCartAction — atomic per-line transaction</name>
  <files>app/(app)/events/[eventId]/checkin/actions.ts</files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §6.1 lines 1314-1430 (FULL implementation — copy verbatim)
    - .planning/REQUIREMENTS.md CI-01..08, MIS-01, AUD-01..04
    - lib/mock/store.ts lines 192-329 (Phase 1 checkin mutator — match signature)
    - lib/schemas/transaction.ts (CheckinCartSchema — create if missing)
    - lib/schemas/missing-item.ts (MissingReason enum)
    - lib/schemas/item.ts (computeIsLowStock from 02-05)
    - lib/auth/dal.ts, lib/firebase/admin.ts
  </read_first>
  <action>
    Verify `lib/schemas/transaction.ts` has `CheckinCartSchema`. Add if missing:

    ```typescript
    export const CheckinCartSchema = z.object({
      eventId: z.string().min(1),
      lines: z.array(z.object({
        itemId: z.string().min(1),
        parentTxId: z.string().min(1),
        returnedQty: z.number().int().nonnegative(),
        missingReason: z.enum(["Lost", "Damaged", "Not returned", "Unknown"]).optional(),
        damaged: z.boolean().optional(),
      })).min(1),
    });
    ```

    Create `app/(app)/events/[eventId]/checkin/actions.ts` per RESEARCH §6.1:

    ```typescript
    "use server";
    // app/(app)/events/[eventId]/checkin/actions.ts — RESEARCH §6.1.
    // Per-line atomic check-in: returnedQty → availableQty (or damagedQty if damaged);
    // missingDelta = parentQty - returnedQty → missingItems doc + missing tx.

    import { requireSession } from "@/lib/auth/dal";
    import { adminDb } from "@/lib/firebase/admin";
    import { FieldValue } from "firebase-admin/firestore";
    import { revalidatePath } from "next/cache";
    import { CheckinCartSchema } from "@/lib/schemas/transaction";
    import { computeIsLowStock } from "@/lib/schemas/item";

    type CheckinResult =
      | { ok: true; txIds: string[]; missingIds: string[] }
      | { ok: false; error: string };

    export async function commitCheckinCartAction(input: {
      eventId: string;
      lines: {
        itemId: string;
        parentTxId: string;
        returnedQty: number;
        missingReason?: "Lost" | "Damaged" | "Not returned" | "Unknown";
        damaged?: boolean;
      }[];
    }): Promise<CheckinResult> {
      const session = await requireSession();
      const parsed = CheckinCartSchema.safeParse(input);
      if (!parsed.success) return { ok: false, error: "Invalid input" };

      // EVT-08 access check
      const eventSnap = await adminDb.collection("events").doc(input.eventId).get();
      if (!eventSnap.exists) return { ok: false, error: "Event not found" };
      const event = eventSnap.data()!;
      const isAdmin = session.role === "admin";
      const isMember = (event.allowedStaff as string[] | undefined)?.includes(session.uid) === true;
      if (!isAdmin && !isMember) return { ok: false, error: "Not authorized for this event" };

      const txIds: string[] = [];
      const missingIds: string[] = [];

      try {
        await adminDb.runTransaction(async (tx) => {
          for (const line of parsed.data.lines) {
            const itemRef = adminDb.collection("inventory").doc(line.itemId);
            const itemSnap = await tx.get(itemRef);
            if (!itemSnap.exists) throw new Error(`ITEM_NOT_FOUND:${line.itemId}`);
            const item = itemSnap.data()!;

            const parentTxRef = adminDb.collection("transactions").doc(line.parentTxId);
            const parentTxSnap = await tx.get(parentTxRef);
            if (!parentTxSnap.exists) throw new Error(`PARENT_TX_NOT_FOUND:${line.parentTxId}`);
            const parentTx = parentTxSnap.data()!;
            const checkedOutQty = parentTx.qty as number;

            // CI-04 — missing reason required when returnedQty < checkedOutQty
            const missingDelta = Math.max(0, checkedOutQty - line.returnedQty);
            if (missingDelta > 0 && !line.missingReason) {
              throw new Error("MISSING_REASON_REQUIRED");
            }

            // CI-06 — damaged routes to damagedQty bucket, NOT availableQty
            const returnedToAvailable = line.damaged ? 0 : line.returnedQty;
            const returnedToDamaged = line.damaged ? line.returnedQty : 0;

            const newAvailable = item.availableQty + returnedToAvailable;
            const newDamaged = (item.damagedQty ?? 0) + returnedToDamaged;
            const newOut = Math.max(0, item.outQty - checkedOutQty);

            // Lifecycle: if outQty drops to 0 AND availableQty matches totalQty - damagedQty,
            // back to "available" — but if damagedQty > 0, the item still has damaged stock.
            // Simplify: if any qty went to damaged, lifecycle stays "damaged" or "available".
            const newLifecycle =
              newOut === 0
                ? (newDamaged > 0 ? "damaged" : "available")
                : item.lifecycleState;

            const isLowStock = computeIsLowStock({
              availableQty: newAvailable,
              lowStockThreshold: item.lowStockThreshold ?? 0,
            });

            tx.update(itemRef, {
              availableQty: newAvailable,
              damagedQty: newDamaged,
              outQty: newOut,
              lifecycleState: newLifecycle,
              isLowStock,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: session.uid,
            });

            // CI-05 + CI-08 — write checkin tx with parentTxId
            const checkinTxRef = adminDb.collection("transactions").doc();
            txIds.push(checkinTxRef.id);
            tx.set(checkinTxRef, {
              type: "checkin",
              itemId: line.itemId,
              itemSku: item.sku,
              itemName: item.name,
              eventId: input.eventId,
              eventName: event.name,
              qty: line.returnedQty,
              actorUid: session.uid,
              actorName: session.displayName,
              actorRoleAtTimeOfAction: session.role,
              at: FieldValue.serverTimestamp(),
              notes: line.damaged ? "Damaged return" : "",
              parentTxId: line.parentTxId,
              clientTxId: null,
            });

            // MIS-01 — create missingItems doc + missing tx if missingDelta > 0
            if (missingDelta > 0) {
              const missingRef = adminDb.collection("missingItems").doc();
              missingIds.push(missingRef.id);
              tx.set(missingRef, {
                id: missingRef.id,
                itemId: line.itemId,
                itemName: item.name,
                eventId: input.eventId,
                eventName: event.name,
                qty: missingDelta,
                reason: line.missingReason ?? "Unknown",
                reportedBy: session.uid,
                reportedAt: FieldValue.serverTimestamp(),
                status: "open",
                resolvedAt: null,
                resolvedBy: null,
                parentCheckinTxId: checkinTxRef.id,
              });

              const missTxRef = adminDb.collection("transactions").doc();
              tx.set(missTxRef, {
                type: "missing",
                itemId: line.itemId,
                itemSku: item.sku,
                itemName: item.name,
                eventId: input.eventId,
                eventName: event.name,
                qty: missingDelta,
                actorUid: session.uid,
                actorName: session.displayName,
                actorRoleAtTimeOfAction: session.role,
                at: FieldValue.serverTimestamp(),
                notes: line.missingReason ?? "Unknown",
                parentTxId: line.parentTxId,
                clientTxId: null,
              });
            }
          }
        });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.startsWith("ITEM_NOT_FOUND") || msg.startsWith("PARENT_TX_NOT_FOUND")) {
          return { ok: false, error: msg };
        }
        if (msg === "MISSING_REASON_REQUIRED") {
          return { ok: false, error: "Missing-reason is required when returning less than checked-out qty." };
        }
        throw err;
      }

      revalidatePath(`/events/${input.eventId}`);
      revalidatePath("/inventory");
      revalidatePath("/reports/out");
      revalidatePath("/reports/missing");
      revalidatePath("/reports/history");
      revalidatePath("/");
      return { ok: true, txIds, missingIds };
    }
    ```
  </action>
  <acceptance_criteria>
    - `head -1 "app/(app)/events/[eventId]/checkin/actions.ts" | grep -q '"use server"'` succeeds.
    - `grep -q "commitCheckinCartAction" "app/(app)/events/[eventId]/checkin/actions.ts"` succeeds.
    - `grep -q "await requireSession()" "app/(app)/events/[eventId]/checkin/actions.ts"` succeeds.
    - `grep -q "runTransaction" "app/(app)/events/[eventId]/checkin/actions.ts"` succeeds.
    - `grep -q "parentTxId" "app/(app)/events/[eventId]/checkin/actions.ts"` succeeds (CI-08).
    - `grep -q "damagedQty" "app/(app)/events/[eventId]/checkin/actions.ts"` succeeds (CI-06).
    - `grep -q "missingDelta" "app/(app)/events/[eventId]/checkin/actions.ts"` succeeds (MIS-01).
    - `grep -q "MISSING_REASON_REQUIRED" "app/(app)/events/[eventId]/checkin/actions.ts"` succeeds (CI-04).
    - `grep -q "computeIsLowStock" "app/(app)/events/[eventId]/checkin/actions.ts"` succeeds (P11).
    - `[ "$(grep -c revalidatePath 'app/(app)/events/[eventId]/checkin/actions.ts')" -ge "5" ]`.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>head -1 "app/(app)/events/[eventId]/checkin/actions.ts" | grep -q '"use server"' && grep -q "commitCheckinCartAction" "app/(app)/events/[eventId]/checkin/actions.ts" && grep -q "MISSING_REASON_REQUIRED" "app/(app)/events/[eventId]/checkin/actions.ts" && grep -q "damagedQty" "app/(app)/events/[eventId]/checkin/actions.ts" && grep -q "computeIsLowStock" "app/(app)/events/[eventId]/checkin/actions.ts" && npx tsc --noEmit</automated>
  </verify>
  <done>Check-in Server Action live with damaged routing + missing detection + parentTxId chain.</done>
</task>

<task type="auto">
  <name>Task 2: Check-in page + form swap</name>
  <files>
    app/(app)/events/[eventId]/checkin/page.tsx,
    app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx
  </files>
  <read_first>
    - app/(app)/events/[eventId]/checkin/page.tsx (Phase 1)
    - app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx (Phase 1: uses selectOpenCheckoutsForEvent + store.checkin)
    - lib/data/events.server.ts getOpenCheckoutsForEventServer (from 02-07)
    - lib/auth/dal.ts
    - lib/hooks/use-transactions-live.ts
  </read_first>
  <action>
    **2.1 — `app/(app)/events/[eventId]/checkin/page.tsx`:** swap to real DAL + getEventServer + initial open checkouts:

    ```typescript
    import { notFound, redirect } from "next/navigation";
    import { requireSession } from "@/lib/auth/dal";
    import { getEventServer, getOpenCheckoutsForEventServer } from "@/lib/data/events.server";
    import { CheckinForm } from "./_components/checkin-form";

    type RouteProps = { params: Promise<{ eventId: string }> };

    export default async function CheckinPage({ params }: RouteProps) {
      const session = await requireSession();
      const { eventId } = await params;
      const event = await getEventServer(eventId, session);
      if (!event) notFound();
      const openCheckouts = await getOpenCheckoutsForEventServer(eventId);
      return (
        <CheckinForm
          event={event}
          initialOpenCheckouts={openCheckouts}
        />
      );
    }
    ```

    **2.2 — `app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx`:**

    Phase 1 reads `selectOpenCheckoutsForEvent` from mock selectors + calls `store.checkin(...)`. Swap to:
    - Initial state from `initialOpenCheckouts` prop (SSR seed)
    - Live updates via `useTransactionsLive({eventId, type: 'checkout'})` + `{eventId, type: 'checkin'}` to compute open status reactively (CI-07 partial check-ins update the view)
    - Commit calls `commitCheckinCartAction`

    ```typescript
    "use client";
    import { useState, useTransition, useMemo } from "react";
    import { useRouter } from "next/navigation";
    import { toast } from "sonner";
    import { commitCheckinCartAction } from "@/app/(app)/events/[eventId]/checkin/actions";
    import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";
    // ... Phase 1 imports for form/qty stepper/missing-reason select ...

    type Line = {
      parentTxId: string;
      itemId: string;
      itemName: string;
      parentQty: number;
      returnedQty: number;
      missingReason: "Lost" | "Damaged" | "Not returned" | "Unknown" | "";
      damaged: boolean;
    };

    export function CheckinForm({ event, initialOpenCheckouts }: {
      event: EventDoc;
      initialOpenCheckouts: TransactionDoc[];
    }) {
      const router = useRouter();
      const [pending, startTransition] = useTransition();

      // Live updates: subscribe to both checkout + checkin for this event;
      // compute current open lines (CI-07 partial check-ins)
      const checkouts = useTransactionsLive({ eventId: event.id, type: "checkout", initial: initialOpenCheckouts });
      const checkins = useTransactionsLive({ eventId: event.id, type: "checkin" });
      const openLines = useMemo(() => {
        // For each checkout, subtract all checkins where parentTxId matches
        const checkinByParent = new Map<string, number>();
        for (const ci of checkins) {
          if (!ci.parentTxId) continue;
          checkinByParent.set(ci.parentTxId, (checkinByParent.get(ci.parentTxId) ?? 0) + ci.qty);
        }
        return checkouts
          .map((co) => ({
            parentTxId: co.id,
            itemId: co.itemId,
            itemName: co.itemName,
            checkedOutQty: co.qty,
            returnedToDate: checkinByParent.get(co.id) ?? 0,
            remaining: co.qty - (checkinByParent.get(co.id) ?? 0),
          }))
          .filter((l) => l.remaining > 0);
      }, [checkouts, checkins]);

      const [lines, setLines] = useState<Line[]>(() =>
        openLines.map((l) => ({
          parentTxId: l.parentTxId,
          itemId: l.itemId,
          itemName: l.itemName,
          parentQty: l.checkedOutQty,
          returnedQty: l.remaining, // CI-03 default = original checked-out qty (less anything already returned)
          missingReason: "",
          damaged: false,
        })),
      );

      function commit() {
        // CI-04 validation client-side
        for (const l of lines) {
          if (l.returnedQty < l.parentQty - 0 && !l.missingReason) {
            toast.error("Missing reason required for any non-full return.");
            return;
          }
        }
        startTransition(async () => {
          const result = await commitCheckinCartAction({
            eventId: event.id,
            lines: lines.map((l) => ({
              itemId: l.itemId,
              parentTxId: l.parentTxId,
              returnedQty: l.returnedQty,
              missingReason: l.missingReason || undefined,
              damaged: l.damaged,
            })),
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`Checked in ${result.txIds.length} line(s)` + (result.missingIds.length > 0 ? `; ${result.missingIds.length} flagged missing` : ""));
          router.push(`/events/${event.id}`);
        });
      }

      // PRESERVE Phase 1 line rendering + qty stepper + missing-reason Select + damaged toggle.
      // ... JSX ...
    }
    ```
  </action>
  <acceptance_criteria>
    - `grep -q "from \"@/lib/auth/dal\"" "app/(app)/events/[eventId]/checkin/page.tsx"` succeeds.
    - `grep -q "getOpenCheckoutsForEventServer" "app/(app)/events/[eventId]/checkin/page.tsx"` succeeds.
    - `grep -q "commitCheckinCartAction" "app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx"` succeeds.
    - `grep -q "useTransactionsLive" "app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx"` succeeds.
    - `grep -q "selectOpenCheckoutsForEvent" "app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx"` FAILS.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "getOpenCheckoutsForEventServer" "app/(app)/events/[eventId]/checkin/page.tsx" && grep -q "commitCheckinCartAction" "app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx" && grep -q "useTransactionsLive" "app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx" && ! grep -q "selectOpenCheckoutsForEvent" "app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx" && npm run build</automated>
  </verify>
  <done>Check-in page + form on Firebase. CI-07 partial check-ins flow naturally via live subscription.</done>
</task>

<task type="auto">
  <name>Task 3: resolveMissing Server Action + ResolveMissingSheet wiring + missing data layer + hook</name>
  <files>
    app/(app)/reports/missing/actions.ts,
    components/feature/missing/ResolveMissingSheet.tsx,
    lib/data/missing.server.ts,
    lib/hooks/use-missing-live.ts
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §6.2 lines 1436-1447 (resolveMissing stub)
    - lib/mock/store.ts lines 511-568 (Phase 1 resolveMissing — match signature + behavior)
    - components/feature/missing/ResolveMissingSheet.tsx (Phase 1 — uses store.resolveMissing)
    - lib/types/missing-item.ts (MissingItemDoc, MissingStatus types)
    - lib/data/users.server.ts (mirror cursor pattern)
    - lib/auth/dal.ts, lib/firebase/admin.ts, lib/firebase/client.ts
    - .planning/REQUIREMENTS.md MIS-02..04
  </read_first>
  <action>
    **3.1 — `lib/data/missing.server.ts`:**

    ```typescript
    import "server-only";
    import { adminDb } from "@/lib/firebase/admin";
    import type { MissingItemDoc } from "@/lib/types/missing-item";

    type MissingCursor = { reportedAt: number; id: string };
    function encodeCursor(c: MissingCursor): string { return Buffer.from(JSON.stringify(c)).toString("base64"); }
    function decodeCursor(s: string): MissingCursor | null {
      try { return JSON.parse(Buffer.from(s, "base64").toString("utf8")); } catch { return null; }
    }

    function toMissing(snap: FirebaseFirestore.QueryDocumentSnapshot): MissingItemDoc {
      const d = snap.data();
      return {
        id: snap.id,
        itemId: d.itemId,
        itemName: d.itemName,
        eventId: d.eventId,
        eventName: d.eventName,
        qty: d.qty,
        reason: d.reason,
        reportedBy: d.reportedBy,
        reportedAt: d.reportedAt?.toMillis?.() ?? 0,
        status: d.status,
        resolvedAt: d.resolvedAt?.toMillis?.() ?? null,
        resolvedBy: d.resolvedBy ?? null,
        parentCheckinTxId: d.parentCheckinTxId,
      } as MissingItemDoc;
    }

    export async function getMissingPage(opts: {
      cursor?: string | null;
      limit?: number;
      filters?: { status?: "open" | "resolved"; eventId?: string; itemId?: string };
    }) {
      const limit = opts.limit ?? 50;
      let q: FirebaseFirestore.Query = adminDb.collection("missingItems");
      if (opts.filters?.status) q = q.where("status", "==", opts.filters.status);
      if (opts.filters?.eventId) q = q.where("eventId", "==", opts.filters.eventId);
      if (opts.filters?.itemId) q = q.where("itemId", "==", opts.filters.itemId);
      q = q.orderBy("reportedAt", "desc").orderBy("__name__").limit(limit + 1);

      const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
      if (cursor) q = q.startAfter(cursor.reportedAt, cursor.id);

      const snap = await q.get();
      const docs = snap.docs.slice(0, limit);
      const hasMore = snap.docs.length > limit;
      const missing = docs.map(toMissing);
      const last = docs[docs.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({ reportedAt: last.data().reportedAt?.toMillis?.() ?? 0, id: last.id })
        : null;
      return { missing, nextCursor };
    }
    ```

    **3.2 — `lib/hooks/use-missing-live.ts`:**

    ```typescript
    "use client";
    import { useEffect, useState } from "react";
    import { collection, query, where, orderBy, limit as fbLimit, onSnapshot } from "firebase/firestore";
    import { db } from "@/lib/firebase/client";
    import type { MissingItemDoc } from "@/lib/types/missing-item";

    export function useMissingLive(
      initial: MissingItemDoc[],
      opts: { status?: "open" | "resolved"; limit?: number } = {},
    ): MissingItemDoc[] {
      const [items, setItems] = useState<MissingItemDoc[]>(initial);
      useEffect(() => {
        const constraints: any[] = [];
        if (opts.status) constraints.push(where("status", "==", opts.status));
        constraints.push(orderBy("reportedAt", "desc"), fbLimit(opts.limit ?? 50));
        const q = query(collection(db, "missingItems"), ...constraints);
        const unsub = onSnapshot(q, (snap) => {
          setItems(snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              itemId: data.itemId, itemName: data.itemName,
              eventId: data.eventId, eventName: data.eventName,
              qty: data.qty, reason: data.reason,
              reportedBy: data.reportedBy,
              reportedAt: data.reportedAt?.toMillis?.() ?? 0,
              status: data.status,
              resolvedAt: data.resolvedAt?.toMillis?.() ?? null,
              resolvedBy: data.resolvedBy ?? null,
              parentCheckinTxId: data.parentCheckinTxId,
            } as MissingItemDoc;
          }));
        });
        return () => unsub();
      }, [opts.status, opts.limit]);
      return items;
    }
    ```

    **3.3 — `app/(app)/reports/missing/actions.ts`** per RESEARCH §6.2:

    ```typescript
    "use server";
    import { requireAdmin } from "@/lib/auth/dal";
    import { adminDb } from "@/lib/firebase/admin";
    import { FieldValue } from "firebase-admin/firestore";
    import { revalidatePath } from "next/cache";
    import { computeIsLowStock } from "@/lib/schemas/item";
    import { z } from "zod";

    const ResolveMissingSchema = z.object({
      missingId: z.string().min(1),
      resolution: z.enum(["found", "writtenOff"]),
    });

    export async function resolveMissing(input: { missingId: string; resolution: "found" | "writtenOff" }) {
      const session = await requireAdmin();
      const parsed = ResolveMissingSchema.safeParse(input);
      if (!parsed.success) return { ok: false as const, error: "Invalid input" };
      const { missingId, resolution } = parsed.data;

      const missingRef = adminDb.collection("missingItems").doc(missingId);

      try {
        await adminDb.runTransaction(async (tx) => {
          const mSnap = await tx.get(missingRef);
          if (!mSnap.exists) throw new Error("MISSING_NOT_FOUND");
          const m = mSnap.data()!;
          if (m.status !== "open") throw new Error("ALREADY_RESOLVED");

          const itemRef = adminDb.collection("inventory").doc(m.itemId);
          const itemSnap = await tx.get(itemRef);
          if (!itemSnap.exists) throw new Error("ITEM_NOT_FOUND");
          const item = itemSnap.data()!;
          const qty = m.qty;

          let newAvailable = item.availableQty;
          let newTotal = item.totalQty;

          if (resolution === "found") {
            // MIS-03: returns qty to availableQty
            newAvailable = item.availableQty + qty;
          } else {
            // MIS-03: writtenOff decrements totalQty
            newTotal = item.totalQty - qty;
          }

          const isLowStock = computeIsLowStock({
            availableQty: newAvailable,
            lowStockThreshold: item.lowStockThreshold ?? 0,
          });

          tx.update(itemRef, {
            availableQty: newAvailable,
            totalQty: newTotal,
            isLowStock,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: session.uid,
          });

          tx.update(missingRef, {
            status: "resolved",
            resolvedAt: FieldValue.serverTimestamp(),
            resolvedBy: session.uid,
          });

          // MIS-04 — follow-up audit row
          const followupRef = adminDb.collection("transactions").doc();
          tx.set(followupRef, {
            type: "adjustment",
            itemId: m.itemId,
            itemSku: item.sku,
            itemName: item.name,
            eventId: m.eventId,
            eventName: m.eventName,
            qty,
            actorUid: session.uid,
            actorName: session.displayName,
            actorRoleAtTimeOfAction: session.role,
            at: FieldValue.serverTimestamp(),
            notes: `Resolved missing: ${resolution}`,
            parentTxId: m.parentCheckinTxId,
            clientTxId: null,
          });
        });
      } catch (err) {
        return { ok: false as const, error: (err as Error).message };
      }

      revalidatePath("/reports/missing");
      revalidatePath("/inventory");
      revalidatePath("/reports/history");
      revalidatePath("/");
      return { ok: true as const };
    }
    ```

    **3.4 — `components/feature/missing/ResolveMissingSheet.tsx`:**

    Swap from `store.resolveMissing` to Server Action:

    ```typescript
    "use client";
    import { useTransition } from "react";
    import { useRouter } from "next/navigation";
    import { toast } from "sonner";
    import { resolveMissing } from "@/app/(app)/reports/missing/actions";
    // ... preserve Phase 1 Sheet/RadioGroup/Button imports ...

    export function ResolveMissingSheet({ missing }: { missing: MissingItemDoc }) {
      const router = useRouter();
      const [pending, startTransition] = useTransition();

      function commit(resolution: "found" | "writtenOff") {
        startTransition(async () => {
          const res = await resolveMissing({ missingId: missing.id, resolution });
          if (!res.ok) { toast.error(res.error); return; }
          toast.success("Resolved");
          router.refresh();
        });
      }
      // PRESERVE Phase 1 Sheet chrome + RadioGroup of resolutions + destructive vs primary button styling
    }
    ```
  </action>
  <acceptance_criteria>
    - `head -1 lib/data/missing.server.ts | grep -q 'import "server-only"'` succeeds.
    - `grep -q "getMissingPage" lib/data/missing.server.ts` succeeds.
    - `grep -q "onSnapshot" lib/hooks/use-missing-live.ts` succeeds.
    - `head -1 "app/(app)/reports/missing/actions.ts" | grep -q '"use server"'` succeeds.
    - `grep -q "requireAdmin" "app/(app)/reports/missing/actions.ts"` succeeds.
    - `grep -q "runTransaction" "app/(app)/reports/missing/actions.ts"` succeeds.
    - `grep -q "type: \"adjustment\"" "app/(app)/reports/missing/actions.ts"` succeeds (MIS-04 follow-up tx).
    - `grep -q "computeIsLowStock" "app/(app)/reports/missing/actions.ts"` succeeds.
    - `grep -q "from \"@/app/(app)/reports/missing/actions\"" components/feature/missing/ResolveMissingSheet.tsx` succeeds.
    - `grep -q "from \"@/lib/mock/store\"" components/feature/missing/ResolveMissingSheet.tsx` FAILS.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>head -1 "app/(app)/reports/missing/actions.ts" | grep -q '"use server"' && grep -q "runTransaction" "app/(app)/reports/missing/actions.ts" && grep -q "computeIsLowStock" "app/(app)/reports/missing/actions.ts" && grep -q "from \"@/app/(app)/reports/missing/actions\"" components/feature/missing/ResolveMissingSheet.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Missing item resolution full chain wired. /reports/missing page swap in 02-10.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: E2E check-in + missing resolution + Block F rules audit</name>
  <what-built>
    Full reconciliation: checkout → check-in → missing-on-shortfall → resolve.
  </what-built>
  <how-to-verify>
    **A — Full check-in:**
    1. Pre-req: from 02-08 Task 4, there should be open checkouts on an event. If not, do a fresh checkout: event X has item Y, totalQty=5; checkout 3 lines.
    2. Visit /events/X/checkin. Should pre-populate 3 lines, each with returnedQty=3 (CI-03 default).
    3. Set line returnedQty=3 (full return), damaged=false. Commit.
    4. Firestore: inventory item.availableQty went 2→5, outQty 3→0. transactions has new checkin doc with parentTxId pointing to the checkout. Item lifecycleState reverted to "available".

    **B — Partial check-in (CI-07):**
    1. Checkout 5 qty of item Y. Then /checkin → set returnedQty=3, missingReason="Damaged", damaged=true. Commit.
    2. Firestore: inventory.availableQty unchanged (damaged), damagedQty +=3, outQty -=5. (Wait — outQty drops by checkedOutQty=5 entirely? per current impl. That's the design: a single check-in completes the parent line. For TRUE partial across multiple check-ins, the form needs to chain — verify behavior in 02-09 with the live `openLines` recompute.) Actually per the action: `newOut = item.outQty - checkedOutQty` — that fully releases the line.
    3. **For CI-07 partial-across-actions:** the form's `openLines` recomputes after each commit. If user submits a partial (returnedQty=3, parentQty=5), missingDelta=2 → missingItems doc + missing tx. Then in the live view, the parent line shows checkedOut=5, returnedToDate=3, remaining=2 → user can submit another check-in for remaining qty. **Note current action's logic: outQty drops by checkedOutQty regardless of returnedQty.** That's per RESEARCH §6.1 line 1342: "outQty decrements by checkedOutQty regardless (the qty IS no longer out)" — once a check-in is recorded for a parent, the parent is closed. For true partials, do multiple check-ins, each against the SAME parentTxId is NOT supported — check-in form should issue separate parents. **Document this caveat in CLAIM.md** if discrepancy with REQUIREMENTS.md CI-07 is material; suggest follow-up clarification.

    For this E2E: just verify partial flow works as designed: a single check-in fully closes one parent tx; if returnedQty < parentQty, the shortfall becomes a missingItem.

    **C — Missing detected:**
    1. Use Step B's flow with returnedQty=3, parent=5, missingReason="Lost", damaged=false.
    2. Firestore: missingItems collection has a new doc with qty=2, status="open", reason="Lost".
    3. Visit /reports/missing — should show the new missing item.

    **D — Resolve missing — found:**
    1. Admin clicks Resolve → found.
    2. Firestore: missingItems.status=resolved, resolvedBy=admin uid. Inventory.availableQty += 2. transactions has new 'adjustment' doc with note "Resolved missing: found".

    **E — Resolve missing — writtenOff:**
    1. Create another missing scenario (Step B again). Resolve → writtenOff.
    2. Firestore: missingItems.status=resolved. Inventory.totalQty -= 2 (NOT availableQty).

    **F — Damaged returns route correctly (CI-06):**
    1. Check-in 2 qty with damaged=true. Verify availableQty unchanged; damagedQty +=2.

    **G — Block F rules audit — `## Rules Audit — Block F` in CLAIM.md:**
    | # | Path | Auth? | Role | Op | Expected |
    |---|------|-------|------|-----|----------|
    | 1 | /missingItems/<id> | Yes | staff | read | ALLOW |
    | 2 | /missingItems/<id> | Yes | staff | update with `{status: 'resolved'}` | DENY (server-only writes) |
    | 3 | /missingItems/<id> | Yes | admin | update with same payload via Web SDK | DENY (still server-only; admin uses Admin SDK via action) |
    | 4 | /missingItems/<id> | No (anonymous) | — | read | DENY |
    | 5 | /transactions/<id> | Yes | admin | update with `{type: 'mutated'}` | DENY (immutable per AUD-04) |

    Report PASS/FAIL each.
  </how-to-verify>
  <resume-signal>Type "checkin + missing E2E PASS, rules audit logged" or describe failures + any CI-07 nuance noted in CLAIM.md.</resume-signal>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation |
|---|---|---|---|---|
| T-02-09-01 | Tampering | Negative outQty via repeated check-ins on same parent | mitigate | parentTxId chain inside transaction; outQty drop is at most checkedOutQty (parent tx is closed); subsequent check-ins against same parent must come via openLines recompute |
| T-02-09-02 | Tampering | Damaged items return to availableQty | mitigate | CI-06: line.damaged ? returnedToDamaged : returnedToAvailable inside the transaction |
| T-02-09-03 | EoP | Staff resolves missing | mitigate | requireAdmin() at top of resolveMissing |
| T-02-09-04 | Repudiation | Missing-item dispute | mitigate | parentCheckinTxId links missingItems doc to the originating checkin tx; AUD-01 actor snapshot present |
| T-02-09-05 | Tampering | Resolution via direct Firestore write | mitigate | firestore.rules missingItems update: if false; only Admin SDK Server Action writes |
| T-02-09-06 | Tampering | isLowStock drift after check-in | mitigate | computeIsLowStock inside the same runTransaction (P11) |
</threat_model>

<verification>
- commitCheckinCartAction wraps everything in a single Firestore transaction; parentTxId chain (CI-08); damaged routing (CI-06); missing detection (MIS-01).
- resolveMissing admin-only; found/writtenOff branches; follow-up adjustment transaction (MIS-04).
- Live hook + Server-Component-seed pattern preserved.
- Block F rules audit (5+ cases) logged.
- npm run build green.
</verification>

<success_criteria>
- CI-01..08 all functional (with CI-07 noted caveat documented in CLAIM.md).
- MIS-01..04 all functional.
- INT-01, INT-03, INT-04, AUD-01/02/03/04 satisfied.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-09-checkin-action-and-missing-SUMMARY.md` documenting files, E2E test outcomes (full + partial check-in + missing resolution branches), Block F rules audit, and any CI-07 partial-check-in caveat to revisit in v2. <= 100 lines.
</output>
