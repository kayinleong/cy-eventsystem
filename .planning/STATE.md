# STATE — cy-eventsystem

**Project:** cy-eventsystem
**Owner:** kayinleong
**Current milestone:** v1
**Last updated:** 2026-05-24 (Phase 1 Plan 01-05 executed — 5/13 plans complete)

---

## Phase tracker

| Phase | ID | Status | Started | Completed |
|-------|----|----|---------|-----------|
| 1 | `phase-kayinleong-01` (UI POC) | In progress (5/13 plans complete) | 2026-05-24 | — |
| 2 | `phase-kayinleong-02` (Functionality) | Not started | — | — |

## Current focus

**Next step:** Execute plan 01-06 (`01-06-inventory-PLAN.md`) — Wave 3 inventory list + detail + new + edit. `/inventory` is the master list (DataTable from Plan 03 + `selectItems` filter by category / lifecycle / low-stock + free-text search per INV-07); `/inventory/[id]` is the detail page with stock breakdown + chronological audit feed (AUD-02) + QR-label print preview (INV-10); `/inventory/new` and `/inventory/[id]/edit` are admin-only forms (requireAdmin from Plan 02). Wave 3 plans (06-12) can render in parallel since they all depend only on the now-complete Waves 1+2 + the now-complete dashboard reference implementation from 01-05.

**Last session:** Phase 1 Plan 01-05 (Dashboard) executed in 5 min, 2 atomic commits (539dc09 + 6813762). Built the Wave 3 dashboard surface: Server-Component shell at `app/(app)/page.tsx` (greets user by first name via `getMockSession().displayName.split(" ")[0]`) composing 5 client widgets in `components/feature/dashboard/`. KpiCards renders 4 hero metrics (Active events, Items checked out, Low stock, Open missing) in a responsive 2-col / 4-col grid using `selectActiveEvents` / `selectLowStockItems` / `selectOpenMissing` + an inline `s.items.reduce(outQty)` reduction. ActiveEventsWidget lists `selectActiveEvents` with StatusBadge via central `statusToTone` mapping (links to `/events/[id]`). LowStockWidget lists `selectLowStockItems` with an **admin-only** inline "Mark as ordered" button — calls `markLowStockOrdered` from the mock store with the actor resolved from `useCurrentUser` + `seedUsers.find(u => u.uid === session.uid)`; sonner toast on success/error. OverdueReturnsWidget lists `selectOverdueEvents` (EVT-07; seed contains "Marketing Pop-Up Booth" endDate 2026-05-22) with amber Overdue badge + link straight to `/events/[id]/checkin` (the recovery path). RecentActivityFeed lists `selectRecentActivity(20)` with type-colored StatusBadge + actor name + verb + qty + item/event links + the AUD-01 `actorRoleAtTimeOfAction` snapshot in the meta line; scrolls inside an `h-80` ScrollArea. **Zero deviations** — plan was written precisely against Plans 02/03/04 contracts and every snippet compiled and ran on first try. Smoke test via `curl` against `next dev`: `GET /` (anon) → 307 → /login (Plan 04 role gate); `GET /` (admin cookie) → 200 (63 KB) with "Welcome back, Alex" + 4 KPI labels + both active event names + Overdue badge + 20 activity rows including `role: admin` / `role: staff` AUD-01 snapshots all rendering correctly. `npm run build` (Next 16 Turbopack — `/` is `ƒ (Dynamic)`) + `tsc --noEmit` + `npm run lint` all green. Resume file: `.planning/phases/phase-kayinleong-01/01-06-inventory-PLAN.md`.

## Decisions (accumulated)

