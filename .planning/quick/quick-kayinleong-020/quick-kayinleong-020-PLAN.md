---
id: quick-kayinleong-020
type: execute
mode: quick
autonomous: false
files_modified:
  - components/feature/inventory/InventoryTable.tsx
  - components/feature/events/EventsTable.tsx
  - components/feature/reports/StockReportTable.tsx
  - components/feature/reports/RepurchaseTable.tsx
  - components/feature/reports/HistoryTable.tsx
  - components/feature/reports/ItemsOutTable.tsx
  - app/(app)/reports/out/page.tsx
requirements:
  - INV-06
  - INV-07
  - EVT-03
  - EVT-08
  - REP-01
  - REP-02
  - REP-04
  - REP-05
  - REP-06
  - REP-07
  - D-17
  - D-20

must_haves:
  truths:
    - "Clicking Next on /inventory advances the table to the second page of items (page-1 rows no longer reappear)."
    - "Clicking Next on /events, /reports/stock, /reports/out, /reports/history, /reports/repurchase advances to the next page."
    - "Each list-page view performs the SSR read only — no client onSnapshot listener attaches on list tables, so reads-per-view drop from ~100 to ~51."
    - "Non-list callers of the shared live hooks (scan, location preview, dashboard widgets, detail tabs, nav low-stock badge, checkin form, event picker) keep their live onSnapshot behavior unchanged."
    - "/users is untouched and still works as the reference implementation."
    - "EVT-08 staff scoping still holds on /events after the listener is dropped (SSR getEventsPage enforces allowedStaff array-contains uid)."
    - "/reports/out still shows only OPEN checkouts (already-checked-in lines do not reappear after the listener is dropped)."
  artifacts:
    - path: "components/feature/inventory/InventoryTable.tsx"
      provides: "List table that renders SSR seed directly + href-based Next"
    - path: "components/feature/events/EventsTable.tsx"
      provides: "List table that renders SSR seed directly + href-based Next"
    - path: "components/feature/reports/StockReportTable.tsx"
      provides: "List table that renders SSR seed directly + href-based Next"
    - path: "components/feature/reports/RepurchaseTable.tsx"
      provides: "List table that renders SSR seed directly + href-based Next"
    - path: "components/feature/reports/HistoryTable.tsx"
      provides: "List table that renders SSR seed directly + href-based Next"
    - path: "components/feature/reports/ItemsOutTable.tsx"
      provides: "Items-out list rendering open-only SSR seed + href-based Next"
  key_links:
    - from: "list table components"
      to: "SSR-seeded initial* props"
      via: "render the seed array directly instead of the live hook array"
      pattern: "initialItems|initialEvents|initial"
---

<objective>
Fix broken pagination on every cursor-paginated LIST page (clicking "Next" does not advance — the page snaps back to page 1) and eliminate the read amplification it causes.

Root cause (per RESEARCH.md, HIGH confidence, file:line verified): each list table calls a live `onSnapshot` hook (`useInventoryLive` / `useEventsLive` / `useTransactionsLive`) that re-subscribes to the *first* 50 rows of the collection with NO `startAfter`. When `goNext()` writes `?cursor=…` and the Server Component re-fetches page 2 into the `initial*` prop, the cursor-blind listener immediately clobbers it back to page 1. The same double-read (SSR + listener-attach) also doubles Firestore reads per view (~51 → ~100). `/users` is the control case: its hook returns the SSR seed verbatim and its Next is an `<a href>` — and it is the ONLY list page where pagination works.

Fix approach (DECIDED — Option B from research, exactly):
1. Stop list tables from consuming the live array — render the SSR-paginated `initial*` seed directly, mirroring `/users` (`lib/hooks/use-users-live.ts:29-31` returns `initial`). Fixes both symptoms: nothing clobbers the page-2 seed, and the per-view listener read disappears.
2. Make Next a real navigation via `<a href="?cursor=…">` like `UsersTable.tsx:151-155`, not `setCursor` + `router.replace`. Prev stays as the existing `router.back()` / disabled-on-page-1 behavior (acceptable per decision).

Scope guardrails (binding, from research pitfall table + blast-radius constraints):
- Do NOT gut the shared hooks globally. They have legitimate live consumers on detail/scan/dashboard surfaces. The change is scoped to the SIX LIST TABLE components only (Task 1 enumerates them).
- Do NOT touch `/users` (correct reference) or any non-list caller.
- Out of scope (research flagged — do NOT implement): restoring "Page N of M" via `getCountFromServer`, rebuilding Prev as a cursor stack, server-side free-text search.

