---
phase: phase-kayinleong-01
plan: 09
subsystem: ui-checkout
tags: [checkout, per-event-scan, scan-session, scan-cart, role-gate, evt-08, async-params, next-16-server-shell, store-checkout, atomic-commit, co-05-stock-failure]

# Dependency graph
requires:
  - phase: phase-kayinleong-01 plan 01
    provides: lib/types/event.ts (EventDoc), lucide-react icons (ChevronLeft)
  - phase: phase-kayinleong-01 plan 02
    provides: lib/auth/mock-session.ts (requireSession), lib/mock/store.ts (getSnapshot + checkout mutator with CheckoutResult contract), lib/mock/selectors.ts (selectEventById)
  - phase: phase-kayinleong-01 plan 03
    provides: components/ui/page-header.tsx, components/ui/button.tsx
  - phase: phase-kayinleong-01 plan 04
    provides: (app)/layout.tsx role-gated shell — /events/[eventId]/checkout renders inside, requireSession guarantees authenticated user
  - phase: phase-kayinleong-01 plan 08
    provides: ScanSessionProvider with initialMode + initialEvent props, ScannerWidget, ScanCartPanel, ScanHeader, ManualEntryInput. The pre-scoped-event pattern (initialEvent={event}) was explicitly anticipated in Plan 08's frontmatter `affects` section.

provides:
  - /events/[eventId]/checkout route — per-event scoped scan flow (CO-01)
  - Server-shell + Client-island composition pattern for routes that need both async-params auth gate AND a Client Component using hooks (mirrors /events/[eventId]/page.tsx shape; cleaner than collapsing into one Client file because notFound + redirect + requireSession are server-only APIs)
  - EVT-08 access gate enforcement at the page level (admin OR uid in event.allowedStaff)
  - Status-actionable rejection (completed / cancelled events redirect back to detail; cannot accept new check-outs)
  - Successful checkout commit auto-redirects to /events/[eventId] via the existing ScanSessionProvider.commit() — no extra logic needed
  - CO-05 stock failure surfaces failed lines as toast.error description; cart stays intact (inherited from Plan 08's commit handler)

affects:
  - phase-kayinleong-01 plan 10 (checkin flow): /events/[eventId]/checkin will follow the IDENTICAL server-shell + client-island shape — requireSession + event lookup + EVT-08 + status-actionable check (only `active` status accepts check-ins) — then hand to a CheckinClient that mounts ScanSessionProvider with initialMode="checkin" and initialEvent={event}. The shell pattern is now a template.
  - phase-kayinleong-02 entirely: the page.tsx shell stays verbatim except for two swaps in Phase 2: (1) requireSession's body swaps from mock-session.ts to a DAL-wrapped getTokens()/verifySession() call, signature unchanged; (2) selectEventById call becomes a Firestore getDoc() inside the DAL. The Client island doesn't change at all — Phase 2's store.checkout swap happens inside scan-session.commit() (Plan 08's deferred Phase-2 swap surface), invisible to this route.

# Tech tracking
tech-stack:
  added: []  # No new dependencies; pure composition over Plan 08 substrate
  patterns:
    - "Server-shell + Client-island for routes needing async-params auth gate AND scan-session context: Server `page.tsx` does requireSession + notFound + redirect + status reject (all server-only APIs); a colocated `_components/<route>-client.tsx` wraps the Client Component tree with ScanSessionProvider. Avoids the alternative of collapsing everything into a Client file (which would force every consumer to handle async params client-side and lose static metadata generation)."
    - "`_components/` colocated private folder for route-scoped Client islands per Next 16's underscore-prefix convention. Doesn't pollute routes; lives next to the page that owns it."
    - "Pre-scoped ScanSessionProvider pattern: passing `initialEvent={event}` (and `initialMode='checkout'`) to ScanSessionProvider skips the EventPickerDialog entirely — the user came from the event detail page, the event is sticky from page mount, and ScanHeader renders the sticky event header from the first paint."
    - "Successful-commit redirect is handled INSIDE ScanSessionProvider.commit() (router.push(`/events/${selectedEvent.id}`)) — no extra success handler needed at the page level. The page lands the user back on the source they came from. Phase 2's Server Action commit will preserve the same router.push call after the action resolves."

