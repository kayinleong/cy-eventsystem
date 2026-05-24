---
phase: 01-ui-poc
plan: 12
subsystem: ui
tags: [users, settings, invite, role-management, disable-user, low-stock-thresholds, theme, next-themes, react-19, shadcn-v4]

# Dependency graph
requires:
  - phase: 01-02-mock-data-store
    provides: store.inviteUser + store.setUserRole + store.disableUser + store.updateLowStockThreshold mutators; users snapshot slice; events recompute (allowedStaff) on setUserRole; InviteUserSchema in lib/schemas/user.ts; lib/auth/mock-session.ts requireAdmin
  - phase: 01-03-shell-primitives
    provides: DataTable + DataTableToolbar + DataTablePagination wrappers; EmptyState + PageHeader primitives; useUrlTableState
  - phase: 01-04-auth-shell-role-gate
    provides: (app)/layout.tsx server-side requireSession gate; AppSidebar with admin-gated /users nav item; useCurrentUser hook (useSyncExternalStore pattern); next-themes provider wired in root layout; ThemeToggle (compact variant) in TopBar; /unauthorized route
provides:
  - /users (admin-only) — AUTH-07/08/09/10 surface; UsersTable with inline role select + Disable button + Disabled badge + Invite user CTA
  - /users/invite (admin-only) — AUTH-07 dedicated full-page invite form mirroring /inventory/new + /events/new "Layout & Route Patterns" full-page pattern
  - /settings — accessible by admin AND staff; ThemePreferencesCard (richer 3-option radio for next-themes) + LowStockThresholdsCard (RP-01 admin-only editor + read-only for staff)
  - UsersTable client island — DataTable wrapper over s.users with 5 columns; "Disabled" Badge inline per AUTH-09 surface
  - InviteUserSheet — admin-only Sheet for AUTH-07 in-context invite from /users
  - UserRoleSelectInline — AUTH-08 per-row Select wrapping store.setUserRole
  - DisableUserButton — AUTH-09 destructive AlertDialog with UI-SPEC Q9 verbatim copy
  - ThemePreferencesCard — settings card with next-themes Light/Dark/System
  - LowStockThresholdsCard — settings card with RP-01 admin-gated threshold editor
