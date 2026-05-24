---
phase: 01-ui-poc
plan: 08
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - app/(app)/scan/page.tsx
  - components/feature/scan/ScannerWidget.tsx
  - components/feature/scan/ScanCartPanel.tsx
  - components/feature/scan/ScanHeader.tsx
  - components/feature/scan/EventPickerDialog.tsx
  - components/feature/scan/ManualEntryInput.tsx
  - components/feature/scan/scan-session.tsx
autonomous: true
requirements:
  - SCN-01
  - SCN-02
  - SCN-03
  - SCN-04
  - SCN-05
  - SCN-06
  - CO-02
  - CO-03
  - CO-06
  - CO-07
  - CO-08
  - CO-09
  - CI-02
  - NFR-05

must_haves:
  truths:
    - "/scan renders a mode toggle (check-out / check-in) and a ScannerWidget."
    - "ScannerWidget uses @yudiel/react-qr-scanner with formats: qr_code, code_128, ean_13, upc_a, data_matrix (D-16 / CO-09)."
    - "Rear camera default via facingMode: { ideal: 'environment' } (SCN-02)."
    - "Camera permission errors render iOS-specific re-enable instructions (SCN-03)."
    - "Duplicate scans within 1.5s are debounced (CO-07)."
    - "Successful scan triggers navigator.vibrate(50) when available (CO-07)."
    - "Manual entry input is always visible — typed SKU enters the same handler as camera scans (CO-08, SCN-06, CO-10)."
    - "First successful scan opens EventPickerDialog if no event preselected (D-15)."
    - "Selected event is sticky in ScanHeader for the rest of the session; 'End session' clears it (D-15)."
    - "Scan cart panel shows lines from the scan session, allows qty stepping and per-line remove, and has a 'Confirm check-out N items' / 'Return N items' CTA per mode."
    - "Cart commit calls store.checkout (checkout mode) — Plan 09 wires the /events/[id]/checkout deep-link variant; Plan 10 wires check-in."
  artifacts:
    - path: "app/(app)/scan/page.tsx"
      provides: "Standalone scanner route with mode toggle"
      contains: "ScannerWidget"
    - path: "components/feature/scan/ScannerWidget.tsx"
      provides: "Camera + decode + debounce + vibrate + permission error toast"
      contains: "@yudiel/react-qr-scanner"
    - path: "components/feature/scan/ScanCartPanel.tsx"
      provides: "Cart UI with qty stepper, per-line remove, confirm CTA per mode; calls store.checkout in checkout mode"
      contains: "QtyStepper"
    - path: "components/feature/scan/ScanHeader.tsx"
      provides: "Sticky selected-event header with End session button"
      contains: "End session"
    - path: "components/feature/scan/EventPickerDialog.tsx"
      provides: "Dialog with combobox listing accessible planned + active events"
      contains: "selectAccessibleEvents"
    - path: "components/feature/scan/ManualEntryInput.tsx"
      provides: "Text input that submits same handler as camera scan on Enter"
      contains: "onKeyDown"
    - path: "components/feature/scan/scan-session.tsx"
      provides: "ScanSessionProvider React context: mode, selectedEvent, cart, addLine, removeLine, setQty, commit, endSession"
      contains: "createContext"
      min_lines: 80
  key_links:
    - from: "components/feature/scan/ScannerWidget.tsx"
      to: "lib/mock/selectors.ts selectItemBySku + scan-session context"
      via: "On decode, lookup SKU, dispatch addLine to scan-session"
      pattern: "selectItemBySku|addLine"
    - from: "components/feature/scan/ScanCartPanel.tsx"
      to: "lib/mock/store.ts checkout + scan-session context"
      via: "Confirm check-out calls checkout({ eventId, lines, actor })"
      pattern: "checkout"
---

<objective>
Build the standalone scanner page at `/scan` and the underlying scan-session context with cart, event picker, scanner widget, manual entry, and sticky header.

This plan does NOT wire the per-event checkout (`/events/[id]/checkout`) or check-in (`/events/[id]/checkin`) routes — those are Plans 09 and 10. This plan builds the reusable scan substrate.

