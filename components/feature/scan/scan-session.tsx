// Phase 2 scan-session context.
//
// Plan 02-08 swap: store.checkout (mock) → commitCheckoutCartAction (Server
// Action). The useOptimistic + revert path from Phase 1 is preserved unchanged
// because the Server Action returns the exact CheckoutResult discriminated
// union shape (CO-06; CONTEXT.md `<specifics>` last bullet).
//
// CONTEXT.md D-13/D-14/D-15 (Phase 1) — owns the in-memory state for a /scan
// session:
//   - mode (checkout vs checkin) — SCN-01
//   - selectedEvent (sticky for the session; post-scan event picker per D-15
//     + CO-02) — survives across scans, cleared on End session
//   - cart (ephemeral list of scanned items with qty) — CO-03/CO-06
//
// Mutators:
//   - addLine: takes a SKU or item id (camera scan rawValue, manual entry, or
//     Bluetooth keystroke burst — CO-10), dedups by item, increments qty up
//     to availableQty in checkout mode. Sources from useInventoryLive (P2
//     Block C live hook) so qty stepper bounds reflect the latest stock
//     observed via onSnapshot.
//   - removeLine: drops a cart entry — CO-03
//   - setQty: clamps via QtyStepper bounds
//   - commit: calls commitCheckoutCartAction Server Action (Plan 02-08).
//     The Server Action atomically validates + decrements in one
//     runTransaction (CO-04, CO-05). On rejection the cart stays intact and
//     useOptimistic auto-reverts when the underlying Firestore listener
//     re-renders with the original availableQty.
//   - endSession: clears selectedEvent + cart (D-15)
//
// Actor lookup REMOVED — the Server Action derives the actor from
// requireSession() server-side. The Phase 1 mock-actor lookup block (which
// did `find(u => u.uid === session.uid)` against the mock-user seed) is
// deleted.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  commitCheckoutCartAction,
  type CheckoutResult,
} from "@/app/(app)/events/[eventId]/checkout/actions";
import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
import type { EventDoc } from "@/lib/types/event";

export type ScanMode = "checkout" | "checkin";

export type ScanCartLine = {
  itemId: string;
  itemSku: string;
  itemName: string;
  qty: number;
  availableQty: number;
};

export type ScanSessionContextValue = {
  mode: ScanMode;
  setMode: (m: ScanMode) => void;
  selectedEvent: EventDoc | null;
  selectEvent: (event: EventDoc) => void;
  endSession: () => void;
  cart: ScanCartLine[];
  addLine: (skuOrId: string) => { ok: true } | { ok: false; reason: string };
  removeLine: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;
  commit: () => Promise<void>;
  isCommitting: boolean;
};

const Ctx = createContext<ScanSessionContextValue | null>(null);

