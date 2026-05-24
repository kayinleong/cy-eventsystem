# Phase 1: UI POC — Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 ships a full UI shell for every route in the locked sitemap, navigable end-to-end with typed mock data. No Firebase. No `.env.local`. No real auth. Forms validate inputs and "submit" against an in-memory mock store; nothing persists across full page reloads.

The bar: stakeholders can sign in, navigate from dashboard → inventory → events → check-out → check-in → reports → users using only the UI, with both admin and staff views visibly distinct, and see the scan-cart actually decrement `availableQty` on the in-memory store. `npm run build`, `tsc --noEmit`, and `eslint` all pass. Every route renders without console errors.

**Out of scope (deferred to Phase 2):** Firebase project setup, `.env.local`, Admin SDK, real auth/session cookies, `proxy.ts` cookie verification, Server Actions writing to Firestore, real-time `onSnapshot` listeners, Firestore rules/indexes/transactions, Cloud Functions, email delivery for invites.
</domain>

<decisions>
## Implementation Decisions

### Mock Data Architecture

- **D-01:** Mock data is hardcoded TypeScript const arrays in `lib/mock/<entity>.ts` (one file per entity: `items.ts`, `events.ts`, `users.ts`, `transactions.ts`, `missingItems.ts`). No `@faker-js/faker` dependency. Each entity exports a typed array literal; types live in `lib/types/<entity>.ts` per CLAUDE.md.
- **D-02:** A mutable in-memory store at `lib/mock/store.ts` exposes a `subscribe()` / `getSnapshot()` API consumed via React 19's `useSyncExternalStore`. Scan-cart commits, item edits, event creates, and missing-item resolves all mutate the store and trigger re-renders. State resets on full page reload (no persistence). The store owns the seed arrays as its initial state; consumers never import the seed arrays directly.
- **D-03:** Seed volume: **~30 inventory items** across 4 categories (Audio / Lighting / Display / Marketing), **6 events** (mix of `planned` / `active` / `completed` / one `overdue` / one `cancelled`), **5 users** (2 admin / 3 staff), **~80 transactions** spread across the events, **~6 missing-item records** (mix of open and resolved). Counts chosen so pagination (50/page on `/reports/history`) and low-stock widget exercise real cases without dominating the codebase.
- **D-04:** Dates are **fixed literals in 2026** (e.g., `2026-05-24`, `2026-06-12`). Not computed-relative-to-now. Acknowledged tradeoff: dashboard widgets may go stale if the demo runs months out; bump dates manually then. User chose this over a function-based seed for editing simplicity.

### Mock Auth + Role Simulation

- **D-05:** Sign-in writes a **non-httpOnly cookie** named `mock_session` containing JSON `{ uid, displayName, email, role, disabled }`. Server Components in `(app)/layout.tsx` read it via `await cookies()` (Next 16 async API). This shape deliberately mirrors the Phase 2 `__session` pattern so the layout file's role-gate logic can be reused with only the cookie-decoder swapped out.
- **D-06:** User menu contains a **"Switch role (POC only)" submenu** with Admin / Staff radio items. The component lives at `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` (filename intentionally signals removal in Phase 2). Switching writes a new cookie and triggers a `router.refresh()` so Server Components re-evaluate.
- **D-07:** **Strict role gate.** Staff hitting an admin-only route (`/users`, `/users/invite`, `/inventory/new`, `/inventory/[id]/edit`, `/events/new`) renders `/unauthorized` (lives at `app/(app)/unauthorized/page.tsx`). Admin-only nav items are also hidden conditionally. AUTH-10 contract met in Phase 1.
- **D-08:** Sign-in form validates email + password with Zod, then **looks up against `lib/mock/users.ts`**. All seed users have hardcoded password `"password"`. Mismatch shows inline error: "Wrong email or password." Match writes the cookie, redirects to `/`. `/forgot-password` and `/set-password` render valid forms but their "submit" only shows a sonner toast and routes back to `/login`.

### List Interactivity