Purpose: Restore correct pagination across all list pages and cut the Firestore read amplification.
Output: Six list-table components render their SSR seed and navigate via href; `/reports/out` SSR seed adjusted to stay open-only; non-list live behavior preserved.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/quick-kayinleong-020/quick-kayinleong-020-RESEARCH.md
@.planning/quick/quick-kayinleong-020/CLAIM.md
@CLAUDE.md
@AGENTS.md

# Working reference implementation (the fix already applied here — copy its shape, do NOT modify it):
@components/feature/users/UsersTable.tsx
@lib/hooks/use-users-live.ts

# List tables to fix:
@components/feature/inventory/InventoryTable.tsx
@components/feature/events/EventsTable.tsx
@components/feature/reports/StockReportTable.tsx
@components/feature/reports/RepurchaseTable.tsx
@components/feature/reports/HistoryTable.tsx
@components/feature/reports/ItemsOutTable.tsx

# SSR seeds (for EVT-08 confirmation + the /reports/out open-only fix):
@lib/data/events.server.ts
@lib/data/transactions.server.ts
@app/(app)/reports/out/page.tsx
@app/(app)/inventory/page.tsx
@lib/hooks/use-url-table-state.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Lock the exact list-vs-non-list call sites + confirm EVT-08 SSR enforcement</name>
  <files>(read-only audit — no file edits in this task; record findings in CLAIM.md)</files>
  <action>
Re-run the caller grep so the executor works from a fresh, complete map (the planner already ran this; re-confirm nothing has drifted):

```
grep -rn "useInventoryLive\|useEventsLive\|useTransactionsLive" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Classify EVERY call site into two buckets and write the table into CLAIM.md under a `## Call-site audit` heading.

CHANGE these (LIST TABLES — Task 2 fixes them):
  - components/feature/inventory/InventoryTable.tsx:99 — `useInventoryLive(initialItems)` → /inventory
  - components/feature/events/EventsTable.tsx:106 — `useEventsLive(initialEvents, {session, status})` → /events
  - components/feature/reports/StockReportTable.tsx:90 — `useInventoryLive(initialItems)` → /reports/stock
  - components/feature/reports/RepurchaseTable.tsx:70 — `useInventoryLive(initial, {isLowStock, limit})` → /reports/repurchase
  - components/feature/reports/HistoryTable.tsx:103 — `useTransactionsLive({...liveFilter, limit, initial})` → /reports/history
  - components/feature/reports/ItemsOutTable.tsx:70,76 — TWO `useTransactionsLive` (checkout seed + checkin derive) → /reports/out

LEAVE UNTOUCHED (NON-LIST — these legitimately want live data; do NOT change them and do NOT change the shared hook bodies):
  - components/feature/scan/scan-session.tsx:301 — `useInventoryLive([], {limit:500})` (checkout stock guard)
  - components/feature/scan/LocationPanel.tsx:66 — `useInventoryLive([], {limit:500})` (scan location preview)
  - components/layout/Nav.tsx:27 — `useInventoryLive([], {isLowStock, limit})` (low-stock nav badge)
  - components/feature/settings/LowStockThresholdsCard.tsx:49 — `useInventoryLive([])`
  - components/feature/dashboard/LowStockWidget.tsx:42, ActiveEventsWidget.tsx:37, OverdueReturnsWidget.tsx:79, RecentActivityFeed.tsx:49 (dashboard widgets)
  - components/feature/scan/EventPickerDialog.tsx:56 — `useEventsLive(...)`
  - All detail/flow tabs: ItemHistoryTab.tsx:49, EventAssignedItemsTab.tsx:99, EventHistoryTab.tsx:47, CancelEventDialog.tsx:73, DOHistoryTab.tsx:41
  - app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx:102,108,113 (CI-07 live re-read)
  - /users (UsersTable.tsx + use-users-live.ts) — the reference; explicitly do NOT touch.

Confirm the chosen technique = "list table simply does not consume the live array; it renders the SSR `initial*` prop directly" (smallest surface; matches `/users`). This requires NO change to `useInventoryLive` / `useEventsLive` / `useTransactionsLive` bodies — the imports just get removed from the six list components. Note this explicitly in CLAIM.md so a reviewer can confirm the shared hooks are byte-identical after the change.

