---
phase: phase-kayinleong-01
plan: 08
subsystem: ui-scan
tags: [scanner, qr-code, barcode, zxing, yudiel-react-qr-scanner, react-context, scan-cart, event-picker, manual-entry, bluetooth-scanner, next-16-suspense]

# Dependency graph
requires:
  - phase: phase-kayinleong-01 plan 01
    provides: lib/types/event.ts (EventDoc), lib/types/item.ts (InventoryItem), @yudiel/react-qr-scanner 2.6.0 installed, shadcn primitives (dialog, command, popover, tabs, card, button, input)
  - phase: phase-kayinleong-01 plan 02
    provides: lib/mock/store.ts (checkout mutator with CheckoutResult contract, getSnapshot), lib/mock/selectors.ts (selectAccessibleEvents, selectItemBySku), lib/auth/mock-session.ts (no direct call here — (app)/layout enforces auth), useCurrentUser hook
  - phase: phase-kayinleong-01 plan 03
    provides: components/feature/inventory/QtyStepper.tsx (44px touch-target stepper for cart lines), components/feature/status/StatusBadge.tsx + status-to-tone (sticky scan header status badge), components/ui/empty-state.tsx (Cart is empty), components/ui/page-header.tsx
  - phase: phase-kayinleong-01 plan 04
    provides: (app)/layout.tsx role-gated shell — /scan renders inside; auth gate enforced before page renders
  - phase: phase-kayinleong-01 plan 07
    provides: selectAccessibleEvents projection already battle-tested by /events list; the EventPickerDialog reuses the same selector with statuses=["planned","active"] filter

provides:
  - /scan route with mode toggle (check-out / check-in) — SCN-01
  - ScannerWidget: camera + ZXing decode of 5 barcode formats (CO-09 / D-16) — rear-camera default (SCN-02), iOS-specific permission error copy (SCN-03), 1500ms duplicate-debounce + haptic feedback (CO-07), torch surfaced on Chrome Android via library's components.torch (SCN-05)
  - ScanCartPanel: cart lines with QtyStepper + per-line remove (CO-03), mode-aware CTA label, locked UI-SPEC "Cart is empty" empty-state copy, optimistic-style synchronous add via mock store (CO-06)
  - ScanHeader: sticky selected-event header with End session button (D-15) — survives across scans until user clears
  - EventPickerDialog: shadcn Dialog + Command (cmdk) typeahead picker filtered via selectAccessibleEvents(s, uid, role, ["planned","active"]) for EVT-08 + CO-02
  - ManualEntryInput: SCN-06 typed-SKU fallback that doubles as the CO-10 Bluetooth-scanner keystroke handler (Bluetooth scanners emit Enter at the end of a keystroke burst, identical to manual submit)
  - ScanSessionProvider context: in-memory session state (mode, selectedEvent, cart, isCommitting) + addLine/removeLine/setQty/commit/endSession mutators; cart is ephemeral per session, NOT persisted (RES-03 deferred to Phase 2)
  - useScanSession hook for any component that needs to dispatch into the session

affects:
  - phase-kayinleong-01 plan 09 (checkout flow): /events/[eventId]/checkout reuses ScannerWidget + ScanCartPanel directly, passing a preselected event into ScanSessionProvider (initialEvent prop) so the user skips the EventPickerDialog. The cart commit hits the same store.checkout — no UI changes between /scan and /events/[id]/checkout.
  - phase-kayinleong-01 plan 10 (checkin flow): /scan's checkin mode routes the user to /events/[eventId]/checkin on commit (CI-02). Plan 10 builds the full check-in form there; the scanner widget on /events/[id]/checkin can also reuse ScannerWidget for line-by-line entry.
  - phase-kayinleong-02 entirely: the page JSX stays verbatim. Phase 2 swaps `store.checkout` for a Server Action that hits Firestore via a transaction (CO-04). The scanner widget's camera lifecycle stays the same; only the commit-time mutator swaps.

