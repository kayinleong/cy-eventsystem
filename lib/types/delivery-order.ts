// Delivery Order (DO) — admin-uploaded record of a vendor delivery or
// an auto-generated record created at checkout time.
//
// v1 is immutable: no edits, no deletes. Manual uploads store their file in
// Cloud Storage at delivery-orders/{id}/document.{pdf|jpg|png}; this
// Firestore record holds the vendor name, the link back to the file, and
// the items this DO covers. Auto-generated checkout DOs have null file fields.
// Items keep a back-reference via InventoryItem.deliveryOrderIds[] for
// traceability ("where did this item come from?").

export type DeliveryOrderContentType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

export type DeliveryOrderType =
  | "internal"
  | "external-outbound"
  | "external-inbound";

export type DeliveryOrder = {
  id: string;
  vendor: string;
  fileUrl: string | null;
  filePath: string | null;
  originalFilename: string | null;
  contentType: DeliveryOrderContentType | null;
  doType: DeliveryOrderType;
  /** "manual" = admin-uploaded document; "checkout" = auto-generated from checkout flow */
  sourceType: "manual" | "checkout";
  /** Populated for checkout-sourced DOs; null for manual uploads */
  eventId: string | null;
  itemIds: string[];
  /** Full cart lines stored at checkout time — populated for sourceType "checkout" DOs only */
  itemLines: { itemId: string; itemName: string; itemSku: string; qty: number }[];
  /** Group barcode IDs generated from this checkout DO (empty for manual DOs) */
  checkoutGroupIds: string[];
  notes: string;
  uploadedAt: string;
  uploadedBy: string;
};
