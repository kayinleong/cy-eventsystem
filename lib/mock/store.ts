// Phase 1 in-memory mock store.
//
// CONTEXT.md D-01 / D-02 — single mutable source of truth shared by all
// Phase 1 UI components. State resets on full page reload (no persistence).
// Same API surface as Phase 2's Firestore-backed data layer:
//   - subscribe / getSnapshot / getServerSnapshot match React 19's
//     `useSyncExternalStore` contract.
//   - Mutators have signatures that map 1:1 onto Phase 2 Server Actions
//     (modulo `actor: UserDoc` becoming `verifySession()` server-side).
//
// REQUIREMENTS.md CO-04 / CO-05 / CO-06 — atomic checkout with stock
// invariant (no negative available qty) and full-cart failure.
// REQUIREMENTS.md CI-05 / CI-06 / CI-07 / CI-08 — checkin returns flow to
// availableQty, damaged flows to damagedQty, missing creates a MissingItem
// record, parentTxId links checkin to its checkout.
// REQUIREMENTS.md MIS-01 / MIS-03 / MIS-04 — missing-item resolution with
// follow-up adjustment transaction.
// REQUIREMENTS.md EVT-07 / EVT-06 — cancel event with reconciliation.
// REQUIREMENTS.md AUTH-07 / AUTH-08 / AUTH-09 — invite, role change, disable.
// REQUIREMENTS.md RP-01 / RP-04 — low-stock threshold + ordered marker.

import type { InventoryItem, ItemLifecycleState, ItemCategory } from "@/lib/types/item";
import type { EventDoc, EventStatus } from "@/lib/types/event";
import type { UserDoc, UserRole } from "@/lib/types/user";
import type { TransactionDoc } from "@/lib/types/transaction";
import type { MissingItemDoc, MissingReason } from "@/lib/types/missing-item";

import { seedItems } from "./items";
import { seedEvents } from "./events";
import { seedUsers } from "./users";
import { seedTransactions } from "./transactions";
import { seedMissingItems } from "./missing-items";

// ============================================================
// Snapshot type — what every selector + hook consumes.
// ============================================================

export type StoreSnapshot = Readonly<{
  items: readonly InventoryItem[];
  events: readonly EventDoc[];
  users: readonly UserDoc[];
  transactions: readonly TransactionDoc[];
  missingItems: readonly MissingItemDoc[];
}>;

let state: StoreSnapshot = Object.freeze({
  items: seedItems,
  events: seedEvents,
  users: seedUsers,
  transactions: seedTransactions,
  missingItems: seedMissingItems,
});

// ============================================================
// subscribe / getSnapshot — useSyncExternalStore contract.
// ============================================================

const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): StoreSnapshot {
  return state;
}

// Same snapshot reference on server + client during the first paint. This is
// safe because we hydrate from the same seed arrays in both runtimes, and the
// store has no networked side effects in Phase 1.
export function getServerSnapshot(): StoreSnapshot {
  return state;
}

// ============================================================
// ID generators (Phase 1 only — Phase 2 uses Firestore-generated ids).
// ============================================================

let txCounter = state.transactions.length + 1;
function nextTxId(): string {
  return `tx-${String(txCounter++).padStart(4, "0")}`;
}

let missingCounter = state.missingItems.length + 1;
function nextMissingId(): string {
  return `miss-${String(missingCounter++).padStart(3, "0")}`;
}

let userCounter = state.users.length + 1;
function nextUserUid(): string {
  return `u-staff-new-${userCounter++}`;
}

// ============================================================
// MUTATORS — every mutator builds a new frozen snapshot, assigns to `state`,
// then calls emit(). Snapshots are immutable; consumers can rely on reference
// equality to detect change.
// ============================================================

// ---------- Inventory check-out (CO-04 / CO-05 / CO-06) ----------

export type CheckoutResult =
  | { ok: true; txIds: string[] }
  | { ok: false; error: string; failedLines?: { itemId: string; available: number }[] };

