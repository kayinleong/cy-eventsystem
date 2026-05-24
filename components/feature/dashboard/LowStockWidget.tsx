// Phase 1 dashboard — Low stock widget.
//
// REQUIREMENTS.md:
//   - RP-02 / RP-01 — list items where lifecycleState != "retired" AND
//     lowStockThreshold > 0 AND availableQty <= lowStockThreshold AND
//     lowStockOrderedAt is null (selectLowStockItems centralizes the rule).
//   - RP-04 — admin-only inline "Mark as ordered" button calls
//     markLowStockOrdered, which sets lowStockOrderedAt = now and removes the
//     item from the widget on the next render (the selector excludes
//     already-ordered items).
//
// Staff role sees the list but no inline action — they can still report by
// other means; the action is gated to admin per AUTH-10 / RP-04.

"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectLowStockItems } from "@/lib/mock/selectors";
import { markLowStockOrdered } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";

export function LowStockWidget() {
  const items = useMockStore(selectLowStockItems);
  const session = useCurrentUser();

  function markOrdered(itemId: string, name: string) {
    // markLowStockOrdered takes the full UserDoc actor (Plan 02 mutator
    // contract); look it up from seedUsers by the session uid. Phase 2 swaps
    // this to a Server Action that derives the actor from verifyTokens().
    const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
    if (!actor) {
      toast.error("Couldn't mark as ordered");
      return;
    }
    markLowStockOrdered(itemId, actor);
    toast.success(`Marked ${name} as ordered`);
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
