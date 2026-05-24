// Phase 1 — QR code preview rendered to a real <canvas> via bwip-js.
//
// REQUIREMENTS:
//   - INV-10 — every inventory item can render a print-ready QR label that
//     encodes its SKU (the scanner decodes the same payload).
//
// Phase 2: the canvas rendering stays — only the URL it's mounted from changes
// (Phase 2 may upload PNG snapshots to Cloud Storage for bulk-print PDFs).

"use client";

import { useEffect, useRef } from "react";
import bwipjs from "bwip-js/browser";

export function LabelPreview({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      bwipjs.toCanvas(canvasRef.current, {
        bcid: "qrcode",
        text: value,
        scale: 4,
        includetext: false,
        paddingwidth: 8,
        paddingheight: 8,
      });
    } catch (err) {
      // Phase 1: log only. The page degrades gracefully — the SKU text below
      // the canvas is still visible and the "Print" button still works.
      console.error("[LabelPreview] bwipjs failed", err);
    }
  }, [value]);

  return (
    <canvas
      ref={canvasRef}
      className="bg-white rounded"
      aria-label={`QR code for ${value}`}
    />
  );
}
