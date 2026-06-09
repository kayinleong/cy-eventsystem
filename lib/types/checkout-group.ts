// checkoutGroups/{groupId} Firestore document type.
// quick-kayinleong-006 — post-checkout group barcode generation.
//
// Each CheckoutGroupDoc represents one physical group of items checked out
// together. The doc ID doubles as the barcode payload so scanners at check-in
// (quick-007/quick-008) can resolve the group back to its constituent items
// without an extra lookup field.

import type { FieldValue } from "firebase-admin/firestore";

export type CheckoutGroupItemLine = {
  itemId: string;
  itemSku: string;
  itemName: string;
  qty: number;
};

export type CheckoutGroupDoc = {
  id: string; // == Firestore doc ID; also the barcode payload
  eventId: string; // for rule enforcement + future queries
  txIds: string[]; // transaction IDs from commitCheckoutCartAction
  itemLines: CheckoutGroupItemLine[]; // denormalized at write time (AUD-01 pattern)
  label: string; // human-readable, e.g. "Group 1 of 2 — Spring Demo"
  createdAt: FieldValue | Date;
  createdBy: string; // session.uid
  // quick-kayinleong-015 — the group's current physical location, set by
  // scanning the group barcode in Scan → Location. Empty string until first set.
  // Location is per-group (a physical bundle), NOT per-SKU: a SKU can be split
  // across multiple groups, so each group tracks its own location independently.
  location?: string;
};