# Tech tracking
tech-stack:
  added: []  # @yudiel/react-qr-scanner was installed in Plan 01
  patterns:
    - "Scan-session React context pattern: a Client Component context owns mode + selectedEvent + cart + commit + endSession. Cart is ephemeral per page mount (RES-03 deferred to Phase 2). Sibling components dispatch via useScanSession()."
    - "Server Component page reading ?mode= search param via the prop — would be cleaner than the Client Component with useSearchParams pattern, but the plan's example mandated a Client Component for the inner UI (uses hooks). Resolution: wrap useSearchParams in <Suspense> within the same file (Next 16 build-time requirement; see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md lines 176-183)."
    - "Camera-widget tap-to-start pattern: camera off by default; pressing Start activates the @yudiel/react-qr-scanner <Scanner/>. Releases the MediaStream on Stop or unmount so the page doesn't drain battery on phones left open. Matches PITFALLS.md line 264 ('Battery drain in long sessions') guidance."
    - "Same-handler input pattern (CO-08 + CO-10): camera scans, manual typed SKU, AND Bluetooth keystroke scanner all route through the same `addLine(value)` dispatcher in the scan-session context. No platform branch — Bluetooth scanners look like a keyboard that fires Enter, manual input is a real keyboard that fires Enter, and the camera emits via onScan(). All three paths converge."
    - "Sticky session header (D-15): once an event is picked, ScanHeader pins it at top-14 (matches TopBar offset) until the user clicks End session. Implemented as a return-null component when selectedEvent is null so the empty /scan state has a clean canvas."
    - "Library error normalization: @yudiel/react-qr-scanner exposes an IScannerError with `kind: 'permission-denied' | 'no-camera' | 'in-use' | 'insecure-context' | ...` AND forwards the raw cause's `.name` (NotAllowedError, NotFoundError). The widget's handleError checks both shapes defensively so iOS Safari's older error shapes still trigger the correct UI-SPEC copy."

key-files:
  created:
    - app/(app)/scan/page.tsx
    - components/feature/scan/scan-session.tsx
    - components/feature/scan/ScannerWidget.tsx
    - components/feature/scan/ScanCartPanel.tsx
    - components/feature/scan/ScanHeader.tsx
    - components/feature/scan/EventPickerDialog.tsx
    - components/feature/scan/ManualEntryInput.tsx
  modified: []

key-decisions:
  - "D-01-08-A: /scan/page.tsx wraps `useSearchParams` in a <Suspense> boundary inside the same file rather than splitting into a Server Component shell + Client Component island. Reason: the plan's task-3 <files> block lists exactly one file (app/(app)/scan/page.tsx), and the plan's example explicitly notes 'this page is a Client Component (uses hooks)'. Honoring the plan's file count while satisfying the Next 16 production-build requirement ('Missing Suspense boundary with useSearchParams' — node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md lines 176-183) means co-locating the Suspense wrapper in the same file. The fallback is `null` because the (app) layout already renders the chrome (sidebar + topbar) and a flicker between fallback and content would be more jarring than nothing."
  - "D-01-08-B: ScanSessionProvider owns the cart in pure useState (NOT useOptimistic). The plan's frontmatter mentions CO-06 (optimistic UI) which the Plan-2 patterns guide suggests via React 19's useOptimistic. In Phase 1 the mock store commits synchronously, so a separate optimistic shadow buys nothing — the cart re-renders instantly. The pattern is documented for Phase 2 substitution: when checkout becomes a Server Action with async settle, swap `useState<ScanCartLine[]>` for `useOptimistic` and add a confirmed-state setter inside `commit()`."
  - "D-01-08-C: ScannerWidget uses a 'tap to start' pattern instead of auto-activating the camera on mount. Two reasons: (1) PITFALLS.md line 264-268 'Battery drain in long sessions' — auto-on drains battery if the user leaves /scan open; (2) iOS Safari permission prompts on auto-getUserMedia are jarring and frequently denied. Tap-to-start gives the user a clear gesture before the permission prompt fires."
  - "D-01-08-D: SCN-05 torch is exposed via the library's `components={{ torch: true }}` prop (not a top-level prop on the Scanner component). Verified by reading node_modules/@yudiel/react-qr-scanner/dist/types/IScannerComponents.d.ts — the `IScannerComponents` interface has `finder?: boolean; torch?: boolean; tracker?: TrackFunction; onOff?: boolean; zoom?: boolean`. Chrome Android renders a torch button automatically when the camera exposes `MediaStreamTrack.getCapabilities().torch`. iOS Safari does not expose torch — the button simply doesn't render. No platform branching needed in our code."
  - "D-01-08-E: scan-session addLine() reads the live snapshot via `getSnapshot()` for one-off item lookup INSTEAD of the closed-over `items` slice subscribed via useMockStore. Reason: the closed-over slice may lag by one render frame relative to the latest commit (e.g., a checkout from another tab in Phase 2). `getSnapshot()` is synchronous and always returns the latest state. The `items` subscription is still kept for the QtyStepper's max prop reactivity — a different concern (re-render trigger, not lookup correctness)."
  - "D-01-08-F: EventPickerDialog renders an empty list when useCurrentUser() returns null (the SSR + initial-paint case per D-01-02-A). The dialog only opens on user action (the 'Pick event' button) which is post-hydration — so by the time the dialog mounts, useCurrentUser has the correct session. Defensive empty-list rendering preserves SSR safety without an extra null-check spike around the dialog."
  - "D-01-08-G: Cart commit in 'checkin' mode does NOT call store.checkin (which would need parentTxId lookups + missing-reason form fields that don't fit in a /scan flow). Instead, the commit routes the user to /events/[eventId]/checkin (CI-02) where the full check-in form lives. The scan cart in checkin mode is effectively a 'select items to return then route to the check-in screen' affordance — Plan 10 builds the destination form."
  - "D-01-08-H: ScanHeader's sticky offset is top-14 (56px) to match the TopBar height from Plan 04 — verified by inspecting the existing inventory/events detail pages which use the same offset for any sub-tab sticky surfaces. Phase 2 keeps this offset; if the TopBar height ever changes, the surface offset would need to change in both places."