key-files:
  created:
    - app/(app)/events/[eventId]/checkout/page.tsx
    - app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx
  modified: []

key-decisions:
  - "D-01-09-A: Server-shell + Client-island split rather than a single Client Component. The plan's task spec explicitly described this split because requireSession + notFound + redirect + async params are all server-only APIs (notFound and redirect are imported from next/navigation but only valid inside Server Components / Route Handlers / Server Actions per Next 16 docs). Collapsing into a single Client file would force passing the event ID via search params + client-side fetching the event, which loses the SSR'd metadata title and adds a flash of empty content. The shell mirrors /events/[eventId]/page.tsx and /events/[eventId]/edit/page.tsx — both Server Components doing the same shape — so the convention is consistent across the events subtree."
  - "D-01-09-B: Status rejection redirects to /events/[eventId] (the event detail page), NOT to /events list or /unauthorized. Reason: cancelled and completed events are still readable (EVT-08 allows view-access); only the action surface is closed. The detail page already shows status-aware messaging ('This event is cancelled' / 'This event is completed' per Plan 07) — landing the user there teaches them why the action is unavailable instead of opaquely bouncing them to /unauthorized. Mirrors Plan 07's D-01-07-G reconciliation-on-cancel posture: once closed, the entity is read-only, not invisible."
  - "D-01-09-C: ManualEntryInput is rendered without the `disabled` prop — there's no scenario where it should be disabled on this page (the event is always pre-scoped from page mount, unlike /scan where ManualEntryInput is disabled until `selectedEvent` is set). Keeps the JSX surface clean. If a Phase 2 enhancement adds a 'commit in progress' lock, the disabled prop can be wired to scan-session.isCommitting at that point."
  - "D-01-09-D: No 'End session' affordance on the per-event checkout page. /scan's ScanHeader exposes End session to clear sticky event + cart (D-15) — but on /events/[eventId]/checkout, the event is permanent for the page lifetime (you can't switch events without navigating away). The ScanHeader still renders for visual consistency with /scan, and End session still works (clears cart + sets selectedEvent to null) — but at that point the ScannerWidget's 'Pick an event below before scanning' message would fire because selectedEvent became null. This is a known edge case: the user clicks End session and the UI degrades to /scan's empty state without an EventPickerDialog mounted. Acceptable in Phase 1 because End session is power-user behavior and the user can simply navigate back to the event detail to restart. Phase 2 may suppress End session on per-event routes, or wire it to a Back-to-event redirect. Captured for future hardening."
  - "D-01-09-E: `'use client'` directive in checkout-client.tsx is placed AFTER the comment header block, following the convention established in D-01-05-A (Plan 05). Next.js's directive scanner accepts comments before directives — verified across every Plan 02 / 04 / 08 client file."

patterns-established:
  - "Server-shell + Client-island route layout (lives in /events/[eventId]/checkout/{page.tsx, _components/checkout-client.tsx}): the page does requireSession + notFound + redirect; the colocated client file mounts the Client Component tree. Plan 10 (/events/[eventId]/checkin) will follow the same template."
  - "Pre-scoped ScanSessionProvider: `<ScanSessionProvider initialMode='...' initialEvent={...}>` lets a parent route control both the mode and the event from the first paint. No event-picker dialog renders. The substrate doesn't change — the existing provider just receives the initial props through its already-typed signature."
  - "Status-actionable rejection: a closed event (completed / cancelled) redirects to the read-only detail page rather than /unauthorized. Preserves entity visibility while closing the action surface."

requirements-completed:
  - CO-01
  - CO-04
  - CO-05
  - CO-06
  - CO-07
  - CO-08
  - CO-09
  - CO-10
  - SCN-01
  - SCN-04

# Metrics
duration: 3 min
completed: 2026-05-24
---

# Phase 1 Plan 09: Checkout Flow Summary

**Per-event scoped check-out route at `/events/[eventId]/checkout` — Server shell does requireSession + EVT-08 access gate + status-actionable redirect, Client island mounts ScanSessionProvider with initialEvent={event} so the user skips the EventPickerDialog and lands directly on the pre-scoped scan UI; successful commit calls store.checkout atomically (CO-04) and ScanSessionProvider.commit() routes back to /events/[eventId]; stock failure surfaces failed lines via toast.error description while leaving the cart intact (CO-05).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-24T16:00:20Z
- **Completed:** 2026-05-24T16:03:51Z
- **Tasks:** 1
- **Files created:** 2

