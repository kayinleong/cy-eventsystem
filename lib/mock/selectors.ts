// Phase 1 pure selectors over a StoreSnapshot.
//
// CONTEXT.md D-01 — selectors live in lib/mock/selectors.ts so the same
// signatures work in Phase 2 against Firestore-backed snapshots. Components
// import these by name; the store implementation can swap without touching
// any consumer.
//
// Every function here is a pure projection (no mutation, no side effects).

import type { InventoryItem } from "@/lib/types/item";
import type { EventDoc, EventStatus } from "@/lib/types/event";
import type { UserDoc, UserRole } from "@/lib/types/user";
import type { TransactionDoc } from "@/lib/types/transaction";
import type { MissingItemDoc } from "@/lib/types/missing-item";
import type { StoreSnapshot } from "./store";

// Phase 1 "today" — fixed per CONTEXT.md D-04 so dashboard widgets are
// deterministic. Phase 2 should call selectors with `new Date()` from the
// caller. Selectors accept an optional override.
export const PHASE_1_TODAY = new Date("2026-05-24T12:00:00.000Z");

// ---------- byId / byEmail lookups ----------

export function selectItemById(s: StoreSnapshot, id: string): InventoryItem | undefined {
  return s.items.find((i) => i.id === id);
}

export function selectItemBySku(s: StoreSnapshot, sku: string): InventoryItem | undefined {
  return s.items.find((i) => i.sku.toLowerCase() === sku.toLowerCase());
}

export function selectEventById(s: StoreSnapshot, id: string): EventDoc | undefined {
  return s.events.find((e) => e.id === id);
}

export function selectUserByUid(s: StoreSnapshot, uid: string): UserDoc | undefined {
  return s.users.find((u) => u.uid === uid);
}

export function selectUserByEmail(s: StoreSnapshot, email: string): UserDoc | undefined {
  return s.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

// ---------- Event lifecycle filters ----------

export function selectActiveEvents(s: StoreSnapshot): EventDoc[] {
  return s.events.filter((e) => e.status === "active");
}

export function selectOverdueEvents(s: StoreSnapshot, today: Date = PHASE_1_TODAY): EventDoc[] {
  // EVT-07 — `active` AND `endDate < today`.
  return s.events.filter((e) => e.status === "active" && new Date(e.endDate) < today);
}

export function selectAccessibleEvents(
  s: StoreSnapshot,
  uid: string,
  role: UserRole,
  statuses?: EventStatus[],
): EventDoc[] {
  // EVT-08 — admin sees all; staff sees only events where allowedStaff
  // includes their uid.
  const filtered =
    role === "admin" ? [...s.events] : s.events.filter((e) => e.allowedStaff.includes(uid));
  if (!statuses || statuses.length === 0) return filtered;
  return filtered.filter((e) => statuses.includes(e.status));
}

// ---------- Inventory projections ----------

export function selectLowStockItems(s: StoreSnapshot): InventoryItem[] {
  // RP-01 / RP-02 — alert when threshold>0 AND availableQty<=threshold AND
  // the admin has NOT marked it ordered yet.
  return s.items.filter(
    (i) =>
      i.lifecycleState !== "retired" &&
      i.lowStockThreshold > 0 &&
      i.availableQty <= i.lowStockThreshold &&
      !i.lowStockOrderedAt,
  );
}

// ---------- Transaction queries ----------

export function selectOpenCheckoutsForEvent(
  s: StoreSnapshot,
  eventId: string,
): TransactionDoc[] {
  // A checkout is "open" when the sum of qty in matching checkin transactions
  // (parentTxId === checkout.id) is less than the checkout qty.
  const allCheckouts = s.transactions.filter(
    (t) => t.type === "checkout" && t.eventId === eventId,
  );
  return allCheckouts.filter((co) => {
    const matchedQty = s.transactions
      .filter((t) => t.parentTxId === co.id && t.type === "checkin")
      .reduce((sum, t) => sum + t.qty, 0);
    return matchedQty < co.qty;
  });
}

export function selectTransactionsForItem(s: StoreSnapshot, itemId: string): TransactionDoc[] {
  return s.transactions
    .filter((t) => t.itemId === itemId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function selectTransactionsForEvent(s: StoreSnapshot, eventId: string): TransactionDoc[] {
  return s.transactions
    .filter((t) => t.eventId === eventId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function selectRecentActivity(s: StoreSnapshot, limit = 20): TransactionDoc[] {
  return [...s.transactions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// ---------- Missing-item projections ----------

export function selectOpenMissing(s: StoreSnapshot): MissingItemDoc[] {
  return s.missingItems.filter((m) => m.status === "open");
}

// ---------- Reporting helpers ----------

export function selectItemsOut(
  s: StoreSnapshot,
): { item: InventoryItem; eventName: string; openTxs: TransactionDoc[] }[] {
  // REP-02 — items currently out at active events.
  const activeIds = new Set(s.events.filter((e) => e.status === "active").map((e) => e.id));
  const openByItem = new Map<string, TransactionDoc[]>();
  for (const t of s.transactions) {
    if (t.type !== "checkout" || !t.eventId || !activeIds.has(t.eventId)) continue;
    const matched = s.transactions
      .filter((x) => x.parentTxId === t.id && x.type === "checkin")
      .reduce((sum, x) => sum + x.qty, 0);
    if (matched >= t.qty) continue;
    const arr = openByItem.get(t.itemId) ?? [];
    arr.push(t);
    openByItem.set(t.itemId, arr);
  }
  const out: { item: InventoryItem; eventName: string; openTxs: TransactionDoc[] }[] = [];
  for (const [itemId, txs] of openByItem) {
    const item = s.items.find((i) => i.id === itemId);
    if (!item) continue;
    out.push({
      item,
      eventName: txs[0]?.eventName ?? "",
      openTxs: txs,
    });
  }
  return out;
}