patterns-established:
  - "Scan-session context pattern: a feature-scoped React context with createContext + useContext owns ephemeral session state (mode, sticky event, cart). Mutators are useCallback'd. Exports a typed value object and a hook that throws if used outside the provider. Reusable shape for any future feature with a 'session-scoped' state requirement (e.g. Plan 10 check-in might wrap a CheckinSessionProvider with similar shape)."
  - "Wrapping useSearchParams in <Suspense> inline: a one-file page where the outer default export is the Suspense wrapper + inner function reads searchParams via the hook. Avoids the Next 16 build-time error 'Missing Suspense boundary with useSearchParams' while keeping file count low."
  - "Same-handler dispatch from 3 input paths (camera + manual + Bluetooth): all three paths land in `addLine(value)` from the scan-session context. Camera dispatches inside `handleScan` after debounce. Manual entry dispatches on Enter or Add-button click. Bluetooth scanner is functionally identical to manual entry (it emits keystrokes followed by Enter). No platform-specific branching."
  - "Tap-to-start camera lifecycle: a stateful `active: boolean` gates the @yudiel/react-qr-scanner <Scanner/> mount. Active=false renders a Start button + empty viewfinder placeholder. Active=true mounts the Scanner. Stop button + unmount effect set active=false so the MediaStream releases. Battery hygiene + permission-prompt-on-explicit-gesture."

requirements-completed:
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

# Metrics
duration: 7 min
completed: 2026-05-24
---

# Phase 1 Plan 08: Scanner + /scan Page Summary

**Standalone scanner with mode toggle (check-out / check-in), @yudiel/react-qr-scanner camera widget supporting all 5 barcode formats with iOS-specific permission handling + 1500ms duplicate-debounce + haptic feedback, sticky post-scan event picker filtered to accessible planned+active events, manual SKU fallback that doubles as the Bluetooth-keystroke-scanner handler, all coordinated by a ScanSessionProvider React context that commits via store.checkout in checkout mode and routes to /events/[id]/checkin in check-in mode.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-24T15:43:19Z
- **Completed:** 2026-05-24T15:50:15Z
- **Tasks:** 3
- **Files created:** 7

## Accomplishments

