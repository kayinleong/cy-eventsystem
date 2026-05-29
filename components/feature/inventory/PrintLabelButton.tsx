// "Print label" Dialog with a format picker + @media print chrome-hiding.
//
// REQUIREMENTS:
//   - INV-10 — admins (and staff for visibility) can preview + print a label.
//
// quick-kayinleong-001: format picker (QR / Code 128 / Code 39 / EAN-13).
// Pre-validates SKU per format via canEncode() and disables Print + replaces
// the canvas with a muted hint when the SKU can't encode in the chosen format.

"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LABEL_FORMATS, canEncode, type BarcodeFormat } from "@/lib/labels";
import { LabelPreview } from "./LabelPreview";

export function PrintLabelButton({
  sku,
  name,
}: {
  sku: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<BarcodeFormat>("qrcode");
  const check = canEncode(sku, format);

  function doPrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  return (
    <>
      {/*
        Scoped print styles — when @media print is active, hide all page
        chrome and only show the #print-label block. The block is fixed
        center-screen so the printed page contains just the label + SKU + name.
      */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-label, #print-label * { visibility: visible !important; }
          #print-label {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
        }
      `}</style>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Printer className="mr-2 size-4" /> Print label
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Print label</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="label-format">Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as BarcodeFormat)}
            >
              <SelectTrigger id="label-format" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABEL_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {check.ok ? (
            <div
              id="print-label"
              className="flex flex-col items-center gap-2 py-4"
            >
              <LabelPreview value={sku} format={format} />
              <p className="font-mono text-sm">{sku}</p>
              <p className="text-sm text-muted-foreground">{name}</p>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              {check.reason}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={doPrint} disabled={!check.ok}>
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
