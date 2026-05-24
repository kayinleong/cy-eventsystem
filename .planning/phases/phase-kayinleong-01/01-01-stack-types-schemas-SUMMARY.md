---
phase: phase-kayinleong-01
plan: 01
subsystem: ui
tags: [shadcn, radix-nova, tailwind-v4, react-19, next-16, zod-4, react-hook-form, types, schemas]

# Dependency graph
requires:
  - phase: phase-kayinleong-01 init
    provides: components.json (radix-nova/neutral), button.tsx, lib/utils.ts cn helper
provides:
  - All 9 Phase-1 runtime npm dependencies installed and pinned
  - 27 shadcn registry components scaffolded via CLI (+ field, + input-group transitive)
  - 6 entity types in lib/types/ mirroring ARCHITECTURE.md Firestore schemas
  - 6 Zod schemas in lib/schemas/ with refinements (qty invariant, date order, password match, CI-04 missing reason)
  - Zod 4 canonical API surface (z.email, z.url) established
  - react-day-picker pinned at v9 (shadcn registry calendar.tsx compat fix)
affects:
  - phase-kayinleong-01 plan 02 (mock data + store will import all 6 types)
  - phase-kayinleong-01 plan 03 (shell primitives will use shadcn UI components)
  - phase-kayinleong-01 plans 04-12 (every form imports a schema; every list imports a type)
  - phase-kayinleong-02 entirely (types + schemas are reused; only data layer swaps)

# Tech tracking
tech-stack:
  added:
    - next-themes ^0.4.6
    - sonner ^2.0.7
    - react-hook-form ^7.76.1
    - "@hookform/resolvers ^5.4.0"
    - zod ^4.4.3
    - "@tanstack/react-table ^8.21.3"
    - date-fns ^4.3.0
    - "@yudiel/react-qr-scanner ^2.6.0"
    - bwip-js ^4.10.1
    - react-day-picker ^9 (pinned — shadcn registry compat)
  patterns:
    - "Form pattern: react-hook-form + zodResolver + shadcn v4 <Field>/<FieldLabel>/<FieldError> primitives (not the v3 <Form>/<FormField> Context wrapper — registry no longer ships that)"
    - "Schema-shape pattern: each entity has both a full *Schema (with audit/projection fields) and an *FormSchema (user-editable inputs only); both export *Input via z.input<typeof X>"
    - "Type-mirror pattern: lib/types/*.ts field names are identical to ARCHITECTURE.md Firestore schemas so Phase 2 swap is data-source-only"
    - "Phase-1 ISO-string date pattern: all timestamps are ISO strings; Phase 2 converts to Firestore Timestamps at the data-layer boundary"
    - "Zod 4 canonical API pattern: top-level z.email() and z.url() instead of deprecated z.string().email() / z.string().url() chains"

key-files:
  created:
    - components/ui/input.tsx
    - components/ui/label.tsx
    - components/ui/textarea.tsx
    - components/ui/select.tsx
    - components/ui/checkbox.tsx
    - components/ui/radio-group.tsx
    - components/ui/switch.tsx
    - components/ui/field.tsx
    - components/ui/card.tsx
    - components/ui/badge.tsx
    - components/ui/table.tsx
    - components/ui/dialog.tsx
    - components/ui/alert-dialog.tsx
    - components/ui/sheet.tsx
    - components/ui/dropdown-menu.tsx
    - components/ui/tabs.tsx
    - components/ui/tooltip.tsx
    - components/ui/breadcrumb.tsx
    - components/ui/separator.tsx
    - components/ui/skeleton.tsx
    - components/ui/avatar.tsx
    - components/ui/sonner.tsx
    - components/ui/command.tsx
    - components/ui/popover.tsx
    - components/ui/calendar.tsx
    - components/ui/progress.tsx
    - components/ui/scroll-area.tsx
    - components/ui/input-group.tsx
    - lib/types/item.ts
    - lib/types/event.ts
    - lib/types/user.ts
    - lib/types/transaction.ts
    - lib/types/missing-item.ts
    - lib/types/session.ts
    - lib/schemas/item.ts
    - lib/schemas/event.ts
    - lib/schemas/user.ts
    - lib/schemas/transaction.ts
    - lib/schemas/missing-item.ts
    - lib/schemas/auth.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Use shadcn v4 <Field> primitives for form composition — the legacy <Form>/<FormField> Context wrapper from shadcn v3 is no longer in the radix-nova registry (entry exists but is empty). All downstream form plans must compose via <Field>/<FieldLabel>/<FieldDescription>/<FieldError> and bind rhf's register/control directly."
  - "Pin react-day-picker to v9 — shadcn radix-nova calendar.tsx references classNames.table which was removed in v10. Aligned with CLAUDE.md no-paste-edit rule for registry components."
  - "Use Zod 4 canonical z.email() and z.url() top-level constructors instead of deprecated z.string().email() / z.string().url() chains. Avoids deprecation warnings and matches STACK.md Zod 4 target."
  - "lib/types/item.ts adds damagedQty, lifecycleState, lowStockThreshold, lowStockOrderedAt beyond ARCHITECTURE.md baseline — required by INV-09 lifecycle states + RP-01/RP-04 low-stock + repurchase requirements. Phase 2 schema documents will adopt the same fields."
  - "Transaction adds actorRoleAtTimeOfAction snapshot per AUD-01 (the role at write-time, not the user's current role at read-time)."
  - "ItemSchema invariant is `available + out + damaged <= total` (not strict equality) — retired stock removes from totalQty so equality would break the projection."

