// DODetailActions — client island for DO detail page.
// Handles:
//   1. Print Checklist — window.open() with item lines (name, SKU, qty if available).
//   2. Print Delivery Order — window.open() with DO-style layout.
//   3. Group barcode QR labels — one PrintLabelButton per checkoutGroupId.
//
// itemLines: populated for DOs created after the itemLines field was added —
//   contains name, SKU, and qty per line.
// fallbackItems: always populated — name, SKU, location from current inventory
//   snapshot (used when itemLines is empty, e.g. older DOs).

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
type FallbackItem = { id: string; name: string; sku: string; location: string };

type DODetailActionsProps = {
  vendor: string;
  uploadedAt: string | null;
  itemLines: ItemLine[];
  fallbackItems: FallbackItem[];
  checkoutGroupIds: string[];
};

export function DODetailActions({
  vendor,
  uploadedAt,
  itemLines,
  fallbackItems,
  checkoutGroupIds,
}: DODetailActionsProps) {
  const dateStr = uploadedAt ? new Date(uploadedAt).toLocaleDateString() : "—";
  const hasQty = itemLines.length > 0;

  // Build print rows from itemLines (with qty) or fallbackItems (no qty).
  function buildRows(): string {
    if (hasQty) {
      return itemLines
        .map(
          (l) =>
            `<tr><td>${l.itemName}</td><td>${l.itemSku}</td><td class="right">${l.qty}</td></tr>`,
        )
        .join("");
    }
    return fallbackItems
      .map(
        (i) => `<tr><td>${i.name}</td><td>${i.sku}</td><td class="right">—</td></tr>`,
      )
      .join("");
  }

  function buildTotalRow(): string {
    if (!hasQty) return "";
    const total = itemLines.reduce((s, l) => s + l.qty, 0);
    return `<tr class="total"><td colspan="2">Total</td><td class="right">${total}</td></tr>`;
  }

  function openPrintWindow(title: string, body: string) {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      alert("Pop-up blocked. Please allow pop-ups for this site and try again.");
      return;
    }
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>${PRINT_CSS}</style></head>
<body>${body}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  function printChecklist() {
    const rows = buildRows();
    const totalRow = buildTotalRow();
    openPrintWindow(
      `Checklist — ${vendor}`,
      `<h1>Checkout Checklist</h1>
<div class="meta">
  <div>Event / Vendor: ${vendor}</div>
  <div>Date: ${dateStr}</div>
  <div>Printed at: ${new Date().toLocaleString()}</div>
</div>
<table>
  <thead><tr><th>Item</th><th>SKU</th><th class="right">Qty</th></tr></thead>
  <tbody>${rows}${totalRow}</tbody>
</table>`,
    );
  }

  function printDeliveryOrder() {
    const rows = buildRows();
    openPrintWindow(
      `Delivery Order — ${vendor}`,
      `<h1>Delivery Order</h1>
<span class="badge">External — Outbound</span>
<div class="meta">
  <div>Event / Vendor: ${vendor}</div>
  <div>Date: ${dateStr}</div>
  <div>Printed at: ${new Date().toLocaleString()}</div>
</div>
<table>
  <thead><tr><th>Item</th><th>SKU</th><th class="right">Qty</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`,
    );
  }

  const hasItems = hasQty || fallbackItems.length > 0;

  return (
    <div className="space-y-6">
      {/* Print buttons */}
      {hasItems && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={printChecklist}>
            <FileText className="mr-2 size-4" />
            Print Checklist
          </Button>
          <Button variant="outline" size="sm" onClick={printDeliveryOrder}>
            <Package className="mr-2 size-4" />
            Print Delivery Order
          </Button>
          {!hasQty && (
            <p className="w-full text-xs text-muted-foreground">
              Quantities not available for this DO — printed without qty column.
            </p>
          )}
        </div>
      )}

      {/* Group barcode QR labels */}
      {checkoutGroupIds.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Group Barcodes ({checkoutGroupIds.length})
          </p>
          <div className="flex flex-col gap-3">
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
                <PrintLabelButton
                  sku={gid}
                  name={`Group ${idx + 1} — ${vendor}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
