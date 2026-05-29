// Barcode formats supported by the in-browser label printer.
//
// bwip-js bcid values verified against node_modules/bwip-js/dist/bwip-js.d.ts
// (qrcode:484, code128:223, code39:235, ean13:316). canEncode pre-validates
// SKU payload because bwipjs.toCanvas throws synchronously on invalid input
// (Code 39 rejects lowercase; EAN-13 requires 12 or 13 digits).

export type BarcodeFormat = "qrcode" | "code128" | "code39" | "ean13";

export const LABEL_FORMATS: ReadonlyArray<{ value: BarcodeFormat; label: string }> = [
  { value: "qrcode", label: "QR" },
  { value: "code128", label: "Code 128" },
  { value: "code39", label: "Code 39" },
  { value: "ean13", label: "EAN-13" },
];

export type EncodeCheck = { ok: true } | { ok: false; reason: string };

// Refuse-with-hint rather than auto-coerce: silently uppercasing the user's
// SKU would be a lossy contract change at print time.
export function canEncode(sku: string, fmt: BarcodeFormat): EncodeCheck {
  const trimmed = sku.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "SKU is empty." };
  }
  if (fmt === "qrcode" || fmt === "code128") return { ok: true };
  if (fmt === "code39") {
    return /^[0-9A-Z \-.$/+%*]+$/.test(trimmed)
      ? { ok: true }
      : {
          ok: false,
          reason:
            "Code 39 needs uppercase A-Z, 0-9, and - . $ / + % * only.",
        };
  }
  if (fmt === "ean13") {
    return /^\d{12,13}$/.test(trimmed)
      ? { ok: true }
      : { ok: false, reason: "EAN-13 needs exactly 12 or 13 digits." };
  }
  return { ok: false, reason: "Unknown format." };
}
