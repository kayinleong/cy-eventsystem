---
phase: phase-kayinleong-02
plan: 13
type: execute
wave: 11
depends_on:
  - 02
  - 08
files_modified:
  - components/layout/OfflineBanner.tsx
  - app/(app)/layout.tsx
  - components/feature/scan/ScannerWidget.tsx
  - components/feature/scan/scan-session.tsx
  - app/(app)/scan/page.tsx
  - app/(app)/events/[eventId]/checkout/page.tsx
  - app/(app)/events/[eventId]/checkin/page.tsx
  - public/manifest.webmanifest
  - app/layout.tsx
autonomous: false
requirements:
  - RES-01
  - RES-02
  - RES-03
  - RES-04
  - NFR-09

must_haves:
  truths:
    - "OfflineBanner renders when navigator.onLine === false; hidden otherwise."
    - "Scanner-bearing pages (/scan, /events/[id]/checkout, /events/[id]/checkin) disable their scan widget when offline."
    - "Firestore IndexedDB persistence already enabled in lib/firebase/client.ts from 02-02 — verifies RES-01 (browse offline)."
    - "Scan-cart state (cartItems, eventId, mode) persists to sessionStorage so an accidental page reload or token refresh during a scan session does not lose work — RES-03 DELIVERED (not just partially via Firestore cache)."
    - "PWA manifest.webmanifest exists at public/ and is linked from app/layout.tsx for RES-04."
  artifacts:
    - path: "components/layout/OfflineBanner.tsx"
      provides: "Offline detection banner per RES-02"
      contains: "navigator.onLine"
    - path: "components/feature/scan/scan-session.tsx"
      provides: "ScanSessionProvider with sessionStorage-backed cart persistence per RES-03"
      contains: "sessionStorage"
    - path: "public/manifest.webmanifest"
      provides: "PWA manifest per RES-04"
      contains: "\"name\":"
---