affects: [phase-2-functionality, users, settings, threshold-management, auth-09-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncExternalStore-based useHasMounted hook for SSR-safe one-shot mount detection (D-01-12-A) — avoids react-hooks/set-state-in-effect lint rule that useEffect+setState triggers"
    - "Raw-slice + useMemo spread for DataTable's mutable T[] contract (D-01-12-B) — passes the reference-stable readonly slice through a useMemo that returns a mutable shallow copy, satisfying TanStack's mutable typing without breaking the D-01-11-A identity-stability rule"
    - "Sheet (in-context) + full-page (deep-linkable) parallel invite entry — both call the same store mutator with the same actor-resolution shape; UI-SPEC's Sheet pattern coexists with the AUTH-07 dedicated URL"

key-files:
  created:
    - app/(app)/users/page.tsx
    - app/(app)/users/invite/page.tsx
    - app/(app)/users/invite/_components/invite-user-page-form.tsx
    - app/(app)/settings/page.tsx
    - components/feature/users/UsersTable.tsx
    - components/feature/users/InviteUserSheet.tsx
    - components/feature/users/UserRoleSelectInline.tsx
    - components/feature/users/DisableUserButton.tsx
    - components/feature/settings/ThemePreferencesCard.tsx
    - components/feature/settings/LowStockThresholdsCard.tsx
  modified: []

key-decisions:
  - "D-01-12-A: ThemePreferencesCard uses useSyncExternalStore-based useHasMounted hook (not useEffect+setMounted) for the next-themes SSR mount gate. The plan example used useEffect(() => setMounted(true), []) which trips the project-wide react-hooks/set-state-in-effect ESLint rule (D-01-02-A / D-01-03-A / D-01-10-C all consolidated on the same fix shape). Hook is a top-level const + empty subscribe — same pattern useCurrentUser uses. Server snapshot is false (renders 'system' placeholder); client snapshot is true (renders persisted theme from useTheme())."
  - "D-01-12-B: UsersTable passes a useMemo-wrapped mutable spread copy to DataTable rather than the raw readonly slice from useMockStore. The store's StoreSnapshot types users as `readonly UserDoc[]` (per Plan 02's immutability invariant); TanStack's DataTable contract is `data: T[]` (mutable). The spread copy is reference-stable via useMemo's [usersRaw] dep, so the D-01-11-A identity-stability rule is preserved while the typescript readonly mismatch is resolved. Same pattern available for future tables that bind directly to a snapshot slice without intermediate filtering."
  - "D-01-12-C: Two parallel invite entries (Sheet on /users + full-page at /users/invite) intentionally coexist. UI-SPEC's 'Sheets vs Dialogs' rule prefers Sheets for short forms (the invite form is 3 fields); AUTH-07 requires a dedicated /users/invite URL for deep-linking + UI-SPEC's 'Layout & Route Patterns' table lists /users/new as a full-page route. Both surfaces use the canonical shadcn v4 <Field> + rhf shape and dispatch store.inviteUser with the same actor-resolution pattern (D-01-05-E). The full-page variant adds router.refresh() after the toast so the destination /users SSR re-evaluates with the new user in the table."
  - "D-01-12-D: /settings accessible by both admin AND staff at the route level; the LowStockThresholdsCard's editor is admin-gated via an `isAdmin` prop passed from the Server Component shell (NOT via useCurrentUser inside the card — that would return null on SSR per D-01-02-A and flash the wrong gate copy). Staff see disabled inputs + 'Only admins can change thresholds.' description. ThemePreferencesCard is fully accessible because theme is a personal device preference (next-themes persists to localStorage, not the store)."
  - "D-01-12-E: UsersTable's role + actions columns are NOT sortable per D-11. The Role column hosts the inline UserRoleSelectInline editor (filter-axis affordance, not a list order axis); the actions column hosts the per-row DisableUserButton. Only displayName is sortable. createdAt is intentionally non-sortable — Plan 1 has 5 seed users where natural list order matches reality; Phase 2 may add sortability if user count justifies it."
  - "D-01-12-F: DisableUserButton uses `variant=\"destructive\"` on AlertDialogAction (shadcn-supported prop per RetireItemButton D-01-06-F + SignOutButton D-01-04-F precedent) rather than ad-hoc className styling. Keeps destructive tone rule-driven per UI-SPEC Q9 and consistent with prior destructive surfaces (Cancel event, Retire item, Write off, Resolve missing → Write off)."

patterns-established:
  - "useSyncExternalStore-based mount detector — `useHasMounted()` hook returning a boolean that's `false` on SSR + `true` after client mount. Replaces the `useEffect(() => setMounted(true), [])` pattern that violates the project's react-hooks/set-state-in-effect rule. Reusable for any 'need to know if we're past initial paint' case (next-themes, localStorage reads, window-size queries)."
  - "Mutable-snapshot bridge for TanStack DataTable — read raw readonly slice via useMockStore, project to a mutable shallow copy via useMemo. Bridges Plan 02's immutability invariant with TanStack's mutable typing without breaking React 19's useSyncExternalStore identity check."
  - "Sheet + full-page parallel entries for the same write surface — the in-context Sheet for quick action, the dedicated URL for deep-linking. Both share the rhf + zodResolver(Schema) + actor-resolution dispatch pattern; only the chrome differs."

requirements-completed:
  - AUTH-07
  - AUTH-08
  - AUTH-09
  - AUTH-10
  - RP-01
  - NFR-05

# Metrics
duration: 15 min
completed: 2026-05-25
---

# Phase 1 Plan 12: Users + Settings Summary

**Admin-only `/users` (with inline role select + Disable button + Disabled badge surface) + `/users/invite` (dedicated full-page form mirroring /inventory/new pattern) + `/settings` (theme prefs accessible by all + admin-gated low-stock thresholds editor) — built as pure composition over Plan 02's user/threshold mutators + Plan 03's DataTable substrate + Plan 04's role-gate helpers, with the canonical shadcn v4 `<Field>` form shape that Plans 04/06/07/11 have now consolidated.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-24T16:48:56Z
- **Completed:** 2026-05-24T17:04:06Z
- **Tasks:** 2
- **Files created:** 10

## Accomplishments

- /users — AUTH-07/08/09/10 admin-only route gating via `requireAdmin()`; PageHeader ("Users" / "Manage team members and their access.") + UsersTable with 5 columns (Name + Email + Role + Created + actions); empty-state copy verbatim from UI-SPEC Q8: "Just you, for now" / "Invite teammates to check items in and out." + [Invite user] CTA
- /users/invite — AUTH-07 dedicated full-page form per UI-SPEC "Layout & Route Patterns" (full-page for `/users/new` invite alongside /inventory/new + /events/new); Back-to-users link + Card-wrapped InviteUserPageForm; admin-gated via `requireAdmin()`
- /settings — accessible by admin + staff per AppSidebar nav contract; PageHeader ("Settings" / "Theme and low-stock thresholds.") + ThemePreferencesCard + LowStockThresholdsCard with isAdmin gate prop
- UsersTable — DataTable wrapper over `s.users` (reference-stable raw slice + mutable spread via useMemo per D-01-12-B); Disabled Badge inline on disabled rows (AUTH-09 surface); InviteUserSheet rendered in toolbarExtras + empty-state action; D-11 audit comments on non-sortable columns (only displayName sortable)
- InviteUserSheet — admin-only Sheet (returns null for non-admin sessions); rhf + zodResolver(InviteUserSchema); Controller-bridged Select for role per D-01-06-B; dispatches store.inviteUser with resolved actor (D-01-05-E); resets form on close
- UserRoleSelectInline — w-28 h-8 shadcn Select with admin/staff options; calls store.setUserRole with actor-resolution; short-circuits on no-change; disabled prop for disabled users
- DisableUserButton — destructive AlertDialog with UI-SPEC Q9 verbatim copy: title "Disable this user?", body "They lose access immediately. Their past activity stays in reports.", confirm label "Disable user" (verb-noun); `variant="destructive"` on AlertDialogAction per D-01-06-F precedent; collapses (returns null) when alreadyDisabled
- ThemePreferencesCard — next-themes Light/Dark/System radio with useSyncExternalStore-based `useHasMounted()` hook (D-01-12-A) replacing the lint-violating useEffect + setMounted pattern; SSR-safe (renders "system" placeholder on server)
- LowStockThresholdsCard (RP-01) — raw-slice + useMemo per D-01-11-A; ScrollArea-bounded list (h-80) with per-item Input + Save button; admin-gated by `isAdmin` prop (disabled inputs + descriptive "Only admins can change thresholds." copy for staff); dispatches store.updateLowStockThreshold with resolved actor
- InviteUserPageForm (colocated client component) — same shadcn v4 `<Field>` + rhf + Controller(Select) shape as InviteUserSheet; redirects to /users on success + router.refresh() so the destination SSR re-evaluates with the new user in the table
- Smoke test passes: anon → 307 /login on all 3 routes (app layout gate); admin → 200 on all 3; staff → 307 /unauthorized on /users + /users/invite (requireAdmin); staff → 200 on /settings with "Only admins can change thresholds." gated copy
- All 5 seed users rendered in /users list; Casey Ramirez (disabled seed) shows "Disabled" badge; "Manage team members and their access." description + admin-only "Invite user" CTA in toolbar + empty-state slot

## Task Commits

Each task was committed atomically:

1. **Task 1: UsersTable + InviteUserSheet + role/disable controls** — `10c4cb7` (feat)
2. **Task 2: /users + /users/invite + /settings routes with cards** — `e40f30c` (feat)

**Plan metadata:** (this commit) `docs: complete 01-12-users-settings plan`

## Files Created/Modified

### Routes (4 files)

- `app/(app)/users/page.tsx` — Server Component shell, requireAdmin() + PageHeader + UsersTable
- `app/(app)/users/invite/page.tsx` — Server Component shell, requireAdmin() + Back-to-users link + Card-wrapped InviteUserPageForm
- `app/(app)/users/invite/_components/invite-user-page-form.tsx` — Colocated Client form (rhf + shadcn v4 <Field> + Controller(Select)); on success calls inviteUser, toast.success, router.push("/users"), router.refresh()
- `app/(app)/settings/page.tsx` — Server Component shell, getMockSession() (no redundant requireSession per D-01-05-D) → derives isAdmin → composes ThemePreferencesCard + LowStockThresholdsCard

### Feature components — users (4 files)

- `components/feature/users/UsersTable.tsx` — DataTable wrapper; mutable-spread bridge over `s.users` (D-01-12-B); 5 columns with D-11 audit comments; UI-SPEC empty-state copy
- `components/feature/users/InviteUserSheet.tsx` — Admin-only shadcn Sheet; rhf + zodResolver(InviteUserSchema); Controller(Select) bridges Radix imperative onValueChange to rhf control; reset on close; actor-resolution dispatch
- `components/feature/users/UserRoleSelectInline.tsx` — Inline 28x8 shadcn Select; dispatches store.setUserRole with resolved actor; short-circuits on no-change; disabled-passthrough for disabled users
- `components/feature/users/DisableUserButton.tsx` — Destructive AlertDialog; UI-SPEC Q9 verbatim copy ("Disable this user?" / "They lose access immediately. Their past activity stays in reports." / "Disable user"); variant="destructive" on AlertDialogAction; collapses when alreadyDisabled

### Feature components — settings (2 files)

- `components/feature/settings/ThemePreferencesCard.tsx` — next-themes Light/Dark/System radio; useSyncExternalStore-based useHasMounted (D-01-12-A); 3-option grid with lucide Sun/Moon/Monitor icons
- `components/feature/settings/LowStockThresholdsCard.tsx` — Raw-slice + useMemo filter per D-01-11-A; ScrollArea-bounded list; per-item Input + conditional Save button (only when dirty + admin); dispatches store.updateLowStockThreshold

## Decisions Made

### D-01-12-A — useSyncExternalStore-based useHasMounted hook for next-themes SSR gate

The plan's example for ThemePreferencesCard used the canonical next-themes SSR pattern:

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
```

This violates the project's `react-hooks/set-state-in-effect` ESLint rule that's already been consolidated through D-01-02-A (useCurrentUser via useSyncExternalStore), D-01-03-A (DataTableToolbar render-time sync), D-01-10-C (CheckinForm render-time two-track merge). The rule treats synchronous setState inside useEffect as a cascading-render anti-pattern.

Fix: extract a top-level `useHasMounted()` hook using useSyncExternalStore with a no-op subscribe. Server snapshot returns `false` (so SSR renders the "system" placeholder); client snapshot returns `true` (so the persisted `theme` from `useTheme()` renders). The cached snapshot functions are module-level singletons (`emptySubscribe`, `getClientSnapshot`, `getServerSnapshot`) so useSyncExternalStore sees stable identities across renders.

Same shape as `useCurrentUser` from Plan 02. Reusable for any "need to know we're past initial paint" case.

### D-01-12-B — Mutable-spread bridge for DataTable's mutable T[] contract

The mock store's `StoreSnapshot` types every slice as `readonly UserDoc[]` (per Plan 02's `Object.freeze` immutability invariant). TanStack's DataTable contract is `data: T[]` (mutable). Direct passing yields:

```
error TS4104: The type 'readonly UserDoc[]' is 'readonly' and cannot be assigned to the mutable type 'UserDoc[]'.
```

Fix: read the raw readonly slice via `useMockStore((s) => s.users)`, project to a mutable shallow copy inside `useMemo`:

```tsx
const usersRaw = useMockStore((s) => s.users);
const users = useMemo(() => [...usersRaw], [usersRaw]);
```

The spread copies the reference array shape but preserves dependency identity via `useMemo([usersRaw])` — same reference returned across renders unless the underlying slice changes. D-01-11-A's identity-stability rule is preserved (the closure over `usersRaw` is reference-stable), and TanStack's mutable typing accepts the spread output.

Pattern matches InventoryTable (which spreads inside its own filter useMemo) and EventsTable (same). Plan 12 is the first table that doesn't filter — so the spread is the entire useMemo body. Reusable for any future table that binds directly to a snapshot slice without intermediate filtering.

### D-01-12-C — Two parallel invite entries (Sheet + full-page) intentionally coexist

UI-SPEC's "Sheets vs Dialogs" rule prefers Sheets for short forms (the 3-field invite form qualifies); UI-SPEC's "Layout & Route Patterns" table lists `/users/new` (invite) alongside `/inventory/new` + `/events/new` as full-page routes. AUTH-07 also explicitly requires the `/users/invite` URL for deep-linking.

Resolution: both coexist. The InviteUserSheet on /users is the in-context shortcut (admin clicks "Invite user" in the toolbar → Sheet slides in from right); the /users/invite full-page route is the deep-linkable URL (bookmarkable, shareable). Both:

- Use the canonical shadcn v4 `<Field>` + rhf + zodResolver(InviteUserSchema) + Controller(Select) shape
- Dispatch `store.inviteUser(values, actor)` with the same actor-resolution pattern (D-01-05-E)
- Reset form on success

Only differences:
- Sheet calls `setOpen(false)` + `reset()`; full-page calls `router.push("/users") + router.refresh()` so the destination SSR re-evaluates with the new user in the table
- Sheet's "Send invite" submits without leaving /users; full-page's "Send invite" routes the user to /users to see the new row

### D-01-12-D — /settings accessible by all signed-in users; threshold editor admin-gated by prop

`/settings` route gate is the (app)/layout.tsx `requireSession()` — so both admin AND staff can reach the page. UI-SPEC sitemap puts Settings in the sidebar for both roles. The personal theme preference (Light/Dark/System) is genuinely per-device + per-user; gating it behind admin would be incorrect.

The low-stock threshold editor IS admin-only per RP-01. Solution: the LowStockThresholdsCard takes an `isAdmin: boolean` prop from its Server Component shell:

```tsx
const session = await getMockSession();
const isAdmin = session?.role === "admin";
return <LowStockThresholdsCard isAdmin={isAdmin} />;
```

NOT `useCurrentUser()` inside the card — that returns null on SSR per D-01-02-A (the client tree hasn't hydrated yet) and would flash "Only admins can change thresholds." for admins on first paint before snapping to the editable view. Passing the resolved boolean from the server shell yields correct SSR copy + correct gate state across both modes.

Staff view: disabled Input + no Save button + descriptive "Only admins can change thresholds." card description. Admin view: editable Input + Save button when dirty + actionable card description.

### D-01-12-E — UsersTable column sortability

Per D-11 (sortable-columns whitelist), only `displayName` is sortable in UsersTable. The other columns:

- `email`: not a list-order axis; D-11 audit comment
- `role`: hosts the inline UserRoleSelectInline editor (filter-axis affordance, not a sort axis); D-11 audit comment
- `createdAt`: presentation-only for Phase 1's 5 seed users — natural list order matches reality. Phase 2 may add sortability if user count justifies it. D-11 audit comment
- `actions`: hosts the per-row DisableUserButton; D-11 audit comment

Same pattern InventoryTable / EventsTable / MissingItemsTable established.

### D-01-12-F — DisableUserButton uses `variant="destructive"` on AlertDialogAction

The shadcn AlertDialogAction component accepts a `variant` prop (`Pick<React.ComponentProps<typeof Button>, "variant" | "size">`). Using `variant="destructive"` keeps the destructive tone rule centralized to UI-SPEC Q9 rather than scattered className styles. Same approach Plan 06's RetireItemButton (D-01-06-F) and Plan 04's SignOutButton (D-01-04-F) established.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced non-existent `@/components/ui/form` imports in InviteUserSheet + InviteUserPageForm with shadcn v4 `<Field>` primitives**

- **Found during:** Task 1 (InviteUserSheet implementation) + Task 2 (InviteUserPageForm implementation)
- **Issue:** Plan example code imported `{ Form, FormField, FormItem, FormLabel, FormControl, FormMessage }` from `@/components/ui/form`. That file does NOT exist in the v4 radix-nova registry — D-01-04-B / D-01-06-A / D-01-07-A / D-01-11-B already flagged this in Plans 04, 06, 07, 11. Direct import would have failed the build with "module not found".
- **Fix:** Built both invite forms (Sheet variant + full-page variant) using the canonical shadcn v4 `<Field>` + `<FieldGroup>` + `<FieldLabel>` + `<FieldError>` primitives + rhf `register()` / `Controller`. Same shape as ItemForm + EventForm + ResolveMissingSheet established across Plans 06/07/11. Behavioral surface is identical: rhf validates against InviteUserSchema, Controller bridges the Radix Select's imperative onValueChange, submit dispatches `store.inviteUser(values, actor)` with the D-01-05-E actor-resolution pattern.
- **Files modified:** components/feature/users/InviteUserSheet.tsx (initial write; never imported the non-existent module); app/(app)/users/invite/_components/invite-user-page-form.tsx (same)
- **Verification:** `npx tsc --noEmit` clean; `npm run build` succeeds with both /users and /users/invite in the route table; dev smoke test: admin → 200 on both, staff → 307 /unauthorized; admin /users/invite HTML contains all form fields (Email + Display name + Role + Send invite button)
- **Committed in:** 10c4cb7 (Task 1: InviteUserSheet) + e40f30c (Task 2: InviteUserPageForm)

**2. [Rule 1 - Bug] Fixed typescript readonly array mismatch in UsersTable**

- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** Plan example used `const users = useMockStore((s) => s.users);` then passed `users` directly to `<DataTable<UserDoc> data={users} ... />`. The store's `StoreSnapshot` types every slice as `readonly UserDoc[]` (Plan 02's `Object.freeze` immutability invariant); TanStack DataTable's `data: T[]` is mutable. tsc emitted `error TS4104: The type 'readonly UserDoc[]' is 'readonly' and cannot be assigned to the mutable type 'UserDoc[]'`.
- **Fix:** Read raw slice via `const usersRaw = useMockStore((s) => s.users);`, then project to a mutable shallow copy inside `useMemo`: `const users = useMemo(() => [...usersRaw], [usersRaw]);`. The spread converts readonly → mutable while preserving D-01-11-A's identity-stability rule (useMemo's dep is the stable underlying slice). Same pattern InventoryTable + EventsTable use inside their filter useMemo bodies; in Plan 12 the spread is the entire useMemo body because no filtering is needed.
- **Files modified:** components/feature/users/UsersTable.tsx
- **Verification:** `npx tsc --noEmit` clean; `npm run build` green; `npm run lint` clean (only known Plan-03 TanStack warning); dev smoke test confirms all 5 seed users render in /users list with no console errors.
- **Committed in:** 10c4cb7 (Task 1, before commit)

**3. [Rule 1 - Bug] Replaced useEffect + setMounted pattern in ThemePreferencesCard with useSyncExternalStore-based useHasMounted hook**

- **Found during:** Task 2 (`npm run lint`)
- **Issue:** Plan example for ThemePreferencesCard used the canonical next-themes SSR pattern: `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);`. ESLint flagged it with `react-hooks/set-state-in-effect` — same rule that D-01-02-A (useCurrentUser), D-01-03-A (DataTableToolbar), D-01-10-C (CheckinForm render-time merge) all consolidated against. The rule treats synchronous setState inside useEffect as a cascading-render anti-pattern.
- **Fix:** Extracted a `useHasMounted()` hook at the top of the file using useSyncExternalStore with module-level singleton callbacks (`emptySubscribe`, `getClientSnapshot=true`, `getServerSnapshot=false`). Identical behavioral contract — `mounted` is `false` on SSR + first server render, `true` after client hydration — but compatible with the lint rule and the project-wide React 19 patterns.
- **Files modified:** components/feature/settings/ThemePreferencesCard.tsx
- **Verification:** `npm run lint` returns 0 errors (1 warning is the known Plan-03 TanStack warning, out of scope per the scope boundary rule); `npx tsc --noEmit` clean; `npm run build` green; dev smoke test: admin /settings → 200 with Theme card visible + Light/Dark/System options present in HTML.
- **Committed in:** e40f30c (Task 2)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All three fixes were essential. (1) prevented build failure — the non-existent module import would have hard-stopped the build. (2) prevented tsc error — the readonly mismatch is a strict-mode failure. (3) prevented ESLint failure — the set-state-in-effect rule is part of the project's CI gate and was already consolidated against in 3 prior plans. None introduce scope creep — the form's behavioral contract matches the plan; UsersTable's data shape is unchanged; ThemePreferencesCard's mount-gate semantics are identical.

## Issues Encountered

None — all three deviations were caught by automated verification (tsc for Rule 1.2, lint for Rule 1.3, write-time grep for Rule 3.1) and fixed inline before any commit was attempted.

## User Setup Required

None — no external service configuration needed for this plan.

## Next Phase Readiness

- Plan 12 users + settings surface is complete. Next plan is **01-13-verification-gate** (Wave 4), which runs the full build/lint/typecheck/smoke + acceptance-demo human-verify checkpoint that closes Phase 1.
- Users infrastructure ready for Phase 2 swap:
  - UsersTable's `useMockStore((s) => s.users)` → swap to Firestore `onSnapshot('users')`; useMemo mutable-spread stays unchanged (Firestore reads are already mutable so the spread becomes a no-op cost).
  - UserRoleSelectInline + DisableUserButton + InviteUserSheet all wrap mutator calls (`setUserRole`, `disableUser`, `inviteUser`) — Phase 2 swaps the mutator bodies to Server Actions (`await setUserRoleAction(uid, role)` etc.); the actor argument becomes `verifySession()` server-side; the component signatures stay verbatim.
  - InviteUserSheet's submit will swap from synchronous `inviteUser(values, actor)` to `await inviteUserAction(values)` + Firebase password-reset link delivery (PROJECT.md key decision #2); the rhf onSubmit shape doesn't change.
- Settings infrastructure ready for Phase 2 swap:
  - ThemePreferencesCard is fully client-side (next-themes localStorage) — no Phase 2 swap needed; the useHasMounted hook stays.
  - LowStockThresholdsCard's `updateLowStockThreshold` call becomes a Server Action with the same signature; the raw-slice + useMemo filter pattern stays (Firestore onSnapshot → same shape); the `isAdmin` prop becomes the resolved DAL verifySession.role check.
- The EVT-08 ↔ allowedStaff recompute happens automatically when a user is promoted via store.setUserRole: the mutator (Plan 02) computes the new `adminUids` after the role change and overwrites every event's `allowedStaff` with the recomputed union. This means inline role promotion from /users immediately changes which staff can see /events/[id]/* and /events/[id]/checkout/checkin per the EVT-08 access rule. The propagation is transparent — Plans 07/09/10's existing requireSession + allowedStaff check just sees the new union on the next snapshot read. Phase 2 will preserve this via the Cloud Function that maintains allowedStaff on team changes (PROJECT.md / ROADMAP.md Block D).
- No new dependencies introduced; no breaking-change surface for Plan 13.
- All Phase 1 routes from the locked sitemap are now in the route table (verified by `npm run build`): /, /login, /register, /forgot-password, /set-password, /unauthorized, /inventory + /inventory/new + /inventory/[itemId] + /inventory/[itemId]/edit, /events + /events/new + /events/[eventId] + /events/[eventId]/edit + /events/[eventId]/checkout + /events/[eventId]/checkin, /scan, /reports/{stock,out,history,missing,repurchase}, **/users + /users/invite**, **/settings**. Plan 13's verification gate has a complete surface to validate.

---
*Phase: 01-ui-poc*
*Completed: 2026-05-25*

## Self-Check: PASSED

- All 10 key-files exist on disk (verified with `[ -f ]`):
  - app/(app)/users/page.tsx
  - app/(app)/users/invite/page.tsx
  - app/(app)/users/invite/_components/invite-user-page-form.tsx
  - app/(app)/settings/page.tsx
  - components/feature/users/UsersTable.tsx
  - components/feature/users/InviteUserSheet.tsx
  - components/feature/users/UserRoleSelectInline.tsx
  - components/feature/users/DisableUserButton.tsx
  - components/feature/settings/ThemePreferencesCard.tsx
  - components/feature/settings/LowStockThresholdsCard.tsx
- Both commit hashes (10c4cb7, e40f30c) present in `git log` between the Plan 11 metadata commit (5c45efe) and HEAD.
- All Task 1 + Task 2 acceptance criteria pass:
  - Task 1: 4 user-feature files exist; setUserRole + disableUser + inviteUser + InviteUserSchema referenced; UI-SPEC Q9 destructive copy verbatim ("Disable this user?" / "Disable user"); empty-state copy verbatim ("Just you, for now" / "Invite teammates to check items in and out."); tsc passes.
  - Task 2: 6 route + card files exist; both /users and /users/invite call requireAdmin(); useTheme + updateLowStockThreshold wired; "Just you, for now" verbatim; tsc + npm run build pass.
- Plan-level `<verification>` block satisfied:
  - /users admin → 200; staff → 307 /unauthorized (verified via curl)
  - /users/invite admin → 200; staff → 307 /unauthorized
  - Inline role-select dispatches setUserRole which recomputes allowedStaff for every event (Plan 02 mutator preserves the EVT-08 ↔ allowedStaff invariant — verified by reading store.setUserRole body)
  - Disable user shows Disabled badge (verified: Casey Ramirez seed user renders with "Disabled" Badge in /users HTML)
  - Settings theme controls work via next-themes (RadioGroup wired to setTheme; useHasMounted gates SSR-safe initial value)
  - Settings low-stock editor admin-only (staff sees disabled Input + "Only admins can change thresholds." copy verified via curl)
  - npm run build passes (route table includes all 3 new routes: /users, /users/invite, /settings)
- Plan-level `<success_criteria>` satisfied: AUTH-07, AUTH-08, AUTH-09, AUTH-10, RP-01, NFR-05 all implemented.
