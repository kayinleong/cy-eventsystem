// Scan-to-capture input for the External barcode field in ItemForm.
//
// Renders a plain text Input for manual entry + a scan icon button that opens
// a Sheet containing a live @yudiel/react-qr-scanner camera feed. On a
// successful scan the Sheet closes and the scanned rawValue is passed to the
// onChange callback (RHF setValue on the parent form). Camera is paused when
// the Sheet is closed so the device does not acquire a MediaStream until the
// user explicitly opens the Sheet.
//
// Debounce: mirrors the ScannerWidget pattern (1500 ms window via useRef) so
// a Bluetooth scanner or multi-frame camera burst only fires once.

"use client";

import { useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type BarcodeFieldInputProps = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function BarcodeFieldInput({
  value,
  onChange,
  disabled = false,
}: BarcodeFieldInputProps) {
  const [open, setOpen] = useState(false);
  const lastScan = useRef<number>(0);

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 4006381333931"
        disabled={disabled}
        className="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        aria-label="Scan barcode"
        onClick={() => setOpen(true)}
      >
        <ScanLine className="size-4" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[80dvh] flex flex-col">
          <SheetHeader className="flex-row items-center justify-between shrink-0">
            <SheetTitle>Scan barcode</SheetTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close scanner"
            >
              <X className="size-5" />
            </Button>
          </SheetHeader>
          {/* Fixed-height container prevents the Scanner video from overflowing
              the sheet and covering the close button. */}
          <div className="flex-1 min-h-0 mt-4 overflow-hidden rounded-md">
            <Scanner
              formats={[
                "qr_code",
                "code_128",
                "ean_13",
                "upc_a",
                "data_matrix",
              ]}
              paused={!open}
              styles={{ container: { height: "100%" } }}
              onScan={(detections) => {
                if (!detections.length) return;
                const now = Date.now();
                if (now - lastScan.current < 1500) return;
                lastScan.current = now;
                navigator.vibrate?.(50);
                onChange(detections[0].rawValue);
                setOpen(false);
              }}
              onError={() => {
                // Silently ignore camera errors — manual Input is the fallback.
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
