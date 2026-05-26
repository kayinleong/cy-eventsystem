// Phase 2 dashboard KPI cards — 4 hero metrics from Firestore count() aggregations.
//
// REQUIREMENTS:
//   - EVT-07 — active events count drives "Active events" card.
//   - RP-02  — low-stock count drives "Low stock" card.
//   - REP-02 — items checked out drives "Items checked out" card.
//
// Phase 2 swap from Phase 1:
//   - Mock store subscription + array projection → SSR-passed counts (props)
//     per CONTEXT D-21.
//   - NOT real-time — counts refresh on every dashboard render
//     (revalidatePath('/') after Server Actions keeps them current).
//   - No `"use client"` directive — this is now a Server Component child
//     rendered from `app/(app)/page.tsx`.
//
// D-21 commitment: NO full-collection JS aggregation. The 4 numbers
// come from `getDashboardKpis()` (4 Firestore count() aggregations).

import {
  Calendar,
  PackageOpen,
  AlertTriangle,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCards({
  totalItems,
  itemsOut,
  lowStockCount,
  activeEvents,
}: {
  totalItems: number;
  itemsOut: number;
  lowStockCount: number;
  activeEvents: number;
}) {
  const cards: ReadonlyArray<{
    label: string;
    value: number;
    icon: LucideIcon;
  }> = [
    { label: "Active events", value: activeEvents, icon: Calendar },
    { label: "Items checked out", value: itemsOut, icon: PackageOpen },
    { label: "Low stock", value: lowStockCount, icon: AlertTriangle },
    { label: "Total items", value: totalItems, icon: AlertCircle },
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