- Built `scan-session.tsx` — the React context that owns the entire /scan page's ephemeral state. Exports `ScanSessionProvider` (with optional `initialMode` and `initialEvent` props for deep-linking from Plan 09's /events/[id]/checkout route), `useScanSession()` hook, and the `ScanMode` + `ScanCartLine` + `ScanSessionContextValue` types. Mutators: `setMode`, `selectEvent`, `endSession`, `addLine`, `removeLine`, `setQty`, `commit`. The commit dispatches to `store.checkout` in checkout mode (atomically commits the whole cart; on stock-failure surfaces failed lines + leaves cart intact per CO-05) or routes to `/events/[id]/checkin` in check-in mode (CI-02). Cart is ephemeral per page mount — RES-03 IndexedDB persistence is deferred to Phase 2 (already captured in CONTEXT.md "Deferred Ideas").
- Built `EventPickerDialog.tsx` — shadcn Dialog wrapping a cmdk-driven Command typeahead. Reuses Plan 07's `selectAccessibleEvents(s, uid, role, ["planned", "active"])` selector (EVT-08 + CO-02) so the user only sees events they can act on AND that are in a state where check-out / check-in makes sense. Empty state copy "No accessible events." On selection, the dialog closes and the parent caller stashes the chosen event in the scan-session sticky header (D-15).
- Built `ManualEntryInput.tsx` — typed SKU input that submits via Enter key OR an explicit "Add" button. The Enter-key submit IS the CO-10 Bluetooth keyboard scanner handler — Bluetooth scanners emit a keystroke burst ending with Enter, indistinguishable from a hand-typed entry. The input has `autoComplete="off"` and `inputMode="text"` so mobile keyboards don't try to autocomplete-mangle SKU codes. `font-mono` so partial typed SKUs render in the same code-style as the QR labels.
- Built `ScanHeader.tsx` — sticky selected-event header (D-15). Renders `null` when no event is selected so the empty /scan state has a clean canvas. When a selectedEvent is present, renders a `top-14` sticky bar (matches TopBar offset from Plan 04) with the event name + status badge + "End session" outline button. End session clears both selectedEvent AND cart (so a user can switch events mid-session without leaking the prior cart).
- Built `ScannerWidget.tsx` — the camera + decode widget. Uses `@yudiel/react-qr-scanner@2.6.0`'s `<Scanner/>` component with: (1) `formats: ["qr_code", "code_128", "ean_13", "upc_a", "data_matrix"]` for CO-09 / D-16; (2) `constraints: { facingMode: { ideal: "environment" } }` for SCN-02 rear-camera default; (3) `scanDelay: 150` for a smooth detection cadence without overworking the decoder; (4) `components: { torch: true, finder: true }` so SCN-05 torch surfaces automatically on devices that expose `MediaStreamTrack.getCapabilities().torch` (Chrome Android; iOS Safari simply won't render the button). Implements: (5) 1500ms duplicate-debounce via a `useRef<{value, at}>` (CO-07 per PITFALLS.md line 253); (6) `navigator.vibrate(50)` haptic feedback on successful scan (CO-07); (7) iOS-specific permission error copy on `NotAllowedError` / `permission-denied` ScannerErrorKind (SCN-03 + UI-SPEC "Camera blocked" error copy verbatim); (8) tap-to-start gating via a local `active` state so the camera doesn't drain battery on /scan-left-open phones (matches PITFALLS.md line 264).
- Built `ScanCartPanel.tsx` — cart UI with QtyStepper per line + per-line Remove icon-button + mode-aware CTA label. UI-SPEC "Cart is empty" empty-state copy verbatim ("Cart is empty" / "Scan items to add them to this check-out."). The CTA label reads "Check out N items" in checkout mode and "Return N items" in check-in mode (per UI-SPEC primary-CTA-per-surface table). QtyStepper bounds: `min={1}` (zero qty means "remove the line" — handled via the Trash icon); `max={line.availableQty}` in checkout mode (CO-05 enforcement at the input layer); `max={Number.MAX_SAFE_INTEGER}` in check-in mode (returns aren't bounded by stock). Item-name links to /inventory/[itemId] so the user can drill into the detail before confirming.
- Built `app/(app)/scan/page.tsx` — Client Component wrapping `ScanSessionProvider` around the inner `<ScanInner/>` composition: PageHeader + Tabs (mode toggle) + ScanHeader (sticky) + EventPickerDialog (post-scan picker) + ScannerWidget + ManualEntryInput + ScanCartPanel. Reads `?mode=` search param via `useSearchParams` to set `initialMode` (so /scan?mode=checkin lands directly on the check-in tab). Wrapped in `<Suspense fallback={null}>` to satisfy Next 16's build-time "Missing Suspense boundary with useSearchParams" requirement (see verified Next 16 docs at node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md lines 176-183).
- All Wave 3 plans 08-12 can now reuse `ScannerWidget` and `ScanCartPanel` directly — they accept the same `ScanSessionProvider` context, so Plan 09's `/events/[id]/checkout` just wraps the same widgets with `initialEvent` preselected.

## Task Commits

Each task was committed atomically:

1. **Task 1: ScanSessionProvider context + EventPickerDialog + ManualEntryInput + ScanHeader** — `6370c32` (feat)
2. **Task 2: ScannerWidget + ScanCartPanel** — `0133038` (feat)
3. **Task 3: /scan route with mode toggle + Suspense wrapper** — `267639b` (feat)

## Files Created/Modified

### Created — feature components (6 files)

- `components/feature/scan/scan-session.tsx` — React context provider with ScanSessionContextValue interface (mode/selectedEvent/cart/addLine/removeLine/setQty/commit/endSession/isCommitting), 278 lines, comprises ~80% of the plan's business logic
- `components/feature/scan/ScannerWidget.tsx` — @yudiel/react-qr-scanner widget with 5 formats + rear camera + permission errors + 1500ms debounce + vibrate + tap-to-start + torch
- `components/feature/scan/ScanCartPanel.tsx` — cart UI with QtyStepper + per-line remove + mode-aware CTA + UI-SPEC "Cart is empty" empty state
- `components/feature/scan/ScanHeader.tsx` — sticky D-15 selected-event header with End session button (returns null when no event selected)
- `components/feature/scan/EventPickerDialog.tsx` — shadcn Dialog + Command typeahead picker reusing selectAccessibleEvents with ["planned","active"] status filter (CO-02 + EVT-08)
- `components/feature/scan/ManualEntryInput.tsx` — typed SKU input that handles Enter (manual + Bluetooth) per SCN-06 + CO-08 + CO-10

### Created — route (1 file)

- `app/(app)/scan/page.tsx` — /scan Client Component wrapping ScanSessionProvider + Suspense + ScanInner composition (PageHeader / Tabs / ScanHeader / pick-event empty state / ScannerWidget + ManualEntryInput / ScanCartPanel / EventPickerDialog)

## Decisions Made

- **D-01-08-A:** `app/(app)/scan/page.tsx` wraps `useSearchParams` in `<Suspense fallback={null}>` inside the same file rather than splitting into a Server Component shell. The plan's task-3 `<files>` block lists exactly one file (`app/(app)/scan/page.tsx`) and the plan's example explicitly comments "this page is a Client Component (uses hooks)". Honoring the plan's single-file mandate while satisfying Next 16's production-build requirement ("Missing Suspense boundary with useSearchParams" — node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md lines 176-183) means co-locating the Suspense wrapper in the same file as the inner Client Component. The fallback is `null` because the (app) layout already renders the chrome (sidebar + topbar) and a flicker between fallback and content would be jarring.

- **D-01-08-B:** ScanSessionProvider owns the cart in pure `useState` (NOT `useOptimistic`). The plan's frontmatter mentions CO-06 (optimistic UI), but in Phase 1 the mock store commits synchronously — a separate optimistic shadow buys nothing because the cart re-renders instantly. The pattern is documented for Phase 2 substitution: when checkout becomes a Server Action with async settle, swap `useState<ScanCartLine[]>` for `useOptimistic` and add a confirmed-state setter inside `commit()`.

- **D-01-08-C:** ScannerWidget uses "tap to start" instead of auto-activating the camera on mount. Two reasons: (1) PITFALLS.md line 264 — auto-on drains battery if the user leaves /scan open; (2) iOS Safari permission prompts on auto-getUserMedia are jarring and frequently denied. Tap-to-start gives the user a clear gesture before the permission prompt fires.

- **D-01-08-D:** SCN-05 torch is exposed via the library's `components={{ torch: true }}` prop, NOT a top-level prop on `<Scanner/>`. Verified by reading `node_modules/@yudiel/react-qr-scanner/dist/types/IScannerComponents.d.ts` — the `IScannerComponents` interface has `torch?: boolean`. Chrome Android renders a torch button automatically when the camera exposes `MediaStreamTrack.getCapabilities().torch`. iOS Safari doesn't expose torch — the button simply doesn't render. No platform branching needed.

- **D-01-08-E:** `scan-session.addLine()` reads the live snapshot via `getSnapshot()` for the one-off item lookup INSTEAD of the closed-over `items` slice subscribed via `useMockStore`. Reason: the closed-over slice may lag by one render frame relative to the latest commit. `getSnapshot()` is synchronous and always returns the latest state. The `items` subscription is still kept for `setQty`'s max bound — a different concern (re-render trigger, not lookup correctness).

- **D-01-08-F:** EventPickerDialog defensively renders an empty list when `useCurrentUser()` returns null (the SSR + initial-paint case per D-01-02-A). The dialog only opens on user action (the "Pick event" button) which is post-hydration — so by the time the dialog mounts, `useCurrentUser` has the correct session. Defensive empty-list rendering preserves SSR safety without an extra null-check around the dialog mount.

- **D-01-08-G:** Cart commit in `"checkin"` mode does NOT call `store.checkin` directly — it routes the user to `/events/[eventId]/checkin` (CI-02). Reason: `store.checkin` needs `parentTxId` lookups + per-line `returnedQty`/`damagedQty` + missing-reason form fields that don't fit a single scan-then-confirm flow. The full check-in form lives in Plan 10 at the per-event check-in route. From /scan in checkin mode, the cart is effectively a "select items to return then route to the check-in screen" affordance.

- **D-01-08-H:** ScanHeader's sticky offset is `top-14` (56px) to match the TopBar height from Plan 04 — verified by inspecting `app/(app)/layout.tsx` and Plan 04's TopBar/AppSidebar wiring. Phase 2 keeps this offset; if the TopBar height ever changes, both surfaces would need to update together.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoidance] Wrapped `useSearchParams` in `<Suspense>` inside the same page.tsx file**

