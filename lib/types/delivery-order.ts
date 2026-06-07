// Delivery Order (DO) — admin-uploaded record of a vendor delivery.
//
// v1 is immutable: no edits, no deletes. The file lives in Cloud Storage at
// delivery-orders/{id}/document.{pdf|jpg|png}; this Firestore record holds
// the vendor name, the link back to the file, and the items this DO covers.
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
  fileUrl: string;
  filePath: string;
  originalFilename: string;
  contentType: DeliveryOrderContentType;
  doType: DeliveryOrderType;
  itemIds: string[];
  notes: string;
  uploadedAt: string;
  uploadedBy: string;
};