patterns-established:
  - "Form composition (Phase 1+): rhf useForm({ resolver: zodResolver(Schema), mode: 'onBlur' }) → <Field><FieldLabel/><FieldControl><Input {...register(...)} /></FieldControl><FieldError errors={errors.field}/></Field>"
  - "Schema-input typing: every form imports the `*Input` type so the rhf generic matches the schema 1:1 (e.g., useForm<LoginInput>(...))"
  - "Refinement-style invariants live on the schema (qty totals, end-date ordering, password confirm) so client-side and server-side validation share the same source"
  - "All v1 entity types live in lib/types/ as .ts files (NOT .tsx); zero runtime values"

requirements-completed: [NFR-01, NFR-02, NFR-03, NFR-04, NFR-09]

# Metrics
duration: 9 min
completed: 2026-05-24
---

# Phase 1 Plan 01: Stack, Types, Schemas Summary

**9 npm deps + 27 shadcn components scaffolded via CLI + 6 entity types + 6 Zod schemas mirroring the Firestore data model — the foundation every Wave 1+ Phase 1 plan compiles against.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-24T13:43:26Z
- **Completed:** 2026-05-24T13:53:10Z
- **Tasks:** 2
- **Files modified:** 41 (39 created + 2 modified)

## Accomplishments

- Installed all 9 Phase-1 runtime dependencies in a single `npm install` (next-themes, sonner, react-hook-form, @hookform/resolvers, zod 4, @tanstack/react-table, date-fns, @yudiel/react-qr-scanner, bwip-js)
- Scaffolded all 27 plan-requested shadcn UI components in a single `npx shadcn@latest add` batched command — every one uses the `radix-ui` umbrella, none import individual `@radix-ui/react-*` packages
- Discovered and resolved the shadcn v4 form-API change: legacy `form` registry entry is empty; the canonical replacement is `field` (FieldLabel / FieldDescription / FieldError) which composes natively with `react-hook-form`. Installed `field.tsx` so downstream form plans have the v4 primitive available
- Pinned `react-day-picker` to v9 to fix a TS error in the registry-shipped `calendar.tsx` (references `classNames.table` removed in v10) — avoids paste-editing registry code per CLAUDE.md
- Authored 6 entity types in `lib/types/` mirroring `.planning/research/ARCHITECTURE.md` Firestore schemas verbatim, with Phase-1-specific additions for the INV-09 lifecycle state, AUD-01 actor snapshots, RP-01/RP-04 low-stock fields
- Authored 6 Zod 4 schemas in `lib/schemas/` using canonical `z.email()` / `z.url()` (not the deprecated `z.string().email()` chain), each exporting an `*Input` inferred type for use by `react-hook-form` form generics
- `npx tsc --noEmit` and `npm run lint` both exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Install runtime deps + scaffold 27 shadcn UI components via CLI** — `d8f9a6a` (feat)
2. **Task 2: Create entity types + Zod schemas mirroring ARCHITECTURE.md** — `e5548bd` (feat)

