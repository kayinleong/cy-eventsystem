// CheckoutGroupDialog — post-checkout group barcode generation.
// quick-kayinleong-006
//
// Two-step dialog:
//   Step 1: User chooses how many groups to split the cart into (1–10).
//           Clicking "Generate" calls createCheckoutGroupAction for each group
//           in parallel. If ALL succeed, moves to step 2.
//   Step 2: Renders one PrintLabelButton per group so the user can print
//           physical barcode labels. "Done" navigates to the event page.
//
// "Skip" on step 1 calls onDone() immediately without creating any groups.
//
// Dialog stays open (open=always true) — user MUST use Skip or Done to close.
// No accidental dismiss via backdrop click.

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrintLabelButton } from "@/components/feature/inventory/PrintLabelButton";
import {
  createCheckoutGroupAction,
  type CreateCheckoutGroupResult,
} from "@/app/(app)/events/[eventId]/checkout/actions";
import type { CommitSuccessPayload, ScanCartLine } from "@/components/feature/scan/scan-session";
import { CheckoutChecklistDialog } from "./CheckoutChecklistDialog";
import { CheckoutDOPrintDialog } from "./CheckoutDOPrintDialog";

// ---- pure helper functions ----

function buildGroupLabel(
  groupIndex: number,
  totalGroups: number,
  eventName: string,
): string {
  if (totalGroups === 1) return eventName;
  return `Group ${groupIndex + 1} of ${totalGroups} — ${eventName}`;
}

// allocation[itemIdx][groupIdx] = qty assigned to that group.
// Initial distribution: whole item line → one group via modulo.
function initAllocation(cart: ScanCartLine[], n: number): number[][] {
  return cart.map((line, i) =>
    Array.from({ length: n }, (_, g) => (g === i % n ? line.qty : 0)),
  );
}

function buildGroupLines(
  cart: ScanCartLine[],
  allocation: number[][],
  groupIdx: number,
): ScanCartLine[] {
  return cart
    .map((line, i) => ({ ...line, qty: allocation[i][groupIdx] }))
    .filter((l) => l.qty > 0);
}

// ---- types ----

type GeneratedGroup = {
  groupId: string;
  label: string;
  itemLines: ScanCartLine[];
};

type CheckoutGroupDialogProps = {
  payload: CommitSuccessPayload;
  eventName: string;
  eventStartDate: string; // ISO string — threaded from checkout-client.tsx event.startDate
  onDone: () => void;
};

// ---- component ----

