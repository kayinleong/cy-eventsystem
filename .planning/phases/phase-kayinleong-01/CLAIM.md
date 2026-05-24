# Claim: phase-kayinleong-01

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-05-24
- status: in-progress
- summary: UI POC — full UI shell for every route with mock data, no backend wiring

> **Status note (2026-05-25):** All 13 plans complete; all automated gates PASS. Status is held at
> `in-progress` pending the Phase 1 acceptance-demo human-verify checkpoint (manual
> click-through by the stakeholder). On approval, flip to `status: done` and commit.

## What will change

- Phase 1 UI design contract written to `.planning/phases/phase-kayinleong-01/01-UI-SPEC.md`
- All design tokens (spacing, typography, color, status palette) locked
- Copywriting contract locked (empty states, errors, destructive confirmations)
- Component/registry inventory restricted to shadcn official + listed libs
- Subsequent claims under this phase will implement the routes against this contract

## What has changed

All 13 plans complete (2026-05-24 → 2026-05-25). The full UI POC ships with mock data only,
zero Firebase calls, zero `.env.local` dependencies, and every route in the locked sitemap
navigable end-to-end.

**Wave 1 — Foundation:**

- **01-01 (stack-types-schemas):** Installed 9 runtime deps (next-themes, sonner,
  react-hook-form, @hookform/resolvers v5, zod v4, @tanstack/react-table, date-fns v4,
  @yudiel/react-qr-scanner, bwip-js) + 27 shadcn v4 components via CLI. Created
  `lib/types/*` (5 entity types) + `lib/schemas/*` (12 Zod 4 schemas using canonical
  `z.email()` / `z.url()`). _Commits: d8f9a6a, e5548bd._
- **01-02 (mock-data-store):** Seeded 30 items / 6 events / 5 users / ~80 transactions
  / 6 missing-item records. Built `lib/mock/store.ts` with 14 mutators (Object.freeze on
  every write per D-01-02-B), selectors, `useSyncExternalStore`-based hooks
  (`useMockStore`, `useCurrentUser`), and `lib/mock/cookie.ts` with dynamic
  `next/headers` import for server+client interop. _Commits: feacb89, 7d45c17._
- **01-03 (shell-primitives):** ThemeProvider + Toaster wiring, StatusBadge, QtyStepper,
  generic DataTable wrapper (with URL-synced pagination/sort/global-filter via
  `useUrlTableState`), EmptyState, PageHeader. _Commits: 0ed298d, 491ec34._

**Wave 2 — Auth spine:**

- **01-04 (auth-shell-role-gate):** 4 auth routes (`/login`, `/forgot-password`,
  `/set-password`, `/register` → 404 per AUTH-06). `(app)/layout.tsx` role-gate via
  `requireSession()`. AppSidebar + TopBar + UserMenu + MobileNavSheet + Breadcrumbs +
  SignOutButton + SeedUsersDisclosure + PhaseOnePocRoleSwitcher. _Commits: 4eac7cf,
  2d00a01._

**Wave 3 — Feature blocks:**

- **01-05 (dashboard):** `/` with 4 KPI cards (active events, items out, low stock,
  open missing) + 4 widgets (Active Events, Overdue Returns, Low Stock, Recent Activity).
  Actor-resolution pattern established here. _Commits: 539dc09, 6813762._
- **01-06 (inventory):** `/inventory` list + `/inventory/new` (admin) +
  `/inventory/[itemId]` detail with QR label (bwip-js client-side) + Retire AlertDialog
  + `/inventory/[itemId]/edit` (admin). _Commits: 203df5a, 2425d5f, 461ab7c._
- **01-07 (events):** `/events` list + `/events/new` (admin) + `/events/[eventId]`
  detail with tabs (assigned items + history) + Cancel reconciliation AlertDialog +
  `/events/[eventId]/edit` (admin OR team-lead per EVT-05). _Commits: 7fce96f, fed97f8,
  bed1059._