EVT-08 verification (a CHECK, not an assumption): confirm `getEventsPage` (lib/data/events.server.ts) applies `where("allowedStaff", "array-contains", session.uid)` for non-admin sessions BEFORE the listener is removed from EventsTable. It does — events.server.ts:110-111 (`if (opts.session.role !== "admin") q = q.where("allowedStaff", "array-contains", opts.session.uid)`). Record this exact line citation in CLAIM.md as the EVT-08 proof so dropping the client-side listener filter does not weaken staff scoping.

`/reports/out` open-only check (a CHECK that drives Task 2's only server edit): confirm `getTransactionsPage({filters:{type:"checkout"}})` (transactions.server.ts:108-147) seeds RAW checkout transactions — it does NOT subtract checkins. Today ItemsOutTable derives open-only by subtracting the `checkinsLive` listener (ItemsOutTable.tsx:82-90). Therefore simply rendering `initialCheckouts` raw would REGRESS by showing already-returned checkouts. Record in CLAIM.md that ItemsOutTable is the one table needing a paired server-side adjustment (covered in Task 2).
  </action>
  <verify>
    <automated>grep -rn "useInventoryLive\|useEventsLive\|useTransactionsLive" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v '//' | wc -l</automated>
  </verify>
  <done>CLAIM.md `## Call-site audit` lists all callers split into CHANGE (the six list tables) vs LEAVE (every non-list caller + /users), records the EVT-08 SSR proof (events.server.ts:110-111), and flags ItemsOutTable as the one table needing a paired server edit. No files edited yet.</done>
</task>

<task type="auto">
  <name>Task 2: Apply Option B to the six list tables + wire href navigation</name>
  <files>components/feature/inventory/InventoryTable.tsx, components/feature/events/EventsTable.tsx, components/feature/reports/StockReportTable.tsx, components/feature/reports/RepurchaseTable.tsx, components/feature/reports/HistoryTable.tsx, components/feature/reports/ItemsOutTable.tsx, app/(app)/reports/out/page.tsx</files>
  <action>
For EACH of the six list tables, make two coordinated edits. Do NOT change the shared hook files — only the table components (and one route file for /reports/out).

EDIT A — render the SSR seed instead of the live array:
  Replace the `const xLive = useHook(...)` + `const x = useMemo(() => [...xLive], [xLive])` pair so the memoized array is built from the SSR `initial*` prop directly, and REMOVE the now-unused live-hook import. Keep the existing `useMemo` so TanStack still gets a stable identity. The downstream `filtered` / `columns` / `table` / `isEmpty` logic stays unchanged — it just consumes the seed array.
    - InventoryTable.tsx: `useInventoryLive(initialItems)` → render `initialItems`. Remove the `useInventoryLive` import.
    - StockReportTable.tsx: `useInventoryLive(initialItems)` → render `initialItems`. Remove import.
    - EventsTable.tsx: `useEventsLive(initialEvents, {session, status})` → render `initialEvents`. Remove the `useEventsLive` import. Keep the `session` prop (still used by the component signature / page); if `session` becomes entirely unused after the edit, prefix with `void session;` (mirroring the `void currentUserUid;` pattern in UsersTable.tsx:56) rather than deleting the prop, so the SSR-side EVT-08 contract and prop shape are preserved.
    - RepurchaseTable.tsx: `useInventoryLive(initial, {isLowStock, limit})` → render `initial`. Remove import. (The SSR seed `initial` is already the low-stock page, so client filtering of `lowStockOrderedAt` + search stays correct.)
    - HistoryTable.tsx: `useTransactionsLive({...liveFilter, limit, initial})` → render `initial`. Remove import. The `liveFilter` useMemo becomes dead — remove it too. The existing client-side `filtered` re-applies all URL filters over the seed, so multi-axis filtering still works within the window.
    - ItemsOutTable.tsx: SPECIAL — see EDIT C below (it derives open-only from two listeners). Do the seed swap as part of EDIT C.

EDIT B — convert Next to href navigation (match UsersTable.tsx:143-160):
  Replace the `goNext()` (`if (nextCursor) setCursor(nextCursor)`) Button with a render-time conditional: when `nextCursor` is truthy, render `<Button asChild variant="outline" size="sm"><Link href={\`{ROUTE}?cursor=${encodeURIComponent(nextCursor)}\`}>Next <ChevronRight…/></Link></Button>`; when falsy, render the existing disabled Next button (or an "End of list" affordance — keep it minimal and consistent with the current chrome). Use the correct route per table: `/inventory`, `/events`, `/reports/stock`, `/reports/repurchase`, `/reports/history`, `/reports/out`.
  IMPORTANT — preserve other URL params: a bare `?cursor=…` href would DROP active filter/sort/search params. To keep REP-06 shareable-URL behavior, build the href from the current params: read `useSearchParams()` (already available via Next navigation) or reuse the existing `url` state, clone the params, set `cursor`, and stringify — i.e. `Next` must navigate to `{pathname}?{existingParams with cursor=nextCursor}`. If the table currently has no filters in scope, a plain `?cursor=` is acceptable, but inventory/events/stock/history DO carry filters, so preserve them. (The `Link` href must be a string; compute it with `URLSearchParams` from the current `searchParams`.)
  Keep `goPrev` / the Prev button exactly as-is (`router.back()`, `disabled={!url.cursor}`). Per the decision, Prev behavior is acceptable unchanged.
  Remove `setCursor` from the `useUrlTableState(...)` destructure IF it becomes unused after removing `goNext` (it is only used by `goNext` in these tables). Removing it avoids a `noUnusedLocals` failure. `setGlobalFilter` / `setFilter` stay (filters still use them).

EDIT C — ItemsOutTable open-only (the one table needing a paired server edit):
  The /reports/out SSR seed (`getTransactionsPage({type:"checkout"})`) returns RAW checkouts; open-only was previously derived by the `checkinsLive` listener. Dropping the listeners must NOT resurrect closed checkouts. Smallest-surface fix:
    1. In `app/(app)/reports/out/page.tsx`, reuse the existing open-derivation pattern. There is already a server helper `getOpenCheckoutsForEventServer(eventId)` (events.server.ts:179) but it is event-scoped and unpaginated — do NOT force it here. Instead, in the page, after fetching the cursor page of checkouts, fetch the matching checkins for that window and subtract — OR (preferred, lowest risk) add a small server-side open-only derivation inside the page: fetch the checkout cursor page (unchanged), then fetch the checkin transactions whose `parentTxId` ∈ the page's checkout ids (a single `where("parentTxId","in",[…])` capped at 30 ids per Firestore `in`-clause limit; chunk if the page has >30 checkouts) and remove matched checkouts. Pass the resulting open-only array as `initialCheckouts`. Keep `nextCursor` from the checkout page unchanged.
       If the `in`-clause chunking adds meaningful surface/complexity, the acceptable simpler alternative is: keep BOTH SSR reads in the page (checkouts page + a checkin read scoped to those checkout ids) and do the subtraction in the page using the SAME set logic already in ItemsOutTable.tsx:82-90 (checkout.id not in any checkin.parentTxId). Pick whichever is smaller after reading the code; document the choice in CLAIM.md.
    2. In `ItemsOutTable.tsx`, remove BOTH `useTransactionsLive` calls and the `openCheckouts` derivation. Render `initialCheckouts` (now already open-only) directly through the existing `filtered` (search) → `table` path. Remove the `useTransactionsLive` import. Apply EDIT B (href Next) as above.
  Do NOT change `getTransactionsPage`'s signature or its other callers (HistoryTable's seed still uses it unchanged).

