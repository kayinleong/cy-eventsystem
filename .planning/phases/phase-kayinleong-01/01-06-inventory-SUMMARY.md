---
phase: phase-kayinleong-01
plan: 06
subsystem: ui-inventory
tags: [inventory, data-table, rhf, zod-4, shadcn-v4-field, bwip-js, qr-code, print-preview, alert-dialog, tabs, next-16-await-params]

# Dependency graph
requires:
  - phase: phase-kayinleong-01 plan 01
    provides: lib/types/item.ts (InventoryItem, ItemCategory, ItemLifecycleState), lib/schemas/item.ts (ItemFormSchema, ItemCategoryEnum), shadcn primitives (field, alert-dialog, dialog, tabs, select, textarea, card), bwip-js@4.10.1 runtime dep
  - phase: phase-kayinleong-01 plan 02
    provides: lib/mock/store.ts (createItem, updateItem, retireItem), lib/mock/selectors.ts (selectItemById, selectTransactionsForItem), lib/auth/mock-session.ts (requireAdmin, getMockSession), lib/hooks/use-mock-store.ts, lib/hooks/use-current-user.ts, seedUsers
  - phase: phase-kayinleong-01 plan 03
    provides: components/feature/table/DataTable.tsx (with useUrlTableState wiring), components/feature/status/StatusBadge + status-to-tone, EmptyState, PageHeader
  - phase: phase-kayinleong-01 plan 04
    provides: (app)/layout.tsx role-gated shell — inventory pages render inside it; requireAdmin pattern for /new and /edit
  - phase: phase-kayinleong-01 plan 05
    provides: actor-resolution pattern (useCurrentUser + seedUsers.find by uid → UserDoc) used by ItemForm + RetireItemButton

provides:
  - /inventory list page with category/lifecycle/lowStock filters + free-text search + URL state + 50 rows/page pagination
  - /inventory/new + /inventory/[itemId]/edit — admin-gated forms with shared ItemForm (shadcn v4 <Field> + rhf + Zod)
  - /inventory/[itemId] — Server-Component detail page with stock breakdown cards + Details/History tabs + QR label print preview + admin retire
  - InventoryTable client island composing the generic DataTable (Plan 03) for inventory rows
  - ItemForm component shared by create + edit modes with SKU-uniqueness check (INV-02) + INV-04 stock-adjust-is-Phase-2 lockdown
  - LabelPreview rendering real QR codes via bwip-js (bcid: 'qrcode') to <canvas>
  - PrintLabelButton wrapping a Dialog with @media print chrome-hide CSS
  - RetireItemButton — AlertDialog with locked UI-SPEC copy ("Retire this item?" / "Retire item")
  - ItemHistoryTab subscribing to mock store via useMockStore + selectTransactionsForItem (newest first; AUD-02)
  - ItemDetail layout composing the above into the canonical detail surface