export function checkout(args: {
  eventId: string;
  lines: { itemId: string; qty: number }[];
  actor: UserDoc;
}): CheckoutResult {
  // CO-05 — refuse atomically if any line would drive availableQty < 0.
  const failedLines: { itemId: string; available: number }[] = [];
  // Aggregate by itemId so a cart with two lines of the same item validates against the same stock.
  const requestedByItem = new Map<string, number>();
  for (const line of args.lines) {
    requestedByItem.set(line.itemId, (requestedByItem.get(line.itemId) ?? 0) + line.qty);
  }
  for (const [itemId, totalQty] of requestedByItem) {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || item.lifecycleState === "retired") {
      failedLines.push({ itemId, available: 0 });
      continue;
    }
    if (item.availableQty < totalQty) {
      failedLines.push({ itemId, available: item.availableQty });
    }
  }
  if (failedLines.length > 0) {
    return { ok: false, error: "Not enough stock", failedLines };
  }

  const event = state.events.find((e) => e.id === args.eventId);
  if (!event) return { ok: false, error: "Event not found" };

  const now = new Date().toISOString();
  const newTxs: TransactionDoc[] = args.lines.map((line) => {
    const item = state.items.find((i) => i.id === line.itemId)!;
    return {
      id: nextTxId(),
      type: "checkout",
      itemId: item.id,
      itemSku: item.sku,
      itemName: item.name,
      eventId: event.id,
      eventName: event.name,
      qty: line.qty,
      actorUid: args.actor.uid,
      actorName: args.actor.displayName,
      actorRoleAtTimeOfAction: args.actor.role,
      at: now,
      notes: "",
      parentTxId: null,
      clientTxId: null,
    };
  });

  const newItems = state.items.map((item) => {
    const totalOut = requestedByItem.get(item.id) ?? 0;
    if (totalOut === 0) return item;
    const newAvailable = item.availableQty - totalOut;
    const newLifecycle: ItemLifecycleState =
      newAvailable === 0 && item.lifecycleState === "available"
        ? "checked_out"
        : item.lifecycleState;
    return {
      ...item,
      availableQty: newAvailable,
      outQty: item.outQty + totalOut,
      lifecycleState: newLifecycle,
      updatedAt: now,
      updatedBy: args.actor.uid,
    };
  });

  state = Object.freeze({
    ...state,
    items: newItems,
    transactions: [...state.transactions, ...newTxs],
  });
  emit();
  return { ok: true, txIds: newTxs.map((t) => t.id) };
}

// ---------- Inventory check-in (CI-05 / CI-06 / CI-07 / CI-08) ----------

export type CheckinResult = { ok: true; txIds: string[]; missingIds: string[] };

