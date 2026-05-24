# Phase 1: UI POC — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 01-ui-poc
**Areas discussed:** Mock data architecture, POC auth + role simulation, List interactivity depth, Scanner depth in Phase 1

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Mock data architecture | Seed richness, hardcoded vs faker, read-only vs in-memory mutable | ✓ |
| POC auth + role simulation | Depth of fake auth: stub vs localStorage vs role switcher | ✓ |
| List interactivity depth | Filter/sort/search; skip vs TanStack vs URL-param sync | ✓ |
| Scanner depth in Phase 1 | Stub vs live camera + log vs full scan-cart wired to mock store | ✓ |

User selected all four areas.

---

## Mock Data Architecture

### Q1: Seed source

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded TS consts | `lib/mock/<entity>.ts` typed array literals; deterministic | ✓ |
| Faker.js with fixed seed | Add `@faker-js/faker`, seed per entity | |
| Hybrid | Hardcode anchor entities; faker for long tail | |

**User's choice:** Hardcoded TS consts.

### Q2: Mutability

| Option | Description | Selected |
|--------|-------------|----------|
| Mutable in-memory store | `lib/mock/store.ts` with `subscribe()`/`getSnapshot()` via `useSyncExternalStore`; resets on full reload | ✓ |
| Read-only seed arrays | Forms submit via console.log + toast; no state change | |
| Mutable + sessionStorage | Survives client-side nav + tab refresh | |

**User's choice:** Mutable in-memory store. Acknowledged tradeoff: state resets on hard refresh.

### Q3: Seed size

| Option | Description | Selected |
|--------|-------------|----------|
| ~30 items / 6 events / 5 users / ~80 transactions / ~6 missing | Exercises pagination + low-stock widget without dominating codebase | ✓ |
| Minimal (~10 / 3 / 3 / ~20) | Lighter; doesn't exercise edge cases | |
| Heavy (~80 / 12 / 8 / ~250) | Stresses table virtualization; maintenance cost | |

**User's choice:** Recommended counts.

### Q4: Dates

| Option | Description | Selected |
|--------|-------------|----------|
| Computed relative to now | Seed exports a function anchoring dates to `today()`; dashboard widgets always populated | |
| Fixed dates in 2026 | Static constants; bumped manually if demo goes stale | ✓ |

**User's choice:** Fixed dates in 2026 (override on recommendation). Simplicity wins; manual bumping acceptable.

---

## POC Auth + Role Simulation

### Q1: Fake user storage

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage + React Context | Client-only; gate lives in Client Component layout shell | |
| Cookie-backed (non-httpOnly) | `await cookies()` in Server Components; closer to Phase 2 `__session` pattern | ✓ |
| URL params (?role=admin) | No persistence; nav must carry param | |

**User's choice:** Cookie-backed (override on recommendation). User chose the closer-to-Phase-2 pattern so the layout's role-gate code carries forward.

### Q2: Role switcher

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — visible in Phase 1 only | User-menu submenu with Admin/Staff radio; component marked for Phase 2 removal | ✓ |
| No — sign-out + sign-in as different seed user | More realistic; slower to demo | |
| Both | Switcher + seed-user list on /login | |

**User's choice:** Phase-1-only role switcher in user menu.

### Q3: Role gate strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Render /unauthorized page | AUTH-10 contract met in Phase 1; nav conditionally hidden + direct URL access shows /unauthorized | ✓ |
| Hide from nav only | Direct URL still works; Phase 2 fix needed | |

**User's choice:** Strict gate.

### Q4: Sign-in form behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Match against seed users; inline error on mismatch | Zod-validated; lookup vs `lib/mock/users.ts`; hardcoded password `"password"` for all | ✓ |
| Any valid input signs in as first admin | Faster demo; weaker contract | |
| Pick-a-user buttons replace form | No form UI exercised | |

**User's choice:** Seed-user matching with inline error.

---

## List Interactivity Depth

### Q1: Filter depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full TanStack data-table + URL-param sync everywhere | REP-06 contract met in Phase 1; Phase 2 only swaps data source | ✓ |
| Client-only state, no URL sync | Filters work but don't persist; REP-06 deferred | |
| Mixed depth across pages | Inventory + events only; reports get URL sync; users gets neither | |