- **Found during:** Task 3 (planning step before writing /scan/page.tsx)
- **Issue:** The plan's example for `app/(app)/scan/page.tsx` is a Client Component that calls `useSearchParams` at the top level without a Suspense boundary. Next 16 production builds fail with "Missing Suspense boundary with useSearchParams" in this exact shape (see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md lines 176-183 — verified locally). The dev server tolerates it (per the same docs: "In development, routes are rendered on-demand, so useSearchParams doesn't suspend"), so a runtime smoke test wouldn't catch this; only `npm run build` would. Since the plan's verification block runs `npm run build`, the failure would have surfaced anyway — fixing pre-emptively keeps Task 3's single commit clean.
- **Fix:** Split the page into three same-file components: outer `ScanPage` (the default export) is a tiny Suspense wrapper; inner `ScanPageContent` calls `useSearchParams` and reads `?mode=`; innermost `ScanInner` consumes the scan-session context and renders the UI. All three live in the same file so the plan's single-file mandate for Task 3 is preserved. Fallback is `null` because the (app) layout already renders the sidebar+topbar chrome — a placeholder fallback would flicker.
- **Files modified:** app/(app)/scan/page.tsx
- **Verification:** `npm run build` exits 0 with `/scan` registered as `ƒ (Dynamic)`. `npm run lint` exits 0 with only the known Plan-03 TanStack warning (no new warnings). Runtime smoke test via curl against `next dev` confirms `/scan` returns 200 for admin + staff sessions, 307 → /login for anon, and `?mode=checkin` toggles the page copy to "Scan items being returned" + "Return 0 items" CTA.
- **Committed in:** `267639b` (Task 3 commit — handled before commit)