## Accomplishments

- Built `app/(app)/events/[eventId]/checkout/page.tsx` — Server Component shell mirroring the existing `/events/[eventId]/page.tsx` and `/events/[eventId]/edit/page.tsx` shape. Calls `requireSession()` (Plan 04 / Plan 02), awaits async `params`, looks up the event via `selectEventById(getSnapshot(), eventId)`, then enforces three gates in order: (1) `notFound()` if event missing → 404; (2) EVT-08 — `redirect("/unauthorized")` if session is not admin AND uid is not in `event.allowedStaff`; (3) status-actionable reject — `redirect("/events/[eventId]")` if status is not `planned` or `active`. On all three passes, hands the resolved event to `<CheckoutClient event={event} />`. Also defines `generateMetadata` that reads the event title for the SSR'd HTML `<title>` ("Check out · Spring Product Demo").
- Built `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx` — Client Component that mounts `<ScanSessionProvider initialMode="checkout" initialEvent={event}>` around the page chrome (Back-to-event link + PageHeader + `<CheckoutBody/>`). The inner `CheckoutBody` calls `useScanSession()` to read `addLine` and composes `<ScanHeader />`, a grid of `<ScannerWidget />` + `<ManualEntryInput onSubmit={(sku) => addLine(sku)} />`, and `<ScanCartPanel />`. Total file is 80 lines, of which ~50 are comment header explaining the architecture + how Phase 2's swaps land here.
- Verified end-to-end via 8 smoke tests against `next dev`: anon → 307 /login (Plan 04 gate); admin + active → 200; admin + planned → 200; admin + completed → 307 /events/evt-completed-01 (status reject); admin + cancelled → 307 /events/evt-cancelled-01 (status reject); admin + missing event → 404; staff NOT in allowedStaff → 307 /unauthorized (EVT-08); staff IN allowedStaff backup → 200. Rendered HTML for the happy path contains the locked UI-SPEC elements ("Check out · Spring Product Demo" PageHeader, "Back to event" link, "Start camera" tap-to-start, "Cart is empty" empty state, "Scanning for" + "Active" status badge + "End session" from ScanHeader). Critically, "Pick event" CTA does NOT appear — confirming the EventPickerDialog is bypassed when initialEvent is set.

## Task Commits

Each task was committed atomically:

1. **Task 1: /events/[eventId]/checkout route + colocated CheckoutClient** — `f48fad0` (feat)

## Files Created/Modified

### Created (2 files)

- `app/(app)/events/[eventId]/checkout/page.tsx` — Server Component shell: requireSession + async params + selectEventById + notFound + EVT-08 redirect + status redirect, then hands event to CheckoutClient. Exports `generateMetadata` for the SSR title.
- `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx` — Client Component wrapping ScanSessionProvider (initialMode="checkout", initialEvent={event}) around PageHeader + Back-to-event link + CheckoutBody (ScanHeader + ScannerWidget + ManualEntryInput + ScanCartPanel grid).

## Decisions Made

- **D-01-09-A:** Server-shell + Client-island split rather than a single Client Component. Reason: `requireSession`, `notFound`, `redirect`, and async params are all server-only APIs. Collapsing into a single Client file would force passing the event ID via search params + client-side fetching, losing SSR'd metadata title + adding a flash of empty content. The shell mirrors `/events/[eventId]/page.tsx` and `/events/[eventId]/edit/page.tsx` so the convention is consistent across the events subtree.

- **D-01-09-B:** Status rejection redirects to `/events/[eventId]` (the event detail page), NOT to `/events` list or `/unauthorized`. Reason: cancelled and completed events are still readable (EVT-08 allows view-access); only the action surface is closed. The detail page already shows status-aware messaging per Plan 07 — landing the user there teaches them why the action is unavailable. Mirrors Plan 07's posture: once closed, the entity is read-only, not invisible.

- **D-01-09-C:** ManualEntryInput is rendered without the `disabled` prop. Reason: on this page the event is always pre-scoped from mount (unlike /scan where ManualEntryInput is disabled until selectedEvent is set). If a Phase 2 enhancement adds a 'commit in progress' lock, disabled can be wired to scan-session.isCommitting then.

