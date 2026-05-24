# STATE — cy-eventsystem

**Project:** cy-eventsystem
**Owner:** kayinleong
**Current milestone:** v1
**Last updated:** 2026-05-24 (Phase 1 Plan 01-01 executed — 1/13 plans complete)

---

## Phase tracker

| Phase | ID | Status | Started | Completed |
|-------|----|----|---------|-----------|
| 1 | `phase-kayinleong-01` (UI POC) | In progress (1/13 plans complete) | 2026-05-24 | — |
| 2 | `phase-kayinleong-02` (Functionality) | Not started | — | — |

## Current focus

**Next step:** Execute plan 01-02 (`01-02-mock-data-store-PLAN.md`) — seed data + in-memory store + mutators + selectors + cookie helpers + hooks. Wave 1 parallel-safe with plan 01-03.

**Last session:** Phase 1 Plan 01-01 (Stack, Types, Schemas) executed in 9 min, 2 atomic commits (d8f9a6a + e5548bd). Installed 9 runtime deps (next-themes, sonner, react-hook-form, @hookform/resolvers v5, zod 4, @tanstack/react-table, date-fns, @yudiel/react-qr-scanner, bwip-js) + 27 shadcn UI components via CLI + 6 entity types in lib/types/ + 6 Zod schemas in lib/schemas/. 4 deviations auto-fixed (Rule 1/2/3): shadcn v4 `form` component is empty registry entry → installed `field` v4 primitive instead; react-day-picker v10 incompatible with registry calendar.tsx → pinned to v9; Zod 4 deprecated `.string().email()` chains → use `z.email()` / `z.url()` top-level; @hookform/resolvers v3 incompat with rhf 7 + Zod 4 → accepted v5.4.0. tsc and ESLint both green. Resume file: `.planning/phases/phase-kayinleong-01/01-02-mock-data-store-PLAN.md`.

## Decisions (accumulated)

- **D-01-01-A:** Use shadcn v4 `<Field>` primitives for form composition. The legacy v3 `<Form>` / `<FormField>` Context wrapper has been removed from the radix-nova registry (entry exists but is empty). Plans 04, 06, 07, 12 must compose forms via `<Field>` / `<FieldLabel>` / `<FieldError>` and bind react-hook-form's `register` / `control` directly.
- **D-01-01-B:** Pin `react-day-picker` to v9. Shadcn's `calendar.tsx` references `classNames.table` which was removed in v10. Pin avoids paste-editing registry code per CLAUDE.md.
- **D-01-01-C:** Use Zod 4 canonical `z.email()` and `z.url()` top-level constructors instead of the deprecated `z.string().email()` / `z.string().url()` chains.
- **D-01-01-D:** `@hookform/resolvers` is v5.4.0 (not the v3 the plan listed). v5 is the only version that supports the React 19 + Zod 4 stack we shipped.

## Notes

- Repo was pre-initialized by user with `npx create-next-app` (Next 16.2.6) and `npx shadcn init` (v4 radix-nova/neutral) before GSD bootstrap.
- One shadcn component already installed: `components/ui/button.tsx`.
- `.env.local` does not exist and is not needed until Phase 2 Block A.
- No git history before this initialization commit.
- Per global CLAUDE.md, the owner-slug is `kayinleong` (derived from `ka.yin.leong`).
- All claim IDs and commit prefixes use the `phase-kayinleong-NN` / `quick-kayinleong-NNN` form.

## Open clarifications (carried into Phase 2 planning)

These do not block Phase 1 but should be answered before Phase 2 work begins in earnest:

1. Existing barcodes the customer needs to scan vs all-new labels?
2. Expected inventory volume? (Affects index strategy + listener cost.)
3. Email delivery: Firebase built-in for invites + low-stock — sufficient, or need SendGrid?
4. Photo storage scope: item photos? Damage attachments? Affects Storage rules + CDN.
5. `next-firebase-auth-edge` v1.12 stability — validate with a 1-day spike at start of Phase 2.