**2. [Rule 1 - Bug avoidance] Used `getSnapshot()` for one-off item lookup in addLine()**

- **Found during:** Task 1 (writing ScanSessionProvider)
- **Issue:** The plan's example for `addLine()` called `selectItemBySku({ items, events: [], users: [], transactions: [], missingItems: [] } as never, trimmed)` — passing a synthetic snapshot with empty arrays for unused fields. The `as never` cast was a code smell that hid the underlying issue: `selectItemBySku` is typed to require a full `StoreSnapshot`, but the call site only needed items. The plan's "Critical:" note immediately after recommended the fix: import `getSnapshot()` from the store and pass the real snapshot. Following the recommendation removes the cast.
- **Fix:** `import { getSnapshot } from "@/lib/mock/store";` and call `selectItemBySku(getSnapshot(), trimmed)` directly. Same selector, no cast, lookup correctness preserved across mutator races (synchronous `getSnapshot()` always returns the latest state — see D-01-08-E for the design rationale).
- **Files modified:** components/feature/scan/scan-session.tsx
- **Verification:** `npx tsc --noEmit` exits 0 with no `never`-related warnings; the addLine code reads cleanly without unsafe casts.
- **Committed in:** `6370c32` (Task 1 commit — handled before commit)

**3. [Rule 2 - Missing critical] Defensive iScannerError shape handling**

