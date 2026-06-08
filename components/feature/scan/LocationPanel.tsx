// quick-kayinleong-007 — Location-tracking scan panel.
//
// Does NOT participate in the ScanSessionProvider cart flow. Each scan is an
// immediate update — no cart accumulation. The panel holds its own local state:
//   state.phase: idle | preview | submitting
//   locationValue: the typed location string
//
// Resolution UX:
//   - Show a preview of matched items BEFORE the user types a location.
//   - Individual items: resolved from useInventoryLive snapshot (instant).
//   - Anything not in the snapshot (group barcodes, items outside the 500-row
//     window) is resolved via resolveLocationBarcodeAction (Admin SDK, server
//     session). quick-kayinleong-012: this replaced a client checkoutGroups
//     getDoc that was denied unless the deployed rules granted the read and was
//     subject to a client-auth-readiness race.
//
// Pitfall 3 avoidance: passes eventRequired={false} to ScannerWidget so the
// camera activates without a selected event.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { ScannerWidget } from "./ScannerWidget";
import { ManualEntryInput } from "./ManualEntryInput";
import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
import {
  updateItemsLocationAction,
  resolveLocationBarcodeAction,
  type UpdateItemsLocationResult,
} from "@/app/(app)/scan/actions";

type PreviewItem = { id: string; name: string; sku: string };

// `recognised` — the barcode mapped to a known item OR an existing group doc.
//   A group with an empty itemLines snapshot is still recognised: the Server
//   Action resolves the authoritative member list at submit.
// `lookupError` — the Firestore group probe threw. Distinct from "unknown" so
//   the UI can tell the user to retry instead of falsely claiming the code
//   isn't in the system.
type PreviewState = {
  barcode: string;
  items: PreviewItem[];
  isGroup: boolean;
  recognised: boolean;
  lookupError: boolean;
};

type PanelState =
  | { phase: "idle" }
  | { phase: "resolving"; barcode: string }
  | ({ phase: "preview" } & PreviewState)
  | ({ phase: "submitting" } & PreviewState);

export function LocationPanel() {
  // useInventoryLive returns InventoryItem[] directly (not { items: ... }).
  const items = useInventoryLive([], { limit: 500 });
  const [state, setState] = useState<PanelState>({ phase: "idle" });
  const [locationValue, setLocationValue] = useState("");

  async function handleBarcode(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();

    // 1. Try individual item from live snapshot (instant, no network)
    const matched =
      items.find((i) => i.sku.toLowerCase() === lower) ??
      items.find((i) => i.id === trimmed) ??
      items.find((i) => i.externalBarcode !== "" && i.externalBarcode === trimmed);

    if (matched) {
      setState({
        phase: "preview",
        barcode: trimmed,
        items: [{ id: matched.id, name: matched.name, sku: matched.sku }],
        isGroup: false,
        recognised: true,
        lookupError: false,
      });
      setLocationValue("");
      return;
    }

    // 2. Not in the live snapshot — resolve via the Server Action (Admin SDK).
    //    Resolving server-side avoids the client checkoutGroups read, which is
    //    denied unless the deployed rules grant it and is subject to a
    //    client-auth-readiness race.
    setState({ phase: "resolving", barcode: trimmed });
    setLocationValue("");
    try {
      const result = await resolveLocationBarcodeAction(trimmed);
      if (result.ok) {
        // A group is recognised even when its itemLines snapshot is empty —
        // the update action expands the full member list authoritatively.
        setState({
          phase: "preview",
          barcode: trimmed,
          items: result.items,
          isGroup: result.resolvedAs === "group",
          recognised: true,
          lookupError: false,
        });
        return;
      }
      // Recognised nowhere.
      setState({
        phase: "preview",
        barcode: trimmed,
        items: [],
        isGroup: false,
        recognised: false,
        lookupError: false,
      });
    } catch (err) {
      // Surface the failure instead of silently reporting "not recognised".
      console.error("[LocationPanel] barcode resolve failed:", err);
      setState({
        phase: "preview",
        barcode: trimmed,
        items: [],
        isGroup: false,
        recognised: false,
        lookupError: true,
      });
    }
  }

  async function handleSubmit() {
    if (state.phase !== "preview") return;
    const { barcode, items: previewItems, isGroup, recognised, lookupError } = state;
    setState({ phase: "submitting", barcode, items: previewItems, isGroup, recognised, lookupError });
    const result: UpdateItemsLocationResult = await updateItemsLocationAction({
      barcodeValue: barcode,
      location: locationValue.trim(),
    });
    if (result.ok) {
      toast.success("Location updated", {
        description: `${result.updatedItemIds.length} item(s) → "${locationValue.trim()}"`,
      });
      setState({ phase: "idle" });
      setLocationValue("");
    } else {
      toast.error("Update failed", { description: result.error });
      setState({ phase: "preview", barcode, items: previewItems, isGroup, recognised, lookupError });
    }
  }

  const isPreviewOrSubmitting =
    state.phase === "preview" || state.phase === "submitting";
  const isSubmitting = state.phase === "submitting";
  const isResolving = state.phase === "resolving";

  return (
    <div className="space-y-6">
      {/* Resolving spinner */}
      {isResolving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Looking up group barcode…
        </div>
      )}

      {/* Scanner — only visible in idle phase */}
      {state.phase === "idle" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <ScannerWidget eventRequired={false} onScan={handleBarcode} />
            <ManualEntryInput onSubmit={handleBarcode} disabled={false} />
          </div>
          <div className="rounded-lg border border-dashed p-6 flex flex-col items-center justify-center text-center gap-2">
            <MapPin className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Scan an item or group barcode to set its location.
            </p>
          </div>
        </div>
      ) : null}

      {/* Preview + location input */}
      {isPreviewOrSubmitting ? (
        <div className="rounded-lg border p-6 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Scanned barcode</p>
            <p className="font-mono text-sm text-muted-foreground break-all">
              {state.barcode}
            </p>
          </div>

          {/* Item preview */}
          {state.items.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {state.isGroup
                  ? `Group barcode — ${state.items.length} item${state.items.length !== 1 ? "s" : ""} will be updated`
                  : `Item${state.items.length > 1 ? "s" : ""} to update`}
              </p>
              {state.isGroup && (
                <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  All {state.items.length} items in this group will have their location updated.
                </div>
              )}
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {state.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="size-4 text-green-500 shrink-0" />
                    <span>{item.name}</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {item.sku}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : state.recognised && state.isGroup ? (
            // Group resolved but its itemLines snapshot is empty — still valid.
            // The Server Action expands the group and updates every member.
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              Group barcode recognised — all items in this group will have their
              location updated on confirm.
            </div>
          ) : state.lookupError ? (
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t look up that barcode. Check your connection and try
              again.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Barcode not recognised — check the value and try again.
            </p>
          )}

          {/* Location input */}
          <div className="space-y-2">
            <Label htmlFor="location-input">New location</Label>
            <Input
              id="location-input"
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value)}
              placeholder="e.g. Warehouse A, Shelf 3"
              maxLength={100}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || locationValue.trim() === "" || !state.recognised}
            >
              {isSubmitting ? "Updating…" : "Update location"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setState({ phase: "idle" });
                setLocationValue("");
              }}
              disabled={isSubmitting}
            >
              Scan different barcode
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
