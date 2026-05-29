import "server-only";
// lib/data/inventory.server.ts
// Per RESEARCH §3.1 + D-17 cursor pagination + D-20 listener-scope window.
//
// Mirrors the lib/data/users.server.ts shape (Plan 02-04) so the SSR-seed →
// onSnapshot handoff is structurally identical across collections.
//
// Type compatibility: InventoryItem (lib/types/item.ts) uses ISO strings for
// createdAt / updatedAt / lowStockOrderedAt (Phase 1 contract). We convert
// Firestore Timestamps → ISO strings here at the boundary so consumers
// (InventoryTable, ItemDetail) keep working without any prop-shape changes.

import { adminDb } from "@/lib/firebase/admin";
import type { InventoryItem, ItemCategory, ItemLifecycleState } from "@/lib/types/item";

type InvCursor = { name: string; id: string };

export type InventoryPage = {
  items: InventoryItem[];
  nextCursor: string | null;
};

function encodeCursor(c: InvCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64");
}

function decodeCursor(s: string): InvCursor | null {
  try {
    return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as InvCursor;
  } catch {
    return null;
  }
}

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

function toItem(snap: FirebaseFirestore.DocumentSnapshot): InventoryItem {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    sku: snap.id, // SKU IS the doc ID per PROJECT.md key decision #14
    name: d.name,
    category: d.category as ItemCategory,
    totalQty: d.totalQty,
    availableQty: d.availableQty,
    outQty: d.outQty ?? 0,
    damagedQty: d.damagedQty ?? 0,
    unit: d.unit ?? "pcs",
    location: d.location ?? "",
    photoUrl: d.photoUrl ?? null,
    notes: d.notes ?? "",
    lifecycleState: (d.lifecycleState ?? "available") as ItemLifecycleState,
    lowStockThreshold: d.lowStockThreshold ?? 0,
    lowStockOrderedAt: tsToIso(d.lowStockOrderedAt),
    isLowStock: d.isLowStock === true,
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(d.updatedAt) ?? new Date(0).toISOString(),
    createdBy: d.createdBy ?? "",
    updatedBy: d.updatedBy ?? "",
    deliveryOrderIds: Array.isArray(d.deliveryOrderIds) ? d.deliveryOrderIds : [],
  };
}

export async function getInventoryPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: { category?: string; lifecycleState?: string; isLowStock?: boolean };
}): Promise<InventoryPage> {
  const limit = opts.limit ?? 50;
  let q: FirebaseFirestore.Query = adminDb.collection("inventory");

  if (opts.filters?.category) q = q.where("category", "==", opts.filters.category);
  if (opts.filters?.lifecycleState) q = q.where("lifecycleState", "==", opts.filters.lifecycleState);
  if (opts.filters?.isLowStock === true) q = q.where("isLowStock", "==", true);

  q = q.orderBy("name").orderBy("__name__").limit(limit + 1);

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) q = q.startAfter(cursor.name, cursor.id);

  const snap = await q.get();
  const docs = snap.docs.slice(0, limit);
  const hasMore = snap.docs.length > limit;
  const items = docs.map(toItem);
  const last = docs[docs.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ name: last.data().name, id: last.id })
      : null;
  return { items, nextCursor };
}

export async function getItemServer(itemId: string): Promise<InventoryItem | null> {
  const snap = await adminDb.collection("inventory").doc(itemId).get();
  if (!snap.exists) return null;
  return toItem(snap);
}