## Files Created/Modified

### Created — shadcn UI components (28 files)
- `components/ui/input.tsx` — text input primitive
- `components/ui/label.tsx` — form label primitive
- `components/ui/textarea.tsx` — multi-line input primitive
- `components/ui/select.tsx` — select dropdown primitive
- `components/ui/checkbox.tsx` — checkbox primitive
- `components/ui/radio-group.tsx` — radio group primitive
- `components/ui/switch.tsx` — toggle switch primitive
- `components/ui/field.tsx` — v4 form primitive (Field / FieldLabel / FieldDescription / FieldError) — replaces legacy `<Form>`
- `components/ui/card.tsx` — card layout primitive
- `components/ui/badge.tsx` — badge primitive (StatusBadge will wrap this)
- `components/ui/table.tsx` — table primitive (TanStack data-table wrapper will use)
- `components/ui/dialog.tsx` — dialog primitive
- `components/ui/alert-dialog.tsx` — confirm-action primitive (destructive flows)
- `components/ui/sheet.tsx` — slide-over primitive (invite user, resolve missing, etc.)
- `components/ui/dropdown-menu.tsx` — dropdown primitive (user menu, table actions)
- `components/ui/tabs.tsx` — tabs primitive (item detail / event detail)
- `components/ui/tooltip.tsx` — tooltip primitive
- `components/ui/breadcrumb.tsx` — breadcrumb primitive
- `components/ui/separator.tsx` — divider primitive
- `components/ui/skeleton.tsx` — loading placeholder primitive
- `components/ui/avatar.tsx` — avatar primitive
- `components/ui/sonner.tsx` — Toaster wrapper (mounted in app/layout.tsx in plan 03)
- `components/ui/command.tsx` — command palette / combobox primitive
- `components/ui/popover.tsx` — popover primitive
- `components/ui/calendar.tsx` — date picker primitive
- `components/ui/progress.tsx` — progress bar primitive
- `components/ui/scroll-area.tsx` — scroll area primitive
- `components/ui/input-group.tsx` — transitive dep (auto-installed)

### Created — types (6 files)
- `lib/types/item.ts` — InventoryItem, ItemLifecycleState, ItemCategory
- `lib/types/event.ts` — EventDoc, EventStatus
- `lib/types/user.ts` — UserDoc, UserRole
- `lib/types/transaction.ts` — TransactionDoc, TransactionType (imports UserRole)
- `lib/types/missing-item.ts` — MissingItemDoc, MissingReason, MissingStatus
- `lib/types/session.ts` — Session (D-05 cookie shape; imports UserRole)

### Created — schemas (6 files)
- `lib/schemas/item.ts` — ItemSchema (with qty invariant), ItemFormSchema, ItemLifecycleStateEnum, ItemCategoryEnum
- `lib/schemas/event.ts` — EventFormSchema (with date-order invariant), EventStatusEnum
- `lib/schemas/user.ts` — InviteUserSchema, SetUserRoleSchema, UserRoleEnum
- `lib/schemas/transaction.ts` — CheckoutLineSchema, CheckoutCartSchema, CheckinLineSchema (with CI-04 invariant), TransactionTypeEnum
- `lib/schemas/missing-item.ts` — ResolveMissingSchema, MissingReasonEnum, MissingStatusEnum
- `lib/schemas/auth.ts` — LoginSchema, ForgotPasswordSchema, SetPasswordSchema (with confirm-match invariant)

### Modified (2 files)
- `package.json` — added 9 deps + react-day-picker v9 pin
- `package-lock.json` — regenerated

## Decisions Made