affects:
  - phase-kayinleong-01 plan 07 (events list + detail) — same DataTable wrapper pattern; same Server-Component-detail + client-history-tab split
  - phase-kayinleong-01 plan 09 (check-out flow) — scan cart reads inventory list; checkout mutations re-render InventoryTable + ItemHistoryTab via useMockStore subscription
  - phase-kayinleong-01 plan 10 (check-in flow) — same as plan 09; missing reports use the same StatusBadge + transaction shape
  - phase-kayinleong-01 plan 11 (reports/missing + reports/history + reports/repurchase) — DataTable column-definition pattern + URL state + RP-04 markLowStockOrdered reused
  - phase-kayinleong-01 plan 12 (users + settings) — admin-gated form pattern (requireAdmin + AlertDialog destructive)
  - phase-kayinleong-02 entirely — every route file's JSX stays verbatim; only store mutators swap to Server Actions; bwip-js client rendering stays unchanged

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared form component pattern: ItemForm accepts a discriminated union `{ mode: 'create' } | { mode: 'edit'; itemId; initial }` so the same JSX serves both routes — disable rules (sku + totalQty locked in edit per INV-04) gate off `mode === 'edit'`"
    - "Default-value defense at the submit boundary: Zod's `.default()` makes the rhf input type include `T | undefined`; the submit handler normalizes via `values.field ?? defaultValue` before calling the mutator (avoids passing undefined into a strict-typed store)"
    - "Server-Component-detail + client-history-tab split: detail/page.tsx reads the snapshot once on the server (so SSR has the item name + stock); ItemHistoryTab subscribes via useMockStore so retire/checkout mutations re-render the feed without reloading the page"
    - "@media print scoped CSS pattern: inline `<style>` block inside the PrintLabelButton component hides all body content except #print-label when the print stylesheet activates — keeps the print preview clean without affecting the page chrome at screen sizes"
    - "Admin-only UI gates use useCurrentUser to short-circuit render (return null for non-admins) on top of the layout-level requireAdmin/requireSession server gate"
    - "Controller for select primitives: react-hook-form's <Controller> wraps shadcn Select to bridge the imperative onValueChange API back into rhf — used for category in ItemForm"

key-files:
  created:
    - app/(app)/inventory/page.tsx
    - app/(app)/inventory/new/page.tsx
    - app/(app)/inventory/[itemId]/page.tsx
    - app/(app)/inventory/[itemId]/edit/page.tsx
    - components/feature/inventory/InventoryTable.tsx
    - components/feature/inventory/ItemForm.tsx
    - components/feature/inventory/ItemDetail.tsx
    - components/feature/inventory/ItemHistoryTab.tsx
    - components/feature/inventory/LabelPreview.tsx
    - components/feature/inventory/PrintLabelButton.tsx
    - components/feature/inventory/RetireItemButton.tsx
  modified: []

key-decisions:
  - "D-01-06-A: ItemForm uses shadcn v4 <Field> primitives with rhf register() bound directly. The plan's example code used the v3 <Form>/<FormField> Context wrapper, which is empty in the radix-nova v4 registry per Plan 01 deviation D-01-01-A and Plan 04's D-01-04-B. Using <Field> here continues the same form-composition convention used by every Plan 04 (auth) form."
  - "D-01-06-B: ItemForm uses <Controller> for the category Select. shadcn's Select primitive exposes an imperative `onValueChange` (Radix pattern) that doesn't compose with rhf's `register()`. Controller bridges the imperative API back into rhf's controlled-input model. Same pattern applies in Plan 07's event form (status select) and Plan 12's invite-user form (role select)."
  - "D-01-06-C: After mutations call router.push + router.refresh(). The store mutation is synchronous and visible to client components via useSyncExternalStore immediately, but the destination page (e.g. /inventory/[id] after create) is a Server Component that reads getSnapshot() — router.refresh() forces the server tree to re-evaluate so the SSR'd HTML on the next navigation reflects the new state. Same pattern Plan 04 established for PhaseOnePocRoleSwitcher."
  - "D-01-06-D: InventoryTable's filter predicate mirrors `selectLowStockItems` literally (lifecycleState != retired AND threshold > 0 AND availableQty <= threshold AND !lowStockOrderedAt). This guarantees the 'Low stock only' toolbar filter shows the EXACT same rows the dashboard's LowStockWidget shows — Phase 2 swaps both to a Firestore query helper that returns the same projection."
  - "D-01-06-E: PrintLabelButton uses inline <style> for @media print CSS rather than a global stylesheet rule. Scope of effect: the rule only takes effect when the dialog is open + the user invokes window.print(); having it inline keeps the print behavior co-located with the component that owns it. Phase 2 can ship a global print-overrides stylesheet if multiple components need print-specific rules — until then, inline is simpler."
  - "D-01-06-F: RetireItemButton uses the `variant=\"destructive\"` prop on AlertDialogAction. The shadcn AlertDialogAction primitive exposes a `variant` prop that forwards to the wrapped Button. Using that prop is cleaner than ad-hoc className styling and keeps the destructive-tone rule centralized to UI-SPEC Q9."
  - "D-01-06-G: ItemForm's submit handler normalizes Zod-default fields (unit, lowStockThreshold, notes) via `values.field ?? default` before passing to the store mutator. The schema's `.default()` makes the rhf input type include `T | undefined` (Zod 4 inferred input behavior), but the mutator signature is strict. Normalizing at the boundary is the canonical fix per Zod 4 docs — preserves the schema's user-facing default while satisfying the mutator's typed contract."