export function checkin(args: {
  eventId: string;
  lines: {
    parentTxId: string;
    itemId: string;
    returnedQty: number;
    damagedQty: number;
    missingReason?: MissingReason;
  }[];
  actor: UserDoc;
}): CheckinResult {
  const now = new Date().toISOString();
  const event = state.events.find((e) => e.id === args.eventId);
  if (!event) {
    // Defensive — keep API simple but avoid crashing UI in dev.
    return { ok: true, txIds: [], missingIds: [] };
  }

  const newTxs: TransactionDoc[] = [];
  const newMissing: MissingItemDoc[] = [];

  for (const line of args.lines) {
    const item = state.items.find((i) => i.id === line.itemId);
    if (!item) continue;
    const parent = state.transactions.find((t) => t.id === line.parentTxId);
    const checkedOutQty = parent?.qty ?? 0;
    const missingQty = Math.max(0, checkedOutQty - line.returnedQty - line.damagedQty);

    // Always write a check-in transaction if anything came back.
    if (line.returnedQty + line.damagedQty > 0) {
      newTxs.push({
        id: nextTxId(),
        type: "checkin",
        itemId: item.id,
        itemSku: item.sku,
        itemName: item.name,
        eventId: event.id,
        eventName: event.name,
        qty: line.returnedQty + line.damagedQty,
        actorUid: args.actor.uid,
        actorName: args.actor.displayName,
        actorRoleAtTimeOfAction: args.actor.role,
        at: now,
        notes: line.damagedQty > 0 ? `${line.damagedQty} damaged` : "",
        parentTxId: line.parentTxId,
        clientTxId: null,
      });
    }

    // Missing branch — record + a separate `missing`-typed transaction (CI-07).
    if (missingQty > 0 && line.missingReason) {
      const checkinTxId = newTxs[newTxs.length - 1]?.id ?? nextTxId();
      newMissing.push({
        id: nextMissingId(),
        itemId: item.id,
        itemName: item.name,
        eventId: event.id,
        eventName: event.name,
        qty: missingQty,
        reason: line.missingReason,
        reportedBy: args.actor.uid,
        reportedByName: args.actor.displayName,
        reportedAt: now,
        status: "open",
        resolvedAt: null,
        resolvedBy: null,
        parentCheckinTxId: checkinTxId,
      });
      newTxs.push({
        id: nextTxId(),
        type: "missing",
        itemId: item.id,
        itemSku: item.sku,
        itemName: item.name,
        eventId: event.id,
        eventName: event.name,
        qty: missingQty,
        actorUid: args.actor.uid,
        actorName: args.actor.displayName,
        actorRoleAtTimeOfAction: args.actor.role,
        at: now,
        notes: `Reason: ${line.missingReason}`,
        parentTxId: line.parentTxId,
        clientTxId: null,
      });
    }
  }

  // Aggregate per-item adjustments across all lines.
  const adjustByItem = new Map<
    string,
    { returned: number; damaged: number; outReduction: number }
  >();
  for (const line of args.lines) {
    const parent = state.transactions.find((t) => t.id === line.parentTxId);
    const checkedOutQty = parent?.qty ?? 0;
    const missingQty = Math.max(0, checkedOutQty - line.returnedQty - line.damagedQty);
    const outReduction = line.returnedQty + line.damagedQty + missingQty;
    const acc = adjustByItem.get(line.itemId) ?? { returned: 0, damaged: 0, outReduction: 0 };
    acc.returned += line.returnedQty;
    acc.damaged += line.damagedQty;
    acc.outReduction += outReduction;
    adjustByItem.set(line.itemId, acc);
  }

  const newItems = state.items.map((item) => {
    const adj = adjustByItem.get(item.id);
    if (!adj) return item;
    const newAvailable = item.availableQty + adj.returned;
    const newOut = Math.max(0, item.outQty - adj.outReduction);
    const newDamaged = item.damagedQty + adj.damaged;
    // Lifecycle: if everything is now damaged with zero available + zero out, mark damaged.
    // Otherwise if there's available stock, mark available. Otherwise leave as-is.
    let nextLifecycle: ItemLifecycleState = item.lifecycleState;
    if (newAvailable > 0) nextLifecycle = "available";
    else if (newOut === 0 && newDamaged > 0) nextLifecycle = "damaged";
    return {
      ...item,
      availableQty: newAvailable,
      outQty: newOut,
      damagedQty: newDamaged,
      lifecycleState: nextLifecycle,
      updatedAt: now,
      updatedBy: args.actor.uid,
    };
  });

  state = Object.freeze({
    ...state,
    items: newItems,
    transactions: [...state.transactions, ...newTxs],
    missingItems: [...state.missingItems, ...newMissing],
  });
  emit();
  return { ok: true, txIds: newTxs.map((t) => t.id), missingIds: newMissing.map((m) => m.id) };
}

// ---------- Item create / update / retire ----------

export function createItem(
  input: {
    name: string;
    sku: string;
    category: ItemCategory;
    totalQty: number;
    unit: string;
    photoUrl: string | null;
    notes: string;
    lowStockThreshold: number;
  },
  actor: UserDoc,
): InventoryItem {
  const now = new Date().toISOString();
  const item: InventoryItem = {
    id: input.sku,
    sku: input.sku,
    name: input.name,
    category: input.category,
    totalQty: input.totalQty,
    availableQty: input.totalQty,
    outQty: 0,
    damagedQty: 0,
    unit: input.unit,
    photoUrl: input.photoUrl,
    notes: input.notes,
    lifecycleState: "available",
    lowStockThreshold: input.lowStockThreshold,
    lowStockOrderedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
    updatedBy: actor.uid,
  };
  state = Object.freeze({ ...state, items: [...state.items, item] });
  emit();
  return item;
}

export function updateItem(itemId: string, patch: Partial<InventoryItem>, actor: UserDoc): void {
  const now = new Date().toISOString();
  const newItems = state.items.map((i) =>
    i.id === itemId ? { ...i, ...patch, updatedAt: now, updatedBy: actor.uid } : i,
  );
  state = Object.freeze({ ...state, items: newItems });
  emit();
}

