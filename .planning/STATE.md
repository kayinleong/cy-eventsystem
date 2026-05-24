# STATE — cy-eventsystem

**Project:** cy-eventsystem
**Owner:** kayinleong
**Current milestone:** v1
**Last updated:** 2026-05-24 (Phase 1 Plan 01-04 executed — 4/13 plans complete)

---

## Phase tracker

| Phase | ID | Status | Started | Completed |
|-------|----|----|---------|-----------|
| 1 | `phase-kayinleong-01` (UI POC) | In progress (4/13 plans complete) | 2026-05-24 | — |
| 2 | `phase-kayinleong-02` (Functionality) | Not started | — | — |

## Current focus

**Next step:** Execute plan 01-05 (`01-05-dashboard-PLAN.md`) — Wave 3 dashboard: `(app)/page.tsx` (`/`) renders 4 KPI cards (total items, active events, overdue, missing) + 4 widgets (active events list, low-stock alerts, overdue returns, recent activity). Also `app/(app)/loading.tsx`, `app/(app)/error.tsx`, `app/(app)/not-found.tsx`. Wave 3 plans (05-12) can render in parallel since they all depend only on the now-complete Waves 1+2.

**Last session:** Phase 1 Plan 01-04 (Auth Shell + Role Gate) executed in 7 min, 2 atomic commits (4eac7cf + 2d00a01). Built the Wave 2 auth + role-gate spine: 4 routes in the `(auth)` group with centered card shell — `/login` (rhf + Zod 4 + shadcn v4 `<Field>`, looks up against seedUsers per D-08, rejects disabled users with the same error message as wrong password per T-04-04, writes mock_session via writeMockSessionClient on success), `/forgot-password` (toast + redirect to /login), `/set-password` (toast + redirect), `/register` (notFound() per AUTH-06); plus the seed-users disclosure (`PHASE 1 ONLY` marker, <details> with click-to-fill via native input events). Built `(app)/layout.tsx` as a Server Component role-gate via `requireSession()` (Plan 02) composing `<AppSidebar role={session.role}/>` + `<TopBar session={session}/>` + max-w-[1400px] main wrapper. Built `(app)/unauthorized/page.tsx` (D-07 landing using EmptyState + ShieldAlert). Built five shell components — AppSidebar (md+ persistent rail, AUTH-10 admin gating on Users nav, usePathname active-link with strict `/`-equality), MobileNavSheet (`<md` Sheet drawer mirror), TopBar (sticky header with backdrop blur), UserMenu (avatar DropdownMenu with displayName/email + theme controls + role switcher + sign-out), Breadcrumbs (auto-derived from pathname segments). Built two auth components — PhaseOnePocRoleSwitcher (`PhaseOnePoc` filename signals removal; useCurrentUser + writeMockSessionClient + router.refresh()) and SignOutButton (AUTH-05; clearMockSessionClient + redirect). Deleted `app/page.tsx` — `(app)/page.tsx` (Plan 05) will own `/`. 3 deviations auto-fixed (Rule 1/3): plan's example used shadcn v3 `<Form>`/`<FormField>` wrapper which is empty in v4 radix-nova registry → rewrote all three forms against v4 `<Field>`/`<FieldLabel>`/`<FieldError>` with rhf `register()` bound directly; ESLint `no-unused-vars` warnings on `_values` parameter in forgot/set-password no-op handlers → renamed to `values` + `void values;` reference + documenting comment; Breadcrumbs `<span>` inside `<ol>` violated semantic HTML → switched to `<span className="contents">` so the children participate in the parent layout as direct `<li>` siblings. `npm run build` (Next 16 Turbopack) + `tsc --noEmit` + `npm run lint` all green. Runtime smoke test via `curl` against `next dev`: /login 200, /forgot-password 200, /set-password 200, /register 404, /unauthorized 307→/login (confirms anonymous role gate). Resume file: `.planning/phases/phase-kayinleong-01/01-05-dashboard-PLAN.md`.

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

## Performance metrics

| Plan | Duration | Tasks | Files | Commits |
|------|----------|-------|-------|---------|
| 01-01 | 9 min | 2 | 41 | d8f9a6a, e5548bd |
| 01-02 | 18 min | 2 | 11 | feacb89, 7d45c17 |
| 01-03 | 7 min | 2 | 14 | 0ed298d, 491ec34 |
| 01-04 | 7 min | 2 | 19 | 4eac7cf, 2d00a01 |

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

## Open clarifications (carried into Phase 2 planning)

These do not block Phase 1 but should be answered before Phase 2 work begins in earnest:

1. Existing barcodes the customer needs to scan vs all-new labels?
2. Expected inventory volume? (Affects index strategy + listener cost.)
3. Email delivery: Firebase built-in for invites + low-stock — sufficient, or need SendGrid?
4. Photo storage scope: item photos? Damage attachments? Affects Storage rules + CDN.
5. `next-firebase-auth-edge` v1.12 stability — validate with a 1-day spike at start of Phase 2.
