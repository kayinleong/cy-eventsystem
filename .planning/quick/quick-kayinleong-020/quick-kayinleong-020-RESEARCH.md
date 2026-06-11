# quick-kayinleong-020 — Research: broken pagination + excessive Firestore reads

**Researched:** 2026-06-11
**Domain:** Next.js 16 App Router + Firestore Web SDK cursor pagination; live `onSnapshot` listener scope
**Confidence:** HIGH (root causes confirmed by reading actual code, file:line cited)
**Mode:** Root-cause diagnosis (NOT a how-to-paginate tutorial)

---

## Summary

Both reported symptoms trace to **one shared design flaw**: the SSR seed (`getInventoryPage` / `getEventsPage` etc.) correctly cursor-paginates, but the **client live hook that takes over rendering ignores the cursor entirely** and always re-subscribes to the *first* 50 rows of the collection. The TanStack table renders the live hook's array, not the SSR seed — so after the brief seed flash, the table always shows page 1.

- **Symptom 1 (Next doesn't advance):** `goNext()` writes `?cursor=…` to the URL and the Server Component refetches the correct second page, but `useInventoryLive(initialItems)` is called **with no `opts`** ([InventoryTable.tsx:99](#)), so its `onSnapshot` query has **no `startAfter`** and re-reads docs 1–50. The fresh SSR seed (page 2) is immediately overwritten by the listener's page-1 snapshot. Net effect: URL changes, table doesn't.
- **Symptom 2 (read amplification):** Every list page mount fires a **live `onSnapshot` listener over a 50-doc window** ([use-inventory-live.ts:108–119](#)). `onSnapshot` reads all matched docs on initial attach **in addition to** the Admin-SDK SSR read of the same 50 docs — so each page view costs ~2× the window (≈100 reads), and the listener keeps charging for any document change while mounted. Multiply across inventory + events + every report tab and a day of clicking around easily reaches ~1K reads.

**Primary recommendation:** Make the live hook cursor-aware (accept and apply the cursor as `startAfter`) **OR** drop the live listener on list pages and render the SSR seed directly (the `/users` table already did exactly this — see [use-users-live.ts:29–31](#) returns `initial` and nothing else). The second option fixes BOTH symptoms at once and is the lower-risk change.

---

## Root Cause 1 — "Next" never advances (all list pages)

### Evidence chain (inventory, the user's repro)

1. **SSR pagination is correct.** [lib/data/inventory.server.ts:74–101] builds `orderBy("name").orderBy("__name__").limit(limit+1)` and applies `startAfter(cursor.name, cursor.id)` when a cursor is present (line 89). It returns the right page + a `nextCursor`. **This part works.**
2. **`goNext` updates the URL correctly.** [InventoryTable.tsx:273–275] `goNext()` → `setCursor(nextCursor)` → [use-url-table-state.ts:91–98] `router.replace(?cursor=…)`. The Server Component re-runs `getInventoryPage({ cursor })` ([inventory/page.tsx:53–61]) and passes the **page-2** slice down as `initialItems`.
3. **The client live hook clobbers it back to page 1.** [InventoryTable.tsx:99] calls `useInventoryLive(initialItems)` — **no second argument**. The hook ([use-inventory-live.ts:76–128]) therefore runs with `opts = {}`: its query is `orderBy("name") + orderBy(documentId()) + limit(50)` with **no `startAfter`** (lines 104–110). On every mount it sets `items` to docs **1–50** (line 114), overwriting the page-2 SSR seed.
4. **The table renders the hook output, not the seed.** [InventoryTable.tsx:101] `items = [...itemsLive]` → `filtered` → `table.data`. So the rendered rows are always the hook's page-1 array.

**Result:** the URL shows `?cursor=…`, the server did the right read, but the visible table snaps back to page 1. Exactly the reported "clicking Next stays on page 1."

> Note: `useInventoryLive` only re-subscribes when `[opts.category, opts.lifecycleState, opts.isLowStock, opts.limit]` change ([use-inventory-live.ts:126]). The cursor isn't in the dependency array and isn't even a parameter — so even if a cursor were threaded into state, this hook would not react to it.

### Same defect on the other list pages

| Page | Live hook call | Cursor passed to listener? | Pagination works? |
|------|----------------|----------------------------|-------------------|
| `/inventory` | `useInventoryLive(initialItems)` ([InventoryTable.tsx:99]) | **No** — no opts at all | Broken (seed clobbered) |
| `/events` | `useEventsLive(initialEvents, {session, status})` ([EventsTable.tsx:106]) | **No** — opts carry session/status only, no cursor; query has no `startAfter` ([use-events-live.ts:99–115]) | Broken (same mechanism) |
| `/users` | `useUsersLive(initialUsers)` ([UsersTable.tsx:50]) | Hook is a **no-op** — returns `initial` verbatim ([use-users-live.ts:29–31]) | **WORKS** — `Next page →` is an `<a href>` that navigates ([UsersTable.tsx:151–155]); SSR seed is rendered as-is |
| `/reports/out` (+ other report tabs) | `useTransactionsLive(...)` ([ItemsOutTable.tsx:39]) | **No** — windowed listener, no cursor | Broken (same mechanism) |

**Key insight:** `/users` is the *control case that proves the diagnosis*. It is the only list page whose live hook does NOT re-subscribe to page 1, and it is the only one where pagination works. The bug is the live-hook-clobbers-seed pattern, present on every page EXCEPT `/users`.

### Secondary correctness issue (Prev button)
`goPrev()` uses `router.back()` ([InventoryTable.tsx:269–272], identical in EventsTable). Even once Next works, Prev relies on browser history popping the cursor. The `Prev` button is `disabled={!url.cursor}` ([InventoryTable.tsx:407]) so on page 1 it's correctly disabled, but `router.back()` is fragile if the user arrived via a shared link. Lower priority than Next; flag for the fix.

---

## Root Cause 2 — Excessive Firestore reads (~1.1K spike)

### The read multiplier

Each list-page view incurs reads from **two independent sources for the same window**:

1. **SSR read (Admin SDK):** `getInventoryPage` does `limit(50+1)` → **51 reads** per server render ([inventory.server.ts:86]). Filters are pushed to Firestore (good — not a full-collection scan).
2. **Client live read (Web SDK):** `useInventoryLive` attaches an `onSnapshot` over a 50-doc window ([use-inventory-live.ts:108–111]). **Initial attach reads all 50 matched docs**, then continues to charge reads for every document write/change while the listener is mounted.

So a single `/inventory` visit ≈ **51 (SSR) + 50 (listener attach) ≈ 100 reads**, plus ongoing reads for any live mutation. The dashboard, events, and each report tab add their own listeners.

### Why the cursor bug *amplifies* reads (user's hypothesis confirmed)

The broken-Next loop is itself a read pump:
- User clicks Next → URL `?cursor=…` → **Server Component re-renders → another 51-read SSR fetch** of page 2 → React remounts/re-renders InventoryTable → the live hook (deps unchanged, but new mount from navigation) **re-attaches its 50-doc listener** → page snaps back to page 1.
- User, seeing no movement, **clicks Next again** → another ~100 reads, same non-result.

Every frustrated "Next" click ≈ ~100 reads with zero progress. This precisely matches the "broken pagination is *also* causing read amplification" report.

### What is NOT the cause (ruled out)
- **NOT a full-collection fetch.** Both the SSR query and the listener use `.limit(50)` with filters pushed server-side ([inventory.server.ts:80–87], [use-inventory-live.ts:104–108]). The amplification is the **double read (SSR + listener) per view × repeated navigations**, not an unbounded scan. `[VERIFIED: code]`
- **Reports are NOT scanning whole collections** either — `/reports/out` uses `getTransactionsPage({ limit: 50, cursor })` ([reports/out/page.tsx:30–34]). Same windowed + listener double-read shape.
- **Dev double-render caveat:** React Strict Mode in `next dev` double-invokes effects, inflating local dev read counts. But the user's ~1.1K spike is consistent with real usage of the SSR+listener double-read, not solely a dev artifact. Treat dev numbers as inflated; the production shape is genuine.

---

## Recommended Fix Approach

Two viable directions. **Option B is recommended** — it fixes both symptoms with the least surface area and matches the already-working `/users` precedent.

### Option A — Make the live hook cursor-aware (keeps live updates)
Thread the decoded cursor into each live hook and apply it as `startAfter`:
- Add a `startAfter?: {name; id}` (or pass the decoded cursor) to `useInventoryLive` opts; push `startAfter(name, id)` into the `constraints` array ([use-inventory-live.ts:104–108]) and add it to the effect deps ([line 126]).
- InventoryTable must decode `url.cursor` and pass it down ([InventoryTable.tsx:99]).
- **Cost:** still pays the SSR + listener double-read (Symptom 2 only partially mitigated — you stop the page-1 clobber but keep paying for two reads of the window). Cursor gotcha: the listener needs the *same* `orderBy("name") + orderBy(__name__)` tuple as the SSR query or the `startAfter` tuple won't line up.

### Option B — Drop the list-page live listener; render the SSR seed (recommended)
Make `useInventoryLive` / `useEventsLive` / `useTransactionsLive` return `initial` verbatim — exactly what `useUsersLive` already does ([use-users-live.ts:29–31]). List pages then render the server-paginated slice directly; navigation re-fetches via the Server Component.
- **Fixes Symptom 1:** nothing clobbers the page-2 seed.
- **Fixes Symptom 2:** removes the listener's initial-attach read AND all ongoing change-reads on list pages. Each view drops from ~100 reads to ~51 (SSR only).
- **Live updates trade-off:** list pages lose real-time cross-client updates. This is already the accepted trade-off for `/users` ([use-users-live.ts:14–28] documents it). Detail pages / scan flows keep their listeners — scope this change to **list tables only**.
- **Cursor pattern to standardize on:** copy the `/users` `Next page →` as an `<a href="/inventory?cursor=…">` ([UsersTable.tsx:151–155]) instead of `setCursor` + `router.replace`. A real navigation guarantees a fresh SSR fetch and avoids the `router.replace` + clobber interaction. Keep `Prev` as `router.back()` or push a cursor stack.

### Count query (total-pages display)
D-17 deliberately retired "Page N of M" in favor of prev/next-only because Firestore can't return a total cheaply ([InventoryTable.tsx:16, 249–252]). If the user wants a total back, `getCountFromServer(query)` is a **cheap aggregation read (1 read, not a scan)** — but it's a *separate* feature request, not part of this bug fix. Flag, don't implement.

---

## Pitfalls & Blast Radius

| Risk | Detail |
|------|--------|
| **Shared hook, many consumers** | `useInventoryLive` is also imported by other surfaces (e.g. scan/location preview per STATE.md quick-007). Changing its *signature* (Option A) touches every caller; changing its *body to return initial* (Option B) is safe for callers that want live data on detail/scan flows — so **scope Option B to a list-only variant or a flag**, don't gut the hook globally. Grep all `useInventoryLive` / `useEventsLive` / `useTransactionsLive` callers first. |
| **Cursor/order tuple must match** (Option A) | SSR uses `orderBy("name").orderBy("__name__")` ([inventory.server.ts:86]); the listener uses `orderBy("name").orderBy(documentId())` ([use-inventory-live.ts:108]). `__name__` and `documentId()` are equivalent, but any `startAfter` must pass `(name, id)` in that exact order or it silently returns wrong rows. |
| **Composite indexes** | Filtered queries (category/lifecycle/isLowStock + orderBy name) already require composite indexes that Phase 2 declared ("pre-declare + grow indexes", D-18). Don't add a new `orderBy` field without checking `firestore.indexes.json`. |
| **`searchParams` is a Promise in Next 16** | Already handled (`await searchParams`, [inventory/page.tsx:53]). Any new page param plumbing must keep the `await`. |
| **`q` (free-text) is client-only within the window** | Search filters only the 50-row window ([InventoryTable.tsx:112–134]) — by design (server-side text search out-of-scope per page.tsx:18–19). Don't "fix" search expecting it to page across the collection. |
| **EVT-08 staff scoping** | `useEventsLive` enforces `allowedStaff array-contains uid` for non-admins ([use-events-live.ts:101–104]). If you drop the listener (Option B), the SSR `getEventsPage` must already enforce EVT-08 (it does, per EventsTable.tsx:6–9 comment) — verify before removing the client filter. |
| **`/users` already correct** | Do NOT "fix" `/users` to add a listener — it's intentionally listener-free ([use-users-live.ts:14–28]). Use it as the reference implementation. |

---

## File Reference Index

| File | Lines | Role in bug |
|------|-------|-------------|
| `components/feature/inventory/InventoryTable.tsx` | 99 (no-opts call), 269–275 (goPrev/goNext), 397–422 (chrome) | Live hook clobbers seed; Next writes cursor that gets undone |
| `lib/hooks/use-inventory-live.ts` | 76–128 (esp. 104–110 query, 126 deps) | Cursor-blind listener → page-1 clobber + extra reads |
| `lib/data/inventory.server.ts` | 74–101 | Correct cursor SSR pagination (works) |
| `lib/hooks/use-url-table-state.ts` | 91–98 (setCursor), 77–88 (router.replace) | URL cursor write |
| `app/(app)/inventory/page.tsx` | 53–61, 79 | SSR seed + prop pass-down |
| `components/feature/events/EventsTable.tsx` | 106, 236–242 | Same defect (events) |
| `lib/hooks/use-events-live.ts` | 99–115 | Cursor-blind events listener |
| `components/feature/users/UsersTable.tsx` | 50, 143–160 | **Working reference** — href navigation + no-op listener |
| `lib/hooks/use-users-live.ts` | 29–31 | **The fix already applied here** (returns `initial`) |
| `components/feature/reports/ItemsOutTable.tsx` | 39 | Same defect (reports) |
| `app/(app)/reports/out/page.tsx` | 30–34 | Cursor SSR seed for reports |
| `components/feature/table/DataTablePagination.tsx` | 36–52 | Generic client-side prev/next (used by `/users` DataTable wrapper; not the cursor pages) |

---

## Open Questions

1. **Keep live updates on list pages at all?** Option B removes them. If real-time list updates are a hard requirement, Option A is needed — but it only fixes Symptom 1 and partially Symptom 2. *Recommendation: Option B; list pages don't need live updates, detail/scan flows keep theirs.*
2. **Restore "Page N of M"?** Would need `getCountFromServer` (cheap, 1 read). Separate request — confirm with user before scoping in.
3. **Prev button semantics** — `router.back()` is fragile for shared links. Acceptable for now or build a cursor stack? Lower priority.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The ~1.1K read spike is dominated by the SSR+listener double-read × repeated Next clicks, not a separate query | Root Cause 2 | If another path (e.g. a dashboard aggregation or a forgotten unbounded query) is the real driver, fixing pagination alone won't fully flatten reads. Verify with Firebase usage breakdown after fix. `[ASSUMED]` |
| A2 | `getCountFromServer` is a single cheap aggregation read, not a scan | Fix / Count query | Firebase aggregation pricing — confirmed by Firestore docs historically, but not re-verified this session. `[ASSUMED]` |

**Sources:** All findings `[VERIFIED: code]` by direct file read except A1/A2 above. Next.js version `16.2.6` confirmed via `node_modules/next/package.json`.