- **01-08 (scanner-and-scan-page):** `/scan` standalone scanner with mode toggle +
  `ScanSessionProvider` context + 6 reusable components in `components/feature/scan/`.
  Live camera + 5 decode formats (QR, Code 128, EAN-13, UPC-A, Data Matrix per CO-09).
  EventPickerDialog + ScanHeader + ManualEntryInput + ScanCartPanel + ScannerWidget.
  _Commits: 6370c32, 0133038, 267639b._
- **01-09 (checkout-flow):** `/events/[eventId]/checkout` per-event scoped scan flow
  (Server shell + Client island composing Plan 08's substrate). Status restriction:
  redirects to detail page if status !∈ {planned, active}. _Commit: f48fad0._
- **01-10 (checkin-flow):** `/events/[eventId]/checkin` with pre-populated lines,
  cross-bounded QtyStepper maxes (CI-04/CI-05/CI-06), MissingReasonSelect, render-time
  two-track merge avoiding `set-state-in-effect`. Accepts ANY event status (D-01-10-A
  — stragglers reconcilable post-event). _Commits: ff825eb, 9d7af22._
- **01-11 (reports):** 5 routes (`/reports/{stock,out,history,missing,repurchase}`) +
  ResolveMissingSheet (MIS-03 admin-only). 6-key URL-synced HistoryTable filter (REP-06).
  All reports accessible to staff; only mutator buttons admin-gated. _Commits: 21e550e,
  e1a12ac, 8306b6d, 1ee2b59._
- **01-12 (users-settings):** `/users` admin-only list + `/users/invite` admin-only
  full-page form + `/settings` shared (theme + admin-gated low-stock thresholds).
  Inline UserRoleSelectInline + DisableUserButton + InviteUserSheet. Established
  `useHasMounted` useSyncExternalStore hook + mutable-spread DataTable bridge +
  server-derived `isAdmin` prop pattern. _Commits: 10c4cb7, e40f30c._

**Files created:** 110+ across `app/(auth)/`, `app/(app)/`, `components/ui/`,
`components/feature/`, `lib/{mock,types,schemas,auth,hooks}/`. **Modified:**
`app/layout.tsx` (ThemeProvider + Toaster); deleted `app/page.tsx` per D-01-04-A so
`(app)/page.tsx` owns `/`.

**Sitemap surface confirmed by `npm run build` route table:** 22 routes total — /, /login,
/register (Next.js auto-emits the entry though we return notFound at request time per
AUTH-06), /forgot-password, /set-password, /unauthorized, /inventory + /inventory/new
+ /inventory/[itemId] + /inventory/[itemId]/edit, /events + /events/new +
/events/[eventId] + /events/[eventId]/edit + /events/[eventId]/checkout +
/events/[eventId]/checkin, /scan, /reports/{stock,out,history,missing,repurchase},
/users + /users/invite, /settings.

**Phase 1 REQ-IDs satisfied at UI/mock level:** All AUTH-01..10 (shell), INV-01..10
(shell), EVT-01..08 (shell), CO-01..10 (mock store atomic commits + scanner working),
CI-01..08 (mock store + form), MIS-01..04 (mock store + sheet), REP-01..07 (URL filters
+ pagination), RP-01..04 (widget + mark-ordered), SCN-01..06 (live camera + 5 formats +
torch + manual entry + permission errors), AUD-01..04 (audit feed components), and
the Phase-1 portions of NFR-01..05, NFR-08, NFR-09 (NFR-04 fully confirmed).

## Verification

Per global CLAUDE.md "Regression Prevention" — this section is the regression report.

### Automated gates (executed 2026-05-25 by orchestrator)

| Gate                                  | Result | Notes                                                                            |
| ------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                    | PASS   | Exit 0, no diagnostics (NFR-02)                                                  |
| `npm run lint`                        | PASS   | Exit 0, 0 errors; 1 known TanStack-table warning carried from Plan 03 (NFR-03)   |
| `npm run build`                       | PASS   | All 22 routes registered as either ƒ (Dynamic) or ○ (Static) (NFR-02)            |
| Anonymous gate test                   | PASS   | 10/10 protected routes return 307 → /login                                       |
| Admin gate test (u-admin-1)           | PASS   | 11/11 routes return 200                                                          |
| Staff gate test (u-staff-1)           | PASS   | Allowed: /, /scan, /inventory, /events, /reports/stock, /settings → 200; Admin-only: /inventory/new, /events/new, /users, /users/invite → 307 → /unauthorized (AUTH-10) |
| Event checkout status gate            | PASS   | planned/active/overdue → 200; completed/cancelled → 307 (D-01-09-B); missing → 404 |
| Event checkin status gate             | PASS   | All statuses → 200 per D-01-10-A; missing → 404                                  |
| `/register` returns 404               | PASS   | AUTH-06 enforced via notFound() at request time                                  |
| Dashboard content                     | PASS   | "Welcome back" + 4 KPI labels render; both active events listed                  |
| Login page content                    | PASS   | Email + Password + Sign in + Forgot password all render                          |
| Console errors during `next dev`      | PASS   | None observed during automated route navigation (NFR-05)                         |

### Manual click-through (PENDING — human-verify checkpoint)

The Phase 1 acceptance demo per `01-CONTEXT.md` `<specifics>` requires stakeholder
walk-through against the running dev server before status can flip to `done`. Awaiting
checkpoint approval.

### What was ruled out and why

- **Negative stock from scan-cart commits** — Ruled out by Plan 02 D-01-02-C
  (per-item aggregation before invariant assertion). Manual scan-add-twice in dev mode
  showed cart correctly blocked the over-commit; cart stayed intact on rejection
  (CO-05 + CO-06).
- **Anonymous access to mutator surface** — Ruled out by the (app) layout role gate
  test: anonymous /inventory/new, /events/new, /users, /users/invite all 307 → /login
  before reaching the page body.
- **Cross-event staff access** — Ruled out by EVT-08 check on the per-event Server
  shells: staff NOT in `event.allowedStaff` get 307 → /unauthorized on
  /events/[eventId]/checkout AND /events/[eventId]/checkin (Plans 09 + 10 verified).
- **Real Firebase accidentally invoked** — Ruled out by grep over the diff: no
  `lib/firebase/` directory exists; no `import { initializeApp }` anywhere;
  `package.json` contains no `firebase*` dep. NFR-04 confirmed.
- **`.env.local` accidentally relied on** — Ruled out by grep over the diff for
  `process.env.NEXT_PUBLIC_FIREBASE_` and `process.env.FIREBASE_` — zero hits.
- **Set-state-in-effect lint violations** — Ruled out by Plan 12's consolidating
  `useHasMounted` hook (D-01-12-A) + D-01-02-A/D-01-03-A/D-01-10-C anti-pattern fixes.
  Only known remaining warning is the pre-existing Plan-03 TanStack `incompatible-library`
  warning on react-table's non-memoizable accessor (documented, out of scope for Phase 1).
- **Mock immutability invariants** — Ruled out by Plan 02 D-01-02-B (every mutator
  inlines its own `Object.freeze`). 15 freeze sites audited; defensive checkout/checkin
  walkthrough in Wave 3 plans never observed a frozen-object mutation.

### Regression scope (per global CLAUDE.md)

- Only **new files added**; **existing files modified:** `app/layout.tsx` (added
  ThemeProvider + Toaster), `app/page.tsx` (deleted per D-01-04-A so `(app)/page.tsx`
  owns `/` without route conflict).
- No Firebase calls introduced (NFR-04 confirmed).
- No `.env.local` dependencies (NFR-04 confirmed).
- Mock store mutators preserve immutability invariants verified by manual
  checkout/checkin walkthrough across all 12 prior plans.
- Phase 2 swap surface preserved: every component's store-mutator call has a 1:1
  Server-Action signature ready for replacement; selectors + types + hook signatures
  stay verbatim per Plan 02 design.

### Acceptance demo (PENDING human-verify)

Acceptance criteria per `01-CONTEXT.md` `<specifics>`:

1. Admin signs in → creates an item → creates an event → switches to staff via the
   PhaseOnePocRoleSwitcher → scans items into a check-out cart → commits the cart →
   switches back to admin → resolves a missing-item record → notices low-stock widget
   reflects the changes. End-to-end, no Firebase touched.
2. No console errors at any step.
3. Dark mode looks correct on every visited route.

Awaiting stakeholder approval at the checkpoint returned by the executor agent.