- **D-01-09-D:** No 'End session' suppression on the per-event checkout page. The ScanHeader still renders End session for visual consistency with /scan. Clicking End session clears cart + sets selectedEvent to null, which degrades the UI to "Pick an event below before scanning" without an EventPickerDialog mounted. Acceptable Phase 1 edge case — power-user behavior; the user can navigate back to the event detail to restart. Phase 2 may suppress End session on per-event routes.

- **D-01-09-E:** `'use client'` directive in checkout-client.tsx is placed AFTER the comment header block (D-01-05-A convention). Verified across every Plan 02/04/08 client file — Next.js's directive scanner accepts comments before directives.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `<action>` block provided a near-verbatim sketch of both files; the only minor adjustments were stylistic (e.g., putting the comment header above `'use client'` per D-01-05-A; expanding the inline explanatory comments on key files for future maintainers). No bugs to auto-fix, no missing critical functionality to inject, no blockers — the Plan 08 substrate was already shaped for this exact composition.

---

**Total deviations:** 0
**Impact on plan:** None — pure composition over Plan 08's substrate.

## Authentication Gates

None — Phase 1 uses the mock session cookie checked by `requireSession()`. The /events/[eventId]/checkout page inherits the (app) layout's auth gate (Plan 04) and adds EVT-08's per-event access check at the page level. No external auth provider involved.

## Issues Encountered

None during planned work. Initial smoke test attempted with `ces_mock_session` cookie name (incorrect guess); corrected to `mock_session` after verifying `lib/mock/cookie.ts`. The page itself never had a bug — only the test invocation needed the right cookie name.

## User Setup Required

None — no external service configuration required.

## Threat Flags

None — no new security-relevant surface introduced. The page reuses existing mitigations:

- **EVT-08 access gate** at the page level (line 51-56 of page.tsx) — staff users without `uid ∈ event.allowedStaff` redirect to /unauthorized BEFORE the event data is rendered. Admin sees all. Same shape as `/events/[eventId]/page.tsx` (Plan 07). Phase 2 swap: `array-contains` Firestore rule check at the data-layer boundary, plus a redundant page-level check for defense-in-depth.
- **Status-actionable reject** at the page level (line 60-62 of page.tsx) — completed and cancelled events cannot accept new check-outs. Phase 2 swap: same check at the page level, plus a Server Action precondition that re-asserts `event.status in ['planned', 'active']` before calling the Firestore transaction (which itself enforces non-negative stock via CO-05). Defense in depth: UI guard + Server Action guard + Firestore rule.
- **Stock invariant (CO-05)** is enforced atomically inside `store.checkout` (Plan 02), surfaced as a toast.error with failedLines description when the user's cart can't be satisfied. UI-layer per-line `max={availableQty}` constraint in ScanCartPanel (Plan 08) is the defense-in-depth above; the store mutator is the canonical enforcement point. Phase 2 wraps this in a Firestore transaction that re-reads availableQty inside the transaction body before decrementing.
- **Sticky event header (D-15)** prevents accidental cross-event commits — the user can SEE the event they're checking out for at the top of the page (ScanHeader's "Scanning for Spring Product Demo" + Active badge).

No new threat surface introduced by this plan — every guard is reused from Plan 02 / Plan 07 / Plan 08.

## Known Stubs

None — every rendered surface receives real data:

- The event is loaded server-side from the seed store via `selectEventById(getSnapshot(), eventId)`.
- The cart is the live `useState<ScanCartLine[]>` from ScanSessionProvider (Plan 08).
- The Scanner uses the real `@yudiel/react-qr-scanner` library; the camera lifecycle is genuine (tap-to-start, vibrate, debounce all work).
- ManualEntryInput submits real SKU lookups against the seed inventory.
- Successful checkout writes a real `transactions` entry to the mock store and decrements `availableQty` synchronously — Phase 2 swaps the body for a Server Action returning the same CheckoutResult contract.

The only "deferred to Phase 2" surface is the underlying mutator implementation (still mock data) — which is expected per the phase split and applies to every Wave 3 page.

## Next Phase Readiness