Across all edits: do NOT introduce "v1"/"temporary"/"static"/"placeholder" reductions. The deliverable is fully-working cursor pagination, not a stub. Preserve every D-11 sortable-column comment, the "Showing N …" labels, empty states, and all existing column definitions verbatim.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint</automated>
  </verify>
  <done>All six list tables render their SSR `initial*` seed (no live-hook import remains in any of the six; verify with `grep -rn "useInventoryLive\|useEventsLive\|useTransactionsLive" components/feature/inventory/InventoryTable.tsx components/feature/events/EventsTable.tsx components/feature/reports/StockReportTable.tsx components/feature/reports/RepurchaseTable.tsx components/feature/reports/HistoryTable.tsx components/feature/reports/ItemsOutTable.tsx` returning 0 matches). Next is an `<a href>` carrying the current params + new cursor. `/reports/out` seeds open-only checkouts server-side. `lib/hooks/use-inventory-live.ts`, `use-events-live.ts`, `use-transactions-live.ts`, and `use-users-live.ts` are byte-identical to before (no diff). `npx tsc --noEmit` and `npm run lint` both pass (12 pre-existing warnings out of scope are acceptable; 0 errors, no NEW warnings).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Option B applied to all six cursor-paginated list tables: they now render the SSR-paginated seed directly (no client onSnapshot listener attaches) and Next is a real `<a href="?cursor=…">` navigation that triggers a fresh SSR fetch — mirroring the already-correct `/users` page. The shared live hooks were left untouched so scan/location/dashboard/detail/checkin surfaces keep their live behavior. `/reports/out` seeds open-only checkouts server-side so already-returned lines do not reappear.
  </what-built>
  <how-to-verify>