export function CheckoutGroupDialog({
  payload,
  eventName,
  eventStartDate,
  onDone,
}: CheckoutGroupDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [splitCount, setSplitCount] = useState(1);
  const [allocation, setAllocation] = useState<number[][]>(() =>
    initAllocation(payload.cart, 1),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [groups, setGroups] = useState<GeneratedGroup[]>([]);

  function handleSplitCountChange(n: number) {
    setSplitCount(n);
    setAllocation(initAllocation(payload.cart, n));
  }

  function setCell(itemIdx: number, groupIdx: number, raw: string) {
    const parsed = parseInt(raw, 10);
    const value = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(payload.cart[itemIdx].qty, parsed));
    setAllocation((prev) => {
      const next = prev.map((row) => [...row]);
      next[itemIdx][groupIdx] = value;
      return next;
    });
  }

  // Each item row must be fully assigned before generating.
  const rowRemaining = payload.cart.map((line, i) =>
    line.qty - (allocation[i]?.reduce((s, v) => s + v, 0) ?? 0),
  );
  const isFullyAllocated = rowRemaining.every((r) => r === 0);

  async function handleGenerate() {
    setIsCreating(true);

    const results = await Promise.all(
      Array.from({ length: splitCount }, (_, g) => {
        const groupLines = buildGroupLines(payload.cart, allocation, g);
        const label = buildGroupLabel(g, splitCount, eventName);
        return createCheckoutGroupAction({
          eventId: payload.eventId,
          txIds: payload.txIds,
          itemLines: groupLines.map((l) => ({
            itemId: l.itemId,
            itemSku: l.itemSku,
            itemName: l.itemName,
            qty: l.qty,
          })),
          label,
        }).then(
          (result): { result: CreateCheckoutGroupResult; label: string; lines: ScanCartLine[] } => ({
            result,
            label,
            lines: groupLines,
          }),
        );
      }),
    );

    setIsCreating(false);

    const anyFailed = results.some((r) => !r.result.ok);
    if (anyFailed) {
      toast.error("Failed to create group barcode. Try again.");
      return;
    }

    // All succeeded — populate groups for step 2
    const generated: GeneratedGroup[] = results.map((r) => ({
      // safe to cast: we checked !anyFailed above
      groupId: (r.result as { ok: true; groupId: string }).groupId,
      label: r.label,
      itemLines: r.lines,
    }));
    setGroups(generated);
    setStep(2);
  }

  return (
    <Dialog open onOpenChange={() => { /* intentionally no-op — use Skip / Done */ }}>
      <DialogContent className="flex flex-col max-w-[95vw] sm:max-w-2xl w-full max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Group barcodes</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            {/* Group count picker */}
            <div className="flex items-center gap-3">
              <Label htmlFor="split-count" className="shrink-0">
                Number of groups
              </Label>
              <Input
                id="split-count"
                type="number"
                min={1}
                max={10}
                value={splitCount}
                onChange={(e) => {
                  const v = Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1));
                  handleSplitCountChange(v);
                }}
                className="w-24"
              />
            </div>

            {/* Allocation table — hidden when only 1 group */}
            {splitCount > 1 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Total
                      </th>
                      {Array.from({ length: splitCount }, (_, g) => (
                        <th key={g} className="px-3 py-2 text-center font-medium">
                          G{g + 1}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Left
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.cart.map((line, i) => {
                      const remaining = rowRemaining[i];
                      return (
                        <tr key={line.itemId} className="border-b last:border-0">
                          <td className="sticky left-0 bg-background px-3 py-1.5 font-medium max-w-[140px] truncate">
                            {line.itemName}
                          </td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground">
                            {line.qty}
                          </td>
                          {Array.from({ length: splitCount }, (_, g) => (
                            <td key={g} className="px-2 py-1.5 text-center">
                              <Input
                                type="number"
                                min={0}
                                max={line.qty}
                                value={allocation[i]?.[g] ?? 0}
                                onChange={(e) => setCell(i, g, e.target.value)}
                                className="h-7 w-14 text-center px-1"
                              />
                            </td>
                          ))}
                          <td
                            className={`px-3 py-1.5 text-right font-medium tabular-nums ${
                              remaining !== 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {remaining}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {splitCount === 1 && (
              <p className="text-sm text-muted-foreground">
                1 group — all {payload.cart.length} item line
                {payload.cart.length !== 1 ? "s" : ""}
              </p>
            )}

            {splitCount > 1 && !isFullyAllocated && (
              <p className="text-xs text-destructive">
                Assign all items before generating. Items shown in red still have
                unallocated quantity.
              </p>
            )}
          </div>
          <div className="shrink-0 flex justify-between gap-2 px-6 py-4 border-t">
            <Button variant="ghost" onClick={onDone} disabled={isCreating}>
              Skip
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isCreating || (splitCount > 1 && !isFullyAllocated)}
            >
              {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isCreating ? "Creating…" : "Generate"}
            </Button>
          </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              {groups.length === 1
                ? "Your group barcode is ready to print."
                : `${groups.length} group barcodes are ready to print.`}
            </p>

            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.groupId}
                  className="flex items-center justify-between gap-4 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{group.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.itemLines.length} item line{group.itemLines.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <PrintLabelButton
                    sku={group.groupId}
                    name={group.label}
                  />
                </div>
              ))}
            </div>

            {/* Documents section */}
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documents</p>
              <div className="flex flex-wrap gap-2">
                <CheckoutChecklistDialog
                  payload={payload}
                  eventName={eventName}
                  eventStartDate={eventStartDate}
                />
                <CheckoutDOPrintDialog
                  payload={payload}
                  eventName={eventName}
                  eventStartDate={eventStartDate}
                />
              </div>
            </div>

          </div>
          <div className="shrink-0 flex justify-end px-6 py-4 border-t">
            <Button onClick={onDone}>Done</Button>
          </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
