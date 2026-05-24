# STATE — cy-eventsystem

**Project:** cy-eventsystem
**Owner:** kayinleong
**Current milestone:** v1
**Last updated:** 2026-05-24 (Phase 1 Plan 01-02 executed — 2/13 plans complete)

---

## Phase tracker

| Phase | ID | Status | Started | Completed |
|-------|----|----|---------|-----------|
| 1 | `phase-kayinleong-01` (UI POC) | In progress (2/13 plans complete) | 2026-05-24 | — |
| 2 | `phase-kayinleong-02` (Functionality) | Not started | — | — |

## Current focus

**Next step:** Execute plan 01-03 (`01-03-shell-primitives-PLAN.md`) — ThemeProvider/Toaster wiring, StatusBadge, QtyStepper, generic DataTable wrapper with URL sync, EmptyState, PageHeader. Wave 1 parallel-safe with plan 01-02 (now complete).

**Last session:** Phase 1 Plan 01-02 (Mock Data Store) executed in 18 min, 2 atomic commits (feacb89 + 7d45c17). Built the Phase 1 data substrate: 5 seed files (5 users / 30 items / 6 events / 80 transactions / 6 missing-items) with full cross-reference integrity, in-memory store at `lib/mock/store.ts` with 14 atomic mutators (CO-04/05/06 atomic checkout, CI-05..08 partial check-in with damaged + missing branches, MIS-03/04 resolve, EVT-06 cancel-reconcile, AUTH-07/08/09 user management, RP-01/04 low-stock), 15 pure selectors at `lib/mock/selectors.ts`, server+client cookie helpers (`lib/mock/cookie.ts`), server auth helpers (`lib/auth/mock-session.ts` with `requireAdmin` D-07 strict gate), and 2 client hooks (`use-mock-store`, `use-current-user` — both using `useSyncExternalStore`). 4 deviations auto-fixed (Rule 1/2): React 19 set-state-in-effect lint flagged `useCurrentUser` → refactored to `useSyncExternalStore` with cached snapshot; Object.freeze count threshold required inlining freeze in 3 wrapper mutators (count now 15); plan's `checkout` had per-line stock check that double-counted same-item cart lines → added Map-based aggregation; plan's `checkin` outQty math needed per-item aggregation. `npm run build` (Next 16 Turbopack) + `tsc --noEmit` + `npm run lint` all green. Resume file: `.planning/phases/phase-kayinleong-01/01-03-shell-primitives-PLAN.md`.

## Decisions (accumulated)

- **D-01-01-A:** Use shadcn v4 `<Field>` primitives for form composition. The legacy v3 `<Form>` / `<FormField>` Context wrapper has been removed from the radix-nova registry (entry exists but is empty). Plans 04, 06, 07, 12 must compose forms via `<Field>` / `<FieldLabel>` / `<FieldError>` and bind react-hook-form's `register` / `control` directly.
- **D-01-01-B:** Pin `react-day-picker` to v9. Shadcn's `calendar.tsx` references `classNames.table` which was removed in v10. Pin avoids paste-editing registry code per CLAUDE.md.
- **D-01-01-C:** Use Zod 4 canonical `z.email()` and `z.url()` top-level constructors instead of the deprecated `z.string().email()` / `z.string().url()` chains.
- **D-01-01-D:** `@hookform/resolvers` is v5.4.0 (not the v3 the plan listed). v5 is the only version that supports the React 19 + Zod 4 stack we shipped.
- **D-01-02-A:** `useCurrentUser` uses `useSyncExternalStore`, not `useEffect + useState`. React 19's `react-hooks/set-state-in-effect` ESLint rule flags synchronous `setState` inside `useEffect` as a cascading-render anti-pattern. The canonical React 19 pattern for syncing a non-React mutable source (`document.cookie`) into the component tree is `useSyncExternalStore` with a cached snapshot via JSON-key equality.
- **D-01-02-B:** All 14 store mutators inline their own `Object.freeze` rather than delegating through a shared wrapper. Makes the per-mutator immutability invariant trivially auditable (15 freeze sites: 14 mutators + 1 initial state).
- **D-01-02-C:** `checkout` aggregates cart lines by `itemId` before stock validation (Map-based). Without aggregation, a cart with two lines of the same item could pass per-line check yet violate the invariant on commit. `checkin` uses the same per-item aggregation pattern for outQty reduction.
- **D-01-02-D:** Mock `cookie.ts` uses dynamic `import("next/headers")` inside async server functions so a single module is importable from both server and client contexts (client consumers never invoke server functions, so the dynamic import never runs in browser bundles).

## Notes

- Repo was pre-initialized by user with `npx create-next-app` (Next 16.2.6) and `npx shadcn init` (v4 radix-nova/neutral) before GSD bootstrap.
- One shadcn component already installed: `components/ui/button.tsx`.
- `.env.local` does not exist and is not needed until Phase 2 Block A.
- No git history before this initialization commit.
- Per global CLAUDE.md, the owner-slug is `kayinleong` (derived from `ka.yin.leong`).
- All claim IDs and commit prefixes use the `phase-kayinleong-NN` / `quick-kayinleong-NNN` form.
- Phase 1 mock data layer is now complete and Phase-2-swap-ready: Phase 2 swaps the body of `lib/mock/store.ts` (subscribe → onSnapshot, mutators → Server Actions) and the cookie decoder in `lib/mock/cookie.ts` — selectors + types + hook signatures stay verbatim.

## Open clarifications (carried into Phase 2 planning)

These do not block Phase 1 but should be answered before Phase 2 work begins in earnest:

1. Existing barcodes the customer needs to scan vs all-new labels?
2. Expected inventory volume? (Affects index strategy + listener cost.)
3. Email delivery: Firebase built-in for invites + low-stock — sufficient, or need SendGrid?
4. Photo storage scope: item photos? Damage attachments? Affects Storage rules + CDN.
5. `next-firebase-auth-edge` v1.12 stability — validate with a 1-day spike at start of Phase 2.
