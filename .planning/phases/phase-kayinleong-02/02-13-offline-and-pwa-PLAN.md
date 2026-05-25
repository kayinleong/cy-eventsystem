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
    - "Firestore IndexedDB persistence already enabled in lib/firebase/client.ts from 02-02 — verifies RES-01 (browse offline) + RES-03 (cart survives reload)."
    - "PWA manifest.webmanifest exists at public/ and is linked from app/layout.tsx for RES-04."
  artifacts:
    - path: "components/layout/OfflineBanner.tsx"
      provides: "Offline detection banner per RES-02"
      contains: "navigator.onLine"
    - path: "public/manifest.webmanifest"
      provides: "PWA manifest per RES-04"
      contains: "\"name\":"
---

<objective>
**Block H — Offline UX + PWA manifest.** Wire the RES-02 offline banner, disable scanner pages when offline (so stock decrements can't race queued writes on reconnect per CONTEXT.md D-19), and verify PWA manifest per RES-04. IndexedDB persistence (RES-01/RES-03) already shipped in 02-02 via `persistentLocalCache`.
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
@app/(app)/layout.tsx
@app/(app)/scan/page.tsx
@app/(app)/events/[eventId]/checkout/page.tsx
@app/(app)/events/[eventId]/checkin/page.tsx
@components/feature/scan/ScannerWidget.tsx
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
  <name>Task 3: PWA manifest + root layout link</name>
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
    **3.1 — `public/manifest.webmanifest`:**

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

    **3.2 — Wire from `app/layout.tsx`:**

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

    **3.3 — Icon files:**

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
  <name>Task 4: Offline E2E + PWA install test</name>
  <what-built>
    Offline banner global; scanner gates off; PWA manifest reachable.
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

    **D — Scan cart persistence (RES-03):**
    1. Online: /scan → mode checkout → pick event → add 2 items to cart. DO NOT commit.
    2. Refresh the page. **Expected:** cart should be restored. (NOTE: this depends on Phase 1's scan-session storing cart in localStorage or sessionStorage. If Phase 1 didn't implement this, document as a v2 gap — IndexedDB persistence is for Firestore reads, not arbitrary client state.) Verify Phase 1's scan-session implementation and document the actual behavior.

    **E — PWA manifest:**
    1. `curl http://localhost:3000/manifest.webmanifest` → returns valid JSON.
    2. Chrome DevTools → Application → Manifest. Should show name "cy-eventsystem", icons (warnings expected if icon files missing — log as v2 polish).
    3. Lighthouse → Mobile → PWA category. Should score >= "Installable" (icons may need adding).

    Report PASS/FAIL each + any v2 caveats (icon files, scan-cart persistence) for CLAIM.md.
  </how-to-verify>
  <resume-signal>Type "offline + PWA E2E PASS" or describe failures + caveats.</resume-signal>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation |
|---|---|---|---|---|
| T-02-13-01 | Tampering | Scanner used offline races queued writes on reconnect | mitigate | ScannerWidget renders disabled state when navigator.onLine === false (D-19 rationale) |
| T-02-13-02 | Information disclosure | Cached Firestore docs survive sign-out | accept | persistentLocalCache is keyed per-user via Firebase Auth scoping; signOut clears the auth state; an attacker with physical device access is out of v1 threat scope |
</threat_model>

<verification>
- OfflineBanner component shipped + wired into (app)/layout.tsx.
- ScannerWidget gates on navigator.onLine.
- public/manifest.webmanifest reachable.
- app/layout.tsx links the manifest.
- npm run build green.
</verification>

<success_criteria>
- RES-01 (offline reads — already via 02-02's persistentLocalCache).
- RES-02 (offline banner + scanner disable).
- RES-03 (IndexedDB persistence verified; scan-cart persistence may be a v2 polish).
- RES-04 (PWA manifest).
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-13-offline-and-pwa-SUMMARY.md` listing 7-8 files, offline test transcripts, and any v2 follow-ups (PWA icons, scan-cart persistence if applicable). <= 60 lines.
</output>
