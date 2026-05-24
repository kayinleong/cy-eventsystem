// Phase 1 — CancelEventDialog (EVT-06 reconciliation).
//
// REQUIREMENTS:
//   - EVT-06 — cancelling an event requires reconciling open check-outs: each
//     open transaction gets a `returned | lost | still_with_owner` resolution
//     that the store mutator (`cancelEvent`) uses to adjust availableQty + outQty.
//
// UI-SPEC Q9 destructive copy (locked, exact match):
//   title:   "Cancel this event?"
//   body:    "Items still checked out must be returned manually. The event
//             won't appear in future schedules."
//   confirm: "Cancel event"   ← Confirm button label, NEVER "OK" or "Yes".
//
// Gating: only admin sees this button (defense in depth — the cancelEvent
// mutator is also called only from admin-visible UI in Phase 1). Phase 2's
// Server Action will additionally enforce admin role server-side.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectOpenCheckoutsForEvent } from "@/lib/mock/selectors";
import { cancelEvent } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

type Resolution = "returned" | "lost" | "still_with_owner";

export function CancelEventDialog({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const router = useRouter();
  const session = useCurrentUser();
  const openTxs = useMockStore((s) => selectOpenCheckoutsForEvent(s, eventId));
  // Per-open-tx resolution map. Default to "returned" (the most common path —
  // items came back, just not yet logged via checkin).
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    () => Object.fromEntries(openTxs.map((t) => [t.id, "returned" as const])),
  );

  if (session?.role !== "admin") return null;

  function confirm() {
    const actor = seedUsers.find((u) => u.uid === session?.uid);
    if (!actor) {
      toast.error("Couldn't cancel event");
      return;
    }
    const reconciliations = openTxs.map((t) => ({
      itemId: t.itemId,
      resolution: resolutions[t.id] ?? "returned",
      qty: t.qty,
    }));
    cancelEvent(eventId, reconciliations, actor);
    toast(`${eventName} cancelled`);
    router.push("/events");
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Ban className="mr-2 size-4" />
          Cancel event
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this event?</AlertDialogTitle>
          <AlertDialogDescription>
            Items still checked out must be returned manually. The event
            won&apos;t appear in future schedules.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {openTxs.length > 0 ? (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reconcile open check-outs ({openTxs.length})
            </p>
            {openTxs.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 border-b pb-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.itemName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.qty} out · <span className="font-mono">{t.itemSku}</span>
                  </p>
                </div>
                <Select
                  value={resolutions[t.id] ?? "returned"}
                  onValueChange={(v) =>
                    setResolutions((r) => ({ ...r, [t.id]: v as Resolution }))
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="still_with_owner">
                      Still with owner
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep event</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} variant="destructive">
            Cancel event
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