export function ScanSessionProvider({
  initialMode = "checkout",
  initialEvent = null,
  children,
}: {
  initialMode?: ScanMode;
  initialEvent?: EventDoc | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const [selectedEvent, setSelectedEvent] = useState<EventDoc | null>(
    initialEvent,
  );
  const [cart, setCart] = useState<ScanCartLine[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);

  // Live inventory subscription — replaces Phase 1's useMockStore((s) => s.items).
  // limit: 500 covers v1 scale (D-16 projects 5000+ items eventually, but the
  // scan flow operates on the active inventory window). The Server Action
  // re-validates via tx.get so a stale snapshot can't push availableQty
  // negative; the client copy is for QtyStepper bounds and SKU lookup only.
  const items = useInventoryLive([], { limit: 500 });

  const selectEvent = useCallback(
    (event: EventDoc) => setSelectedEvent(event),
    [],
  );

  const endSession = useCallback(() => {
    setSelectedEvent(null);
    setCart([]);
  }, []);

  const addLine = useCallback(
    (skuOrId: string): { ok: true } | { ok: false; reason: string } => {
      const trimmed = skuOrId.trim();
      if (!trimmed) return { ok: false, reason: "Empty scan." };

      // SKU lookup is case-insensitive; fall back to id match for camera
      // scans that already carry the item id (e.g., an internal QR encoding).
      // Mirrors the Phase 1 selectItemBySku behavior.
      const lower = trimmed.toLowerCase();
      const item =
        items.find((i) => i.sku.toLowerCase() === lower) ??
        items.find((i) => i.id === trimmed);

      if (!item) {
        // UI-SPEC "No scan match" copy verbatim.
        toast.error("Item not recognized", {
          description:
            "This code isn't in inventory. Check the label or enter the SKU manually.",
        });
        return { ok: false, reason: "Item not recognized" };
      }
      if (item.lifecycleState === "retired") {
        toast.error("This item is retired and can't be checked out.");
        return { ok: false, reason: "Item retired" };
      }
      if (mode === "checkout" && item.availableQty <= 0) {
        // UI-SPEC "Not enough stock" copy verbatim.
        toast.error("Not enough stock", {
          description: `Only ${item.availableQty} available.`,
        });
        return { ok: false, reason: "Not enough stock" };
      }

      // Increment if already present; otherwise add qty=1.
      let outcome: { ok: true } | { ok: false; reason: string } = { ok: true };
      setCart((prev) => {
        const existing = prev.find((l) => l.itemId === item.id);
        if (existing) {
          if (mode === "checkout" && existing.qty + 1 > item.availableQty) {
            toast.error("Not enough stock", {
              description: `Only ${item.availableQty} available.`,
            });
            outcome = { ok: false, reason: "Not enough stock" };
            return prev;
          }
          return prev.map((l) =>
            l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l,
          );
        }
        return [
          ...prev,
          {
            itemId: item.id,
            itemSku: item.sku,
            itemName: item.name,
            qty: 1,
            availableQty: item.availableQty,
          },
        ];
      });

      if (outcome.ok) {
        toast.success(`Added ${item.name}`);
      }
      return outcome;
    },
    [items, mode],
  );

  const removeLine = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((l) => l.itemId !== itemId));
  }, []);

  const setQty = useCallback(
    (itemId: string, qty: number) => {
      setCart((prev) =>
        prev.map((l) => {
          if (l.itemId !== itemId) return l;
          const item = items.find((i) => i.id === itemId);
          const max =
            mode === "checkout"
              ? (item?.availableQty ?? 0)
              : Number.MAX_SAFE_INTEGER;
          const clamped = Math.max(0, Math.min(max, Math.floor(qty)));
          return {
            ...l,
            qty: clamped,
            availableQty: item?.availableQty ?? l.availableQty,
          };
        }),
      );
    },
    [items, mode],
  );

  const commit = useCallback(async () => {
    if (!selectedEvent) {
      toast.error("Pick an event first");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setIsCommitting(true);

    if (mode === "checkout") {
      // Phase 2 — Server Action. CheckoutResult shape matches Phase 1 mock
      // contract so the optimistic-revert path is structurally unchanged.
      const result: CheckoutResult = await commitCheckoutCartAction({
        eventId: selectedEvent.id,
        lines: cart.map((l) => ({ itemId: l.itemId, qty: l.qty })),
      });
      if (!result.ok) {
        // CO-05 — whole cart fails atomically; surface failed lines so the
        // user can correct before retrying. Cart stays intact. useOptimistic
        // (in any consumer) reverts because the underlying Firestore listener
        // still shows the original availableQty (no successful writes).
        toast.error(result.error, {
          description: result.failedLines
            ?.map(
              (f) =>
                `${f.itemId}: only ${f.available} available, requested ${f.requested}`,
            )
            .join("; "),
        });
        setIsCommitting(false);
        return;
      }
      toast.success(
        `${cart.length} ${cart.length === 1 ? "item" : "items"} checked out`,
      );
      setCart([]);
      // Defense-in-depth: revalidatePath has run server-side; refresh the
      // current segment so the user sees the new outQty + audit feed when
      // landing on /events/<id>.
      router.push(`/events/${selectedEvent.id}`);
      router.refresh();
    } else {
      // Phase 1 scope: /scan in checkin mode routes to the per-event check-in
      // screen (CI-02). Plan 02-09 wires the full check-in form.
      router.push(`/events/${selectedEvent.id}/checkin`);
    }
    setIsCommitting(false);
  }, [selectedEvent, cart, mode, router]);

  const value = useMemo<ScanSessionContextValue>(
    () => ({
      mode,
      setMode,
      selectedEvent,
      selectEvent,
      endSession,
      cart,
      addLine,
      removeLine,
      setQty,
      commit,
      isCommitting,
    }),
    [
      mode,
      selectedEvent,
      selectEvent,
      endSession,
      cart,
      addLine,
      removeLine,
      setQty,
      commit,
      isCommitting,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScanSession(): ScanSessionContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScanSession must be inside ScanSessionProvider");
  return ctx;
}
