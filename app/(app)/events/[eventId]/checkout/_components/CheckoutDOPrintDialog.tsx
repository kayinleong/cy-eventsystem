// CheckoutDOPrintDialog — printable Delivery Order from checkout cart.
// quick-kayinleong-009
//
// Opens a shadcn Dialog from a "Print Delivery Order" trigger button.
// The preview renders inside the dialog; printing opens a new window
// with a self-contained HTML document so the Radix Dialog portal
// does not interfere with the print output.
//
// DO type is always "external-outbound" for checkout — items are leaving
// for an external event.
//
// quick-kayinleong-010: replaced @media print + window.print() with
// window.open() approach to avoid Radix Dialog backdrop printing as a
// separate page.

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

const PRINT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; padding: 32px; color: #111; }
h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.meta { color: #555; font-size: 13px; margin-bottom: 16px; line-height: 1.6; }
.badge { display: inline-block; border: 1px solid #ccc; border-radius: 4px; padding: 2px 8px; font-size: 12px; margin-bottom: 8px; }
.badge.outbound { background: #f0f0f0; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
th { text-align: left; font-weight: 600; border-bottom: 2px solid #000; padding: 6px 4px; }
td { border-bottom: 1px solid #ddd; padding: 6px 4px; }
.right { text-align: right; }
.total td { font-weight: 700; border-top: 2px solid #000; border-bottom: none; }
.ref { margin-top: 16px; font-size: 11px; color: #999; }
`;

export function CheckoutDOPrintDialog({
  payload,
  eventName,
  eventStartDate,
}: CheckoutDOPrintDialogProps) {
  function handlePrint() {
    const dateStr = new Date(eventStartDate).toLocaleDateString();
    const generatedAt = new Date().toLocaleString();

    const rows = payload.cart
      .map(
        (line) =>
          `<tr>
            <td>${line.itemName}</td>
            <td>${line.itemSku}</td>
            <td class="right">${line.qty}</td>
          </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Delivery Order — ${eventName}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <h1>Delivery Order</h1>
  <span class="badge outbound">External — Outbound</span>
  <div class="meta">
    <div>Event: ${eventName}</div>
    <div>Date: ${dateStr}</div>
    <div>Generated at: ${generatedAt}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Item Name</th>
        <th>SKU</th>
        <th class="right">Qty</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="ref">Reference: ${payload.txIds.join(", ")}</p>
</body>
</html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

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

        {/* Preview — visible in the dialog before printing */}
        <div className="space-y-4">
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

        {/* Print button — opens new window */}
        <div className="flex justify-end pt-2">
          <Button onClick={handlePrint}>Print</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
