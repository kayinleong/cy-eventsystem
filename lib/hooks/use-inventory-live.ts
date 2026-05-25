"use client";
// lib/hooks/use-inventory-live.ts
// Live hook scoped to the visible cursor page per D-20 (50-row window).
// SSR seed pattern: server passes `initial` from getInventoryPage; hook takes
// over via onSnapshot for the same query window. See PATTERNS §4 excerpt A/C.
//
// Permission note: unlike useUsersLive (Plan 02-04 fallout — users-collection
// rule requires per-doc admin check that auth-edge ID tokens may lack), the
// inventory firestore.rules `allow read: if isSignedIn()` works for any
// authenticated client. The listener should never permission-deny here, but
// we keep a defensive error logger so future rule changes surface in console.
//
// Type compatibility: matches lib/data/inventory.server.ts conversion of
// Firestore Timestamps → ISO strings so InventoryItem shape is consistent
// across the SSR seed and the client live update.

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  documentId,
  type QueryConstraint,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { InventoryItem, ItemCategory, ItemLifecycleState } from "@/lib/types/item";

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

function toItem(d: QueryDocumentSnapshot): InventoryItem {
  const data = d.data();
  return {
    id: d.id,
    sku: d.id,
    name: data.name,
    category: data.category as ItemCategory,
    totalQty: data.totalQty,
    availableQty: data.availableQty,
    outQty: data.outQty ?? 0,
    damagedQty: data.damagedQty ?? 0,
    unit: data.unit ?? "pcs",
    photoUrl: data.photoUrl ?? null,
    notes: data.notes ?? "",
    lifecycleState: (data.lifecycleState ?? "available") as ItemLifecycleState,
    lowStockThreshold: data.lowStockThreshold ?? 0,
    lowStockOrderedAt: tsToIso(data.lowStockOrderedAt),
    isLowStock: data.isLowStock === true,
    createdAt: tsToIso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(data.updatedAt) ?? new Date(0).toISOString(),
    createdBy: data.createdBy ?? "",
    updatedBy: data.updatedBy ?? "",
  };
}

export function useInventoryLive(
  initial: InventoryItem[],
  opts: {
    category?: string;
    lifecycleState?: string;
    isLowStock?: boolean;
    limit?: number;
  } = {},
): InventoryItem[] {
  const [items, setItems] = useState<InventoryItem[]>(initial);

  useEffect(() => {
    const constraints: QueryConstraint[] = [];
    if (opts.category) constraints.push(where("category", "==", opts.category));
    if (opts.lifecycleState) constraints.push(where("lifecycleState", "==", opts.lifecycleState));
    if (opts.isLowStock === true) constraints.push(where("isLowStock", "==", true));
    constraints.push(orderBy("name"), orderBy(documentId()), fbLimit(opts.limit ?? 50));

    const q = query(collection(db, "inventory"), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot) => {
        setItems(snap.docs.map((d) => toItem(d as QueryDocumentSnapshot)));
      },
      (err: FirestoreError) => {
        console.error("[useInventoryLive] onSnapshot error:", err.code, err.message);
      },
    );
    return () => unsub();
  }, [opts.category, opts.lifecycleState, opts.isLowStock, opts.limit]);

  return items;
}
