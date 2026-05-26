// components/layout/OfflineBanner.tsx
//
// RES-02 — surface offline state at the top of the (app) shell so users know
// reads are coming from Firestore's IndexedDB cache (per persistentLocalCache
// in lib/firebase/client.ts) and that scanning + committing are disabled
// until reconnect (D-19 — stock decrements race queued writes on reconnect,
// so we hard-gate write paths offline rather than queue them).
//
// Subscribes to the browser's `online` / `offline` window events and the
// initial `navigator.onLine` snapshot. Renders null when online so it costs
// nothing visually in the steady state.
//
// SSR-safety: `useEffect` is the only code path that touches `navigator` /
// `window`, so this Client Component is safe to render from the (app) layout
// which is otherwise a Server Component.

"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  // Default to `true` (online) so the banner doesn't flash during the first
  // client render before the effect runs. The effect immediately reconciles
  // with `navigator.onLine` on mount.
  const [online, setOnline] = useState(true);

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

  if (online) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-destructive text-destructive-foreground px-4 py-2 text-sm flex items-center gap-2"
    >
      <WifiOff className="size-4" />
      <span>
        Offline — reconnect to scan. Existing data continues to display from
        cache.
      </span>
    </div>
  );
}
