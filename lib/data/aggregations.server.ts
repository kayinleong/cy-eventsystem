import "server-only";
// lib/data/aggregations.server.ts
// Per RESEARCH §7.2 + CONTEXT.md D-21: dashboard KPI count() aggregations
// replace the Phase 1 .reduce() pattern. Aggregations are NOT real-time —
// they fire on every Server Component render. revalidatePath('/') after
// every Server Action keeps the dashboard fresh between mutations.
//
// Why count() over reduce():
//   - Phase 1 used `useMockStore(s => s.items.reduce(...))` which works
//     against an in-memory array but doesn't scale to Firestore (a full
//     collection scan to count rows is O(N) reads = O(N) billing).
//   - count() aggregations return a single number via a single backend
//     request — O(1) for the client, charged as 1 read per 1000 rows
//     scanned server-side (Firestore aggregation pricing).
//
// RP-03 — getLowStockCount is the single source of truth for the nav
// low-stock badge. Re-queried on every layout render (path change).

import { adminDb } from "@/lib/firebase/admin";

export type DashboardKpis = {
  totalItems: number;
  itemsOut: number;
  lowStockCount: number;
  activeEvents: number;
};

/**
 * D-21: 4 count() aggregations per dashboard load. NOT real-time.
 * Refetched on mount + on revalidatePath('/').
 *
 * Active events query uses `where("status", "==", "active")` — note that
 * the stored event.status field is informational per lib/utils/event-status.ts
 * (Phase 2 derives status from dates). For KPI display purposes the stored
 * field is "close enough" — the dashboard widget itself (OverdueReturnsWidget)
 * uses deriveEventStatus() for precise filtering. The KPI count is an
 * approximation that matches Firestore's index without an expensive
 * client-side filter pass.
 */
export async function getDashboardKpis(): Promise<DashboardKpis> {
  // Each line is a single .count().get() call — 4 aggregations per dashboard load.
  const [totalItems, itemsOut, lowStockCount, activeEvents] = await Promise.all([
    adminDb.collection("inventory").where("lifecycleState", "!=", "retired").count().get(),
    adminDb.collection("inventory").where("outQty", ">", 0).count().get(),
    adminDb.collection("inventory").where("isLowStock", "==", true).count().get(),
    adminDb.collection("events").where("status", "==", "active").count().get(),
  ]);
  return {
    totalItems: totalItems.data().count,
    itemsOut: itemsOut.data().count,
    lowStockCount: lowStockCount.data().count,
    activeEvents: activeEvents.data().count,
  };
}

/**
 * RP-03 — single count for nav badge. Re-queried on every layout render
 * (Next 16 RSC layouts re-execute on path change), so the badge stays
 * current without a Web SDK listener subscription cost.
 */
export async function getLowStockCount(): Promise<number> {
  const snap = await adminDb.collection("inventory").where("isLowStock", "==", true).count().get();
  return snap.data().count;
}
