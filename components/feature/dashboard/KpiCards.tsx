// Phase 1 dashboard KPI cards — 4 hero metrics in a responsive 2/4-col grid.
//
// REQUIREMENTS.md:
//   - EVT-07 (active events count drives "Active events" card)
//   - RP-02  (low-stock count drives "Low stock" card)
//   - MIS-01 (open missing count drives "Open missing" card)
//
// All counts subscribe to the mock store via useSyncExternalStore — any later
// plan's mutation (checkout / checkin / resolveMissing / markLowStockOrdered)
// causes this widget to re-render with fresh values.
//
// CONTEXT.md D-01 — selectors live in lib/mock/selectors.ts so the same
// projections work against a Firestore-backed snapshot in Phase 2.

"use client";

import { Calendar, PackageOpen, AlertTriangle, AlertCircle, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMockStore } from "@/lib/hooks/use-mock-store";
import {
  selectActiveEvents,
  selectLowStockItems,
  selectOpenMissing,
} from "@/lib/mock/selectors";

export function KpiCards() {
  const activeEvents = useMockStore(selectActiveEvents);
  const lowStock = useMockStore(selectLowStockItems);
  const openMissing = useMockStore(selectOpenMissing);
  // Items currently checked out — sum outQty across every (non-retired) item.
  // Equivalent to "items currently out at active events" per REP-02 by way of
  // the seed-data invariant (Plan 02): outQty == sum of open-checkout qty.
  const itemsOut = useMockStore((s) =>
    s.items.reduce((sum, i) => sum + i.outQty, 0),
  );

  const cards: ReadonlyArray<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "Active events", value: activeEvents.length, icon: Calendar },
    { label: "Items checked out", value: itemsOut, icon: PackageOpen },
    { label: "Low stock", value: lowStock.length, icon: AlertTriangle },
    { label: "Open missing", value: openMissing.length, icon: AlertCircle },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
