# CLAUDE.md — cy-eventsystem

This project extends the global rules in `~/.claude/CLAUDE.md`. Read those first — they cover the claim-before-start protocol, commit format, secrets hygiene, regression prevention, and the docs gate. This file only documents what is **specific to this project**.

The shared Next.js agent rules also apply — see `@AGENTS.md`.

@AGENTS.md

---

## Project Identity

| Field | Value |
|-------|-------|
| Project | cy-eventsystem |
| Domain | Event-based physical inventory tracking |
| Owner slug | `kayinleong` (derived from `ka.yin.leong` per global rules) |
| Backend | Firebase (Auth + Firestore + Storage) |
| Frontend | Next.js 16 (App Router) + React 19 + shadcn/ui v4 + Tailwind v4 |

---

## Owner Slug for This Project

For this terminal/machine the resolved owner slug is **`kayinleong`**.

All claim IDs and commit prefixes use this slug:

- Phases: `phase-kayinleong-01`, `phase-kayinleong-02`, …
- Quick tasks: `quick-kayinleong-001`, `quick-kayinleong-002`, …

If another developer joins, they resolve their own slug from their `git config user.name` — counters are per-owner.

---

## Phase Roadmap (locked at init)

| Phase | ID | Goal |
|-------|----|----|
| 1 | `phase-kayinleong-01` | **UI POC** — full UI shell for every page, no backend wiring, mock data only |
| 2 | `phase-kayinleong-02` | **Functionality** — wire up Firebase Auth, Firestore data layer, all features functional |

Phase 1 must produce a navigable app with all routes, components, and forms rendering with mock data. Phase 2 must replace all mocks with real Firebase calls without changing the UI surface (unless explicitly approved during execution).

---

## Stack Constraints (non-negotiable)

- **Next.js 16.2.6** — App Router only. **This is a breaking-change major version vs anything in training data.** Before writing Next.js-specific code, read `node_modules/next/dist/docs/` for the relevant API. Heed deprecation notices.
- **React 19** — Server Components by default. Add `'use client'` only when needed (form state, scanner, real-time listeners).
- **shadcn/ui v4.8.0** — `style: "radix-nova"`, `baseColor: "neutral"`, CSS variables. Add components via the shadcn CLI; never paste-edit registry components.
- **Tailwind CSS v4** — no `tailwind.config.js`; theming lives in `app/globals.css` via `@theme`.
- **lucide-react** for icons.
- **Firebase** — Web SDK on the client, Admin SDK on the server. Never mix.

If a task seems to require something outside this stack, surface it as a decision, do not silently add a dependency.

---

## Firebase Hygiene

- **Never** commit `firebase-adminsdk-*.json`, `.env.local`, or any service-account JSON.
- All Firebase config goes in environment variables. Public keys (`NEXT_PUBLIC_FIREBASE_*`) are fine in code; private keys live in `.env.local`.
- Firestore rules and indexes ship with the code in `firestore.rules` and `firestore.indexes.json`. Updates to either are part of the same claim.
- Quantity invariants (no negative stock) enforced at **three layers**: client UI guard, server action validation, Firestore transaction. Defense in depth.

---

## UI POC (Phase 1) Rules

During Phase 1, all data is mocked. No Firebase calls. No real auth. Specifically:

- Mock data lives in `lib/mock/` — typed, exported, imported by Client Components.
- Auth pages render and validate inputs but route directly to `/` on submit.
- Lists, detail pages, and forms render against typed mock arrays.
- "Save" / "Submit" buttons either no-op or log to console — they do not navigate based on backend state.
- The scanner page may use the real camera + decode library, but the scanned value is logged only, not persisted.

The phase is **done** when every route in the sitemap renders, every form is reachable, and the app can be navigated end-to-end without backend.

---

## Pages / Routes (sitemap — locked)

```
/login                       /register (admin-invite only)        /forgot-password
/                            (dashboard)
/inventory                   /inventory/new      /inventory/[id]      /inventory/[id]/edit
/scan                        (camera-based scanner — mode toggle: check-out | check-in)
/events                      /events/new         /events/[id]
/events/[id]/checkout        /events/[id]/checkin
/reports/stock               /reports/out        /reports/missing
/reports/history             /reports/repurchase
/users                       (admin-only)
/settings
```

Additions confirmed at init:
- Dedicated QR check-in / check-out flows
- Post-scan event assignment (Event A vs Event B picker)
- Return-to-inventory delivery flow
- Backup team support per event

Adding or removing a route requires updating ROADMAP.md and PROJECT.md in the same claim.

---

## Naming & Filing

- Source routes: `app/<route>/page.tsx`
- Shared UI: `components/ui/*` (shadcn) and `components/feature/<feature>/*`
- Firebase clients: `lib/firebase/client.ts`, `lib/firebase/admin.ts`
- Mock data (Phase 1): `lib/mock/<entity>.ts`
- Server actions (Phase 2): `app/<route>/actions.ts` co-located with the route
- Types: `lib/types/<entity>.ts`

---

## Verification Expectations

The global Regression Prevention rules apply. For this project, every claim that touches a flow must verify:

- The relevant route renders without console errors (`npm run dev` + manual visit).
- TypeScript passes (`npm run build` or `tsc --noEmit`).
- ESLint passes (`npm run lint`).
- For Phase 2 claims: Firestore rules unit tests pass for any rule changes.

A claim is `done` only when its `CLAIM.md` Verification section lists what was tested, what passed, and what was ruled out.

---

## GSD Workflow Hooks

- `/gsd-plan-phase 1` — start UI POC planning
- `/gsd-execute-phase 1` — execute the plans
- `/gsd-progress` — check state at session start (use this first, every session)

Planning artifacts live in `.planning/` and are committed alongside code (`commit_docs: true`).
