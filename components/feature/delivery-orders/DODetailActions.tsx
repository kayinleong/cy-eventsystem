// DODetailActions — client island for DO detail page.
// Handles:
//   1. Print Checklist — window.open() with item lines (name, SKU, qty).
//   2. Print Delivery Order — window.open() with DO-style layout.
//   3. Group barcode QR labels — one PrintLabelButton per checkoutGroupId.

"use client";

import { FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintLabelButton } from "@/components/feature/inventory/PrintLabelButton";

const PRINT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; padding: 32px; color: #111; }
h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.meta { color: #555; font-size: 13px; margin-bottom: 16px; line-height: 1.6; }
.badge { display: inline-block; border: 1px solid #ccc; border-radius: 4px; padding: 2px 8px; font-size: 12px; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
th { text-align: left; font-weight: 600; border-bottom: 2px solid #000; padding: 6px 4px; }
td { border-bottom: 1px solid #ddd; padding: 6px 4px; }
.right { text-align: right; }
.total td { font-weight: 700; border-top: 2px solid #000; border-bottom: none; }
`;

type ItemLine = { itemId: string; itemName: string; itemSku: string; qty: number };

type DODetailActionsProps = {
  vendor: string;
  uploadedAt: string | null;
  itemLines: ItemLine[];
  checkoutGroupIds: string[];
};

export function DODetailActions({
  vendor,
  uploadedAt,
  itemLines,
  checkoutGroupIds,
}: DODetailActionsProps) {
  const dateStr = uploadedAt
    ? new Date(uploadedAt).toLocaleDateString()
    : "—";
  const totalQty = itemLines.reduce((s, l) => s + l.qty, 0);

  function printChecklist() {
    const rows = itemLines
      .map(
        (l) =>
          `<tr><td>${l.itemName}</td><td>${l.itemSku}</td><td class="right">${l.qty}</td></tr>`,
      )
      .join("");
    const totalRow = `<tr class="total"><td colspan="2">Total</td><td class="right">${totalQty}</td></tr>`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Checklist — ${vendor}</title>
<style>${PRINT_CSS}</style></head>
<body>
<h1>Checkout Checklist</h1>
<div class="meta">
  <div>Event / Vendor: ${vendor}</div>
  <div>Date: ${dateStr}</div>
  <div>Printed at: ${new Date().toLocaleString()}</div>
</div>
<table>
  <thead><tr><th>Item</th><th>SKU</th><th class="right">Qty</th></tr></thead>
  <tbody>${rows}${totalRow}</tbody>
</table>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  function printDeliveryOrder() {
    const rows = itemLines
      .map(
        (l) =>
          `<tr><td>${l.itemName}</td><td>${l.itemSku}</td><td class="right">${l.qty}</td></tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Delivery Order — ${vendor}</title>
<style>${PRINT_CSS}</style></head>
<body>
<h1>Delivery Order</h1>
<span class="badge">External — Outbound</span>
<div class="meta">
  <div>Event / Vendor: ${vendor}</div>
  <div>Date: ${dateStr}</div>
  <div>Printed at: ${new Date().toLocaleString()}</div>
</div>
<table>
  <thead><tr><th>Item</th><th>SKU</th><th class="right">Qty</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  return (
    <div className="space-y-6">
      {/* Print buttons — only shown when there are item lines with qty data */}
      {itemLines.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={printChecklist}>
            <FileText className="mr-2 size-4" />
            Print Checklist
          </Button>
          <Button variant="outline" size="sm" onClick={printDeliveryOrder}>
            <Package className="mr-2 size-4" />
            Print Delivery Order
          </Button>
        </div>
      )}

      {/* Group barcode labels */}
      {checkoutGroupIds.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Group Barcodes ({checkoutGroupIds.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {checkoutGroupIds.map((gid, idx) => (
              <div
                key={gid}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Group {idx + 1}</p>
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {gid}
                  </p>
                </div>
                <PrintLabelButton sku={gid} name={`Group ${idx + 1} — ${vendor}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