- **D-01-01-A:** Use shadcn v4 `<Field>` primitives for form composition. The legacy v3 `<Form>` / `<FormField>` Context wrapper has been removed from the radix-nova registry (entry exists but is empty). Plans 04, 06, 07, 12 must compose forms via `<Field>` / `<FieldLabel>` / `<FieldError>` and bind react-hook-form's `register` / `control` directly.
- **D-01-01-B:** Pin `react-day-picker` to v9. Shadcn's `calendar.tsx` references `classNames.table` which was removed in v10. Pin avoids paste-editing registry code per CLAUDE.md.
- **D-01-01-C:** Use Zod 4 canonical `z.email()` and `z.url()` top-level constructors instead of the deprecated `z.string().email()` / `z.string().url()` chains.
- **D-01-01-D:** `@hookform/resolvers` is v5.4.0 (not the v3 the plan listed). v5 is the only version that supports the React 19 + Zod 4 stack we shipped.
- **D-01-02-A:** `useCurrentUser` uses `useSyncExternalStore`, not `useEffect + useState`. React 19's `react-hooks/set-state-in-effect` ESLint rule flags synchronous `setState` inside `useEffect` as a cascading-render anti-pattern. The canonical React 19 pattern for syncing a non-React mutable source (`document.cookie`) into the component tree is `useSyncExternalStore` with a cached snapshot via JSON-key equality.
- **D-01-02-B:** All 14 store mutators inline their own `Object.freeze` rather than delegating through a shared wrapper. Makes the per-mutator immutability invariant trivially auditable (15 freeze sites: 14 mutators + 1 initial state).
- **D-01-02-C:** `checkout` aggregates cart lines by `itemId` before stock validation (Map-based). Without aggregation, a cart with two lines of the same item could pass per-line check yet violate the invariant on commit. `checkin` uses the same per-item aggregation pattern for outQty reduction.
- **D-01-02-D:** Mock `cookie.ts` uses dynamic `import("next/headers")` inside async server functions so a single module is importable from both server and client contexts (client consumers never invoke server functions, so the dynamic import never runs in browser bundles).
- **D-01-03-A:** `DataTableToolbar` re-syncs local input state from the parent's `globalFilter` prop using the React 19 canonical "previous value" render-time sync pattern, NOT `useEffect` + `setLocal`. Same anti-pattern family that Plan 02's `useCurrentUser` hit — React 19's `react-hooks/set-state-in-effect` rule flags synchronous setState inside effects. Store a `lastSyncedGlobal` sentinel in `useState`; if `globalFilter !== lastSyncedGlobal` during render, call `setLastSyncedGlobal(globalFilter)` + `setLocal(globalFilter)` directly in render. React's reconciler treats this as a render-time update and re-renders immediately without triggering the lint rule. Plans 06/07/10/11 should be aware when wiring any local table/form state from props.
- **D-01-03-B:** `useUrlTableState`'s `filterKeys` array is serialized to a `|`-joined string before the `useMemo` deps. If a consumer passes `filterKeys={['category','status']}` inline, the array identity changes every render and `useMemo` never memoizes. Strings are interned, so identical content always reaches the same dependency identity. Filter keys are static per call site by contract (Plans 06/07/10/11 each pass a fixed list).
- **D-01-03-C:** `DataTable` pagination chrome always renders (D-10) — even on empty data or filtered-to-zero. The empty state slot is rendered inside the table body via `<TableCell colSpan>` so the toolbar above and pagination below stay in their canonical positions. Two-tier empty precedence: source-empty (`data.length === 0`) renders the `emptyState` prop; filtered-empty renders "No results." inline.
- **D-01-03-D:** `DomainStatus` enum includes the missing-status value `'open'` → destructive tone. UI-SPEC marks `missing` as destructive; a `MissingItemDoc.status='open'` row is by definition the destructive case at the row level. Once resolved (`found` / `writtenOff`) the row collapses to muted tone.
- **D-01-03-E:** `DataTable` column visibility state lives in component state, NOT the URL. Toggling columns is an ephemeral user preference; URL-syncing it would pollute the back stack with every checkbox toggle. Pagination / sort / filters DO sync (REP-06's "shareable view" axes); column visibility is intentionally not.
- **D-01-04-A:** Delete `app/page.tsx` entirely; do NOT leave a stub redirect at root. Two pages at `/` would be a Next.js route-conflict error. The cleanest layout: `(app)/page.tsx` (Plan 05) owns `/`, and the role gate in `(app)/layout.tsx` handles unauth → `/login` via `requireSession()`. Verified via `curl` — anonymous request to `/unauthorized` returns 307 → /login.
- **D-01-04-B:** Form composition for all Phase 1 auth + entity forms uses shadcn v4 `<Field>` with rhf `register()` bound directly. Exact pattern: `<Field data-invalid={!!errors.X}><FieldLabel htmlFor="X">...</FieldLabel><Input id="X" {...register("X")} aria-invalid={!!errors.X}/><FieldError errors={errors.X ? [{message: errors.X.message}] : undefined}/></Field>`. `noValidate` on the `<form>` so browser native validation never competes with rhf+zod. Plans 06/07/08/12 must follow this exact shape.
- **D-01-04-C:** LoginForm rejects disabled users (AUTH-09) with the same error message as wrong password ("Wrong email or password.") per UI-SPEC error copy + T-04-04 mitigation. Separate "account disabled" copy would leak account-existence.
- **D-01-04-D:** PhaseOnePocRoleSwitcher uses `useCurrentUser()` (the useSyncExternalStore hook from Plan 02) for the radio value but reads the cookie fresh via `readMockSessionClient()` at flip time. Belt-and-braces — the cookie is source of truth, the hook is the render-time view. Short-circuits on `current.role === role` to avoid redundant writes.
- **D-01-04-E:** SeedUsersDisclosure uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` + `dispatchEvent('input', {bubbles: true})` to set form values, NOT rhf Context. Decouples the disclosure file from the form file — Phase 2 deletes the disclosure wholesale without touching the form.
- **D-01-04-F:** SignOutButton uses `variant="destructive"` on `DropdownMenuItem` (a shadcn-supported prop) rather than ad-hoc className styling. Keeps destructive tone rule-driven per UI-SPEC Q9.
- **D-01-05-A:** Dashboard widget files follow the project convention from Plans 02 + 04 — comment header block ABOVE the `"use client"` directive (Next.js's directive scanner accepts comments before directives). The plan's literal acceptance criterion ("start with `\"use client\";`") is interpreted as "have the directive in the file header before any code", not "on line 1". Same convention used in lib/hooks/use-mock-store.ts, components/feature/shell/AppSidebar.tsx, and every (auth) form file.
- **D-01-05-B:** KpiCards `itemsOut` uses an inline `s.items.reduce((sum, i) => sum + i.outQty, 0)` instead of going through a dedicated selector. Plan 02's seed-data invariant guarantees `sum(item.outQty) == sum(open-checkout qty across active+overdue events)` so the inline reduce is equivalent to summing across `selectItemsOut()` but cheaper. If Phase 2 changes the invariant, add `selectTotalItemsOut(s)` to lib/mock/selectors.ts as a single-point swap.
- **D-01-05-C:** OverdueReturnsWidget rows link to `/events/[id]/checkin` (Plan 10), NOT `/events/[id]` (Plan 07's detail). Dashboard's job is recovery — sending the user to detail adds a click before the check-in action. Plan 07 will preserve cross-discoverability with a "Start check-in" CTA on the detail page.
- **D-01-05-D:** Dashboard route uses `getMockSession()` (not `requireSession()`) for the greeting. The `(app)/layout.tsx` role gate from Plan 04 already enforced auth, so session is guaranteed present at render time. Using `getMockSession()` directly avoids a redundant cookie read + redirect path. The greeting handles a defensive `null` case with `"there"` fallback.
- **D-01-05-E:** LowStockWidget's "Mark as ordered" button is admin-only at the UI level (AUTH-10 / RP-04). Widget reads `useCurrentUser()` and gates on `session?.role === "admin"`. Defense-in-depth — Phase 2's `markLowStockOrdered` Server Action will also enforce admin role server-side via `requireAdmin()` before mutating Firestore.

## Performance metrics

| Plan | Duration | Tasks | Files | Commits |
|------|----------|-------|-------|---------|
| 01-01 | 9 min | 2 | 41 | d8f9a6a, e5548bd |
| 01-02 | 18 min | 2 | 11 | feacb89, 7d45c17 |
| 01-03 | 7 min | 2 | 14 | 0ed298d, 491ec34 |
| 01-04 | 7 min | 2 | 19 | 4eac7cf, 2d00a01 |
| 01-05 | 5 min | 2 | 6  | 539dc09, 6813762 |

## Notes

- Repo was pre-initialized by user with `npx create-next-app` (Next 16.2.6) and `npx shadcn init` (v4 radix-nova/neutral) before GSD bootstrap.
- One shadcn component already installed: `components/ui/button.tsx`.
- `.env.local` does not exist and is not needed until Phase 2 Block A.
- No git history before this initialization commit.
- Per global CLAUDE.md, the owner-slug is `kayinleong` (derived from `ka.yin.leong`).
- All claim IDs and commit prefixes use the `phase-kayinleong-NN` / `quick-kayinleong-NNN` form.
- Phase 1 mock data layer (Plan 02) is Phase-2-swap-ready: Phase 2 swaps the body of `lib/mock/store.ts` (subscribe → onSnapshot, mutators → Server Actions) and the cookie decoder in `lib/mock/cookie.ts` — selectors + types + hook signatures stay verbatim.
- Phase 1 UI shell primitives (Plan 03) are Phase-2-swap-ready: every primitive in `components/ui/`, `components/feature/status/`, `components/feature/inventory/`, `components/feature/table/`, and the URL-state hooks in `lib/hooks/` are pure client-side and have no dependency on the mock store — Phase 2 reuses them verbatim with Firestore-backed selectors.
- Phase 1 auth spine (Plan 04) is now in place: `(auth)/layout.tsx` + 4 auth routes; `(app)/layout.tsx` role-gates via `requireSession()`; AppSidebar/TopBar/UserMenu/MobileNavSheet/Breadcrumbs compose the authenticated shell. Wave 3 plans (05-12) render their pages as `children` of `(app)/layout.tsx` — no per-page shell logic needed. Admin-only routes (Plans 06/07/12) call `requireAdmin()` from `lib/auth/mock-session.ts` (Plan 02) and bounce staff to `/unauthorized`.
- Phase 1 dashboard (Plan 05) is now in place at `app/(app)/page.tsx` with 5 client widgets in `components/feature/dashboard/`. Every widget reads via a named selector from `lib/mock/selectors.ts` (no inline filtering) and subscribes via `useSyncExternalStore` so any Wave 3 mutator's effect (checkout, checkin, resolveMissing, markLowStockOrdered) re-renders the dashboard automatically. The actor-resolution pattern for client-component-to-store-mutator calls is established here: `session = useCurrentUser(); actor = seedUsers.find(u => u.uid === session.uid); mutator(args, actor)`. Plans 06+ that expose inline store-mutator buttons should copy this shape.

## Open clarifications (carried into Phase 2 planning)

These do not block Phase 1 but should be answered before Phase 2 work begins in earnest:

1. Existing barcodes the customer needs to scan vs all-new labels?
2. Expected inventory volume? (Affects index strategy + listener cost.)
3. Email delivery: Firebase built-in for invites + low-stock — sufficient, or need SendGrid?
4. Photo storage scope: item photos? Damage attachments? Affects Storage rules + CDN.
5. `next-firebase-auth-edge` v1.12 stability — validate with a 1-day spike at start of Phase 2.