Run the dev server: `npm run dev` (this project runs `next dev --webpack`), then sign in and verify against a Firebase env with >50 inventory items (the imported 109-item dataset from quick-019 qualifies):

1. /inventory — click **Next**. The table MUST advance to a different set of items (page 2). The URL should show `?cursor=…`. Click **Next** again → page 3. Click **Prev** (browser-back semantics) → returns to the prior page. Confirm page-1 rows do NOT flash back after the seed loads.
2. With a category filter or search active on /inventory, click **Next** → confirm the filter/search param survives in the URL (REP-06 shareable URLs) and the page still advances.
3. /events — repeat the Next/advance check. As a STAFF user (not admin), confirm you still see ONLY events you're assigned to (EVT-08 staff scoping intact) — no events leak in after the listener was dropped.
4. /reports/stock, /reports/history, /reports/repurchase — click **Next** on each → confirm each advances.
5. /reports/out — click **Next** → confirm it advances AND that only currently-OPEN checkouts are listed (check an item you know was already checked IN does not appear).
6. Firestore reads sanity: open the Firebase console usage / network tab and confirm a single list-page view now issues the SSR read only (no client onSnapshot subscription on the list tables). Reads-per-view should be roughly halved vs before (~51 vs ~100). Non-list pages (e.g. /scan, the dashboard, an item detail tab) MUST still update live.
7. /users — confirm it still works exactly as before (untouched reference).

Report any page where Next still fails to advance, any filter param that gets dropped, any EVT-08 leak, or any closed checkout reappearing on /reports/out.
  </how-to-verify>
  <resume-signal>Type "approved" once Next advances on all six list pages, filters survive, EVT-08 holds, /reports/out stays open-only, and non-list live behavior is intact — or describe the issue.</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` exits 0.
- `npm run lint` exits 0 (0 errors; the 12 pre-existing TanStack/rhf warnings are out of scope; introduce no NEW warnings).
- `npm run build` exits 0 with the full route table intact (no routes added/removed).
- Manual repro (checkpoint): clicking **Next** on /inventory advances to page 2 (and /events, /reports/stock, /reports/out, /reports/history, /reports/repurchase likewise).
- No client `onSnapshot` listener attaches on the six list tables (reads-per-view drops ~100 → ~51).
- `git diff` shows ZERO changes to `lib/hooks/use-inventory-live.ts`, `use-events-live.ts`, `use-transactions-live.ts`, `use-users-live.ts`, and ZERO changes under `/users`.
- EVT-08: staff still see only their allowed events on /events (SSR enforcement, events.server.ts:110-111).
- /reports/out lists only open checkouts.
</verification>

<success_criteria>
- Next advances the page on all six cursor-paginated list pages.
- Firestore reads per list-page view are no longer doubled by a redundant client listener.
- Shared live hooks and all non-list callers are unchanged; `/users` untouched.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- CLAIM.md updated with the call-site audit, the EVT-08 proof, the chosen /reports/out derivation approach, and a Regression Report per the global CLAUDE.md (what was tested, what passed, what was ruled out) before the claim is marked done.
</success_criteria>

<output>
Update `.planning/quick/quick-kayinleong-020/CLAIM.md`:
- `## Call-site audit` (Task 1) — CHANGE vs LEAVE table + EVT-08 proof + ItemsOutTable flag.
- What changed (the six tables + the /reports/out page edit).
- `## Verification` — Regression Report: tsc/lint/build results, the manual Next-advances repro outcome, EVT-08 spot-check, /reports/out open-only spot-check, and confirmation that the shared hooks + /users are byte-identical (regression surface ruled out).
- Flip `status: claimed` → `status: done` only after the checkpoint is approved and the Regression Report is filled.
</output>
