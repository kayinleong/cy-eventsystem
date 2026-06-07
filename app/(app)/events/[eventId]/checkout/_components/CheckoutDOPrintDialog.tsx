// CheckoutDOPrintDialog — printable Delivery Order from checkout cart.
// quick-kayinleong-009
//
// Opens a shadcn Dialog from a "Print Delivery Order" trigger button.
// The print target div (#print-do-document) is isolated via @media print
// using the same inline <style> injection pattern from PrintLabelButton
// (NOT Tailwind print: utilities).
//
// Unique print id: #print-do-document
// Does NOT collide with: #print-label (PrintLabelButton), #print-checklist
// (CheckoutChecklistDialog). Only one Dialog can be open at a time.
//
// DO type is always "external-outbound" for checkout — items are leaving
// for an external event.

"use client";

import { Package } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DoTypeBadge } from "@/components/feature/delivery-orders/DoTypeBadge";
import type { CommitSuccessPayload } from "@/components/feature/scan/scan-session";

type CheckoutDOPrintDialogProps = {
  payload: CommitSuccessPayload;
  eventName: string;
  eventStartDate: string; // ISO string
};

export function CheckoutDOPrintDialog({
  payload,
  eventName,
  eventStartDate,
}: CheckoutDOPrintDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="mr-2 size-4" />
          Print Delivery Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delivery Order Preview</DialogTitle>
        </DialogHeader>

        {/* @media print isolation — injected inline per PrintLabelButton pattern */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #print-do-document, #print-do-document * { visibility: visible !important; }
            #print-do-document { position: absolute; inset: 0; padding: 24px; overflow: visible; }
          }
        `}</style>

        {/* Print target */}
        <div id="print-do-document" className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">Delivery Order</h1>
              <div className="mt-1">
                <DoTypeBadge type="external-outbound" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              Event: {eventName}
            </p>
            <p className="text-sm text-muted-foreground">
              Date: {new Date(eventStartDate).toLocaleDateString()}
            </p>
            <p className="text-sm text-muted-foreground">
              Generated at: {new Date().toLocaleString()}
            </p>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-semibold">Item Name</th>
                <th className="py-2 text-left font-semibold">SKU</th>
                <th className="py-2 text-right font-semibold">Qty</th>
              </tr>
            </thead>
            <tbody>
              {payload.cart.map((line) => (
                <tr key={line.itemId} className="border-b">
                  <td className="py-2">{line.itemName}</td>
                  <td className="py-2 text-muted-foreground">{line.itemSku}</td>
                  <td className="py-2 text-right">{line.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-muted-foreground">
            Reference: {payload.txIds.join(", ")}
          </p>
        </div>

        {/* Print button — outside the print target */}
        <div className="flex justify-end pt-2">
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
