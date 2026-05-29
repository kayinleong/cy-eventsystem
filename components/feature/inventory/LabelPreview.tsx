// Print-ready label preview rendered to a real <canvas> via bwip-js.
//
// REQUIREMENTS:
//   - INV-10 — every inventory item can render a print-ready label that
//     encodes its SKU (the scanner decodes the same payload).
//
// Format prop (quick-kayinleong-001): QR keeps the existing settings; 1D
// barcodes (code128 / code39 / ean13) render at scale 3 with includetext so
// operators have a readable fallback when the print is smudged.

"use client";

import { useEffect, useRef } from "react";
import bwipjs from "bwip-js/browser";

import type { BarcodeFormat } from "@/lib/labels";

export function LabelPreview({
  value,
  format = "qrcode",
}: {
  value: string;
  format?: BarcodeFormat;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      if (format === "qrcode") {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: "qrcode",
          text: value,
          scale: 4,
          includetext: false,
          paddingwidth: 8,
          paddingheight: 8,
        });
      } else {
        // 1D barcodes need the human-readable text printed beneath the bars.
        bwipjs.toCanvas(canvasRef.current, {
          bcid: format,
          text: value,
          scale: 3,
          height: 12,
          includetext: true,
          textxalign: "center",
          textsize: 10,
          paddingwidth: 8,
          paddingheight: 8,
        });
      }
    } catch (err) {
      // toCanvas throws synchronously on invalid input — log and degrade;
      // PrintLabelButton pre-validates with canEncode() so this path is
      // only hit for unexpected payloads.
      console.error("[LabelPreview] bwipjs failed", err);
    }
  }, [value, format]);

  return (
    <canvas
      ref={canvasRef}
      className="bg-white rounded"
      aria-label={`${format} label for ${value}`}
    />
  );
}
