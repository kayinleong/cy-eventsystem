// Phase 1 camera scanner widget.
//
// CONTEXT.md D-13/D-16 — @yudiel/react-qr-scanner (ZXing-backed) with all 5
// barcode formats enabled (CO-09). Defaults to the rear camera (SCN-02).
// Camera permission denials show iOS-specific re-enable instructions per
// SCN-03 and the UI-SPEC error copy table.
//
// Behavior:
//   - "Tap to start" pattern (SCN-04 spirit, battery hygiene per PITFALLS.md
//     line 264): camera off by default; the user presses Start to activate.
//     Stopping the camera releases the MediaStream via the library's
//     internal cleanup, so a phone left on /scan doesn't drain battery.
//   - Debounces same value within 1500ms (CO-07 per PITFALLS.md line 253).
//   - On a successful scan: navigator.vibrate(50) when available (CO-07).
//   - On scan, dispatches to the scan-session addLine() so the same handler
//     is shared between camera + manual entry + Bluetooth scanner (CO-10).
//
// Torch (SCN-05): the library's `components.torch` prop surfaces a torch
// button on devices that expose `MediaStreamTrack.getCapabilities().torch`
// (Chrome Android). iOS Safari does not expose torch — the button simply
// won't render on those devices. No extra work to gate this per platform.
//
// Phase 2 / Plan 02-13 — RES-02 + D-19 offline gate: when navigator.onLine
// === false the widget short-circuits to a disabled placeholder. Stock
// decrements depend on the server-side transactional check; allowing scans
// to queue while offline would race the eventual reconnect and could
// silently double-commit. Read-side caching (RES-01) is unaffected and
// continues to operate via persistentLocalCache. This single gate covers
// every scanner-bearing surface (/scan, /events/[id]/checkout,
// /events/[id]/checkin) because they all mount this widget.

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Scanner,
  type IDetectedBarcode,
  type IScannerError,
} from "@yudiel/react-qr-scanner";
import { Camera, CameraOff, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { useScanSession } from "./scan-session";

export function ScannerWidget({ paused = false }: { paused?: boolean }) {
  const { addLine, selectedEvent } = useScanSession();
  const lastValue = useRef<{ value: string; at: number } | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  // RES-02 + D-19 — online-state gate. Default true so SSR + initial client
  // render don't flash the disabled state for users who are actually online.
  // The effect below reconciles immediately with navigator.onLine on mount.
  const [online, setOnline] = useState(true);

  // Stop the stream on unmount (battery / tab-switch hygiene).
  useEffect(() => {
    return () => {
      setActive(false);
    };
  }, []);

  // RES-02 + D-19 — subscribe to network state.
  useEffect(() => {
    const update = () =>
      setOnline(typeof navigator !== "undefined" && navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Going offline mid-session: the `!online` early return below unmounts the
  // <Scanner/> JSX subtree, which triggers the library's MediaStream cleanup
  // automatically. No imperative `setActive(false)` needed — React handles
  // the teardown via unmount. When the user reconnects, `active` is still
  // whatever it was before (likely true, since they were scanning), so the
  // camera resumes seamlessly. The lint rule `react-hooks/set-state-in-effect`
  // forbids the synchronous setState pattern we'd otherwise use here, and
  // React's reconciliation gives us the same behavior for free.

  if (!online) {
    return (
      <div className="aspect-square w-full max-w-md mx-auto bg-muted rounded-lg flex flex-col items-center justify-center text-center gap-3 px-6">
        <WifiOff className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Scanner disabled while offline. Reconnect to scan or use manual entry
          to queue items.
        </p>
      </div>
    );
  }

  const isPaused = paused || !active || !selectedEvent || !!permissionError;

  function handleScan(results: IDetectedBarcode[]) {
    const value = results[0]?.rawValue;
    if (!value) return;
    const now = Date.now();
    // CO-07 — ignore same value within 1500ms (matches PITFALLS guidance).
    if (
      lastValue.current &&
      lastValue.current.value === value &&
      now - lastValue.current.at < 1500
    ) {
      return;
    }
    lastValue.current = { value, at: now };
    // Haptic feedback (Chrome Android; iOS Safari ignores the call).
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(50);
    }
    addLine(value);
  }

  function handleError(err: IScannerError | unknown) {
    const kind = (err as { kind?: string })?.kind;
    const name = (err as { name?: string })?.name;
    // Library normalises errors to { kind, message, cause } but also forwards
    // the raw cause; handle both shapes defensively.
    if (kind === "permission-denied" || name === "NotAllowedError") {
      setPermissionError(
        "Camera access needed. On iOS, open Settings → Safari → Camera and allow this site. Then reload.",
      );
      // UI-SPEC "Camera blocked" copy verbatim.
      toast.error("Camera access needed", {
        description: "Allow camera permission in your browser to scan codes.",
      });
    } else if (kind === "no-camera" || name === "NotFoundError") {
      setPermissionError("No camera found on this device.");
    } else if (kind === "insecure-context") {
      setPermissionError(
        "Camera needs HTTPS. Open this page over a secure connection.",
      );
    } else {
      toast.error("Couldn't read code");
    }
  }

  return (
    <div className="space-y-3">
      {active ? (
        <div className="relative aspect-square w-full max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
          <Scanner
            // CO-09 / D-16 — all 5 formats.
            formats={[
              "qr_code",
              "code_128",
              "ean_13",
              "upc_a",
              "data_matrix",
            ]}
            paused={isPaused}
            // SCN-02 — rear camera default.
            constraints={{ facingMode: { ideal: "environment" } }}
            scanDelay={150}
            // SCN-05 — surface the torch toggle on devices that expose it
            // (Chrome Android). iOS Safari simply won't render it.
            components={{ torch: true, finder: true }}
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
          {/* SCN-04 spirit — tap-to-start camera so /scan doesn't drain
              battery on phones left on the page. */}
          <Camera className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {selectedEvent
              ? "Tap to start the camera."
              : "Pick an event below before scanning."}
          </p>
          <Button
            type="button"
            onClick={() => {
              setPermissionError(null);
              setActive(true);
            }}
            disabled={!selectedEvent}
            className="h-11"
          >
            <Camera className="mr-2 size-4" /> Start camera
          </Button>
        </div>
      )}
      {permissionError ? (
        <p className="text-sm text-destructive max-w-md mx-auto text-center">
          {permissionError}
        </p>
      ) : null}
    </div>
  );
}