- **shadcn v4 `<Field>` over legacy `<Form>`** — The legacy v3 `<Form>` / `<FormField>` registry entry is empty in shadcn v4 (radix-nova preset). Installed `field.tsx` instead, which is the official v4 replacement and composes natively with `react-hook-form` (no Context wrapper required). All downstream form plans (04, 06, 07, 12) must use `<Field>` / `<FieldLabel>` / `<FieldError>` primitives rather than the v3 pattern shown in PATTERNS.md.
- **`react-day-picker` pinned to v9** — Shadcn's registry-shipped `calendar.tsx` references `classNames.table`, which was removed in v10. Rather than paste-edit a registry component (violates CLAUDE.md), pinned the dep to the version the registry was authored against. Will be a tracked upgrade target whenever shadcn pushes a v10-compatible calendar.
- **Zod 4 canonical email/url** — Used `z.email()` / `z.url()` top-level constructors (per Zod 4 docs) instead of the legacy `z.string().email()` / `z.string().url()` chains the plan example used. Both work, but the chained forms are marked `@deprecated`; AGENTS.md is explicit about heeding deprecation notices on breaking-change major versions.
- **ItemSchema invariant is `<=` not `=`** — `available + out + damaged <= total`, not strict equality. Retired stock decrements totalQty (per INV-09 lifecycle), so a strict equality would break the projection. The schema's responsibility is "no overselling"; total reconciliation happens via the transaction log.
- **`damagedQty` lives on the item, not on a side table** — The plan only listed it in the InventoryItem type but not in ARCHITECTURE.md baseline. Adding it to the canonical type now (Phase 1) is cheaper than retrofitting it in Phase 2. INV-09 explicitly defines `damaged` as a lifecycle state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn v4 `form` component registry entry is empty**
- **Found during:** Task 1 (running `npx shadcn@latest add ... form ...`)
- **Issue:** Plan instructed `npx shadcn@latest add form` and expected `components/ui/form.tsx` to be created. The CLI exits silently because the radix-nova `form` registry entry exists but ships zero files. The legacy v3 `<Form>` / `<FormField>` Context wrapper has been removed from shadcn v4. Without an installed form primitive, plans 04, 06, 07, 12 cannot compose rhf-backed forms.
- **Fix:** Installed `field` (the v4 canonical replacement) via `npx shadcn@latest add field --yes`. The field primitive ships `<Field>`, `<FieldLabel>`, `<FieldDescription>`, `<FieldError>`, `<FieldSet>`, `<FieldLegend>`, `<FieldGroup>` and composes directly with react-hook-form's `register` / `control` without a Context wrapper. Documented in SUMMARY decisions so plans 04+ adopt the v4 pattern explicitly.
- **Files modified:** components/ui/field.tsx (added), components/ui/label.tsx (re-skipped, identical), components/ui/separator.tsx (re-skipped, identical)
- **Verification:** `ls components/ui/field.tsx` succeeds; tsc passes; field.tsx imports from `radix-ui` umbrella (no `@radix-ui/react-*` violation)
- **Committed in:** d8f9a6a (Task 1 commit)

**2. [Rule 1 - Bug] shadcn calendar.tsx is incompatible with installed react-day-picker version**
- **Found during:** Task 1 (running `npx tsc --noEmit` after shadcn install)
- **Issue:** Shadcn installed `react-day-picker@10.0.1` as the calendar dep, but the registry-shipped `calendar.tsx` references `classNames.table` (e.g. `table: "w-full border-collapse"`), which was removed from `ClassNames` in react-day-picker v10. TS error: `Object literal may only specify known properties, and 'table' does not exist in type 'Partial<ClassNames>'`. Build is broken.
- **Fix:** Pinned `react-day-picker` to v9 via `npm install react-day-picker@9`. v9 still has `table` in its ClassNames union and works against the registry calendar.tsx without modification. Avoids paste-editing registry code per CLAUDE.md rule.
- **Files modified:** package.json (react-day-picker pin), package-lock.json (regenerated)
- **Verification:** `npx tsc --noEmit` exits 0 after the downgrade
- **Committed in:** d8f9a6a (Task 1 commit)