<objective>
**Block H — Offline UX + PWA manifest.** Wire the RES-02 offline banner, disable scanner pages when offline (so stock decrements can't race queued writes on reconnect per CONTEXT.md D-19), persist the scan-cart state to sessionStorage so RES-03 is fully delivered (not just partially via Firestore IndexedDB cache), and verify PWA manifest per RES-04. IndexedDB persistence for read caching (RES-01) already shipped in 02-02 via `persistentLocalCache`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-02/02-RESEARCH.md
@.planning/phases/phase-kayinleong-02/02-CONTEXT.md
@.planning/REQUIREMENTS.md
@app/(app)/layout.tsx
@app/(app)/scan/page.tsx
@app/(app)/events/[eventId]/checkout/page.tsx
@app/(app)/events/[eventId]/checkin/page.tsx
@components/feature/scan/ScannerWidget.tsx
@components/feature/scan/scan-session.tsx
@app/layout.tsx
@public/
</context>

<tasks>

<task type="auto">
  <name>Task 1: OfflineBanner component + layout wiring</name>
  <files>
    components/layout/OfflineBanner.tsx,
    app/(app)/layout.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §8.3 lines 1652-1672 (OfflineBanner implementation)
    - app/(app)/layout.tsx (from 02-03 — needs <OfflineBanner/> wired in)
  </read_first>
  <action>
    Create `components/layout/OfflineBanner.tsx`:

    ```typescript
    "use client";
    // components/layout/OfflineBanner.tsx — per RESEARCH §8.3 + RES-02.
    import { useEffect, useState } from "react";
    import { WifiOff } from "lucide-react";

    export function OfflineBanner() {
      const [online, setOnline] = useState(true);

      useEffect(() => {
        const update = () => setOnline(typeof navigator !== "undefined" && navigator.onLine);
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
          <span>Offline — reconnect to scan. Existing data continues to display from cache.</span>
        </div>
      );
    }
    ```

    Wire into `app/(app)/layout.tsx` at the top of the rendered shell. The layout from 02-03 already wraps children with `<AppShell session={...}>`; render `<OfflineBanner/>` immediately inside the layout's root before `<AppShell>`:

    ```typescript
    // app/(app)/layout.tsx (excerpt — preserve everything else from 02-03)
    import { OfflineBanner } from "@/components/layout/OfflineBanner";
    // ...

    export default async function AppLayout({ children }: { children: React.ReactNode }) {
      const session = await requireSession();
      return (
        <>
          <OfflineBanner />
          <AppShell session={session}>{children}</AppShell>
        </>
      );
    }
    ```
  </action>
  <acceptance_criteria>
    - `test -f components/layout/OfflineBanner.tsx` succeeds.
    - `grep -q "navigator.onLine" components/layout/OfflineBanner.tsx` succeeds.
    - `grep -q "role=\"alert\"" components/layout/OfflineBanner.tsx` succeeds.
    - `grep -q "OfflineBanner" "app/(app)/layout.tsx"` succeeds.
    - `grep -q "<OfflineBanner" "app/(app)/layout.tsx"` succeeds.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "navigator.onLine" components/layout/OfflineBanner.tsx && grep -q "<OfflineBanner" "app/(app)/layout.tsx" && npx tsc --noEmit</automated>
  </verify>
  <done>Offline banner live globally in (app) tree.</done>
</task>

<task type="auto">
  <name>Task 2: Disable scanner pages when offline</name>
  <files>
    components/feature/scan/ScannerWidget.tsx,
    app/(app)/scan/page.tsx,
    app/(app)/events/[eventId]/checkout/page.tsx,
    app/(app)/events/[eventId]/checkin/page.tsx
  </files>
  <read_first>
    - components/feature/scan/ScannerWidget.tsx (current Phase 1)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-19 (Scan pages disable on offline because stock decrements race queued writes)
  </read_first>
  <action>
    Add online-state gate to `ScannerWidget.tsx`. The widget already manages camera state from Phase 1; add a check at the top:

    ```typescript
    // components/feature/scan/ScannerWidget.tsx — minimal addition
    "use client";
    import { useEffect, useState } from "react";
    // ... preserve Phase 1 imports ...

    export function ScannerWidget(props: ScannerProps) {
      const [online, setOnline] = useState(true);

      useEffect(() => {
        const update = () => setOnline(typeof navigator !== "undefined" && navigator.onLine);
        update();
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => {
          window.removeEventListener("online", update);
          window.removeEventListener("offline", update);
        };
      }, []);

      if (!online) {
        return (
          <div className="rounded-md border border-dashed bg-muted/50 p-8 text-center text-sm text-muted-foreground">
            Scanner disabled while offline. Reconnect to scan or use manual entry to queue items.
          </div>
        );
      }

      // PRESERVE Phase 1 rest of component: camera permission, ZXing decode, etc.
    }
    ```

    Alternative location: instead of guarding inside ScannerWidget, the scanner-bearing PAGE components can render a disabled state. Either works; modifying the widget is cleaner because it propagates everywhere the widget is used.

    No changes needed to the page files themselves if the gate lives in the widget.
  </action>
  <acceptance_criteria>
    - `grep -q "navigator.onLine" components/feature/scan/ScannerWidget.tsx` succeeds.
    - `grep -q "Scanner disabled while offline" components/feature/scan/ScannerWidget.tsx` succeeds OR similar messaging.
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "navigator.onLine" components/feature/scan/ScannerWidget.tsx && npm run build</automated>
  </verify>
  <done>Scanner widget gracefully degrades when offline.</done>
</task>

<task type="auto">
  <name>Task 3: Persist scan-cart state to sessionStorage (RES-03 full delivery)</name>
  <files>components/feature/scan/scan-session.tsx</files>
  <read_first>
    - components/feature/scan/scan-session.tsx (current ScanSessionProvider — verify whether cart state is already persisted; identify the mutators: addItem / removeItem / updateQty / clearCart and the commit path that calls checkoutItem / checkinItem)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md (RES-03 expectations: in-progress scan-cart contents persist so accidental navigation or token refresh doesn't lose them)
    - .planning/REQUIREMENTS.md RES-03
    - .planning/phases/phase-kayinleong-01/01-08-scanner-and-scan-page-SUMMARY.md (Phase 1 scan-session shape: cart items, mode, eventId)
  </read_first>
  <action>
    Inspect `components/feature/scan/scan-session.tsx`. If the cart state is currently in-memory only (React state, not persisted to any client storage), wire it to `sessionStorage` so RES-03 is fully delivered. Use `sessionStorage` not `localStorage` — scan carts are session-scoped (survives reload but clears on tab close, which matches scanning UX). Use a versioned key (`scan-cart-v1`) so future schema changes can invalidate cleanly.

    **Step 3.1 — Add hydration on provider mount.**

    On `ScanSessionProvider` mount, attempt to hydrate state from `sessionStorage.getItem("scan-cart-v1")`. Parse cautiously (try/catch). Skip hydration if:
    - parse fails
    - stored `timestamp` is older than 4 hours (stale — likely abandoned session)
    - stored `eventId` or `mode` is missing (corrupted)

    **Step 3.2 — Persist on every cart mutation.**

    Every cart mutator (`addItem`, `removeItem`, `updateQty`, `setEvent`, `setMode`, `clearCart`) must serialise `{cartItems, eventId, mode, timestamp: Date.now()}` to `sessionStorage.setItem("scan-cart-v1", JSON.stringify(state))` after applying the change. The cleanest implementation is a `useEffect` that watches the relevant state slices and writes on every change, rather than threading writes through each mutator.

    **Step 3.3 — Clear on successful commit.**

    When the cart commit succeeds (Server Action `checkoutItem` / `checkinItem` returns `{ok: true}`), call `sessionStorage.removeItem("scan-cart-v1")` AND `clearCart()`. A failed commit should NOT clear storage — the user still has work in progress.

    **Step 3.4 — Cross-tab sync (defensive).**

    Add a `window.addEventListener("storage", handler)` so if the user has the scan page open in multiple tabs and one of them commits, the other rehydrates from the cleared/updated state. Single-tab usage is dominant, but the listener is cheap insurance.

    **Step 3.5 — SSR-safety.**

    All `sessionStorage` access must be guarded with `typeof window !== "undefined"` because ScanSessionProvider may be imported into Server Components transitively. Standard pattern.

    **Reference implementation sketch** (adapt to the actual provider shape — preserve Phase 1's existing API; only ADD persistence, don't refactor the public contract):

    ```typescript
    "use client";
    // components/feature/scan/scan-session.tsx — RES-03 persistence layer
    // PRESERVE all Phase 1 imports + types + context exports + the public hook signatures.

    const STORAGE_KEY = "scan-cart-v1";
    const STALE_MS = 4 * 60 * 60 * 1000; // 4h

    type PersistedCart = {
      cartItems: CartItem[];   // existing Phase 1 type
      eventId: string | null;
      mode: "checkout" | "checkin" | null;
      timestamp: number;
    };

    function loadPersisted(): PersistedCart | null {
      if (typeof window === "undefined") return null;
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedCart;
        if (!parsed.timestamp || Date.now() - parsed.timestamp > STALE_MS) return null;
        if (!parsed.eventId || !parsed.mode) return null;
        return parsed;
      } catch {
        return null;
      }
    }

    function savePersisted(state: Omit<PersistedCart, "timestamp">) {
      if (typeof window === "undefined") return;
      try {
        const payload: PersistedCart = { ...state, timestamp: Date.now() };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // quota exceeded / private mode — degrade silently; RES-03 best-effort
      }
    }

    function clearPersisted() {
      if (typeof window === "undefined") return;
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }

    export function ScanSessionProvider({ children }: { children: React.ReactNode }) {
      // Initial state seeded from persisted snapshot if present
      const persisted = typeof window !== "undefined" ? loadPersisted() : null;
      const [cartItems, setCartItems] = useState<CartItem[]>(persisted?.cartItems ?? []);
      const [eventId, setEventId] = useState<string | null>(persisted?.eventId ?? null);
      const [mode, setMode] = useState<"checkout" | "checkin" | null>(persisted?.mode ?? null);

      // Persist on every relevant change
      useEffect(() => {
        if (cartItems.length === 0 && !eventId && !mode) {
          clearPersisted();
          return;
        }
        savePersisted({ cartItems, eventId, mode });
      }, [cartItems, eventId, mode]);

      // Cross-tab sync (defensive)
      useEffect(() => {
        const onStorage = (e: StorageEvent) => {
          if (e.key !== STORAGE_KEY) return;
          if (e.newValue === null) {
            // another tab cleared (e.g., committed) — clear here too
            setCartItems([]);
            setEventId(null);
            setMode(null);
          } else {
            try {
              const parsed = JSON.parse(e.newValue) as PersistedCart;
              setCartItems(parsed.cartItems ?? []);
              setEventId(parsed.eventId ?? null);
              setMode(parsed.mode ?? null);
            } catch { /* ignore */ }
          }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
      }, []);

      // PRESERVE Phase 1: addItem / removeItem / updateQty / setEvent / setMode / clearCart mutators.
      // PRESERVE Phase 1: commitCart() — but on success path call clearPersisted() then clearCart().
      // The useEffect above will mirror state→storage automatically; mutators don't need direct storage calls.

      // ... rest of provider unchanged ...
    }
    ```

    **IMPORTANT — do not refactor Phase 1's public hook API.** ScanCartPanel, ScannerWidget, EventPickerDialog, and the scan/checkout/checkin page components all consume the existing `useScanSession()` hook. Add persistence INSIDE the provider; the consumer surface stays identical.

    **If Phase 1 ALREADY persists** (grep shows `sessionStorage.setItem` or `localStorage.setItem` already references the cart):
    1. Document the verification grep in the SUMMARY: `grep -n "sessionStorage\\|localStorage" components/feature/scan/scan-session.tsx`
    2. Verify the existing persistence covers cartItems + eventId + mode (the three RES-03-relevant fields).
    3. If it covers only a subset, extend it to cover all three.
    4. Either way, mark RES-03 fully delivered in the SUMMARY and skip the writes above for whatever's already present.
  </action>
  <acceptance_criteria>
    - `grep -rE "sessionStorage\\.setItem.*scan-cart" components/feature/scan/` returns at least one match (cart persistence wired).
    - `grep -rE "sessionStorage\\.getItem.*scan-cart" components/feature/scan/` returns at least one match (cart hydration wired).
    - `grep -rE "sessionStorage\\.removeItem.*scan-cart" components/feature/scan/` returns at least one match (cleared on commit).
    - `grep -q "STALE_MS\\|4 \\* 60 \\* 60" components/feature/scan/scan-session.tsx` succeeds (staleness check present).
    - `grep -q "typeof window" components/feature/scan/scan-session.tsx` succeeds (SSR-safe storage access).
    - Manual test (verify in Task 4 step D): scan 3 items, refresh page, cart still shows 3 items.
    - Manual test (verify in Task 4 step D): scan 1 item, commit successfully, refresh, cart is empty (cleared on successful commit).
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -rE "sessionStorage\.setItem.*scan-cart" components/feature/scan/ && grep -rE "sessionStorage\.getItem.*scan-cart" components/feature/scan/ && grep -q "typeof window" components/feature/scan/scan-session.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Scan-cart state persists to sessionStorage. RES-03 transitions from PARTIAL (Firestore cache only) to DELIVERED (cart survives reload + token refresh). Cleared on successful commit.</done>
</task>

<task type="auto">
  <name>Task 4: PWA manifest + root layout link</name>
  <files>
    public/manifest.webmanifest,
    app/layout.tsx
  </files>
  <read_first>
    - public/ directory (verify what icons exist; if Phase 1 didn't ship icons, use placeholder)
    - app/layout.tsx (the root layout — Phase 1 likely shipped this)
    - .planning/REQUIREMENTS.md RES-04 (installable PWA)
  </read_first>
  <action>
    **4.1 — `public/manifest.webmanifest`:**

    ```json
    {
      "name": "cy-eventsystem",
      "short_name": "cy-events",
      "description": "Event-based physical inventory tracking",
      "start_url": "/",
      "display": "standalone",
      "background_color": "#0a0a0a",
      "theme_color": "#0a0a0a",
      "orientation": "portrait",
      "icons": [
        {
          "src": "/icon-192.png",
          "type": "image/png",
          "sizes": "192x192"
        },
        {
          "src": "/icon-512.png",
          "type": "image/png",
          "sizes": "512x512",
          "purpose": "any maskable"
        }
      ]
    }
    ```

    **4.2 — Wire from `app/layout.tsx`:**

    Add to the metadata export OR a `<link rel="manifest">` in head:

    ```typescript
    // app/layout.tsx
    export const metadata: Metadata = {
      // ... preserve Phase 1 metadata ...
      manifest: "/manifest.webmanifest",
      themeColor: "#0a0a0a",
      appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "cy-events",
      },
    };
    ```

    If Phase 1 hadn't shipped a `manifest` reference, add this. Test that the manifest is reachable: `curl http://localhost:3000/manifest.webmanifest` returns the JSON.

    **4.3 — Icon files:**

    If Phase 1 hasn't shipped icons, this is a checkpoint moment — Chrome will warn that the manifest references missing icons. Options:
    1. Quick: drop two placeholder PNGs into `public/` (Claude can generate via `convert` if ImageMagick available, or accept the developer manually adds them).
    2. Document as a follow-up: PWA installability will warn until icons land.

    Pick the simplest path: document in the SUMMARY that icons may need to be added by developer for full Lighthouse PWA pass; for v1, the manifest itself satisfies RES-04 minimum.
  </action>
  <acceptance_criteria>
    - `test -f public/manifest.webmanifest` succeeds.
    - `node -e "JSON.parse(require('fs').readFileSync('public/manifest.webmanifest'))"` exits 0.
    - `grep -q "manifest.webmanifest\|manifest:" app/layout.tsx` succeeds.
    - `grep -q "cy-eventsystem\|cy-events" public/manifest.webmanifest` succeeds.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>test -f public/manifest.webmanifest && node -e "JSON.parse(require('fs').readFileSync('public/manifest.webmanifest'))" && grep -q "manifest" app/layout.tsx && npm run build</automated>
  </verify>
  <done>PWA manifest live. RES-04 satisfied (icons may be a developer follow-up).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Offline E2E + scan-cart persistence + PWA install test</name>
  <what-built>
    Offline banner global; scanner gates off when offline; scan-cart persisted to sessionStorage; PWA manifest reachable.
  </what-built>
  <how-to-verify>
    **A — Offline banner:**
    1. `npm run dev`. Sign in.
    2. DevTools → Network → set throttling to "Offline" (or disable wifi). The banner should appear at the top of the (app) shell.
    3. Re-enable network — banner disappears.

    **B — Offline reads (RES-01):**
    1. While online, navigate /inventory → see items.
    2. Go offline. Refresh /inventory. **Expected:** items still render (from IndexedDB cache per persistentLocalCache).
    3. Navigate /events. Cached events render.

    **C — Scanner disable (RES-02 + D-19):**
    1. Go offline. Navigate /scan. **Expected:** scanner widget shows "Scanner disabled while offline" message.
    2. Navigate /events/<id>/checkout. **Expected:** same disabled state.
    3. Re-enable network. Refresh. Scanner should re-activate.

    **D — Scan cart persistence (RES-03) — must FULLY pass:**
    1. Online: /scan → mode checkout → pick event → add 3 items to cart. DO NOT commit.
    2. Open DevTools → Application → Session Storage → confirm key `scan-cart-v1` exists with `cartItems`, `eventId`, `mode`, `timestamp` populated.
    3. Hard refresh the page (Cmd+Shift+R). **Expected:** cart still shows the 3 items, the picked event, and checkout mode. No items lost.
    4. Clear the cart (remove all items via UI). **Expected:** `scan-cart-v1` key removed from Session Storage (or cleared by useEffect on empty state).
    5. Add 1 item again, then commit checkoutItem (real Server Action call). On success toast: **Expected:** `scan-cart-v1` removed from Session Storage AND cart is empty in the UI.
    6. Add 1 item, simulate a failed commit (e.g., disable network briefly to make the action fail). **Expected:** Session Storage still holds the cart (not cleared on failure — user retains work in progress).
    7. Open the /scan page in a SECOND tab while a cart is in progress in the first tab. Commit in the first tab. **Expected:** the second tab's cart clears via the `storage` event listener within ~1s.

    Report PASS for steps 1-6 minimum. Step 7 is defensive and PASS-preferred.

    **E — PWA manifest:**
    1. `curl http://localhost:3000/manifest.webmanifest` → returns valid JSON.
    2. Chrome DevTools → Application → Manifest. Should show name "cy-eventsystem", icons (warnings expected if icon files missing — log as v2 polish).
    3. Lighthouse → Mobile → PWA category. Should score >= "Installable" (icons may need adding).

    Report PASS/FAIL each + any v2 caveats (icon files) for CLAIM.md.
  </how-to-verify>
  <resume-signal>Type "offline + scan-cart persistence + PWA E2E PASS" or describe failures + caveats.</resume-signal>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation |
|---|---|---|---|---|
| T-02-13-01 | Tampering | Scanner used offline races queued writes on reconnect | mitigate | ScannerWidget renders disabled state when navigator.onLine === false (D-19 rationale) |
| T-02-13-02 | Information disclosure | Cached Firestore docs survive sign-out | accept | persistentLocalCache is keyed per-user via Firebase Auth scoping; signOut clears the auth state; an attacker with physical device access is out of v1 threat scope |
| T-02-13-03 | Information disclosure | Persisted scan-cart in sessionStorage survives sign-out | accept | sessionStorage is tab-scoped and cleared on tab close. A sign-out within the same tab does not clear the cart, but the data (item SKUs + quantities) is non-sensitive — no PII, no credentials. Cross-user device sharing is out of v1 threat scope. |
</threat_model>

<verification>
- OfflineBanner component shipped + wired into (app)/layout.tsx.
- ScannerWidget gates on navigator.onLine.
- ScanSessionProvider persists cartItems + eventId + mode to sessionStorage under key `scan-cart-v1`; hydrates on mount; clears on successful commit; cross-tab sync via `storage` event.
- public/manifest.webmanifest reachable.
- app/layout.tsx links the manifest.
- npm run build green.
</verification>

<success_criteria>
- RES-01 (offline reads — already via 02-02's persistentLocalCache).
- RES-02 (offline banner + scanner disable).
- RES-03 (in-progress scan-cart contents persist to sessionStorage across reload and token refresh — **DELIVERED**, not partial; verified by step D in Task 5).
- RES-04 (PWA manifest).
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-13-offline-and-pwa-SUMMARY.md` listing the files modified, offline test transcripts, scan-cart persistence test transcript (D1-D7), and any v2 follow-ups (PWA icons). <= 80 lines.
</output>
