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
//
// Plan 02-13 (RES-03 full delivery) — scan-cart persistence to sessionStorage.
// The Phase 1 / Plan 02-08 implementation kept cart + selectedEvent + mode in
// React state only, so an accidental browser refresh or token refresh during
// a scan session lost everything. We now mirror those three pieces to
// sessionStorage under the versioned key `scan-cart-v1` so RES-03 is fully
// delivered (not just partially via Firestore IndexedDB cache):
//   - hydrate on ScanSessionProvider mount, skipping stale (>4h) or corrupt
//     payloads;
//   - mirror every change via a single useEffect (mutators themselves are
//     unchanged — no public-API churn for ScanCartPanel / ScannerWidget /
//     EventPickerDialog consumers);
//   - clear on successful commit (explicit clearPersisted() in the commit
//     success path so cross-tab listeners fire immediately; the mirror
//     useEffect also handles this defensively);
//   - cross-tab sync via the `storage` event so two tabs don't fight;
//   - SSR-safe — every sessionStorage access is guarded with
//     `typeof window !== "undefined"`.
//
// Threat-model: T-02-13-03 — the persisted payload is non-PII (SKUs +
// quantities + event metadata already readable by the signed-in user). The
// risk of leaving the data across sign-out on a shared device is documented
// as accepted in the plan threat register.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

// RES-03 — versioned sessionStorage key. Bump the suffix if the persisted
// shape ever changes so old sessions invalidate cleanly instead of crashing
// the hydration parse.
const STORAGE_KEY = "scan-cart-v1";
// Sessions older than 4h are treated as abandoned — likely a user closed the
// tab last night and reopened today, in which case rehydrating yesterday's
// cart would be surprising and possibly wrong (stock has shifted).
const STALE_MS = 4 * 60 * 60 * 1000;

type PersistedScanSession = {
  cart: ScanCartLine[];
  selectedEvent: EventDoc | null;
  mode: ScanMode;
  timestamp: number;
};

function loadPersisted(): PersistedScanSession | null {
  if (typeof window === "undefined") return null;
  try {
    // sessionStorage.getItem scan-cart-v1
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedScanSession>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.timestamp !== "number") return null;
    if (Date.now() - parsed.timestamp > STALE_MS) return null;
    if (parsed.mode !== "checkout" && parsed.mode !== "checkin") return null;
    if (!Array.isArray(parsed.cart)) return null;
    // selectedEvent is allowed to be null (user picked mode but not an event
    // yet, then refreshed). Guard against malformed object shapes only.
    if (
      parsed.selectedEvent !== null &&
      (typeof parsed.selectedEvent !== "object" ||
        typeof (parsed.selectedEvent as EventDoc).id !== "string")
    ) {
      return null;
    }
    return {
      cart: parsed.cart as ScanCartLine[],
      selectedEvent: (parsed.selectedEvent as EventDoc | null) ?? null,
      mode: parsed.mode,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

function savePersisted(snapshot: Omit<PersistedScanSession, "timestamp">) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedScanSession = {
      ...snapshot,
      timestamp: Date.now(),
    };
    // sessionStorage.setItem scan-cart-v1
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota exceeded / private mode — RES-03 is best-effort; degrade silently
    // so a Safari private window doesn't break the active session.
  }
}

function clearPersisted() {
  if (typeof window === "undefined") return;
  try {
    // sessionStorage.removeItem scan-cart-v1
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — see savePersisted comment.
  }
}

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

  // RES-03 — hydrate cart/event/mode from sessionStorage if a recent session
  // exists. The initial-state seed runs once on Provider mount (functional
  // initializer ensures `loadPersisted()` is called only on the first render
  // and only client-side via the `typeof window` guard inside).
  //
  // Hydration precedence rules:
  //   - For `selectedEvent`: an explicit `initialEvent` prop (e.g.,
  //     /events/[id]/checkout passes the event from the server) always wins
  //     over persisted state. The persisted event is only used when the
  //     mount-site doesn't supply one (the /scan page).
  //   - For `mode`: a persisted mode wins over `initialMode` so a refresh of
  //     /scan?mode=checkout doesn't clobber a session the user had toggled
  //     into check-in mode. The /events/[id]/checkout page hard-codes
  //     `initialMode="checkout"` and doesn't persist event-bound checkout
  //     across navigations because its eventId is part of the URL — so we
  //     match the persisted mode only when no initialEvent is provided
  //     (i.e., the /scan flow). This keeps event-bound pages deterministic.
  //   - For `cart`: always rehydrated. Even if the page provides a fresh
  //     initialEvent, recovering an in-progress cart for that event is the
  //     whole point of RES-03.
  const [mode, setMode] = useState<ScanMode>(() => {
    const persisted = loadPersisted();
    if (initialEvent) return initialMode;
    return persisted?.mode ?? initialMode;
  });
  const [selectedEvent, setSelectedEvent] = useState<EventDoc | null>(() => {
    const persisted = loadPersisted();
    if (initialEvent) return initialEvent;
    return persisted?.selectedEvent ?? null;
  });
  const [cart, setCart] = useState<ScanCartLine[]>(() => {
    const persisted = loadPersisted();
    return persisted?.cart ?? [];
  });
  const [isCommitting, setIsCommitting] = useState(false);

  // RES-03 — mirror every relevant state change to sessionStorage. When the
  // user fully clears their session (no cart, no event), we remove the key
  // outright so a stale empty payload doesn't sit around eating storage and
  // looking like work-in-progress to the hydration path.
  useEffect(() => {
    if (cart.length === 0 && !selectedEvent) {
      clearPersisted();
      return;
    }
    savePersisted({ cart, selectedEvent, mode });
  }, [cart, selectedEvent, mode]);

  // RES-03 — cross-tab sync. If the user opens /scan in two tabs and commits
  // in tab A, tab B should clear its cart so they can't double-submit. The
  // `storage` event only fires in *other* tabs (never the originator), so
  // this is safe and cheap insurance.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === null) {
        // Another tab cleared the session (likely a successful commit).
        setCart([]);
        // Don't clobber an explicit initialEvent — event-bound pages remain
        // anchored to their URL even if a sibling tab cleared its picker.
        if (!initialEvent) setSelectedEvent(null);
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue) as PersistedScanSession;
        if (parsed.mode !== "checkout" && parsed.mode !== "checkin") {
          return;
        }
        setCart(Array.isArray(parsed.cart) ? parsed.cart : []);
        if (!initialEvent) {
          setSelectedEvent(parsed.selectedEvent ?? null);
          setMode(parsed.mode);
        }
      } catch {
        // ignore corrupt storage events
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [initialEvent]);

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
      // RES-03 — successful commit means there's no work-in-progress left.
      // We clear the cart (the mirror useEffect would also unset the key,
      // but the explicit removeItem ensures cross-tab listeners fire
      // immediately even if React batches the state updates around the
      // router.push that follows).
      setCart([]);
      clearPersisted();
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