**3. [Rule 2 - Missing Critical] Plan used deprecated Zod 3 chain API for email/url**
- **Found during:** Task 2 (drafting lib/schemas/auth.ts + lib/schemas/item.ts + lib/schemas/user.ts)
- **Issue:** Plan's example code used `z.string().email(...)` and `z.string().url()` chains. In the Zod 4 (^4.4.3) we installed, those chained forms are marked `@deprecated` with explicit JSDoc redirects to `z.email()` / `z.url()`. AGENTS.md mandates heeding deprecation notices on breaking-change major versions.
- **Fix:** Used the Zod 4 canonical top-level constructors: `z.email("…")` in auth.ts, user.ts; `z.url().nullable()` in item.ts. The inferred types and runtime behavior are identical to the chained form, but no deprecation warnings.
- **Files modified:** lib/schemas/item.ts, lib/schemas/user.ts, lib/schemas/auth.ts
- **Verification:** tsc passes; lint passes; no deprecation warnings reported
- **Committed in:** e5548bd (Task 2 commit)

**4. [Rule 2 - Missing Critical] `@hookform/resolvers` version drift**
- **Found during:** Task 1 (`npm install` completion)
- **Issue:** Plan pinned `@hookform/resolvers ^3.x` but npm installed `^5.4.0` because v3 does not support `react-hook-form ^7.76.1` paired with `zod ^4.4.3`. Installing v3 against this stack would either fail peer-dep resolution or produce runtime errors when `zodResolver` calls Zod 4 APIs that v3 did not know about.
- **Fix:** Accepted `^5.4.0` as the correct version for the React 19 + Zod 4 stack. This is the current major and is the only resolver version that supports Zod 4's new error format. The plan was authored before this was known.
- **Files modified:** package.json (^5.4.0 instead of ^3.x), package-lock.json
- **Verification:** tsc passes; `zodResolver` import in future form plans will resolve correctly
- **Committed in:** d8f9a6a (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking, 1 bug, 2 missing-critical)
**Impact on plan:** All four are essential for correctness or to align with locked stack constraints (CLAUDE.md no-paste-edit, AGENTS.md heed-deprecations). No scope creep — the foundation still ships exactly what plans 02-13 need. Downstream plans 04 / 06 / 07 / 12 must update the form snippets in their `<read_first>` PATTERNS.md from the v3 `<Form>`/`<FormField>` shape to the v4 `<Field>`/`<FieldError>` shape; this is a comment/snippet update, not a logic change.

## Issues Encountered

None during planned work. All four deviations above were resolved automatically.

## User Setup Required

None — no external service configuration required.

## Threat Flags

None — no new security-relevant surface introduced beyond what the plan's threat model already documented (T-01-01 deps, T-01-02 closed schemas, T-01-03 type vs schema duality, all `mitigate` or `accept` per plan).

## Known Stubs

None — all 12 type/schema files are complete and production-ready for Phase 2 reuse. The deviations introduced no placeholder values.

## Next Phase Readiness

- **Foundation contracts locked.** lib/types/*.ts and lib/schemas/*.ts are reusable by Phase 2's Server Actions without modification — Phase 2 only swaps the data source (mock store → Firestore), not the shape contracts.
- **Ready for plan 02** (mock data + store): plan 02 imports all 6 types and the *Schema runtime values to populate `lib/mock/{items,events,users,transactions,missing-items}.ts` and to shape-check inside `lib/mock/store.ts` mutators.
- **Ready for plan 03** (shell primitives): plan 03 can compose AppSidebar / TopBar / UserMenu / ThemeToggle from the shadcn UI primitives installed here.
- **Form-pattern note for plans 04 / 06 / 07 / 12:** Use `<Field>` / `<FieldLabel>` / `<FieldDescription>` / `<FieldError>` primitives from `@/components/ui/field` (shadcn v4 canonical) instead of the v3 `<Form>` / `<FormField>` wrapper shown in 01-PATTERNS.md. The rhf wiring is unchanged (still `useForm({ resolver: zodResolver(...) })`) — only the JSX primitive name differs.

---

*Phase: phase-kayinleong-01*
*Completed: 2026-05-24*

## Self-Check: PASSED

- 17 spot-checked files (5 components + 6 types + 6 schemas) all exist on disk.
- Both task commits (d8f9a6a, e5548bd) found in `git log --all`.
- Plan-level verification: `npx tsc --noEmit` exits 0; `npm run lint` exits 0.
- All 5 acceptance-criterion gates from Task 1 + Task 2 pass.
- All 5 requirements (NFR-01, NFR-02, NFR-03, NFR-04, NFR-09) satisfied at the baseline level.