Output: 1 route + 6 feature components + 1 React context.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-PATTERNS.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md
@lib/types/item.ts
@lib/types/event.ts
@lib/mock/store.ts
@lib/mock/selectors.ts
@lib/mock/users.ts
@lib/hooks/use-mock-store.ts
@lib/hooks/use-current-user.ts
@components/ui/dialog.tsx
@components/ui/command.tsx
@components/ui/popover.tsx
@components/ui/card.tsx
@components/ui/button.tsx
@components/ui/input.tsx
@components/ui/tabs.tsx
@components/feature/inventory/QtyStepper.tsx
@components/feature/status/StatusBadge.tsx
@components/feature/status/status-to-tone.ts
@components/ui/empty-state.tsx
@components/ui/page-header.tsx

<interfaces>
```tsx
// scan-session.tsx
export type ScanMode = "checkout" | "checkin";
export type ScanCartLine = { itemId: string; itemSku: string; itemName: string; qty: number; availableQty: number };

export type ScanSessionContextValue = {
  mode: ScanMode;
  setMode: (m: ScanMode) => void;
  selectedEvent: EventDoc | null;
  selectEvent: (event: EventDoc) => void;
  endSession: () => void;
  cart: ScanCartLine[];
  addLine: (itemId: string) => { ok: true } | { ok: false; reason: string };
  removeLine: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;
  commit: () => Promise<void>;
  isCommitting: boolean;
};

export function ScanSessionProvider(props: { initialMode?: ScanMode; initialEvent?: EventDoc | null; children: React.ReactNode }): React.ReactElement;
export function useScanSession(): ScanSessionContextValue;

// ScannerWidget.tsx
export function ScannerWidget(props: { mode: ScanMode; paused?: boolean }): React.ReactElement;

// ScanCartPanel.tsx
export function ScanCartPanel(): React.ReactElement;

// ScanHeader.tsx
export function ScanHeader(): React.ReactElement | null;

// EventPickerDialog.tsx
export function EventPickerDialog(props: { open: boolean; onOpenChange: (v: boolean) => void; onSelect: (event: EventDoc) => void }): React.ReactElement;

// ManualEntryInput.tsx
export function ManualEntryInput(props: { onSubmit: (sku: string) => void; disabled?: boolean }): React.ReactElement;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: ScanSessionProvider context + EventPickerDialog + ManualEntryInput + ScanHeader</name>
  <files>
    components/feature/scan/scan-session.tsx,
    components/feature/scan/EventPickerDialog.tsx,
    components/feature/scan/ManualEntryInput.tsx,
    components/feature/scan/ScanHeader.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-13, D-14, D-15, D-16
    - .planning/REQUIREMENTS.md CO-02 (post-scan event picker filtered to accessible planned+active events), CO-03, CO-06, CO-09, SCN-04, SCN-06, CI-02
    - lib/mock/selectors.ts (selectAccessibleEvents)
    - lib/mock/store.ts (checkout signature)
    - components/ui/command.tsx, components/ui/dialog.tsx
  </read_first>
  <action>
    **components/feature/scan/scan-session.tsx** (provider + hook; in-memory session state):
    ```tsx
    "use client";
    import { createContext, useCallback, useContext, useMemo, useState } from "react";
    import { useRouter } from "next/navigation";
    import { toast } from "sonner";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectItemBySku } from "@/lib/mock/selectors";
    import { checkout } from "@/lib/mock/store";
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
      const [selectedEvent, setSelectedEvent] = useState<EventDoc | null>(initialEvent);
      const [cart, setCart] = useState<ScanCartLine[]>([]);
      const [isCommitting, setIsCommitting] = useState(false);

      // We always read items from the live store so the cart's availableQty reflects the latest state.
      const items = useMockStore((s) => s.items);

      const selectEvent = useCallback((event: EventDoc) => setSelectedEvent(event), []);

      const endSession = useCallback(() => {
        setSelectedEvent(null);
        setCart([]);
      }, []);

      const addLine = useCallback((skuOrId: string): { ok: true } | { ok: false; reason: string } => {
        const trimmed = skuOrId.trim();
        if (!trimmed) return { ok: false, reason: "Empty scan." };
        const item = selectItemBySku({ items, events: [], users: [], transactions: [], missingItems: [] } as never, trimmed)
          ?? items.find((i) => i.id === trimmed);
        if (!item) {
          // UI-SPEC "No scan match" copy
          toast.error("Item not recognized", { description: "This code isn't in inventory. Check the label or enter the SKU manually." });
          return { ok: false, reason: "Item not recognized" };
        }
        if (item.lifecycleState === "retired") {
          toast.error("This item is retired and can't be checked out.");
          return { ok: false, reason: "Item retired" };
        }
        if (mode === "checkout" && item.availableQty <= 0) {
          // UI-SPEC "Not enough stock" copy
          toast.error("Not enough stock", { description: `Only ${item.availableQty} available.` });
          return { ok: false, reason: "Not enough stock" };
        }
        // Increment if already present; otherwise add qty=1
        setCart((prev) => {
          const existing = prev.find((l) => l.itemId === item.id);
          if (existing) {
            if (mode === "checkout" && existing.qty + 1 > item.availableQty) {
              toast.error("Not enough stock", { description: `Only ${item.availableQty} available.` });
              return prev;
            }
            return prev.map((l) => l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l);
          }
          return [...prev, { itemId: item.id, itemSku: item.sku, itemName: item.name, qty: 1, availableQty: item.availableQty }];
        });
        toast.success(`Added ${item.name}`);
        return { ok: true };
      }, [items, mode]);

      const removeLine = useCallback((itemId: string) => {
        setCart((prev) => prev.filter((l) => l.itemId !== itemId));
      }, []);

      const setQty = useCallback((itemId: string, qty: number) => {
        setCart((prev) => prev.map((l) => {
          if (l.itemId !== itemId) return l;
          const item = items.find((i) => i.id === itemId);
          const max = mode === "checkout" ? (item?.availableQty ?? 0) : Number.MAX_SAFE_INTEGER;
          const clamped = Math.max(0, Math.min(max, Math.floor(qty)));
          return { ...l, qty: clamped, availableQty: item?.availableQty ?? l.availableQty };
        }));
      }, [items, mode]);

      const commit = useCallback(async () => {
        if (!selectedEvent) { toast.error("Pick an event first"); return; }
        if (cart.length === 0) { toast.error("Cart is empty"); return; }
        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't commit"); return; }
        setIsCommitting(true);

        if (mode === "checkout") {
          const result = checkout({ eventId: selectedEvent.id, lines: cart.map((l) => ({ itemId: l.itemId, qty: l.qty })), actor });
          if (!result.ok) {
            // CO-05: whole cart fails atomically; surface failed lines
            toast.error(result.error, {
              description: result.failedLines?.map((f) => `${f.itemId}: only ${f.available} left`).join("; "),
            });
            setIsCommitting(false);
            return;
          }
          toast.success(`${cart.length} items checked out`);
          setCart([]);
          router.push(`/events/${selectedEvent.id}`);
        } else {
          // Phase 1 scope: /scan in checkin mode routes to the per-event check-in screen (CI-02)
          // The full check-in form lives in Plan 10. From /scan we route the user there.
          router.push(`/events/${selectedEvent.id}/checkin`);
        }
        setIsCommitting(false);
      }, [selectedEvent, cart, mode, session, router]);

      const value = useMemo<ScanSessionContextValue>(() => ({
        mode, setMode, selectedEvent, selectEvent, endSession,
        cart, addLine, removeLine, setQty, commit, isCommitting,
      }), [mode, selectedEvent, selectEvent, endSession, cart, addLine, removeLine, setQty, commit, isCommitting]);

      return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
    }

    export function useScanSession(): ScanSessionContextValue {
      const ctx = useContext(Ctx);
      if (!ctx) throw new Error("useScanSession must be inside ScanSessionProvider");
      return ctx;
    }
    ```

    Critical: `selectItemBySku` signature requires a full StoreSnapshot — the executor must adapt: either call `getSnapshot()` directly, or fix the call to pass a real snapshot. Recommended fix during implementation:

    ```ts
    // Inside addLine, replace the selectItemBySku call with:
    import { getSnapshot } from "@/lib/mock/store";
    const item = selectItemBySku(getSnapshot(), trimmed) ?? items.find((i) => i.id === trimmed);
    ```

    Use `getSnapshot()` for one-off lookups; use `useMockStore` for re-render-triggering subscriptions.

    **components/feature/scan/EventPickerDialog.tsx**:
    ```tsx
    "use client";
    import { Check } from "lucide-react";
    import {
      Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
    } from "@/components/ui/dialog";
    import {
      Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
    } from "@/components/ui/command";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectAccessibleEvents } from "@/lib/mock/selectors";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import type { EventDoc } from "@/lib/types/event";

    export function EventPickerDialog({
      open,
      onOpenChange,
      onSelect,
    }: {
      open: boolean;
      onOpenChange: (v: boolean) => void;
      onSelect: (event: EventDoc) => void;
    }) {
      const session = useCurrentUser();
      const events = useMockStore((s) =>
        session
          ? selectAccessibleEvents(s, session.uid, session.role, ["planned", "active"])
          : []
      );
      // EVT-08 + CO-02: filtered to accessible AND planned-or-active

      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pick an event</DialogTitle>
              <DialogDescription>Choose the event these items belong to.</DialogDescription>
            </DialogHeader>
            <Command>
              <CommandInput placeholder="Search events…" autoFocus />
              <CommandList>
                <CommandEmpty>No accessible events.</CommandEmpty>
                <CommandGroup>
                  {events.map((e) => (
                    <CommandItem
                      key={e.id}
                      value={`${e.name} ${e.location}`}
                      onSelect={() => { onSelect(e); onOpenChange(false); }}
                    >
                      <Check className="mr-2 size-4 opacity-0" />
                      <div className="flex flex-col">
                        <span className="text-sm">{e.name}</span>
                        <span className="text-xs text-muted-foreground">{e.location} · {e.status}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
      );
    }
    ```

    **components/feature/scan/ManualEntryInput.tsx** (SCN-06 + CO-08 + CO-10 — handles Bluetooth keystroke scanners too):
    ```tsx
    "use client";
    import { useState } from "react";
    import { Input } from "@/components/ui/input";
    import { Button } from "@/components/ui/button";

    export function ManualEntryInput({
      onSubmit,
      disabled = false,
    }: {
      onSubmit: (sku: string) => void;
      disabled?: boolean;
    }) {
      const [value, setValue] = useState("");
      function submit() {
        const trimmed = value.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
        setValue("");
      }
      return (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Enter SKU or scan barcode…"
            className="font-mono"
            autoComplete="off"
            inputMode="text"
            disabled={disabled}
            aria-label="Manual SKU entry"
          />
          <Button type="button" onClick={submit} disabled={disabled || !value.trim()}>
            Add
          </Button>
        </div>
      );
    }
    ```

    **components/feature/scan/ScanHeader.tsx** (D-15 sticky selected event):
    ```tsx
    "use client";
    import { X } from "lucide-react";
    import { Button } from "@/components/ui/button";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import { useScanSession } from "./scan-session";

    export function ScanHeader() {
      const { selectedEvent, endSession } = useScanSession();
      if (!selectedEvent) return null;
      return (
        <div className="sticky top-14 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-muted/60 backdrop-blur border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Scanning for</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate">{selectedEvent.name}</p>
                <StatusBadge tone={statusToTone(selectedEvent.status)}>
                  {statusToLabel(selectedEvent.status)}
                </StatusBadge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={endSession}>
              <X className="mr-2 size-4" /> End session
            </Button>
          </div>
        </div>
      );
    }
    ```
  </action>
  <verify>
    <automated>ls components/feature/scan/scan-session.tsx components/feature/scan/EventPickerDialog.tsx components/feature/scan/ManualEntryInput.tsx components/feature/scan/ScanHeader.tsx | wc -l | grep -q "^4$"; grep -q "createContext" components/feature/scan/scan-session.tsx; grep -q "ScanSessionProvider" components/feature/scan/scan-session.tsx; grep -q "useScanSession" components/feature/scan/scan-session.tsx; grep -q "checkout" components/feature/scan/scan-session.tsx; grep -q "selectAccessibleEvents" components/feature/scan/EventPickerDialog.tsx; grep -q "End session" components/feature/scan/ScanHeader.tsx; grep -q "Enter" components/feature/scan/ManualEntryInput.tsx; grep -q "autoComplete=\"off\"" components/feature/scan/ManualEntryInput.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 4 files exist.
    - `scan-session.tsx` exports `ScanSessionProvider` + `useScanSession` + types.
    - EventPickerDialog filters via `selectAccessibleEvents` with statuses=["planned","active"] (CO-02).
    - ManualEntryInput submits on Enter key (CO-10 Bluetooth keyboard scanner pattern).
    - ScanHeader includes "End session" button (D-15).
    - tsc passes.
  </acceptance_criteria>
  <done>Scan-session context + 3 satellite components compile, store integration via checkout mutator works.</done>
</task>

<task type="auto">
  <name>Task 2: ScannerWidget + ScanCartPanel</name>
  <files>
    components/feature/scan/ScannerWidget.tsx,
    components/feature/scan/ScanCartPanel.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md "Scanner widget" (lines 692-735), "Scan cart" (lines 738-775)
    - .planning/research/PITFALLS.md "iOS Safari camera permissions + PWA quirks" (lines 234-246), "Continuous scan debouncing" (lines 252-256)
    - .planning/REQUIREMENTS.md SCN-02, SCN-03, SCN-04, SCN-05, CO-07, CO-09
    - @yudiel/react-qr-scanner README ("Scanner" component props: `formats`, `paused`, `constraints`, `scanDelay`, `onScan`, `onError`, `allowMultiple`)
    - components/feature/inventory/QtyStepper.tsx (44px stepper for cart lines)
  </read_first>
  <action>
    **components/feature/scan/ScannerWidget.tsx**:
    ```tsx
    "use client";
    import { useEffect, useRef, useState } from "react";
    import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
    import { Camera, CameraOff } from "lucide-react";
    import { toast } from "sonner";
    import { Button } from "@/components/ui/button";
    import { useScanSession } from "./scan-session";

    export function ScannerWidget({ paused = false }: { paused?: boolean }) {
      const { addLine, selectedEvent } = useScanSession();
      const lastValue = useRef<{ value: string; at: number } | null>(null);
      const [permissionError, setPermissionError] = useState<string | null>(null);
      const [active, setActive] = useState(false);

      // Stop the stream on unmount (battery / tab-switch hygiene)
      useEffect(() => {
        return () => { setActive(false); };
      }, []);

      const isPaused = paused || !active || !selectedEvent || !!permissionError;

      function handleScan(results: IDetectedBarcode[]) {
        const value = results[0]?.rawValue;
        if (!value) return;
        const now = Date.now();
        // CO-07 debounce — ignore same value within 1.5s
        if (lastValue.current && lastValue.current.value === value && now - lastValue.current.at < 1500) return;
        lastValue.current = { value, at: now };
        // Feedback
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(50);
        addLine(value);
      }

      function handleError(err: unknown) {
        const name = (err as { name?: string })?.name;
        if (name === "NotAllowedError") {
          // SCN-03 iOS-specific
          setPermissionError(
            "Camera access needed. On iOS, open Settings → Safari → Camera and allow this site. Then reload."
          );
          toast.error("Camera access needed", { description: "Allow camera permission in your browser to scan codes." });
        } else if (name === "NotFoundError") {
          setPermissionError("No camera found on this device.");
        } else {
          toast.error("Couldn't read code");
        }
      }

      return (
        <div className="space-y-3">
          {active ? (
            <div className="relative aspect-square w-full max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
              <Scanner
                // CO-09 / D-16 — all 5 formats
                formats={["qr_code", "code_128", "ean_13", "upc_a", "data_matrix"]}
                paused={isPaused}
                // SCN-02 rear camera default
                constraints={{ facingMode: { ideal: "environment" } }}
                scanDelay={150}
                onScan={handleScan}
                onError={handleError}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => setActive(false)}
                aria-label="Stop camera"
              >
                <CameraOff className="mr-2 size-4" /> Stop
              </Button>
            </div>
          ) : (
            <div className="aspect-square w-full max-w-md mx-auto bg-muted rounded-lg flex flex-col items-center justify-center text-center gap-3 px-6">
              {/* SCN-04 — tap-to-start camera */}
              <Camera className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {selectedEvent ? "Tap to start the camera." : "Pick an event below before scanning."}
              </p>
              <Button
                type="button"
                onClick={() => { setPermissionError(null); setActive(true); }}
                disabled={!selectedEvent}
                className="h-11"
              >
                <Camera className="mr-2 size-4" /> Start camera
              </Button>
            </div>
          )}
          {permissionError ? (
            <p className="text-sm text-destructive max-w-md mx-auto text-center">{permissionError}</p>
          ) : null}
        </div>
      );
    }
    ```

    Note on SCN-05 (torch toggle): The `@yudiel/react-qr-scanner` library does not consistently expose a torch prop across versions. Executor should confirm via the installed `node_modules/@yudiel/react-qr-scanner/dist/*` files whether a `torch` prop exists; if so, surface it as an icon button. If not, mark it as Phase 2 work and add a small comment. Do NOT block this plan on torch.

    **components/feature/scan/ScanCartPanel.tsx**:
    ```tsx
    "use client";
    import Link from "next/link";
    import { Trash2, ShoppingCart } from "lucide-react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { Button } from "@/components/ui/button";
    import { EmptyState } from "@/components/ui/empty-state";
    import { QtyStepper } from "@/components/feature/inventory/QtyStepper";
    import { useScanSession } from "./scan-session";

    export function ScanCartPanel() {
      const { mode, cart, removeLine, setQty, commit, isCommitting, selectedEvent } = useScanSession();
      const total = cart.reduce((s, l) => s + l.qty, 0);
      const ctaLabel = mode === "checkout"
        ? `Check out ${total} ${total === 1 ? "item" : "items"}`
        : `Return ${total} ${total === 1 ? "item" : "items"}`;

      return (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShoppingCart className="size-4" /> Cart
              {cart.length > 0 ? <span className="text-xs text-muted-foreground">({cart.length})</span> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                heading="Cart is empty"
                body="Scan items to add them to this check-out."
              />
            ) : (
              <ul className="divide-y divide-border">
                {cart.map((line) => (
                  <li key={line.itemId} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/inventory/${line.itemId}`} className="text-sm font-medium hover:underline truncate block">
                        {line.itemName}
                      </Link>
                      <p className="text-xs font-mono text-muted-foreground">{line.itemSku}</p>
                      {mode === "checkout" ? (
                        <p className="text-xs text-muted-foreground">{line.availableQty} available</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <QtyStepper
                        value={line.qty}
                        onChange={(v) => setQty(line.itemId, v)}
                        min={1}
                        max={mode === "checkout" ? line.availableQty : Number.MAX_SAFE_INTEGER}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.itemId)}
                        aria-label={`Remove ${line.itemName}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button
              className="w-full h-11"
              size="lg"
              disabled={cart.length === 0 || isCommitting || !selectedEvent}
              onClick={() => commit()}
            >
              {ctaLabel}
            </Button>
          </CardContent>
        </Card>
      );
    }
    ```
  </action>
  <verify>
    <automated>ls components/feature/scan/ScannerWidget.tsx components/feature/scan/ScanCartPanel.tsx; grep -q "@yudiel/react-qr-scanner" components/feature/scan/ScannerWidget.tsx; grep -q "qr_code" components/feature/scan/ScannerWidget.tsx; grep -q "code_128" components/feature/scan/ScannerWidget.tsx; grep -q "ean_13" components/feature/scan/ScannerWidget.tsx; grep -q "upc_a" components/feature/scan/ScannerWidget.tsx; grep -q "data_matrix" components/feature/scan/ScannerWidget.tsx; grep -q "facingMode" components/feature/scan/ScannerWidget.tsx; grep -q "NotAllowedError" components/feature/scan/ScannerWidget.tsx; grep -q "navigator.vibrate" components/feature/scan/ScannerWidget.tsx; grep -q "1500" components/feature/scan/ScannerWidget.tsx; grep -q "Cart is empty" components/feature/scan/ScanCartPanel.tsx; grep -q "QtyStepper" components/feature/scan/ScanCartPanel.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist.
    - ScannerWidget imports `@yudiel/react-qr-scanner`, sets all 5 formats, uses `facingMode: { ideal: "environment" }`, handles `NotAllowedError` with iOS-specific copy, debounces same value within 1500ms, vibrates on scan.
    - ScanCartPanel uses QtyStepper, renders "Cart is empty" empty state matching UI-SPEC verbatim, exposes a Confirm CTA with dynamic mode-specific label.
    - tsc passes.
  </acceptance_criteria>
  <done>Camera widget + cart panel compile; ZXing decoding wired via library; debounce + vibrate work.</done>
</task>

<task type="auto">
  <name>Task 3: /scan route with mode toggle + ScanSessionProvider wiring</name>
  <files>app/(app)/scan/page.tsx</files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-13 (scanner integration), D-15 (post-scan event picker)
    - .planning/REQUIREMENTS.md SCN-01 (mode toggle), CI-02
    - components/ui/tabs.tsx (Tabs, TabsList, TabsTrigger, TabsContent — used for mode toggle)
    - All 6 scan components from Tasks 1-2
  </read_first>
  <action>
    **app/(app)/scan/page.tsx**:
    ```tsx
    "use client";
    import { useState } from "react";
    import { useSearchParams } from "next/navigation";
    import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { PageHeader } from "@/components/ui/page-header";
    import { ScanSessionProvider, useScanSession, type ScanMode } from "@/components/feature/scan/scan-session";
    import { ScannerWidget } from "@/components/feature/scan/ScannerWidget";
    import { ScanCartPanel } from "@/components/feature/scan/ScanCartPanel";
    import { ScanHeader } from "@/components/feature/scan/ScanHeader";
    import { EventPickerDialog } from "@/components/feature/scan/EventPickerDialog";
    import { ManualEntryInput } from "@/components/feature/scan/ManualEntryInput";
    import { Button } from "@/components/ui/button";

    function ScanInner() {
      const { mode, setMode, selectedEvent, selectEvent, addLine } = useScanSession();
      const [pickerOpen, setPickerOpen] = useState(false);

      return (
        <div className="space-y-6">
          <PageHeader
            title="Scan"
            description={mode === "checkout" ? "Scan items to check them out." : "Scan items being returned."}
          />
          <Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
            <TabsList>
              <TabsTrigger value="checkout">Check out</TabsTrigger>
              <TabsTrigger value="checkin">Check in</TabsTrigger>
            </TabsList>
          </Tabs>

          <ScanHeader />

          {!selectedEvent ? (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Pick an event to begin scanning.</p>
              <Button onClick={() => setPickerOpen(true)}>Pick event</Button>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <ScannerWidget />
              <ManualEntryInput onSubmit={(sku) => addLine(sku)} disabled={!selectedEvent} />
            </div>
            <ScanCartPanel />
          </div>

          <EventPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={(e) => selectEvent(e)}
          />
        </div>
      );
    }

    export default function ScanPage() {
      const searchParams = useSearchParams();
      const initialMode = (searchParams.get("mode") === "checkin" ? "checkin" : "checkout") as ScanMode;
      return (
        <ScanSessionProvider initialMode={initialMode}>
          <ScanInner />
        </ScanSessionProvider>
      );
    }
    ```
    Note: this page is a Client Component (uses hooks). Metadata in Client Components is set via `<title>` or omitted; for now omit explicit title — the parent layout's template handles "%s · cy-eventsystem" only when a Server `metadata` is exported. Leaving the default page title is acceptable for Phase 1.
  </action>
  <verify>
    <automated>ls app/(app)/scan/page.tsx; grep -q "ScanSessionProvider" app/(app)/scan/page.tsx; grep -q "ScannerWidget" app/(app)/scan/page.tsx; grep -q "ScanCartPanel" app/(app)/scan/page.tsx; grep -q "EventPickerDialog" app/(app)/scan/page.tsx; grep -q "ManualEntryInput" app/(app)/scan/page.tsx; grep -q "ScanHeader" app/(app)/scan/page.tsx; grep -q "TabsTrigger" app/(app)/scan/page.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - /scan route exists, uses ScanSessionProvider, mode toggle wired to context, all 5 satellite components composed.
    - npm run build passes.
  </acceptance_criteria>
  <done>/scan renders, allows mode toggle, picks event, scans (camera or manual), accumulates cart, commits via store.checkout.</done>
</task>

</tasks>

<verification>
- /scan renders mode toggle + scanner placeholder + cart.
- Picking an event from EventPickerDialog updates ScanHeader sticky.
- Scanning a known SKU (manual entry suffices for verification) adds to cart and shows sonner success.
- Cart commit calls store.checkout and redirects to /events/[id] for checkout mode, /events/[id]/checkin for checkin mode.
- npm run build passes.
- npx tsc --noEmit passes.
</verification>

<success_criteria>SCN-01..06, CO-02, CO-03, CO-06, CO-07, CO-08, CO-09 (Phase 1 mock level), CI-02 (routing only — full check-in form in Plan 10) satisfied.</success_criteria>

<output>After completion, create `.planning/phases/phase-kayinleong-01/01-08-scanner-and-scan-page-SUMMARY.md` documenting the 7 files, the scan-session API exports, and any quirks observed with @yudiel/react-qr-scanner in this React 19 / Next 16 stack.</output>