export function retireItem(itemId: string, actor: UserDoc): void {
  const now = new Date().toISOString();
  const newItems = state.items.map((i) =>
    i.id === itemId
      ? { ...i, lifecycleState: "retired" as ItemLifecycleState, updatedAt: now, updatedBy: actor.uid }
      : i,
  );
  state = Object.freeze({ ...state, items: newItems });
  emit();
}

// ---------- Event create / update / cancel ----------

export function createEvent(
  input: {
    name: string;
    startDate: string;
    endDate: string;
    location: string;
    description: string;
    teamLeads: string[];
    backupTeams: string[];
  },
  actor: UserDoc,
): EventDoc {
  const now = new Date().toISOString();
  const adminUids = state.users.filter((u) => u.role === "admin").map((u) => u.uid);
  const allowedStaff = Array.from(
    new Set([...adminUids, ...input.teamLeads, ...input.backupTeams]),
  );
  const event: EventDoc = {
    id: `evt-${Date.now()}`,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    status: "planned",
    location: input.location,
    description: input.description,
    teamLeads: input.teamLeads,
    backupTeams: input.backupTeams,
    allowedStaff,
    plannedItems: {},
    createdAt: now,
    createdBy: actor.uid,
    closedAt: null,
    closedBy: null,
  };
  state = Object.freeze({ ...state, events: [...state.events, event] });
  emit();
  return event;
}

export function updateEvent(eventId: string, patch: Partial<EventDoc>, actor: UserDoc): void {
  // Recompute `allowedStaff` if teamLeads / backupTeams changed.
  const newEvents = state.events.map((e) => {
    if (e.id !== eventId) return e;
    const teamLeads = patch.teamLeads ?? e.teamLeads;
    const backupTeams = patch.backupTeams ?? e.backupTeams;
    const adminUids = state.users.filter((u) => u.role === "admin").map((u) => u.uid);
    const allowedStaff = Array.from(new Set([...adminUids, ...teamLeads, ...backupTeams]));
    return { ...e, ...patch, teamLeads, backupTeams, allowedStaff };
  });
  state = Object.freeze({ ...state, events: newEvents });
  emit();
  // updatedAt/updatedBy not tracked on events in Phase 1 (matches ARCHITECTURE.md).
  void actor;
}

export function cancelEvent(
  eventId: string,
  reconciliations: { itemId: string; resolution: "returned" | "lost" | "still_with_owner"; qty: number }[],
  actor: UserDoc,
): void {
  // EVT-06 — cancellation requires reconciling open check-outs.
  const now = new Date().toISOString();
  const eventName = state.events.find((e) => e.id === eventId)?.name ?? "";
  const newTxs: TransactionDoc[] = reconciliations.map((r) => {
    const item = state.items.find((i) => i.id === r.itemId);
    return {
      id: nextTxId(),
      type: r.resolution === "returned" ? "checkin" : "adjustment",
      itemId: r.itemId,
      itemSku: item?.sku ?? r.itemId,
      itemName: item?.name ?? "",
      eventId,
      eventName,
      qty: r.qty,
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorRoleAtTimeOfAction: actor.role,
      at: now,
      notes: `Cancellation reconciliation: ${r.resolution}`,
      parentTxId: null,
      clientTxId: null,
    };
  });
  const newEvents = state.events.map((e) =>
    e.id === eventId
      ? { ...e, status: "cancelled" as EventStatus, closedAt: now, closedBy: actor.uid }
      : e,
  );

  // Adjust item totals based on resolution.
  const newItems = state.items.map((item) => {
    const itemRecons = reconciliations.filter((r) => r.itemId === item.id);
    if (itemRecons.length === 0) return item;
    const returnedQty = itemRecons
      .filter((r) => r.resolution === "returned")
      .reduce((s, r) => s + r.qty, 0);
    const totalReducedFromOut = itemRecons.reduce((s, r) => s + r.qty, 0);
    return {
      ...item,
      availableQty: item.availableQty + returnedQty,
      outQty: Math.max(0, item.outQty - totalReducedFromOut),
      updatedAt: now,
      updatedBy: actor.uid,
    };
  });

  state = Object.freeze({
    ...state,
    events: newEvents,
    items: newItems,
    transactions: [...state.transactions, ...newTxs],
  });
  emit();
}

// ---------- Missing-item resolution (MIS-03 / MIS-04) ----------

