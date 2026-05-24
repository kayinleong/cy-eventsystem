---
phase: 01-ui-poc
plan: 10
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - app/(app)/events/[eventId]/checkin/page.tsx
  - app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx
  - components/feature/checkin/CheckinLineRow.tsx
  - components/feature/checkin/MissingReasonSelect.tsx
autonomous: true
requirements:
  - CI-01
  - CI-03
  - CI-04
  - CI-05
  - CI-06
  - CI-07
  - CI-08
  - MIS-01
  - NFR-05

must_haves:
  truths:
    - "/events/[eventId]/checkin lists every open check-out line for the event, pre-populated returned-qty = checked-out-qty (CI-03)."
    - "For each line, returned + damaged ≤ checkedOut. If returned + damaged < checkedOut, missingReason becomes REQUIRED (CI-04)."
    - "Damaged qty routes to item.damagedQty bucket per CI-06 — handled by store.checkin."
    - "Submit commits ALL lines at once via store.checkin (atomic) and creates MissingItem records as needed (MIS-01)."
    - "Access gate: admin OR uid in event.allowedStaff (EVT-08)."
    - "Partial check-ins supported (CI-07) — committing some lines now leaves others open for later."
    - "Each newly created check-in transaction has parentTxId set to its source checkout tx (CI-08)."
  artifacts:
    - path: "app/(app)/events/[eventId]/checkin/page.tsx"
      provides: "Server shell with access gate + event/open-tx lookup"
      contains: "selectOpenCheckoutsForEvent"
    - path: "app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx"
      provides: "rhf form with array of lines; calls store.checkin on submit"
      contains: "useFieldArray"
      min_lines: 100
    - path: "components/feature/checkin/CheckinLineRow.tsx"
      provides: "Per-line return-qty + damaged-qty + missing-reason controls; computes missing delta and surfaces CI-04 validation inline"
      contains: "QtyStepper"
    - path: "components/feature/checkin/MissingReasonSelect.tsx"
      provides: "shadcn Select for 4 missing reasons"
      contains: "Lost|Damaged|Not returned|Unknown"
  key_links:
    - from: "app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx"
      to: "lib/mock/store.ts checkin + lib/schemas/transaction.ts CheckinLineSchema"
      via: "rhf.handleSubmit → store.checkin({ eventId, lines, actor })"
      pattern: "checkin\\("
---

<objective>
Build the per-event check-in flow: a form pre-populated with the event's open checkouts. User decrements returned-qty if items didn't come back, marks damaged separately, and selects a missing reason if there's a delta. Submit commits all lines atomically.

Output: 1 server route shell + 1 client form + 2 sub-components.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@.planning/research/FEATURES.md
@lib/types/transaction.ts
@lib/types/missing-item.ts
@lib/types/event.ts
@lib/schemas/transaction.ts
@lib/mock/store.ts
@lib/mock/selectors.ts
@lib/mock/users.ts
@lib/auth/mock-session.ts
@lib/hooks/use-current-user.ts
@components/ui/page-header.tsx
@components/ui/card.tsx
@components/ui/button.tsx
@components/ui/select.tsx
@components/ui/form.tsx
@components/ui/empty-state.tsx
@components/feature/inventory/QtyStepper.tsx
@components/feature/status/StatusBadge.tsx