**User's choice:** Full TanStack + URL params on every list.

### Q2: Pagination

| Option | Description | Selected |
|--------|-------------|----------|
| Server-style pager always rendered | "Page N of M", page-size selector, prev/next; `?page=` in URL | ✓ |
| Show-all + scroll | No pager in Phase 1 | |
| Hardcode pageSize=50; pager only when > 50 rows | Pager hides on small lists | |

**User's choice:** Server-style pager always rendered.

### Q3: Sortable columns

| Option | Description | Selected |
|--------|-------------|----------|
| Selective: name/SKU, qty, date, status | Skip sort on meaningless columns | ✓ |
| Every text/number column | More consistency, more chrome | |
| No sort — fixed default order | Inventory by name; events by startDate desc; tx by timestamp desc | |

**User's choice:** Selective sort on demo-relevant columns.

### Q4: Search

| Option | Description | Selected |
|--------|-------------|----------|
| Global filter bar + Combobox for item typeahead | Debounced 250ms; INV-07 contract met | ✓ |
| Per-column filters only | More precise; more chrome | |
| Skip search in Phase 1 | Breaks INV-07 early | |

**User's choice:** Global filter bar + Combobox.

---

## Scanner Depth in Phase 1

### Q1: Library install timing

| Option | Description | Selected |
|--------|-------------|----------|
| Install + wire in Phase 1 | `@yudiel/react-qr-scanner` integrated; live camera + decode | ✓ |
| Stub with "coming in Phase 2" | Violates ROADMAP success #5 | |

**User's choice:** Install + wire in Phase 1.

### Q2: Scan-cart UI depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full scan-cart wired against mock store | Cart commits actually decrement `availableQty` + write transaction | ✓ |
| Cart UI works but "Confirm" only logs | Lighter; no visible state change | |
| Log scans only — no cart | Breaks CO-02 contract | |

**User's choice:** Full scan-cart against mock store.

### Q3: Post-scan event picker

| Option | Description | Selected |
|--------|-------------|----------|
| Modal Combobox after first scan; sticky until "End session" | Best UX for scan-first workflow | ✓ |
| Pick event before opening scanner | Cleaner state model; more friction | |
| Inline picker per cart line | Too much friction | |

**User's choice:** Modal Combobox, sticky for session.

### Q4: Decode formats

| Option | Description | Selected |
|--------|-------------|----------|
| All 5 formats (QR + Code 128 + EAN-13 + UPC-A + Data Matrix) | CO-09 contract met in Phase 1 | ✓ |
| QR-only | Faster startup; misses CO-09 | |

**User's choice:** All 5 formats.

---

## Closing prompt

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context — capture remaining as Claude's discretion | Routing groups, form/schema strategy, dashboard widgets, QR printing, optimistic UI, Sheets vs Dialogs all documented as defaults | ✓ |
| Discuss QR label printing | Print preview polish level | |
| Discuss optimistic UI patterns | `useOptimistic` wiring in Phase 1 | |
| Discuss something else | — | |

**User's choice:** Proceed to write CONTEXT.md; remaining items captured as Claude's discretion.

---

## Claude's Discretion

The following defaults are documented in CONTEXT.md and accepted by silence:

- App Router groups: `(auth)/` (no chrome) and `(app)/` (shared shell with role gate)
- `/scan` lives in `(app)/`; `/unauthorized` at `(app)/unauthorized/page.tsx`
- Zod schemas in `lib/schemas/<entity>.ts` (Phase-2-shareable)
- `react-hook-form` + `zodResolver` everywhere; validate on blur + submit
- Dashboard widgets computed live from mock store via selectors
- Real QR generation via `bwip-js` on `/inventory/[id]`, printed via `window.print()`
- `useOptimistic` wired on scan-cart even though Phase 1 cannot reject
- `<Sheet/>` for short forms (invite, threshold, resolve-missing); full-page routes for create/edit
- `next-themes` toggle in user menu (light/dark/system, system default)
- `/login` shows "POC seed users" disclosure for one-click form-fill

## Deferred Ideas

(None — discussion stayed within Phase 1 scope. Phase 2 / v2 forward-looking items already tracked in `STATE.md` open clarifications.)