- **Plan 10 ready** (checkin flow): `/events/[eventId]/checkin` will follow the IDENTICAL Server-shell + Client-island template established here. The shell does `requireSession + EVT-08 + status-actionable check (only `active` status accepts check-ins — `planned` doesn't have open checkouts yet, `completed/cancelled` are closed)`. The Client island mounts ScanSessionProvider with `initialMode="checkin"` and `initialEvent={event}`. The substrate work for the actual check-in form (per-line returnedQty + missing-reason picker per CI-03/CI-04) is Plan 10's net-new scope — but the route shell is a copy-paste-and-rename of /events/[eventId]/checkout.
- **Plan 11 ready** (reports): no direct dependency on this plan. Reports already render against the seed transactions slice via useMockStore subscriptions — any checkout committed from this page automatically flows into /reports/history and /reports/out.
- **Plan 12 ready** (users + settings): no dependency.
- **Phase 2 swap surface:** minimal. (1) page.tsx — `requireSession()` body changes from mock-session.ts to a DAL-wrapped `getTokens()` + `verifySession()` call from `next-firebase-auth-edge`; same signature, same async return shape. (2) `selectEventById(getSnapshot(), ...)` becomes a Firestore `getDoc(eventsCollection, eventId)` inside a DAL helper; the shell's three gates (notFound + EVT-08 + status reject) all stay verbatim. (3) checkout-client.tsx doesn't change at all — the Phase 2 swap happens inside `scan-session.commit()` (Plan 08's deferred swap surface — `store.checkout` → Server Action returning the same `CheckoutResult` contract), invisible to this page. The pre-scoped-event pattern stays exactly as written.

---

*Phase: phase-kayinleong-01*
*Completed: 2026-05-24*

## Self-Check: PASSED

- Both created files exist on disk:
  - `app/(app)/events/[eventId]/checkout/page.tsx`
  - `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx`
- Task commit present in `git log --oneline`: `f48fad0`
- Plan-level verification:
  - `npx tsc --noEmit` exits 0: PASS
  - `npm run build` (Next 16 Turbopack) exits 0: PASS — `/events/[eventId]/checkout` registered as `ƒ (Dynamic)`
  - `npm run lint` exits 0: PASS (1 unchanged pre-existing Plan-03 TanStack React Compiler warning; no new warnings)
  - Runtime smoke test via `curl` against `next dev` (cookie `mock_session={json}`):
    - `GET /events/evt-active-01/checkout` (anon) → 307 → `/login` (Plan 04 gate)
    - `GET /events/evt-active-01/checkout` (admin u-admin-1) → 200 with "Check out · Spring Product Demo" + "Back to event" + "Start camera" + "Cart is empty" + "Scanning for" + "Active" badge + "End session" — no "Pick event" CTA (confirming pre-scoping)
    - `GET /events/evt-planned-01/checkout` (admin) → 200
    - `GET /events/evt-completed-01/checkout` (admin) → 307 → `/events/evt-completed-01` (status reject)
    - `GET /events/evt-cancelled-01/checkout` (admin) → 307 → `/events/evt-cancelled-01` (status reject)
    - `GET /events/missing-event-xyz/checkout` (admin) → 404 (notFound)
    - `GET /events/evt-planned-01/checkout` (staff u-staff-2, NOT in evt-planned-01.allowedStaff) → 307 → `/unauthorized` (EVT-08)
    - `GET /events/evt-planned-01/checkout` (staff u-staff-1, IN evt-planned-01.allowedStaff via backupTeams) → 200
- Task 1 acceptance criteria all pass:
  - Both files exist (page.tsx + _components/checkout-client.tsx): PASS (`ls` output above)
  - Page enforces EVT-08 access check + rejects completed/cancelled: PASS (smoke tests 4, 5, 7)
  - ScanSessionProvider receives initialMode="checkout" and initialEvent={event}: PASS (grep verified 3 strings)
  - npm run build + tsc pass: PASS
- All 10 plan requirements (CO-01, CO-04, CO-05, CO-06, CO-07, CO-08, CO-09, CO-10, SCN-01, SCN-04) satisfied at the UI-shell level — Phase 2 will swap `store.checkout` for a Server Action returning the same CheckoutResult contract, with the page surface (and the EVT-08 + status gates) unchanged.
