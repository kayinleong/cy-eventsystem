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

function splitLines(
  lines: ScanCartLine[],
  n: number,
): ScanCartLine[][] {
  const groups: ScanCartLine[][] = Array.from({ length: n }, () => []);
  lines.forEach((line, i) => groups[i % n].push(line));
  return groups;
}

function buildGroupLabel(
  groupIndex: number,
  totalGroups: number,
  eventName: string,
): string {
  if (totalGroups === 1) return eventName;
  return `Group ${groupIndex + 1} of ${totalGroups} — ${eventName}`;
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
  const [isCreating, setIsCreating] = useState(false);
  const [groups, setGroups] = useState<GeneratedGroup[]>([]);

  // Preview: how many items in each group
  const splitPreview = splitLines(payload.cart, splitCount);

  async function handleGenerate() {
    setIsCreating(true);

    const splitGroups = splitLines(payload.cart, splitCount);

    const results = await Promise.all(
      splitGroups.map((groupLines, i) => {
        const label = buildGroupLabel(i, splitCount, eventName);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Group barcodes</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="split-count">Number of groups</Label>
              <Input
                id="split-count"
                type="number"
                min={1}
                max={10}
                value={splitCount}
                onChange={(e) => {
                  const v = Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1));
                  setSplitCount(v);
                }}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                {splitCount === 1
                  ? `1 group — all ${payload.cart.length} item line${payload.cart.length !== 1 ? "s" : ""}`
                  : splitPreview
                      .map((g, i) => `Group ${i + 1}: ${g.length} item line${g.length !== 1 ? "s" : ""}`)
                      .join(", ")}
              </p>
            </div>

            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                onClick={onDone}
                disabled={isCreating}
              >
                Skip
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isCreating}
              >
                {isCreating && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {isCreating ? "Creating…" : "Generate"}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
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

            <div className="flex justify-end">
              <Button onClick={onDone}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
