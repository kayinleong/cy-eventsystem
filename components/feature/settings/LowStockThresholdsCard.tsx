// Phase 2 — /settings Low-stock thresholds editor card (Block C UI swap).
//
// REQUIREMENTS:
//   - RP-01 — admin can adjust per-item low-stock threshold; the field flows
//     into the isLowStock denormalization (recomputed atomically inside the
//     updateLowStockThreshold Server Action per RESEARCH P11) which then
//     drives the LowStockWidget on the dashboard and the inventory filter.
//
// Phase 2 swap from Phase 1:
//   - useMockStore + selectors → useInventoryLive (onSnapshot, 50-row window
//     per D-20). The card surfaces only the first 50 active items by default.
//   - updateLowStockThreshold mock-store mutator → Server Action from
//     app/(app)/inventory/actions.ts. Action recomputes isLowStock and
//     clears lowStockOrderedAt atomically inside its runTransaction.
//   - Actor lookup (seedUsers.find + useCurrentUser) DELETED — Server Action
//     derives actor server-side via requireAdmin.
//   - router.refresh() after successful save (defense-in-depth on top of
//     the action's revalidatePath).
//
// Admin-only: the card is shown to all signed-in users (the route /settings
// is staff-accessible) but the inputs + save button are gated by the
// `isAdmin` prop passed in from the Server Component shell. Staff see a
// read-only listing — disabled inputs + descriptive copy explaining the gate.

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
import { updateLowStockThreshold } from "@/app/(app)/inventory/actions";

export function LowStockThresholdsCard({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  // D-20: 50-row scoped live window. Defensive client-side filter strips
  // retired items so admins don't waste a save slot on dead inventory.
  const allItems = useInventoryLive([]);
  const items = useMemo(
    () => allItems.filter((i) => i.lifecycleState !== "retired"),
    [allItems],
  );

  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save(itemId: string) {
    const val = drafts[itemId];
    if (val === undefined) return;
    const threshold = Math.max(0, Math.floor(val));
    setPendingId(itemId);
    startTransition(async () => {
      const res = await updateLowStockThreshold(itemId, threshold);
      if (!res.ok) {
        toast.error(res.error);
        setPendingId(null);
        return;
      }
      toast.success("Threshold updated");
      setDrafts((d) => {
        const next = { ...d };
        delete next[itemId];
        return next;
      });
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          Low-stock thresholds
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? "Set the available-qty threshold below which an item is flagged low-stock."
            : "Only admins can change thresholds."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-80">
          <ul className="divide-y divide-border">
            {items.length === 0 ? (
              <li className="px-6 py-6 text-sm text-muted-foreground text-center">
                No active items.
              </li>
            ) : (
              items.map((i) => {
                const draft = drafts[i.id];
                const current = draft !== undefined ? draft : i.lowStockThreshold;
                const isDirty =
                  draft !== undefined && draft !== i.lowStockThreshold;
                const isSavingThis = pendingId === i.id;
                return (
                  <li
                    key={i.id}
                    className="px-6 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{i.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {i.sku} · {i.availableQty} available
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="w-20"
                        value={current}
                        disabled={!isAdmin || isSavingThis}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [i.id]: Number(e.target.value || 0),
                          }))
                        }
                      />
                      {isAdmin && isDirty ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => save(i.id)}
                          disabled={isSavingThis}
                        >
                          <Save className="mr-1 size-3" />
                          {isSavingThis ? "Saving…" : "Save"}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