<interfaces>
```tsx
export function MissingReasonSelect(props: { value: MissingReason | ""; onChange: (v: MissingReason | "") => void; required?: boolean }): React.ReactElement;
export function CheckinLineRow(props: {
  parentTxId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  checkedOutQty: number;
  returnedQty: number;
  damagedQty: number;
  missingReason: MissingReason | "";
  onReturned: (v: number) => void;
  onDamaged: (v: number) => void;
  onMissingReason: (v: MissingReason | "") => void;
}): React.ReactElement;
export function CheckinForm(props: { event: EventDoc; openTxs: TransactionDoc[] }): React.ReactElement;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: MissingReasonSelect + CheckinLineRow components</name>
  <files>
    components/feature/checkin/MissingReasonSelect.tsx,
    components/feature/checkin/CheckinLineRow.tsx
  </files>
  <read_first>
    - .planning/REQUIREMENTS.md CI-03, CI-04, CI-06, CI-07
    - .planning/research/FEATURES.md "Missing item modeling on check-in" (the table example with Returned + Missing + Reason columns)
    - lib/types/missing-item.ts (MissingReason enum)
    - components/ui/select.tsx
    - components/feature/inventory/QtyStepper.tsx
  </read_first>
  <action>
    **components/feature/checkin/MissingReasonSelect.tsx**:
    ```tsx
    "use client";
    import {
      Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    } from "@/components/ui/select";
    import type { MissingReason } from "@/lib/types/missing-item";

    const REASONS: MissingReason[] = ["Lost", "Damaged", "Not returned", "Unknown"];

    export function MissingReasonSelect({
      value,
      onChange,
      required = false,
    }: {
      value: MissingReason | "";
      onChange: (v: MissingReason | "") => void;
      required?: boolean;
    }) {
      return (
        <Select value={value || undefined} onValueChange={(v) => onChange(v as MissingReason)}>
          <SelectTrigger className={required && !value ? "border-destructive" : ""}>
            <SelectValue placeholder={required ? "Required" : "—"} />
          </SelectTrigger>
          <SelectContent>
            {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    ```

    **components/feature/checkin/CheckinLineRow.tsx** (per-line row showing checked-out / returned / damaged / missing-delta / reason):
    ```tsx
    "use client";
    import Link from "next/link";
    import { QtyStepper } from "@/components/feature/inventory/QtyStepper";
    import { MissingReasonSelect } from "./MissingReasonSelect";
    import type { MissingReason } from "@/lib/types/missing-item";

    export function CheckinLineRow({
      itemId,
      itemSku,
      itemName,
      checkedOutQty,
      returnedQty,
      damagedQty,
      missingReason,
      onReturned,
      onDamaged,
      onMissingReason,
    }: {
      parentTxId: string;
      itemId: string;
      itemSku: string;
      itemName: string;
      checkedOutQty: number;
      returnedQty: number;
      damagedQty: number;
      missingReason: MissingReason | "";
      onReturned: (v: number) => void;
      onDamaged: (v: number) => void;
      onMissingReason: (v: MissingReason | "") => void;
    }) {
      const missingDelta = Math.max(0, checkedOutQty - returnedQty - damagedQty);
      const exceedsCheckedOut = returnedQty + damagedQty > checkedOutQty;
      const reasonRequired = missingDelta > 0;
      const showError =
        exceedsCheckedOut ||
        (reasonRequired && !missingReason);

      return (
        <div className="grid grid-cols-12 gap-3 items-start py-3 border-b last:border-b-0">
          <div className="col-span-12 md:col-span-4 min-w-0">
            <Link href={`/inventory/${itemId}`} className="text-sm font-medium hover:underline truncate block">
              {itemName}
            </Link>
            <p className="text-xs font-mono text-muted-foreground">{itemSku}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Checked out: {checkedOutQty}</p>
          </div>
          <div className="col-span-6 md:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Returned</p>
            <QtyStepper value={returnedQty} onChange={onReturned} min={0} max={checkedOutQty - damagedQty} />
          </div>
          <div className="col-span-6 md:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Damaged</p>
            <QtyStepper value={damagedQty} onChange={onDamaged} min={0} max={checkedOutQty - returnedQty} />
          </div>
          <div className="col-span-6 md:col-span-1 flex flex-col items-center pt-3">
            <p className="text-xs text-muted-foreground">Missing</p>
            <p className={`text-lg font-semibold ${missingDelta > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{missingDelta}</p>
          </div>
          <div className="col-span-6 md:col-span-3">
            <p className="text-xs text-muted-foreground mb-1">Reason</p>
            <MissingReasonSelect
              value={missingReason}
              onChange={onMissingReason}
              required={reasonRequired}
            />
          </div>
          {showError ? (
            <p className="col-span-12 text-xs text-destructive">
              {exceedsCheckedOut
                ? "Returned + damaged cannot exceed checked out."
                : "Select a reason for missing items."}
            </p>
          ) : null}
        </div>
      );
    }
    ```
  </action>
  <verify>
    <automated>ls components/feature/checkin/MissingReasonSelect.tsx components/feature/checkin/CheckinLineRow.tsx; grep -q "Lost" components/feature/checkin/MissingReasonSelect.tsx; grep -q "Damaged" components/feature/checkin/MissingReasonSelect.tsx; grep -q "Not returned" components/feature/checkin/MissingReasonSelect.tsx; grep -q "Unknown" components/feature/checkin/MissingReasonSelect.tsx; grep -q "QtyStepper" components/feature/checkin/CheckinLineRow.tsx; grep -q "missingDelta" components/feature/checkin/CheckinLineRow.tsx; grep -q "Returned" components/feature/checkin/CheckinLineRow.tsx; grep -q "Damaged" components/feature/checkin/CheckinLineRow.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist.
    - MissingReasonSelect lists all 4 reasons: Lost, Damaged, Not returned, Unknown.
    - CheckinLineRow shows 3 columns: Returned (QtyStepper), Damaged (QtyStepper), Missing (computed display), plus a Reason select (required when missingDelta > 0).
    - tsc passes.
  </acceptance_criteria>
  <done>Both row components compile; missing-delta computed correctly with CI-04 validation visible.</done>
</task>

<task type="auto">
  <name>Task 2: CheckinForm + /events/[eventId]/checkin route</name>
  <files>
    app/(app)/events/[eventId]/checkin/page.tsx,
    app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx
  </files>
  <read_first>
    - .planning/REQUIREMENTS.md CI-01, CI-03, CI-04, CI-05, CI-06, CI-07, CI-08, MIS-01
    - lib/mock/store.ts (checkin signature returns `{ ok, txIds, missingIds }`)
    - lib/mock/selectors.ts (selectOpenCheckoutsForEvent — returns open checkout transactions)
    - lib/auth/mock-session.ts
    - react-hook-form useFieldArray docs (https://react-hook-form.com/docs/usefieldarray)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
  </read_first>
  <action>
    **D-11 sortable-columns rule (see Plan 03 Task 2):** This flow renders each open checkout as a form row via `useFieldArray` (NOT a TanStack DataTable), so no header-level sort exists here. If a missing-items summary table is rendered for the event, the `reason` column MUST NOT be sortable per D-11 (plain string header, no `toggleSorting`, no `ArrowUpDown`). Sortable columns in any such table = item name, qty, at/timestamp. Carry `// D-11: reason text is NOT sortable` on the reason column.

    **app/(app)/events/[eventId]/checkin/page.tsx** (Server shell):
    ```tsx
    import type { Metadata } from "next";
    import { notFound, redirect } from "next/navigation";
    import Link from "next/link";
    import { ChevronLeft } from "lucide-react";
    import { requireSession } from "@/lib/auth/mock-session";
    import { getSnapshot } from "@/lib/mock/store";
    import { selectEventById, selectOpenCheckoutsForEvent } from "@/lib/mock/selectors";
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { EmptyState } from "@/components/ui/empty-state";
    import { PackageOpen } from "lucide-react";
    import { CheckinForm } from "./_components/checkin-form";

    type RouteProps = { params: Promise<{ eventId: string }> };

    export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
      const { eventId } = await params;
      const ev = selectEventById(getSnapshot(), eventId);
      return { title: ev ? `Check in · ${ev.name}` : "Check in" };
    }

    export default async function CheckinPage({ params }: RouteProps) {
      const session = await requireSession();
      const { eventId } = await params;
      const event = selectEventById(getSnapshot(), eventId);
      if (!event) notFound();

      if (session.role !== "admin" && !event.allowedStaff.includes(session.uid)) {
        redirect("/unauthorized");
      }

      // Read open checkouts at request time; the client form will re-read after each commit
      const openTxs = selectOpenCheckoutsForEvent(getSnapshot(), eventId);

      return (
        <div className="space-y-4">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={`/events/${eventId}`}><ChevronLeft className="mr-1 size-4" /> Back to event</Link>
          </Button>
          <PageHeader
            title={`Check in · ${event.name}`}
            description="Mark returned, damaged, or missing for each item."
          />
          {openTxs.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              heading="Nothing to check in"
              body="All items have been returned or the event has no open check-outs."
              action={
                <Button asChild variant="outline">
                  <Link href={`/events/${eventId}`}>Back to event</Link>
                </Button>
              }
            />
          ) : (
            <CheckinForm eventId={eventId} initialOpenTxs={openTxs} />
          )}
        </div>
      );
    }
    ```

    **app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx** (client form, useFieldArray + store.checkin):
    ```tsx
    "use client";
    import { useState } from "react";
    import { useRouter } from "next/navigation";
    import { toast } from "sonner";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectOpenCheckoutsForEvent } from "@/lib/mock/selectors";
    import { checkin } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import { Button } from "@/components/ui/button";
    import { Card, CardContent } from "@/components/ui/card";
    import { CheckinLineRow } from "@/components/feature/checkin/CheckinLineRow";
    import type { MissingReason } from "@/lib/types/missing-item";
    import type { TransactionDoc } from "@/lib/types/transaction";

    type LineState = {
      parentTxId: string;
      itemId: string;
      itemSku: string;
      itemName: string;
      checkedOutQty: number;
      returnedQty: number;
      damagedQty: number;
      missingReason: MissingReason | "";
    };

    function buildLine(t: TransactionDoc): LineState {
      return {
        parentTxId: t.id,
        itemId: t.itemId,
        itemSku: t.itemSku,
        itemName: t.itemName,
        checkedOutQty: t.qty,
        returnedQty: t.qty,   // CI-03: default returned = checked-out
        damagedQty: 0,
        missingReason: "",
      };
    }

    export function CheckinForm({ eventId, initialOpenTxs }: { eventId: string; initialOpenTxs: TransactionDoc[] }) {
      const router = useRouter();
      const session = useCurrentUser();
      // Re-read live so newly-committed lines drop out of the list naturally
      const liveOpen = useMockStore((s) => selectOpenCheckoutsForEvent(s, eventId));

      // Maintain per-line state keyed by parentTxId; initialize from initialOpenTxs and merge in any new entries from liveOpen
      const [lines, setLines] = useState<LineState[]>(() => initialOpenTxs.map(buildLine));
      const [submitting, setSubmitting] = useState(false);

      // Keep lines in sync with liveOpen (drop committed rows; add any that newly appeared)
      const liveIds = new Set(liveOpen.map((t) => t.id));
      const currentLines = lines.filter((l) => liveIds.has(l.parentTxId));
      const missingFromState = liveOpen.filter((t) => !lines.some((l) => l.parentTxId === t.id));
      const allLines = [...currentLines, ...missingFromState.map(buildLine)];

      function update(parentTxId: string, patch: Partial<LineState>) {
        setLines((prev) => {
          const exists = prev.find((l) => l.parentTxId === parentTxId);
          if (!exists) {
            const fromLive = liveOpen.find((t) => t.id === parentTxId);
            if (!fromLive) return prev;
            return [...prev, { ...buildLine(fromLive), ...patch }];
          }
          return prev.map((l) => l.parentTxId === parentTxId ? { ...l, ...patch } : l);
        });
      }

      function validate(line: LineState): string | null {
        if (line.returnedQty + line.damagedQty > line.checkedOutQty) return "Returned + damaged cannot exceed checked out.";
        const missingDelta = line.checkedOutQty - line.returnedQty - line.damagedQty;
        if (missingDelta > 0 && !line.missingReason) return "Pick a reason for missing items.";
        return null;
      }

      function submit() {
        // CI-04 validation
        const errors = allLines.map(validate).filter(Boolean);
        if (errors.length > 0) { toast.error("Fix the errors above before submitting."); return; }

        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't check in"); return; }

        // Only include lines where something happens (returnedQty > 0 OR damagedQty > 0 OR missing delta > 0)
        const payload = allLines
          .filter((l) => l.returnedQty > 0 || l.damagedQty > 0 || (l.checkedOutQty - l.returnedQty - l.damagedQty) > 0)
          .map((l) => ({
            parentTxId: l.parentTxId,
            itemId: l.itemId,
            returnedQty: l.returnedQty,
            damagedQty: l.damagedQty,
            missingReason: l.missingReason || undefined,
          }));

        if (payload.length === 0) { toast.error("Nothing to check in"); return; }

        setSubmitting(true);
        const result = checkin({ eventId, lines: payload, actor });
        if (result.ok) {
          // CI-07 partial check-ins: some lines may still be open after this commit; routing back to event detail surfaces them
          toast.success(`${payload.length} ${payload.length === 1 ? "line" : "lines"} checked in`);
          router.push(`/events/${eventId}`);
        } else {
          toast.error("Couldn't check in");
        }
        setSubmitting(false);
      }

      return (
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="hidden md:grid grid-cols-12 gap-3 pb-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <div className="col-span-4">Item</div>
              <div className="col-span-2">Returned</div>
              <div className="col-span-2">Damaged</div>
              <div className="col-span-1 text-center">Missing</div>
              <div className="col-span-3">Reason</div>
            </div>
            {allLines.map((line) => (
              <CheckinLineRow
                key={line.parentTxId}
                parentTxId={line.parentTxId}
                itemId={line.itemId}
                itemSku={line.itemSku}
                itemName={line.itemName}
                checkedOutQty={line.checkedOutQty}
                returnedQty={line.returnedQty}
                damagedQty={line.damagedQty}
                missingReason={line.missingReason}
                onReturned={(v) => update(line.parentTxId, { returnedQty: v })}
                onDamaged={(v) => update(line.parentTxId, { damagedQty: v })}
                onMissingReason={(v) => update(line.parentTxId, { missingReason: v })}
              />
            ))}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="button" onClick={submit} disabled={submitting || allLines.length === 0}>
                Confirm return
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    ```

    Critical:
    - The form is purely client state (no rhf needed because the shape is dynamic and changes with store updates). This is acceptable for Phase 1 — Phase 2 will use useActionState + Server Actions per the standard pattern.
    - Submit calls `checkin()` from the mock store; it handles all the math (decrements outQty, increments availableQty for returned, increments damagedQty for damaged, creates MissingItem record + missing-type transaction for the delta with reason).
    - Empty-state for no-open-checkouts is in the SERVER page.tsx, NOT in the form, so the form never has to handle empty.
  </action>
  <verify>
    <automated>ls app/(app)/events/[eventId]/checkin/page.tsx app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx; grep -q "await params" app/(app)/events/[eventId]/checkin/page.tsx; grep -q "allowedStaff.includes" app/(app)/events/[eventId]/checkin/page.tsx; grep -q "selectOpenCheckoutsForEvent" app/(app)/events/[eventId]/checkin/page.tsx; grep -q "checkin(" app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx; grep -q "missingReason" app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx; grep -q "parentTxId" app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx; grep -q "Nothing to check in" app/(app)/events/[eventId]/checkin/page.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist.
    - Server route enforces EVT-08 access check + uses `await params`.
    - Server route renders an empty state when there are no open check-outs (CI-07 — partial check-ins return to this page with fewer rows).
    - CheckinForm calls `checkin()` mutator with payload referencing `parentTxId` (CI-08).
    - CI-04 validation: lines where returned + damaged < checkedOut require missingReason; the form blocks submit until valid.
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <done>Check-in form pre-populates returned-qty = checked-out-qty, supports damaged column, requires missing-reason when delta > 0, commits atomically via store.checkin, creates MissingItem records for delta lines.</done>
</task>

</tasks>

<verification>
- Visiting /events/evt-active-01/checkin (an event with open checkouts in seed data) renders the form with all open lines pre-populated.
- Decrementing a returnedQty below checkedOutQty triggers the inline "Pick a reason for missing items." validation; selecting a reason clears it.
- Damaged column increments item.damagedQty (verify by visiting the item detail page afterwards).
- Submitting partial check-in (commit some lines, leave others) leaves remaining lines visible after redirect → re-navigate.
- npm run build passes.
</verification>

<success_criteria>CI-01, CI-03, CI-04, CI-05, CI-06, CI-07, CI-08, MIS-01 satisfied at Phase 1 mock level.</success_criteria>

<output>After completion, create `.planning/phases/phase-kayinleong-01/01-10-checkin-flow-SUMMARY.md` documenting the 4 files, the validation rules enforced inline, and a verification walkthrough showing partial check-in plus missing-item creation.</output>
