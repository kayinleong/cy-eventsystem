// Phase 1 scan-cart panel.
//
// CONTEXT.md D-14 — the cart panel renders lines from the scan-session
// context, exposes per-line qty stepping + remove, and commits the cart
// to store.checkout (or routes to /events/[id]/checkin for check-in mode).
//
// REQUIREMENTS:
//   - CO-03 — multiple items accumulate; user can adjust qty or remove
//   - CO-06 — optimistic UI: cart-add updates immediately (mock store
//             commits synchronously; Phase 2 swaps to useOptimistic)
//   - CO-04 — single submit commits all lines atomically via store.checkout
//   - CO-05 — failure surfaces line-by-line failures (handled in scan-session
//             commit; this panel just leaves the cart intact)
//   - UI-SPEC "Cart is empty" empty-state copy verbatim
//   - Mode-dependent CTA label: "Check out N items" / "Return N items"

"use client";

import Link from "next/link";
import { Trash2, ShoppingCart } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QtyStepper } from "@/components/feature/inventory/QtyStepper";

import { useScanSession } from "./scan-session";

export function ScanCartPanel() {
  const {
    mode,
    cart,
    removeLine,
    setQty,
    commit,
    isCommitting,
    selectedEvent,
  } = useScanSession();

  const total = cart.reduce((s, l) => s + l.qty, 0);
  const itemNoun = total === 1 ? "item" : "items";
  // UI-SPEC primary CTA labels (per surface): /scan checkout → "Check out N items".
  const ctaLabel =
    mode === "checkout"
      ? `Check out ${total} ${itemNoun}`
      : `Return ${total} ${itemNoun}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShoppingCart className="size-4" /> Cart
          {cart.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              ({cart.length})
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cart.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            heading="Cart is empty"
            body="Scan items to add them to this check-out."
          />
        ) : (
          <ul className="divide-y divide-border">
            {cart.map((line) => (
              <li
                key={line.itemId}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/inventory/${line.itemId}`}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {line.itemName}
                  </Link>
                  <p className="text-xs font-mono text-muted-foreground">
                    {line.itemSku}
                  </p>
                  {mode === "checkout" ? (
                    <p className="text-xs text-muted-foreground">
                      {line.availableQty} available
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <QtyStepper
                    value={line.qty}
                    onChange={(v) => setQty(line.itemId, v)}
                    min={1}
                    max={
                      mode === "checkout"
                        ? line.availableQty
                        : Number.MAX_SAFE_INTEGER
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(line.itemId)}
                    aria-label={`Remove ${line.itemName}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          className="w-full h-11"
          size="lg"
          disabled={cart.length === 0 || isCommitting || !selectedEvent}
          onClick={() => commit()}
        >
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