patterns-established:
  - "Inventory list pattern (Plans 06/07/11): Server-Component shell → PageHeader with admin-only CTA → <FeatureNameTable/> client island that composes DataTable with column defs + filterKeys + toolbarExtras. URL state lives entirely in the client island via useUrlTableState."
  - "Admin-gated route pattern (Plans 06/07/12): `await requireAdmin()` at the top of the page component; no other gating logic needed. Edit routes additionally `await params` (Next 16 async params), call selectItemById/selectEventById, and call notFound() on miss."
  - "Detail-page pattern (Plans 06/07): Server-Component reads the snapshot once on the server (for SSR title + stock breakdown), then renders a client-aware ItemDetail / EventDetail composite. Live-data tabs (History) subscribe via useMockStore so mutations re-render without a server roundtrip."
  - "Destructive confirmation pattern (Plans 06/07/12 retire/cancel/disable): AlertDialog with title verb + body explanation + Cancel + confirm-with-destructive-variant action. Locked copy from UI-SPEC Q9 destructive table. Verb matches the action ('Retire item', 'Cancel event', 'Disable user') — never 'OK' or 'Yes'."
  - "Print-preview pattern (Plan 06): Dialog wraps a #print-label block + inline <style> with `@media print { body * { visibility: hidden } #print-label * { visibility: visible } }`. Call `window.print()` from a button inside the dialog. No PDF generation, no third-party print library."

requirements-completed:
  - INV-01
  - INV-02
  - INV-03
  - INV-04
  - INV-05
  - INV-06
  - INV-07
  - INV-08
  - INV-09
  - INV-10
  - AUD-02
  - AUD-04
  - REP-06
  - REP-07
  - NFR-05

# Metrics
duration: 8 min
completed: 2026-05-24
---

# Phase 1 Plan 06: Inventory Summary

**Full inventory CRUD shell: filterable + sortable DataTable list, admin-gated create + edit forms with INV-02 SKU-uniqueness enforcement, detail page with Tabs (Details + History) including real bwip-js QR label preview and `@media print` chrome-hide, destructive retire AlertDialog with UI-SPEC locked copy.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-24T15:06:29Z
- **Completed:** 2026-05-24T15:14:34Z
- **Tasks:** 3
- **Files created:** 11

## Accomplishments