- **Found during:** Task 2 (writing ScannerWidget)
- **Issue:** The plan's example for `handleError` checked `(err as { name?: string })?.name === "NotAllowedError"` — the DOM `MediaStreamError.name` shape. But `@yudiel/react-qr-scanner@2.6.0` normalises errors to an `IScannerError` shape `{ kind: 'permission-denied' | 'no-camera' | ..., message: string, cause: unknown }`. Verified by reading `node_modules/@yudiel/react-qr-scanner/dist/types/IScannerError.d.ts`. The plan's example would still work in many cases because the raw cause's `.name` is sometimes forwarded, but it would silently miss the normalised `kind` field — making the iOS-specific permission copy unreliable.
- **Fix:** Check both shapes defensively — first the library's normalised `kind`, then the raw DOM `name`. Covers `permission-denied` (library) + `NotAllowedError` (DOM), `no-camera` (library) + `NotFoundError` (DOM), and adds an `insecure-context` branch for HTTPS misconfigurations (which the library exposes but the plan didn't enumerate). The UI-SPEC iOS-specific copy fires reliably across both error shapes.
- **Files modified:** components/feature/scan/ScannerWidget.tsx
- **Verification:** `npx tsc --noEmit` exits 0; the typed import `import { type IScannerError } from "@yudiel/react-qr-scanner"` confirms the shape matches what the library exports.
- **Committed in:** `0133038` (Task 2 commit — handled before commit)

---

**Total deviations:** 3 auto-fixed (1 build-failure prevention, 1 type-safety improvement, 1 defensive error handling)
**Impact on plan:** All three fixes preserve the plan's `<interfaces>` contracts and `<acceptance_criteria>` verbatim. Deviation 1 was a Next 16 build-safety fix that the plan's own verification block would have flagged anyway — caught pre-commit. Deviation 2 removes a `never` cast in favor of the canonical `getSnapshot()` API the plan's "Critical:" note already recommended. Deviation 3 adds defense-in-depth on a library shape the plan didn't fully enumerate. No scope creep — every file in `<files_modified>` of the plan frontmatter exists and matches its acceptance criteria.

## Authentication Gates

None — Phase 1 has no real authentication. The mock session cookie is checked at the (app) layout via `requireSession()`; /scan inherits the gate. Any signed-in user (admin or staff) can access /scan; specific events the user can act on are filtered via `selectAccessibleEvents` inside `EventPickerDialog` per EVT-08.

## Issues Encountered

None during planned work. All three deviations above were resolved pre-commit. The plan's automated verification block:

- `ls components/feature/scan/scan-session.tsx EventPickerDialog.tsx ManualEntryInput.tsx ScanHeader.tsx | wc -l | grep -q "^4$"` → PASS (Task 1)
- All Task 1 + Task 2 + Task 3 grep checks → PASS
- `npx tsc --noEmit` (every task) → PASS
- `npm run build` (Task 3) → PASS — /scan registered as ƒ (Dynamic)
- Runtime smoke tests via curl → PASS (anon → 307 /login; admin /scan → 200 with check-out copy; admin /scan?mode=checkin → 200 with "Return 0 items" CTA; staff /scan → 200)

## User Setup Required

None — no external service configuration required. `@yudiel/react-qr-scanner` was installed in Plan 01.

## Threat Flags

None — no new security-relevant surface introduced. Existing surface mitigations:

- **/scan** inherits the (app) layout's `requireSession()` auth gate (Plan 04). Anonymous users redirect to /login.
- **EventPickerDialog** filters to `selectAccessibleEvents(s, uid, role, ["planned", "active"])` so staff users only see events where `uid ∈ allowedStaff` (EVT-08). Admin sees all. Phase 2 swaps this projection for a Firestore `array-contains` rule at the data-layer boundary.
- **store.checkout** (called from ScanSessionProvider.commit) already enforces the CO-05 stock invariant atomically. The UI's per-line `max={availableQty}` constraint in ScanCartPanel is a defense-in-depth layer above the store's invariant — both must hold for a checkout to commit.
- **Camera permissions** are gated by the browser's getUserMedia prompt. Tap-to-start (D-01-08-C) ensures the prompt only fires after an explicit user gesture, reducing accidental permission grants.

