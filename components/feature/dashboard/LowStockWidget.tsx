// Phase 2 dashboard — Low stock widget (Block G UI swap, plan 02-10).
//
// REQUIREMENTS:
//   - RP-02 / RP-01 — list items where isLowStock === true (the RESEARCH P11
//     denormalized boolean maintained by every Server Action that touches
//     availableQty or lowStockThreshold).
//   - RP-04 — admin-only "Mark as ordered" calls markLowStockOrdered Server
//     Action; on success revalidatePath bumps both /reports/repurchase and /.
//
// Phase 2 swap from Phase 1:
//   - useMockStore + selectLowStockItems → useInventoryLive scoped to
//     {isLowStock: true, limit: 50} (D-20 listener window).
//   - markLowStockOrdered mock mutator → markLowStockOrdered Server Action
//     from app/(app)/inventory/actions.ts; useTransition for pending state.
//   - Phase 1 mock-store actor lookup removed — Server Action derives the
//     actor via requireAdmin() server-side.
//
// Note: the widget consumes a SSR-seeded `initialItems` prop so the first
// paint matches what useInventoryLive will resolve once the auth-gated
// onSnapshot subscription connects.

"use client";

import Link from "next/link";
import { useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
import { markLowStockOrdered } from "@/app/(app)/inventory/actions";
import type { InventoryItem } from "@/lib/types/item";

export function LowStockWidget({
  initialItems,
}: {
  initialItems: InventoryItem[];
}) {
  const items = useInventoryLive(initialItems, { isLowStock: true, limit: 50 });
  const session = useCurrentUser();
  const [pending, startTransition] = useTransition();

  function markOrdered(itemId: string, name: string) {
    startTransition(async () => {
      const r = await markLowStockOrdered(itemId);
      if (!r.ok) {
        toast.error(r.error || "Couldn't mark as ordered");
        return;
      }
      toast.success(`Marked ${name} as ordered`);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Low stock</CardTitle>
        {items.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {items.length} below threshold
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            heading="Stock is healthy"
            body="No items below their threshold."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((i) => (
              <li
                key={i.id}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/inventory/${i.id}`}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {i.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {i.availableQty} available · threshold {i.lowStockThreshold}
                  </p>
                </div>
                {session?.role === "admin" ? (
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={pending}
                    onClick={() => markOrdered(i.id, i.name)}
                  >
                    Mark as ordered
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
