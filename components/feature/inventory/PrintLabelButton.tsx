// Phase 1 — "Print label" Dialog with @media print chrome-hiding.
//
// REQUIREMENTS:
//   - INV-10 — admins (and staff for visibility) can preview + print a QR label.
//
// UI-SPEC pattern: print preview hides surrounding chrome via @media print
// CSS scoped to the dialog's `#print-label` block, then calls window.print().

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
import { LabelPreview } from "./LabelPreview";

export function PrintLabelButton({
  sku,
  name,
}: {
  sku: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);

  function doPrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  return (
    <>
      {/*
        PHASE 1: scoped print styles — when @media print is active, hide all
        page chrome and only show the #print-label block. The block is fixed
        center-screen so the printed page contains just the QR + SKU + name.
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
            <DialogTitle>QR label</DialogTitle>
          </DialogHeader>
          <div
            id="print-label"
            className="flex flex-col items-center gap-2 py-4"
          >
            <LabelPreview value={sku} />
            <p className="font-mono text-sm">{sku}</p>
            <p className="text-sm text-muted-foreground">{name}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={doPrint}>Print</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