## Known Stubs

None — every component renders against real data:

- The "Cart is empty" empty state is intentional and matches UI-SPEC verbatim — it's the initial state of an empty cart, not a stub.
- The "Pick an event to begin scanning" empty state is intentional D-15 messaging when no event is selected.
- ScannerWidget's "Pick an event below before scanning" message gates the camera start until the user picks an event — intentional UX, not a stub.
- The check-in mode commit routes to `/events/[eventId]/checkin` which exists at the route-registration level but its actual UI is Plan 10's work. The route currently 404s until Plan 10 ships — that's expected per the wave-3 phasing and is documented as the cross-plan handoff.

## Next Phase Readiness

- **Plan 09 ready** (checkout flow): `/events/[eventId]/checkout` can directly compose `<ScanSessionProvider initialEvent={event} initialMode="checkout">` wrapped around the same `ScannerWidget` + `ManualEntryInput` + `ScanCartPanel` triplet. The EventPickerDialog is unused at /events/[id]/checkout because the event is preselected; the rest of the UI is identical. Plan 09's only new surface is the page-level shell that loads the event server-side and passes it as `initialEvent`.
- **Plan 10 ready** (checkin flow): `/events/[eventId]/checkin` is the destination of /scan?mode=checkin commit. Plan 10 can either (a) reuse ScannerWidget for line-by-line scan-then-mark-returned, or (b) build a dedicated form against the open checkouts. Either approach can compose with the scan-session context if needed.
- **Plan 11 (reports) ready** — no direct dependency on Plan 08, but the audit feed widgets (`/reports/history`, `/reports/missing`) will pick up checkout transactions written via the scan-session commit path automatically (via useMockStore subscriptions on the transactions slice).
- **Plan 12 (users + settings) ready** — no dependency.
- **Phase 2 swap surface is minimal:** every component file stays verbatim. The only mutator change is in scan-session's `commit()` body: `store.checkout(...)` swaps to a `Server Action` returning the same `CheckoutResult` contract. The optimistic UI affordance (D-01-08-B) is the only piece that grows — `useState` becomes `useOptimistic` with a confirmed-state setter inside `commit()`. Camera lifecycle, debounce, vibrate, manual entry, and event picker are all already Phase-2-ready.

---

*Phase: phase-kayinleong-01*
*Completed: 2026-05-24*

## Self-Check: PASSED

- All 7 created files exist on disk:
  - app/(app)/scan/page.tsx
  - components/feature/scan/scan-session.tsx
  - components/feature/scan/ScannerWidget.tsx
  - components/feature/scan/ScanCartPanel.tsx
  - components/feature/scan/ScanHeader.tsx
  - components/feature/scan/EventPickerDialog.tsx
  - components/feature/scan/ManualEntryInput.tsx
- All 3 task commits present in `git log --oneline`: `6370c32` (Task 1), `0133038` (Task 2), `267639b` (Task 3)
- Plan-level verification:
  - `npx tsc --noEmit` exits 0: PASS
  - `npm run build` (Next 16 Turbopack) exits 0: PASS — `/scan` registered as `ƒ (Dynamic)`
  - `npm run lint` exits 0: PASS (1 unchanged Plan-03 TanStack React Compiler warning; no new warnings)
  - Runtime smoke test via `curl` against `next dev`:
    - `GET /scan` (anon) → 307 → `/login` (Plan 04 role gate)
    - `GET /scan` (admin) → 200 with "Scan items to check them out" + "Check out" tab + "Pick event" CTA + "Cart is empty" empty state
    - `GET /scan?mode=checkin` (admin) → 200 with "Scan items being returned" + "Return 0 items" CTA
    - `GET /scan` (staff in allowedStaff: u-staff-1) → 200 with same shell
- All Task 1 acceptance criteria pass (4 file existence + 8 grep + tsc).
- All Task 2 acceptance criteria pass (2 file existence + 11 grep + tsc).
- All Task 3 acceptance criteria pass (1 file existence + 7 grep + tsc + build).
- All 14 requirements (SCN-01..06, CO-02, CO-03, CO-06, CO-07, CO-08, CO-09, CI-02, NFR-05) satisfied at the UI level — Phase 2 wires the data layer underneath without changing the rendered surface (the only swap is `store.checkout` → a Server Action, identical return contract).
