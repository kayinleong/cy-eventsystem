// CheckoutChecklistDialog — printable checkout item checklist.
// quick-kayinleong-009
//
// Opens a shadcn Dialog from a "Print Checklist" trigger button.
// The print target div (#print-checklist) is isolated via @media print
// using the same inline <style> injection pattern from PrintLabelButton
// (NOT Tailwind print: utilities).
//
// Unique print id: #print-checklist
// Does NOT collide with: #print-label (PrintLabelButton), #print-do-document
// (CheckoutDOPrintDialog). Only one Dialog can be open at a time.

"use client";

import { FileText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CommitSuccessPayload } from "@/components/feature/scan/scan-session";

type CheckoutChecklistDialogProps = {
  payload: CommitSuccessPayload;
  eventName: string;
  eventStartDate: string; // ISO string
};

export function CheckoutChecklistDialog({
  payload,
  eventName,
  eventStartDate,
}: CheckoutChecklistDialogProps) {
  const totalQty = payload.cart.reduce((sum, l) => sum + l.qty, 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 size-4" />
          Print Checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Checkout Checklist Preview</DialogTitle>
        </DialogHeader>

        {/* @media print isolation — injected inline per PrintLabelButton pattern */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #print-checklist, #print-checklist * { visibility: visible !important; }
            #print-checklist { position: absolute; inset: 0; padding: 24px; overflow: visible; }
          }
        `}</style>

        {/* Print target */}
        <div id="print-checklist" className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Checkout Checklist</h1>
            <p className="text-sm text-muted-foreground">
              Event: {eventName}
            </p>
            <p className="text-sm text-muted-foreground">
              Date: {new Date(eventStartDate).toLocaleDateString()}
            </p>
            <p className="text-sm text-muted-foreground">
              Printed at: {new Date().toLocaleString()}
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
              <tr>
                <td colSpan={2} className="py-2 font-semibold">Total</td>
                <td className="py-2 text-right font-semibold">{totalQty}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Print button — outside the print target */}
        <div className="flex justify-end pt-2">
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
