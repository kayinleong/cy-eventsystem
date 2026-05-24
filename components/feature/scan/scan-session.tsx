// Phase 1 scan-session context.
//
// CONTEXT.md D-13/D-14/D-15 — owns the in-memory state for a /scan session:
//   - mode (checkout vs checkin) — SCN-01
//   - selectedEvent (sticky for the session; post-scan event picker per D-15 +
//     CO-02) — survives across scans, cleared on End session
//   - cart (ephemeral list of scanned items with qty) — CO-03/CO-06
//
// Mutators:
//   - addLine: takes a SKU or item id (camera scan rawValue OR manual entry),
//     dedups by item, increments qty up to availableQty in checkout mode,
//     emits sonner success/error toasts per UI-SPEC copy
//   - removeLine: drops a cart entry — CO-03
//   - setQty: clamps via QtyStepper bounds
//   - commit: dispatches to store.checkout (CO-04) or routes to the
//     per-event check-in form (CI-02 routing only; Plan 10 wires the form)
//   - endSession: clears selectedEvent + cart (D-15)
//
// Phase 2 swap surface: every method body stays the same shape — only the
// store.checkout call changes to a Server Action returning the same
// CheckoutResult contract.

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

import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectItemBySku } from "@/lib/mock/selectors";
import { checkout, getSnapshot } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
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
  const session = useCurrentUser();
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const [selectedEvent, setSelectedEvent] = useState<EventDoc | null>(
    initialEvent,
  );
  const [cart, setCart] = useState<ScanCartLine[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);

  // Subscribe to items so QtyStepper bounds reflect the latest stock.
  const items = useMockStore((s) => s.items);

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

      // Use the live snapshot for one-off lookup so we don't depend on the
      // closed-over `items` slice (which may lag by one render). The selector
      // is case-insensitive on SKU; fall back to id match for camera scans
      // that already carry the item id (e.g. an internal QR encoding).
      const snap = getSnapshot();
      const item =
        selectItemBySku(snap, trimmed) ??
        snap.items.find((i) => i.id === trimmed);

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
    [mode],
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
    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't commit");
      return;
    }
    setIsCommitting(true);

    if (mode === "checkout") {
      const result = checkout({
        eventId: selectedEvent.id,
        lines: cart.map((l) => ({ itemId: l.itemId, qty: l.qty })),
        actor,
      });
      if (!result.ok) {
        // CO-05 — whole cart fails atomically; surface failed lines so the
        // user can correct before retrying. Cart stays intact.
        toast.error(result.error, {
          description: result.failedLines
            ?.map((f) => `${f.itemId}: only ${f.available} left`)
            .join("; "),
        });
        setIsCommitting(false);
        return;
      }
      toast.success(
        `${cart.length} ${cart.length === 1 ? "item" : "items"} checked out`,
      );
      setCart([]);
      router.push(`/events/${selectedEvent.id}`);
    } else {
      // Phase 1 scope: /scan in checkin mode routes to the per-event check-in
      // screen (CI-02). Plan 10 wires the full check-in form.
      router.push(`/events/${selectedEvent.id}/checkin`);
    }
    setIsCommitting(false);
  }, [selectedEvent, cart, mode, session, router]);

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
