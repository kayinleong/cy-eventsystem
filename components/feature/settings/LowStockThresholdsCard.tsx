// Phase 1 — /settings Low-stock thresholds editor card.
//
// REQUIREMENTS:
//   - RP-01 — admin can adjust per-item low-stock threshold; the field flows
//     into selectLowStockItems / LowStockWidget / RepurchaseTable / Inventory
//     toolbar "Low stock only" filter.
//
// Admin-only: the card is shown to all signed-in users (the route /settings
// is staff-accessible) but the inputs + save button are gated by the
// `isAdmin` prop passed in from the Server Component shell. Staff see a
// read-only listing — the heading copy + the disabled input communicate the
// gate clearly.
//
// Selector pattern: read raw `s.items` via useMockStore + filter in useMemo
// per D-01-11-A (avoid the inline-filter selector re-render loop that
// StockReportTable hit in Plan 11). The retired filter mirrors REP-01's
// scope so the settings list matches the live stock view.
//
// Per D-01-05-E actor-resolution: read useCurrentUser() + resolve the full
// UserDoc from seedUsers at save time; pass to store.updateLowStockThreshold.

"use client";

import { useMemo, useState } from "react";
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
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { updateLowStockThreshold } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function LowStockThresholdsCard({ isAdmin }: { isAdmin: boolean }) {
  // D-01-11-A: read raw slice + filter inside useMemo to avoid the
  // useSyncExternalStore identity-stability re-render loop.
  const allItems = useMockStore((s) => s.items);
  const items = useMemo(
    () => allItems.filter((i) => i.lifecycleState !== "retired"),
    [allItems],
  );

  const session = useCurrentUser();
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  function save(itemId: string) {
    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't save threshold");
      return;
    }
    const val = drafts[itemId];
    if (val === undefined) return;
    updateLowStockThreshold(itemId, Math.max(0, Math.floor(val)), actor);
    toast.success("Threshold updated");
    setDrafts((d) => {
      const next = { ...d };
      delete next[itemId];
      return next;
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
            {items.map((i) => {
              const draft = drafts[i.id];
              const current = draft !== undefined ? draft : i.lowStockThreshold;
              const isDirty =
                draft !== undefined && draft !== i.lowStockThreshold;
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
                      disabled={!isAdmin}
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
                      >
                        <Save className="mr-1 size-3" />
                        Save
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