- **D-09:** **Every list page uses the shadcn data-table block with TanStack Table v8**, including URL-param sync. Filter state (`?q=`, `?category=`, `?status=`, `?lifecycle=`, `?reason=`, `?role=`) and pagination (`?page=`) are read with `useSearchParams()` and written via `router.replace()` with `scroll: false`. REP-06 (shareable filter URLs) is met in Phase 1; Phase 2 only swaps the data source.
- **D-10:** **Server-style pagination chrome is always rendered** even though data is client-side: "Page N of M", page-size selector (50 default per REP-07), prev/next buttons. The pager is part of the data-table wrapper component (`components/feature/table/DataTablePagination.tsx`) so it's identical across all lists.
- **D-11:** **Selective sortable columns:** name/SKU (inventory + items-out), qty / availableQty (inventory + reports), date / startDate / endDate / serverTimestamp (events + history + missing), status / lifecycle (inventory + events). Sort UI is the TanStack `column.toggleSorting()` arrow button on headers. Columns without sort (actor display name, notes, reason text) don't render a sort affordance.
- **D-12:** **Global filter bar pattern.** Each list has a single text input above the table, debounced 250ms, that feeds TanStack's `globalFilter`. For item references in reports (e.g., "filter history by item X"), use shadcn's `Combobox` / `Command` for typeahead against the mock store's item list.

### Scanner

- **D-13:** **Install and integrate `@yudiel/react-qr-scanner` in Phase 1.** The scanner component lives at `components/feature/scan/ScannerWidget.tsx` and is reused by `/scan`, `/events/[id]/checkout`, and `/events/[id]/checkin`. Per ROADMAP success #5, the camera captures live input and decodes; scanned values appear on screen and are logged via the mock store, not persisted across reloads.
- **D-14:** **Full scan-cart UI wired to the mock store.** Scan adds to cart with a sonner toast + audible/haptic feedback (CO-07). The cart panel shows lines with a qty stepper (1–availableQty), per-line remove, and a "Confirm check-out" CTA that calls `store.checkout({ eventId, lines })`. The store decrements `availableQty`, increments `outQty`, and writes a `checkout` transaction. Audit feed and dashboard widgets update on the next render. Phase 2 swaps `store.checkout()` for a Server Action — UI unchanged.
- **D-15:** **Post-scan event picker.** When `/scan` opens without a preselected event, the first successful scan opens a modal `Combobox` listing the current user's accessible `planned` + `active` events. The chosen event sticks in a session-scoped "scan header" (`<ScanHeader event={...} />`) until the user clicks **"End session"** or navigates away. Subsequent scans within the session skip the picker and go straight into the cart.
- **D-16:** **All 5 decode formats enabled:** QR Code, Code 128, EAN-13, UPC-A, Data Matrix. Pass the format list to `@yudiel/react-qr-scanner` via its ZXing format option. CO-09 contract met in Phase 1.

### Claude's Discretion

The following items have strong defaults; the planner can decide details:

- **Routing structure.** Use App Router groups: `app/(auth)/{login,forgot-password,set-password}/page.tsx` (no chrome layout) and `app/(app)/...` for everything else (shared shell layout with nav + role gate). `/scan` lives in `(app)/scan/page.tsx`. `/unauthorized` lives at `app/(app)/unauthorized/page.tsx`. The `(app)/layout.tsx` is a Server Component that reads the mock cookie and renders the chrome.
- **Form + schema strategy.** All Zod schemas live in `lib/schemas/<entity>.ts` (so Phase 2's Server Actions can import them without changes). Every form uses `react-hook-form` with `zodResolver`. Validate on blur + on submit (`mode: 'onBlur'`). Show field-level errors inline beneath each input using shadcn's `<FormMessage/>`.
- **Dashboard widgets.** Active events, low-stock alerts, overdue returns, and recent activity widgets compute live from the mock store via selector helpers. Role switch + scan-cart commits visibly change widget values.
- **QR label printing.** `bwip-js` runs client-side; generate real QR codes on `/inventory/[id]` "Print label" preview. Use `window.print()` against a styled `@media print` div — no PDF generation in Phase 1.
- **Optimistic UI.** Use React 19's `useOptimistic` on the scan-cart even though Phase 1 cannot reject — locks the pattern for Phase 2. CO-06 contract pre-wired.
- **Sheets vs Dialogs.** Per UI-SPEC: full-page routes for `create/edit` (inventory, events, users). `<Sheet/>` for short forms (invite user, set low-stock threshold, resolve missing item). `<AlertDialog/>` for destructive confirmations (already locked in UI-SPEC copy contract).
- **Layout shell.** Sidebar nav on `lg:` and above, top bar with `<Sheet/>` drawer on mobile. User menu in top-right (sign-out + Phase-1-only role switcher + theme toggle).
- **Theme toggle.** `next-themes` light/dark/system selector lives in the user menu (per UI-SPEC Q6). System-preference default.
- **`/login` UX.** Below the form, render a tiny "POC seed users" disclosure listing the 5 seed emails (password `password` for all). One-click fills the form. Removed in Phase 2.

### Folded Todos

(None — no pending todos surfaced as relevant to this phase.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level Context (always)

- `CLAUDE.md` — Owner slug, claim protocol, regression rules, doc gate, stack constraints (Next 16 / React 19 / shadcn v4 / Tailwind v4 / lucide), file location rules for `lib/mock/`, `lib/types/`, `components/feature/<feature>/`, `lib/firebase/`. Naming.
- `AGENTS.md` — Next.js 16 breaking-change warning. Read `node_modules/next/dist/docs/` before writing Next-specific code.
- `.planning/PROJECT.md` — Project identity, sitemap (locked), 20 key decisions including stack, lifecycle states, audit log model, scanner library choice, no-global-state-lib.
- `.planning/REQUIREMENTS.md` — All v1 requirements with IDs (AUTH-01..10, INV-01..10, EVT-01..08, CO-01..10, CI-01..08, MIS-01..04, REP-01..07, RP-01..04, SCN-01..06, AUD-01..04, INT-01..05, RES-01..04, NFR-01..09). Phase 1 ships matching UI shells.
- `.planning/ROADMAP.md` §"Phase 1 — UI POC" — Mapped requirements, success criteria, out-of-scope for Phase 1.
- `.planning/STATE.md` — Phase tracker. Open clarifications (carried into Phase 2, not blocking Phase 1).

### Phase 1 Locked Contracts

- `.planning/phases/phase-kayinleong-01/01-UI-SPEC.md` — **APPROVED visual contract.** All 6 dimensions PASS. Spacing (4/8/16/24/32/48/64 with 44px touch-target exception), typography (Geist Sans/Mono, 14/14/18/24 at weights 400/600), color (monochrome radix-nova/neutral, accent reserved to primary CTA + active nav + focus ring + breadcrumb), status palette (outline + colored dot), copy contract (verb-noun voice, 7 empty-state copies, 4 destructive confirmations, 6 error copies), registry safety (shadcn official only).

### Technical Research

- `.planning/research/STACK.md` — Locked library choices with version + confidence levels. Next.js 16 breaking-change matrix (proxy.ts, async cookies, revalidateTag signature, parallel-route defaults). Read this before writing any Next-specific code.
- `.planning/research/ARCHITECTURE.md` — Firestore data model (`users`, `inventory`, `events`, `transactions`, `missingItems`). Mock types should mirror this exactly so Phase 2 can swap data layers without touching components.
- `.planning/research/FEATURES.md` — Per-feature implementation patterns and library recommendations.
- `.planning/research/PITFALLS.md` — Known traps: ZXing iOS Safari camera quirks, Firestore transaction retry semantics, session-cookie revocation timing.
- `.planning/research/SUMMARY.md` — Cross-cutting synthesis of the four research docs.

### Phase 1 Claim

- `.planning/phases/phase-kayinleong-01/CLAIM.md` — Claim stub. Update as `in-progress` when execution begins; complete with Verification section before marking `done`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Current State

The codebase is essentially blank scaffold:

- `app/layout.tsx` — Next 16 default root layout, Geist Sans + Geist Mono loaded
- `app/page.tsx` — Default `create-next-app` landing page (will be replaced by dashboard)
- `app/globals.css` — Tailwind v4 + `@theme inline` block; all 19 shadcn radix-nova/neutral tokens present at `:root` and `.dark` (verified during UI-SPEC research)
- `components/ui/button.tsx` — Only shadcn component installed so far
- `lib/utils.ts` — `cn()` helper
- `components.json` — `style: "radix-nova"`, `baseColor: "neutral"`, `cssVariables: true`, `iconLibrary: "lucide"`
- No `lib/firebase/`, no `lib/mock/`, no `lib/schemas/`, no `lib/types/`, no `components/feature/`, no route groups

### Reusable Assets

- `components/ui/button.tsx` — Already installed; reusable as-is
- `lib/utils.ts` `cn()` — Used by every component

### Established Patterns

- shadcn CLI installs go into `components/ui/` per `components.json`
- Tailwind v4 `@theme inline` lives in `app/globals.css` — no `tailwind.config.js`
- ESLint flat config at `eslint.config.mjs` (Next 16 removed `next lint`)
- `next.config.ts` exists and is essentially empty; do not enable `cacheComponents` (PROJECT.md Key Decision #12)

### Integration Points

- Root `app/layout.tsx` will need to add the theme provider (`next-themes`), the sonner `<Toaster/>`, and a `<MockAuthBoundary/>` if needed (Server Component reading the mock cookie).
- Phase 1 work introduces: `app/(auth)/`, `app/(app)/`, `lib/mock/`, `lib/schemas/`, `lib/types/`, `components/feature/`, `components/ui/<more shadcn blocks>`. Phase 2 will add `lib/firebase/`, `lib/dal/`, `proxy.ts`, `firestore.rules`, `firestore.indexes.json`, and replace `lib/mock/` wholesale.
- `package.json` will gain in Phase 1: `next-themes`, `sonner`, `@hookform/resolvers`, `react-hook-form`, `zod`, `@tanstack/react-table`, `date-fns`, `@yudiel/react-qr-scanner`, `bwip-js`, and the additional shadcn blocks installed via the CLI (form, input, label, dropdown-menu, sheet, dialog, alert-dialog, table, badge, card, command, combobox, popover, separator, skeleton, sonner, tabs, tooltip, avatar, scroll-area, switch).

</code_context>

<specifics>
## Specific Ideas

- The role switcher in the user menu must be **visually marked as POC-only** so stakeholders know it goes away in Phase 2 (e.g., label includes "(POC)" suffix; component lives at `components/feature/auth/PhaseOnePocRoleSwitcher.tsx`).
- The `/login` page should include a discrete "POC seed users" disclosure listing the 5 emails so demos don't require remembering credentials.
- Scanner UX: the post-scan event picker remembers the chosen event for the duration of the scan session, surfaced as a sticky `<ScanHeader event={...} />` at the top of the scanner view — explicit "End session" button to clear.
- All mock entity shapes mirror the Firestore data model in `ARCHITECTURE.md` exactly. This is critical: Phase 2 must be a data-source swap, not a UI rewrite.
- Phase 1 acceptance demo flow (informal acceptance criterion): admin signs in → creates an item → creates an event → switches to staff role via user menu → scans items into a check-out cart → commits the cart → switches back to admin → resolves a missing-item record → notices low-stock widget reflects the changes. End-to-end, no Firebase touched.

</specifics>

<deferred>
## Deferred Ideas

(Discussion stayed within Phase 1 scope.)

### Phase 2 / v2 considerations surfaced incidentally

- `next-firebase-auth-edge` v1.12 stability spike (already captured in `STATE.md` open clarifications).
- Bluetooth handheld scanner integration via keystroke handler (CO-10) — wiring lives in Phase 2; the scan input handler in Phase 1 should be designed so a keyboard event listener can layer on without refactoring.
- App Check enrollment — Phase 2 hardening.
- `firestore.rules` unit tests — Phase 2.
- IndexedDB persistence for scan-cart (RES-03) — Phase 2 only; Phase 1 cart lives in the in-memory mock store.

</deferred>

---

*Phase: 01-ui-poc*
*Context gathered: 2026-05-24*
