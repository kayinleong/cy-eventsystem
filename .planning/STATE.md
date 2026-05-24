# STATE — cy-eventsystem

**Project:** cy-eventsystem
**Owner:** kayinleong
**Current milestone:** v1
**Last updated:** 2026-05-24 (Phase 1 Plan 01-03 executed — 3/13 plans complete)

---

## Phase tracker

| Phase | ID | Status | Started | Completed |
|-------|----|----|---------|-----------|
| 1 | `phase-kayinleong-01` (UI POC) | In progress (3/13 plans complete) | 2026-05-24 | — |
| 2 | `phase-kayinleong-02` (Functionality) | Not started | — | — |

## Current focus

**Next step:** Execute plan 01-04 (`01-04-auth-shell-role-gate-PLAN.md`) — Wave 2 auth spine: `/login`, `/forgot-password`, `/set-password`, `/register` 404, `(app)/layout.tsx` role gate, sidebar, top bar, breadcrumbs, role switcher. Depends on Wave 1 (now complete).

**Last session:** Phase 1 Plan 01-03 (Shell Primitives + DataTable System) executed in 7 min, 2 atomic commits (0ed298d + 491ec34). Built the Phase 1 UI shell primitives that every Wave 2+ plan composes against: wired `app/layout.tsx` with `next-themes` ThemeProvider + Sonner Toaster + Geist fonts + `min-h-svh` body + `suppressHydrationWarning` per next-themes; created the theme client wrapper (`components/ui/theme-provider.tsx`) and Sun/Moon/Monitor toggle (`components/ui/theme-toggle.tsx`); UI-SPEC `EmptyState` (`py-16` centered stack) + `PageHeader` (Heading-M + action slot); cva-based `StatusBadge` with 5 UI-SPEC tones (green/blue/amber/muted/destructive) + central `statusToTone` + `statusToLabel` mapping; 44px-touch-target `QtyStepper` per WCAG 2.5.5 AAA; URL-state hooks (`useDebouncedValue` 250ms per D-12 + `useUrlTableState` per D-09/D-10/D-11/D-12); and the generic TanStack v8 `DataTable` system (DataTable + Toolbar + Pagination + ViewOptions) with REP-07 default 50 rows/page and always-on pagination chrome (D-10). 2 deviations auto-fixed (Rule 1/2): React 19 `set-state-in-effect` lint blocked the toolbar's parent→local resync effect → replaced with the React 19 canonical "previous value" render-time sync pattern (same fix family as Plan 02's `useCurrentUser`); `useUrlTableState` `useMemo` deps used raw `filterKeys` array reference → serialized to `|`-joined string so inline-literal arrays don't re-trigger every render. `npm run build` (Next 16 Turbopack) + `tsc --noEmit` + `npm run lint` all green (1 informational warning about TanStack Table React Compiler incompatibility — known, no action). Resume file: `.planning/phases/phase-kayinleong-01/01-04-auth-shell-role-gate-PLAN.md`.

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

## Notes

- Repo was pre-initialized by user with `npx create-next-app` (Next 16.2.6) and `npx shadcn init` (v4 radix-nova/neutral) before GSD bootstrap.
- One shadcn component already installed: `components/ui/button.tsx`.
- `.env.local` does not exist and is not needed until Phase 2 Block A.
- No git history before this initialization commit.
- Per global CLAUDE.md, the owner-slug is `kayinleong` (derived from `ka.yin.leong`).
- All claim IDs and commit prefixes use the `phase-kayinleong-NN` / `quick-kayinleong-NNN` form.
- Phase 1 mock data layer is now complete and Phase-2-swap-ready: Phase 2 swaps the body of `lib/mock/store.ts` (subscribe → onSnapshot, mutators → Server Actions) and the cookie decoder in `lib/mock/cookie.ts` — selectors + types + hook signatures stay verbatim.
- Phase 1 UI shell primitives (Plan 03) are also Phase-2-swap-ready: every primitive in `components/ui/`, `components/feature/status/`, `components/feature/inventory/`, `components/feature/table/`, and the URL-state hooks in `lib/hooks/` are pure client-side and have no dependency on the mock store — Phase 2 reuses them verbatim with Firestore-backed selectors.

## Open clarifications (carried into Phase 2 planning)

These do not block Phase 1 but should be answered before Phase 2 work begins in earnest:

1. Existing barcodes the customer needs to scan vs all-new labels?
2. Expected inventory volume? (Affects index strategy + listener cost.)
3. Email delivery: Firebase built-in for invites + low-stock — sufficient, or need SendGrid?
4. Photo storage scope: item photos? Damage attachments? Affects Storage rules + CDN.
5. `next-firebase-auth-edge` v1.12 stability — validate with a 1-day spike at start of Phase 2.