- Built `/inventory` as a Server-Component shell handing off to the `InventoryTable` client island. The table composes the generic `DataTable` (Plan 03) with three filter keys (`category`, `lifecycle`, `lowStock`), a `Search name or SKU…` global filter, and four sortable columns per D-11 (name, sku, availableQty, lifecycleState) — `category` and `outQty` are explicitly non-sortable with a `// D-11: <col> is NOT sortable` audit comment.
- Filter predicate for the "Low stock only" toggle mirrors `selectLowStockItems` literally: `lifecycleState !== 'retired' AND lowStockThreshold > 0 AND availableQty <= lowStockThreshold AND !lowStockOrderedAt`. This guarantees the toolbar's filtered rows match the dashboard's `LowStockWidget` exactly — Phase 2 swaps both to a Firestore query helper without changing what the user sees.
- Empty state uses UI-SPEC locked copy (`"No items yet"` / `"Add your first inventory item to get started."`) with an `Add item` CTA that links to `/inventory/new`.
- Built `/inventory/new` and `/inventory/[itemId]/edit` as admin-gated Server-Component routes (`await requireAdmin()`). Both render the shared `ItemForm` client island.
- `ItemForm` uses **shadcn v4 `<Field>` primitives** (per Plans 01/04 decisions) with `react-hook-form` `register()` bound directly + `<Controller>` for the category Select. The form covers all 7 inputs from `ItemFormSchema`: name, sku, category, totalQty, unit, lowStockThreshold, photoUrl, notes.
- **INV-02 SKU uniqueness** enforced client-side via `getSnapshot().items.find(i => i.sku.toLowerCase() === values.sku.toLowerCase())` before calling `createItem` — on collision, sets a field-level error ("An item with this SKU already exists.") instead of submitting. The store mutator does not (and cannot, in Phase 1) re-validate, so this is the only gate.
- **INV-04 stock-adjust-is-Phase-2** enforced by disabling both `sku` and `totalQty` inputs when `mode === 'edit'` and explicitly excluding `totalQty` from the `updateItem` patch. The form comment documents the intent.
- Built `/inventory/[itemId]` as a Server-Component detail page using Next 16 `await params` + `selectItemById(getSnapshot(), itemId)` + `notFound()` on miss. Renders `<ItemDetail>` with a 4-card stock breakdown (Total / Available / Out / Damaged), Tabs (Details + History), and a row of admin/staff action buttons (Print label always; Edit + Retire admin-only).
- `ItemHistoryTab` is a client island that subscribes via `useMockStore + selectTransactionsForItem` and renders a chronological audit feed per **AUD-02**. Each row shows actor name + verb + qty + optional event link + the `actorRoleAtTimeOfAction` snapshot per **AUD-01** in the meta line.
- `LabelPreview` renders a real QR code via `bwipjs.toCanvas({ bcid: 'qrcode', text: sku, scale: 4 })`. Imports from `bwip-js/browser` (the canvas-using export). The canvas is rendered with `bg-white rounded` so it prints crisp on any device theme.
- `PrintLabelButton` wraps the canvas in a `Dialog` + an inline `<style>` block with `@media print { body * { visibility: hidden } #print-label * { visibility: visible } #print-label { position: absolute; inset: 0; ... } }`. Clicking Print calls `window.print()` — the browser's native print dialog handles the rest. No PDF generation in Phase 1.
- `RetireItemButton` uses `AlertDialog` with EXACT UI-SPEC Q9 locked copy: title `"Retire this item?"`, body `"It will be removed from active inventory and won't appear in scans or events. Past history is kept."`, confirm label `"Retire item"`. After confirming, calls `retireItem(itemId, actor)` → toast → `router.push('/inventory') + router.refresh()`. The button is hidden entirely for non-admin sessions (gate uses `useCurrentUser`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Inventory list page + InventoryTable feature component** — `203df5a` (feat)
2. **Task 2: Create + edit forms + ItemForm component (shared)** — `2425d5f` (feat)
3. **Task 3: Item detail page + history tab + label preview + retire button** — `461ab7c` (feat)

## Files Created/Modified

### Created — route files (4 files)

- `app/(app)/inventory/page.tsx` — `/inventory` list page Server-Component shell with admin-only `Add item` CTA
- `app/(app)/inventory/new/page.tsx` — `/inventory/new` admin-gated (`requireAdmin`) create form route
- `app/(app)/inventory/[itemId]/page.tsx` — `/inventory/[itemId]` detail route with `generateMetadata` for the title + `await params` + `notFound()`
- `app/(app)/inventory/[itemId]/edit/page.tsx` — `/inventory/[itemId]/edit` admin-gated edit form route

### Created — feature components (7 files)

- `components/feature/inventory/InventoryTable.tsx` — client island composing `DataTable` with filter keys + column defs + EmptyState + low-stock-mirror predicate
- `components/feature/inventory/ItemForm.tsx` — shared form for create + edit modes with v4 `<Field>` + rhf + Zod 4; INV-02 SKU uniqueness + INV-04 totalQty lockdown
- `components/feature/inventory/ItemDetail.tsx` — detail page composite: stock breakdown cards + Tabs (Details + History) + admin actions
- `components/feature/inventory/ItemHistoryTab.tsx` — client island subscribing to `selectTransactionsForItem` for chronological audit feed
- `components/feature/inventory/LabelPreview.tsx` — bwip-js canvas QR renderer
- `components/feature/inventory/PrintLabelButton.tsx` — Dialog with `@media print` chrome-hide CSS
- `components/feature/inventory/RetireItemButton.tsx` — AlertDialog with UI-SPEC Q9 locked copy

## Decisions Made

- **D-01-06-A:** ItemForm uses shadcn v4 `<Field>` primitives with rhf `register()` bound directly. Plan 01's deviation D-01-01-A discovered that the v3 `<Form>` / `<FormField>` Context wrapper is empty in the radix-nova v4 registry. Plan 04's D-01-04-B established the v4 form convention for all Phase 1 forms. This plan continues that convention.

- **D-01-06-B:** ItemForm uses `<Controller>` for the category Select. shadcn Select exposes an imperative `onValueChange` (Radix pattern) that doesn't compose with `register()`. Controller bridges the imperative API back into rhf's controlled-input model. Plans 07 (event status), 11 (resolve-missing reason), and 12 (invite-user role) follow this same pattern.

- **D-01-06-C:** After mutations call `router.push + router.refresh()`. The store mutation is synchronous and visible to client components via `useSyncExternalStore` immediately, but the destination page (e.g. `/inventory/[id]` after create) is a Server Component that reads `getSnapshot()` — `router.refresh()` forces the server tree to re-evaluate so the SSR'd HTML on the next navigation reflects the new state. Same pattern Plan 04 established for `PhaseOnePocRoleSwitcher`.

- **D-01-06-D:** InventoryTable's "Low stock only" filter predicate mirrors `selectLowStockItems` literally (lifecycleState != retired AND threshold > 0 AND availableQty <= threshold AND !lowStockOrderedAt). This guarantees the toolbar filter shows the EXACT same rows the dashboard's `LowStockWidget` shows. Phase 2 swaps both to a Firestore query helper that returns the same projection. Avoids the "two-source-of-truth" bug where the toolbar and the widget disagree.

- **D-01-06-E:** PrintLabelButton uses inline `<style>` for `@media print` CSS rather than a global stylesheet rule. Scope of effect is limited: the rule only takes effect when the dialog is open + the user invokes `window.print()`. Having it inline keeps the print behavior co-located with the component that owns it. Phase 2 can ship a global print-overrides stylesheet if multiple components need print-specific rules — until then, inline is simpler and easier to reason about.

- **D-01-06-F:** RetireItemButton uses the `variant="destructive"` prop on `AlertDialogAction`. The shadcn `AlertDialogAction` primitive exposes a `variant` prop that forwards to the wrapped `Button`. Using the prop is cleaner than ad-hoc className styling and keeps the destructive-tone rule centralized to UI-SPEC Q9.

- **D-01-06-G:** ItemForm's submit handler normalizes Zod-default fields (`unit`, `lowStockThreshold`, `notes`) via `values.field ?? default` before passing to the store mutator. The schema's `.default()` makes the rhf input type include `T | undefined` (Zod 4 inferred input behavior — the input shape allows undefined, the output shape applies the default at parse time). The store mutator's signature is strict (no undefined). Normalizing at the submit boundary is the canonical Zod 4 fix — preserves the schema's user-facing default while satisfying the mutator's typed contract.

## Deviations from Plan

The plan's example code snippets used a few patterns I had to swap out — these were anticipated in the carry-forward context from prior summaries (D-01-01-A, D-01-04-B). Documenting them here for completeness.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's ItemForm example used shadcn v3 `<Form>` / `<FormField>` Context wrapper that's empty in v4 radix-nova registry**

- **Found during:** Task 2 (drafting ItemForm against the plan's example code)
- **Issue:** The plan's `<action>` block for ItemForm imports `Form, FormField, FormItem, FormLabel, FormControl, FormMessage` from `@/components/ui/form`. Plan 01's deviation D-01-01-A discovered that the radix-nova v4 registry ships the `form` entry as empty — `components/ui/form.tsx` was never installed in this project. Plan 04 established the v4 `<Field>` convention for every Phase 1 form. Building with the plan's example would have failed `npm run build` immediately on the missing import.
- **Fix:** Rewrote `ItemForm.tsx` against the v4 `<Field>` + `<FieldLabel>` + `<FieldError>` pattern from `components/ui/field.tsx` with rhf `register()` bound directly + `<Controller>` for the category Select. Same composition shape as the Plan 04 login form.
- **Files modified:** components/feature/inventory/ItemForm.tsx
- **Verification:** `npx tsc --noEmit` exits 0; `npm run build` succeeds with the form route rendering correctly; `/inventory/new` returns HTTP 200 for admin sessions.
- **Committed in:** `2425d5f` (Task 2 commit)

**2. [Rule 1 - Bug] Initial submit handler passed Zod-default fields directly to the store mutator, causing TS2322**

- **Found during:** Task 2 (running `npx tsc --noEmit` after the first draft of `ItemForm`)
- **Issue:** `lib/schemas/item.ts` uses `.default()` on `unit`, `lowStockThreshold`, and `notes`. The Zod 4 inferred *input* type (`z.input<typeof ItemFormSchema>`) makes these fields `T | undefined` (they may be omitted; Zod applies the default at parse time). The store mutator's signature is strict — `unit: string`, `lowStockThreshold: number`, `notes: string`. Passing `values.unit` (typed `string | undefined`) into `createItem({unit: ...})` produced two `error TS2322: Type 'string | undefined' is not assignable to type 'string'.`
- **Fix:** Normalize at the submit boundary: `values.unit ?? "pcs"`, `values.lowStockThreshold ?? 0`, `values.notes ?? ""`. Applied to both the `create` and `edit` branches.
- **Files modified:** components/feature/inventory/ItemForm.tsx
- **Verification:** `npx tsc --noEmit` exits 0; defaults reach the store correctly.
- **Committed in:** `2425d5f` (Task 2 commit)

**3. [Rule 1 - Bug] Unused `eslint-disable-next-line no-console` directive in LabelPreview**

- **Found during:** Task 3 (running `npm run lint`)
- **Issue:** I added `// eslint-disable-next-line no-console` above the `console.error("[LabelPreview] bwipjs failed", err)` line out of caution. The project's ESLint config does not lint `console.*` calls (Next.js's default config allows them), so the disable directive itself triggered a warning: `Unused eslint-disable directive (no problems were reported from 'no-console')`. Lint exit code stayed 0, but the warning count was 2 (one new, plus the known TanStack warning from Plan 03).
- **Fix:** Removed the unused `// eslint-disable-next-line no-console` comment. The `console.error` call stays — it's an intentional dev-time diagnostic for when bwip-js fails to render a QR code.
- **Files modified:** components/feature/inventory/LabelPreview.tsx
- **Verification:** `npm run lint` exits 0 with only the known Plan-03 TanStack warning (1 warning total).
- **Committed in:** `461ab7c` (Task 3 commit — bundled with the file's initial creation since the lint fix happened before commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All three fixes preserve the plan's `<interfaces>` contracts and `<acceptance_criteria>` verbatim. Deviation 1 was a direct continuation of the Plan 01 stack reality + Plan 04 form convention (anticipated by the carry-forward context in this plan's prompt). Deviation 2 is a Zod 4 type-narrowing fix at the submit boundary — a Phase-2-relevant pattern (Server Actions will need the same normalization). Deviation 3 is hygiene. No scope creep — every file in `<files_modified>` of the plan frontmatter exists and matches its acceptance criteria.

## Authentication Gates

None — Phase 1 has no real authentication. The mock session cookie is checked via `requireAdmin()` (Plan 02 helper) at the layout/page level; the actor resolution for mutator calls uses `useCurrentUser` + `seedUsers.find(uid)` (Plan 05 pattern).

## Issues Encountered

None during planned work. All three deviations above were resolved automatically without escalation.

The plan's verification block referenced `bwip-js` library docs in `<read_first>`. I verified the package is installed (`node_modules/bwip-js/`) and that the `./browser` export resolves to the canvas-using ESM module (`dist/bwip-js.mjs`). The `bwipjs.toCanvas` API works as documented — no patch needed.

## User Setup Required

None — no external service configuration required. The bwip-js dependency is bundled and runs entirely client-side. No `.env.local` changes.

## Threat Flags

None — no new security-relevant surface introduced beyond what the plan's threat model already documented:

- Admin-only routes (`/inventory/new`, `/inventory/[id]/edit`) call `requireAdmin()` at the page level (T-04-02 mitigation, defense in depth on top of the layout-level `requireSession`).
- INV-02 SKU uniqueness is enforced client-side in Phase 1 via `getSnapshot().items.find`. In Phase 2 this becomes a Firestore transaction guard — the Phase 1 check is defense-in-depth UX. The plan's threat model accepts this Phase 1 limitation.
- bwip-js runs entirely client-side; no PII flows through the QR code (it encodes the SKU only).
- The Retire button is gated at three levels: (1) only rendered for admin role via `useCurrentUser` check, (2) action wrapped in AlertDialog requiring explicit confirmation, (3) Phase 2's Server Action will additionally enforce admin role server-side before mutating Firestore.

## Known Stubs

None — every component renders against real (mock) seed data and every link target resolves to a real route. The 4 routes (list/new/detail/edit) + 7 components have no placeholders, no "Coming soon" text, no null-passing components.

The only Phase-1-vs-Phase-2 boundaries are:
- INV-04 stock-adjust flow: the edit form's `totalQty` input is intentionally disabled and the `updateItem` patch excludes it. Phase 2 will ship a dedicated "Adjust stock" sub-flow that writes an `adjustment` transaction with a required reason. The Phase 1 edit form does not need to change for Phase 2 to work.
- Admin retire: in Phase 1 the `retireItem` mutator is synchronous and direct. Phase 2 swaps it for a Server Action that wraps a Firestore transaction. The `RetireItemButton.tsx` JSX does not change.
- LabelPreview: renders client-side via bwip-js. Phase 2 may add a server-side bulk-PDF export endpoint, but the per-item canvas rendering stays identical.

## Next Phase Readiness

- **Wave 3 inventory feature complete.** The inventory shell is fully functional against the mock store. Plans 07 (events) and 11 (reports) can now follow the same admin-gated-route + DataTable + Server-Component-detail + client-history-tab patterns established here.
- **Ready for Plan 07** (events list + detail): the events list will compose `useMockStore(s => s.events)` and the events DataTable wrapper will use the same column-def + filterKeys shape as InventoryTable. The "Cancel event" destructive confirm follows the same UI-SPEC Q9 AlertDialog pattern as RetireItemButton.
- **Ready for Plan 09** (check-out flow): scan-cart commits via `store.checkout` will re-render the inventory table's `outQty` + `availableQty` + `lifecycleState` columns automatically via useSyncExternalStore. The detail page's History tab will show the new checkout transactions on the next render.
- **Ready for Plan 10** (check-in flow): `store.checkin` mutations re-render the same surface; missing-item creation flows into Plan 11's `/reports/missing`.
- **Ready for Plan 11** (reports): the InventoryTable's URL-state + filter pattern is the template for `/reports/stock`, `/reports/out`, `/reports/history`, `/reports/missing`, `/reports/repurchase`. The "Low stock only" toggle predicate is the same as `/reports/repurchase`'s default view.
- **Ready for Plan 12** (users + settings): the admin-gated route pattern (`await requireAdmin()`) + AlertDialog destructive confirm pattern (Disable user, Retire user) carry over verbatim.
- **Phase 2 swap surface is minimal:** every route file's JSX stays verbatim. Phase 2 swaps:
  - The body of `lib/mock/store.ts` mutators (createItem/updateItem/retireItem) for Server Actions calling Firestore transactions.
  - The body of `lib/mock/selectors.ts` selectors (selectItemById, selectTransactionsForItem) for Firestore reads with `cache()` wrappers.
  - The actor-resolution pattern in ItemForm + RetireItemButton swaps from `seedUsers.find(session.uid)` to `verifySession()` inside the Server Action body.
  - bwip-js usage stays identical (client-side canvas rendering).
  - SKU uniqueness check moves from client `getSnapshot().items.find` to a server-side Firestore transaction `getDoc` that fails if an item with that SKU already exists.

---

*Phase: phase-kayinleong-01*
*Completed: 2026-05-24*

## Self-Check: PASSED

- All 11 created files exist on disk:
  - app/(app)/inventory/page.tsx
  - app/(app)/inventory/new/page.tsx
  - app/(app)/inventory/[itemId]/page.tsx
  - app/(app)/inventory/[itemId]/edit/page.tsx
  - components/feature/inventory/InventoryTable.tsx
  - components/feature/inventory/ItemForm.tsx
  - components/feature/inventory/ItemDetail.tsx
  - components/feature/inventory/ItemHistoryTab.tsx
  - components/feature/inventory/LabelPreview.tsx
  - components/feature/inventory/PrintLabelButton.tsx
  - components/feature/inventory/RetireItemButton.tsx
- All 3 task commits found in `git log --all`: `203df5a` (Task 1), `2425d5f` (Task 2), `461ab7c` (Task 3)
- Plan-level verification:
  - `npx tsc --noEmit` exits 0: PASS
  - `npm run build` (Next 16 Turbopack) exits 0: PASS — all 4 inventory routes registered (`/inventory`, `/inventory/[itemId]`, `/inventory/[itemId]/edit`, `/inventory/new` — all `ƒ (Dynamic)` because (app)/layout reads cookies)
  - `npm run lint` exits 0: PASS (1 unchanged Plan-03 TanStack React Compiler warning; no new warnings)
  - Runtime smoke test via `curl` against `next dev`:
    - `GET /inventory` (anon) → 307 → `/login` (Plan 04 role gate)
    - `GET /inventory` (admin cookie) → 200 with "Browse, filter, and manage" + "Add item" CTA
    - `GET /inventory/new` (admin) → 200; (staff) → 307 → /unauthorized (requireAdmin works)
    - `GET /inventory/AUD-MIC-01` (admin) → 200 with "Print label" + "Edit" + "Retire" + "Details" + "History" + stock-breakdown labels
    - `GET /inventory/AUD-MIC-01/edit` (admin) → 200; (staff) → 307 → /unauthorized
    - `GET /inventory/NOPE-NOT-A-SKU` → 404 (notFound works)
    - `GET /inventory?category=Audio` → narrows to 2 Audio matches, 0 Lighting matches in HTML
    - `GET /inventory?category=Marketing` → narrows to 2 Marketing matches, 0 Audio matches in HTML
- All Task 1 acceptance criteria pass (2 file existence + 8 grep + tsc + build).
- All Task 2 acceptance criteria pass (3 file existence + 7 grep + tsc).
- All Task 3 acceptance criteria pass (6 file existence + 9 grep + tsc + build).
- All 15 requirements (INV-01..10, AUD-02, AUD-04, REP-06, REP-07, NFR-05) satisfied at the UI level — Phase 2 wires the data layer underneath without changing the rendered surface.