export function resolveMissing(
  missingId: string,
  resolution: "found" | "writtenOff",
  actor: UserDoc,
): void {
  const now = new Date().toISOString();
  const record = state.missingItems.find((m) => m.id === missingId);
  if (!record) return;

  const newMissing = state.missingItems.map((m) =>
    m.id === missingId ? { ...m, status: resolution, resolvedAt: now, resolvedBy: actor.uid } : m,
  );

  const newItems = state.items.map((item) => {
    if (item.id !== record.itemId) return item;
    if (resolution === "found") {
      return {
        ...item,
        availableQty: item.availableQty + record.qty,
        updatedAt: now,
        updatedBy: actor.uid,
      };
    }
    // writtenOff — decrement totalQty (stock is permanently lost).
    return {
      ...item,
      totalQty: Math.max(0, item.totalQty - record.qty),
      updatedAt: now,
      updatedBy: actor.uid,
    };
  });

  const followUpTx: TransactionDoc = {
    id: nextTxId(),
    type: "adjustment",
    itemId: record.itemId,
    itemSku: state.items.find((i) => i.id === record.itemId)?.sku ?? "",
    itemName: record.itemName,
    eventId: record.eventId,
    eventName: record.eventName,
    qty: record.qty,
    actorUid: actor.uid,
    actorName: actor.displayName,
    actorRoleAtTimeOfAction: actor.role,
    at: now,
    notes: `Missing resolved: ${resolution}`,
    parentTxId: record.parentCheckinTxId,
    clientTxId: null,
  };

  state = Object.freeze({
    ...state,
    missingItems: newMissing,
    items: newItems,
    transactions: [...state.transactions, followUpTx],
  });
  emit();
}

// ---------- User invite / role / disable (AUTH-07 / AUTH-08 / AUTH-09) ----------

export function inviteUser(
  input: { email: string; displayName: string; role: UserRole },
  actor: UserDoc,
): UserDoc {
  // AUTH-07 — Phase 1 "invite" creates the user record directly; the seed
  // password is "password" (see lib/mock/users.ts header). Phase 2 swaps this
  // for a real Firebase signed-link flow.
  const now = new Date().toISOString();
  const user: UserDoc = {
    uid: nextUserUid(),
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    disabled: false,
    createdAt: now,
    createdBy: actor.uid,
    lastLoginAt: null,
  };
  state = Object.freeze({ ...state, users: [...state.users, user] });
  emit();
  return user;
}

export function setUserRole(uid: string, role: UserRole, actor: UserDoc): void {
  // AUTH-08 — recompute allowedStaff for every event because admin promotion
  // changes the admin union baked into each event's allowedStaff.
  const newUsers = state.users.map((u) => (u.uid === uid ? { ...u, role } : u));
  const adminUids = newUsers.filter((u) => u.role === "admin").map((u) => u.uid);
  const newEvents = state.events.map((e) => ({
    ...e,
    allowedStaff: Array.from(new Set([...adminUids, ...e.teamLeads, ...e.backupTeams])),
  }));
  state = Object.freeze({ ...state, users: newUsers, events: newEvents });
  emit();
  void actor;
}

export function disableUser(uid: string, actor: UserDoc): void {
  // AUTH-09
  const newUsers = state.users.map((u) => (u.uid === uid ? { ...u, disabled: true } : u));
  state = Object.freeze({ ...state, users: newUsers });
  emit();
  void actor;
}

// ---------- Low-stock controls (RP-01 / RP-04) ----------

export function markLowStockOrdered(itemId: string, actor: UserDoc): void {
  // RP-04 — `lowStockOrderedAt` records when the admin clicked "Mark ordered".
  const now = new Date().toISOString();
  const newItems = state.items.map((i) =>
    i.id === itemId ? { ...i, lowStockOrderedAt: now, updatedAt: now, updatedBy: actor.uid } : i,
  );
  state = Object.freeze({ ...state, items: newItems });
  emit();
}

export function updateLowStockThreshold(itemId: string, threshold: number, actor: UserDoc): void {
  // RP-01
  const now = new Date().toISOString();
  const newItems = state.items.map((i) =>
    i.id === itemId
      ? { ...i, lowStockThreshold: threshold, updatedAt: now, updatedBy: actor.uid }
      : i,
  );
  state = Object.freeze({ ...state, items: newItems });
  emit();
}
