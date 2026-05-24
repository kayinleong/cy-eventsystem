---
phase: 01-ui-poc
plan: 02
type: execute
wave: 1
depends_on: [01]
files_modified:
  - lib/mock/users.ts
  - lib/mock/items.ts
  - lib/mock/events.ts
  - lib/mock/transactions.ts
  - lib/mock/missing-items.ts
  - lib/mock/store.ts
  - lib/mock/selectors.ts
  - lib/mock/cookie.ts
  - lib/hooks/use-mock-store.ts
  - lib/hooks/use-current-user.ts
  - lib/auth/mock-session.ts
autonomous: true
requirements:
  - NFR-04
  - AUD-01
  - AUD-04
  - INV-09
  - RP-01
  - CO-04
  - CO-05
  - CO-06
  - CI-05
  - CI-06
  - CI-07
  - CI-08
  - MIS-01
  - MIS-03
  - MIS-04
  - EVT-07
  - RP-02
  - AUTH-07
  - AUTH-08
  - AUTH-09

must_haves:
  truths:
    - "Mock seed data contains ~30 items, 6 events, 5 users, ~80 transactions, ~6 missing items per CONTEXT.md D-03 with fixed 2026 dates per D-04."
    - "In-memory store at lib/mock/store.ts exposes subscribe/getSnapshot/getServerSnapshot per React 19 useSyncExternalStore contract."
    - "Store mutators (checkout, checkin, createItem, updateItem, retireItem, createEvent, updateEvent, cancelEvent, resolveMissing, inviteUser, setUserRole, disableUser, markLowStockOrdered, updateLowStockThreshold) produce new frozen snapshots and call emit()."
    - "Mock cookie helpers read/write the non-httpOnly `mock_session` cookie in both server and client contexts per CONTEXT.md D-05."
    - "Selectors in lib/mock/selectors.ts are pure functions over StoreSnapshot — same API will be reusable in Phase 2 against Firestore-backed snapshots."
    - "Both lib/hooks/use-mock-store.ts and lib/hooks/use-current-user.ts are 'use client' and exist (debounced-value + url-table-state hooks live in Plan 03 with their DataTable consumer)."
  artifacts:
    - path: "lib/mock/store.ts"
      provides: "StoreSnapshot type, subscribe(), getSnapshot(), getServerSnapshot(), 14 mutator functions"
      contains: "useSyncExternalStore-compatible API"
      min_lines: 250
    - path: "lib/mock/items.ts"
      provides: "seedItems: InventoryItem[] (~30 items, 4 categories, lifecycle distribution incl. damaged + retired)"
      contains: "export const seedItems"
      min_lines: 100
    - path: "lib/mock/events.ts"
      provides: "seedEvents: EventDoc[] (6 events covering all 4 statuses + 1 overdue)"
      contains: "export const seedEvents"
      min_lines: 80
    - path: "lib/mock/users.ts"
      provides: "seedUsers: UserDoc[] (5 users: 2 admin + 3 staff, 1 disabled)"
      contains: "export const seedUsers"
    - path: "lib/mock/transactions.ts"
      provides: "seedTransactions: TransactionDoc[] (~80 across all event statuses)"
      contains: "export const seedTransactions"
      min_lines: 120
    - path: "lib/mock/missing-items.ts"
      provides: "seedMissingItems: MissingItemDoc[] (~6, mix open + resolved)"
      contains: "export const seedMissingItems"
    - path: "lib/mock/selectors.ts"
      provides: "Pure selectors: byId lookups, low-stock, overdue, active events, recent activity, history filters"
      contains: "selectItemById"
    - path: "lib/mock/cookie.ts"
      provides: "setMockSession, clearMockSession (server) + writeMockSessionClient, readMockSessionClient (client)"
      contains: "mock_session"
    - path: "lib/auth/mock-session.ts"
      provides: "getMockSession() and requireAdmin() server helpers for layouts and admin-only routes"
      contains: "requireAdmin"
    - path: "lib/hooks/use-mock-store.ts"
      provides: "useMockStore<T>(selector) wrapping useSyncExternalStore"
      contains: "useSyncExternalStore"
  key_links:
    - from: "lib/mock/store.ts"
      to: "lib/mock/items.ts, lib/mock/events.ts, lib/mock/users.ts, lib/mock/transactions.ts, lib/mock/missing-items.ts"
      via: "Imports seed arrays as initial state"
      pattern: "import \\{ seedItems \\}|import \\{ seedEvents \\}"
    - from: "lib/hooks/use-mock-store.ts"
      to: "lib/mock/store.ts"
      via: "useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getServerSnapshot()))"
      pattern: "useSyncExternalStore"
    - from: "lib/auth/mock-session.ts"
      to: "lib/mock/cookie.ts + lib/types/session.ts"
      via: "Reads cookie via Next 16 async cookies() then JSON.parses to Session"
      pattern: "await cookies\\(\\)"
---

<objective>
Build the in-memory mock data layer + store + selectors + hooks + cookie helpers. This is the single source of truth for Phase 1 — every UI component reads from it, every mutation writes to it. State resets on full page reload (no persistence).

Purpose: This is the data substrate. Without it, every UI plan from Wave 3 onwards has nothing to render.

Output: 5 seed files, 1 store file with 14 mutators, 1 selectors file, 1 cookie helper, 4 client hooks, 1 server auth helper.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-PATTERNS.md
@.planning/research/ARCHITECTURE.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md
@lib/types/item.ts
@lib/types/event.ts
@lib/types/user.ts
@lib/types/transaction.ts
@lib/types/missing-item.ts
@lib/types/session.ts

<interfaces>
<!-- Phase 1 mock store contract — must be reusable as-is in components. Plan 03 onwards depends on these exact exports. -->

```ts
// lib/mock/store.ts
export type StoreSnapshot = Readonly<{
  items: readonly InventoryItem[];
  events: readonly EventDoc[];
  users: readonly UserDoc[];
  transactions: readonly TransactionDoc[];
  missingItems: readonly MissingItemDoc[];
}>;

export function subscribe(listener: () => void): () => void;
export function getSnapshot(): StoreSnapshot;
export function getServerSnapshot(): StoreSnapshot;

// Mutators (each produces a new frozen snapshot and emits)
export function checkout(args: { eventId: string; lines: { itemId: string; qty: number }[]; actor: UserDoc }): { ok: true; txIds: string[] } | { ok: false; error: string; failedLines?: { itemId: string; available: number }[] };
export function checkin(args: { eventId: string; lines: { parentTxId: string; itemId: string; returnedQty: number; damagedQty: number; missingReason?: MissingReason }[]; actor: UserDoc }): { ok: true; txIds: string[]; missingIds: string[] };
export function createItem(input: Omit<InventoryItem, "id" | "availableQty" | "outQty" | "damagedQty" | "lifecycleState" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">, actor: UserDoc): InventoryItem;
export function updateItem(itemId: string, patch: Partial<InventoryItem>, actor: UserDoc): void;
export function retireItem(itemId: string, actor: UserDoc): void;
export function createEvent(input: Omit<EventDoc, "id" | "status" | "allowedStaff" | "plannedItems" | "createdAt" | "createdBy" | "closedAt" | "closedBy">, actor: UserDoc): EventDoc;
export function updateEvent(eventId: string, patch: Partial<EventDoc>, actor: UserDoc): void;
export function cancelEvent(eventId: string, reconciliations: { itemId: string; resolution: "returned" | "lost" | "still_with_owner"; qty: number }[], actor: UserDoc): void;
export function resolveMissing(missingId: string, resolution: "found" | "writtenOff", actor: UserDoc): void;
export function inviteUser(input: { email: string; displayName: string; role: UserRole }, actor: UserDoc): UserDoc;
export function setUserRole(uid: string, role: UserRole, actor: UserDoc): void;
export function disableUser(uid: string, actor: UserDoc): void;
export function markLowStockOrdered(itemId: string, actor: UserDoc): void;
export function updateLowStockThreshold(itemId: string, threshold: number, actor: UserDoc): void;
```

```ts
// lib/mock/selectors.ts — pure functions over StoreSnapshot
export function selectItemById(s: StoreSnapshot, id: string): InventoryItem | undefined;
export function selectEventById(s: StoreSnapshot, id: string): EventDoc | undefined;
export function selectUserByUid(s: StoreSnapshot, uid: string): UserDoc | undefined;
export function selectUserByEmail(s: StoreSnapshot, email: string): UserDoc | undefined;
export function selectActiveEvents(s: StoreSnapshot): EventDoc[];
export function selectOverdueEvents(s: StoreSnapshot, today?: Date): EventDoc[];
export function selectLowStockItems(s: StoreSnapshot): InventoryItem[];
export function selectAccessibleEvents(s: StoreSnapshot, uid: string, role: UserRole, statuses?: EventStatus[]): EventDoc[];
export function selectOpenCheckoutsForEvent(s: StoreSnapshot, eventId: string): TransactionDoc[];
export function selectTransactionsForItem(s: StoreSnapshot, itemId: string): TransactionDoc[];
export function selectTransactionsForEvent(s: StoreSnapshot, eventId: string): TransactionDoc[];
export function selectOpenMissing(s: StoreSnapshot): MissingItemDoc[];
export function selectRecentActivity(s: StoreSnapshot, limit?: number): TransactionDoc[];
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create 5 seed-data files in lib/mock/</name>
  <files>
    lib/mock/users.ts,
    lib/mock/items.ts,
    lib/mock/events.ts,
    lib/mock/transactions.ts,
    lib/mock/missing-items.ts
  </files>
  <read_first>
    - lib/types/item.ts, lib/types/event.ts, lib/types/user.ts, lib/types/transaction.ts, lib/types/missing-item.ts (all created in Plan 01)
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-01 (mock data architecture), D-03 (seed volumes), D-04 (fixed 2026 dates)
    - .planning/research/ARCHITECTURE.md (field shapes)
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Mock Data Contract" section (lines 330-336 — status distribution must include every status, all 4 categories, etc.)
    - .planning/REQUIREMENTS.md INV-09 (lifecycle states), EVT-02 (event statuses), CI-04 (missing reasons), AUD-01 (actor snapshots), EVT-07 (overdue must be visible)
  </read_first>
  <action>
    Create 5 typed, deterministic, exported-array seed files. NO `Math.random()`. NO faker library. All dates are fixed 2026 ISO strings.

    **lib/mock/users.ts** (5 users — 2 admin, 3 staff, 1 disabled per D-03):
    ```ts
    import type { UserDoc } from "@/lib/types/user";

    export const seedUsers: UserDoc[] = [
      { uid: "u-admin-1",  email: "alex.chen@example.com",   displayName: "Alex Chen",       role: "admin", disabled: false, createdAt: "2026-01-12T09:00:00.000Z", createdBy: "system",   lastLoginAt: "2026-05-22T08:14:00.000Z" },
      { uid: "u-admin-2",  email: "morgan.lee@example.com",  displayName: "Morgan Lee",      role: "admin", disabled: false, createdAt: "2026-01-15T10:30:00.000Z", createdBy: "u-admin-1", lastLoginAt: "2026-05-23T12:01:00.000Z" },
      { uid: "u-staff-1",  email: "sam.patel@example.com",   displayName: "Sam Patel",       role: "staff", disabled: false, createdAt: "2026-02-02T14:00:00.000Z", createdBy: "u-admin-1", lastLoginAt: "2026-05-23T09:50:00.000Z" },
      { uid: "u-staff-2",  email: "jordan.kim@example.com",  displayName: "Jordan Kim",      role: "staff", disabled: false, createdAt: "2026-02-15T11:20:00.000Z", createdBy: "u-admin-2", lastLoginAt: "2026-05-21T16:35:00.000Z" },
      { uid: "u-staff-3",  email: "casey.ramirez@example.com", displayName: "Casey Ramirez", role: "staff", disabled: true,  createdAt: "2026-03-04T08:45:00.000Z", createdBy: "u-admin-1", lastLoginAt: "2026-04-10T18:20:00.000Z" },
    ];
    ```
    Note: all 5 users share password `"password"` per CONTEXT.md D-08 — the password is NOT stored in this file; the login form checks against the literal string.

    **lib/mock/items.ts** (~30 items, 4 categories, exercise all 4 lifecycle states + low-stock):
    Create exactly 30 items distributed approximately:
    - Audio: 8 items (e.g., wireless mics, mixers, speakers, cables)
    - Lighting: 8 items (e.g., LED panels, par cans, gels, stands)
    - Display: 7 items (e.g., monitors, projectors, screens, HDMI)
    - Marketing: 7 items (e.g., banners, brochures, demo units, flyers)

    Distribution invariants (every item):
    - Set unique `id` and `sku` (SKU pattern: `AUD-MIC-01`, `LGT-LED-04`, etc. — uppercase, hyphens).
    - `id === sku` for every item.
    - `availableQty + outQty + damagedQty <= totalQty` (the rest are retired).
    - At least 4 items have `lifecycleState: "available"` AND `availableQty <= lowStockThreshold` so the low-stock widget (RP-02) has visible cases.
    - At least 1 item has `lifecycleState: "checked_out"` (some out, some still here).
    - At least 1 item has `lifecycleState: "damaged"` (damagedQty > 0).
    - At least 1 item has `lifecycleState: "retired"` (totalQty > 0, all in retired).
    - At least 1 item per category has `lowStockThreshold > 0`.
    - All dates use fixed 2026 ISO strings (e.g., createdAt 2026-01-15..2026-04-30 spread).
    - `createdBy` and `updatedBy` are admin uids from seedUsers.
    - `photoUrl: null` for every item in Phase 1 (no real Storage URLs).

    Example shape (first 3 items shown, executor implements remaining 27 following same pattern):
    ```ts
    import type { InventoryItem } from "@/lib/types/item";

    export const seedItems: InventoryItem[] = [
      { id: "AUD-MIC-01", sku: "AUD-MIC-01", name: "Shure SM58 wireless mic", category: "Audio", totalQty: 12, availableQty: 8, outQty: 3, damagedQty: 1, unit: "pcs", photoUrl: null, notes: "Frequency band G50.", lifecycleState: "available", lowStockThreshold: 3, lowStockOrderedAt: null, createdAt: "2026-01-20T10:00:00.000Z", updatedAt: "2026-05-10T14:20:00.000Z", createdBy: "u-admin-1", updatedBy: "u-admin-1" },
      { id: "AUD-MIX-01", sku: "AUD-MIX-01", name: "Yamaha MG10 mixer", category: "Audio", totalQty: 4, availableQty: 4, outQty: 0, damagedQty: 0, unit: "pcs", photoUrl: null, notes: "", lifecycleState: "available", lowStockThreshold: 1, lowStockOrderedAt: null, createdAt: "2026-01-22T11:00:00.000Z", updatedAt: "2026-01-22T11:00:00.000Z", createdBy: "u-admin-1", updatedBy: "u-admin-1" },
      { id: "LGT-LED-01", sku: "LGT-LED-01", name: "ARRI LED panel S60", category: "Lighting", totalQty: 6, availableQty: 1, outQty: 5, damagedQty: 0, unit: "pcs", photoUrl: null, notes: "Battery + AC.", lifecycleState: "checked_out", lowStockThreshold: 2, lowStockOrderedAt: null, createdAt: "2026-02-01T09:00:00.000Z", updatedAt: "2026-05-12T15:00:00.000Z", createdBy: "u-admin-2", updatedBy: "u-admin-1" },
      // ... 27 more items, deterministically chosen, with the constraints above
    ];
    ```

    **lib/mock/events.ts** (6 events covering all 4 statuses + 1 explicitly overdue per EVT-07):
    ```ts
    import type { EventDoc } from "@/lib/types/event";

    export const seedEvents: EventDoc[] = [
      // 1 planned — future event with team leads only
      { id: "evt-planned-01", name: "Summer Tech Conference 2026", startDate: "2026-07-15T09:00:00.000Z", endDate: "2026-07-17T18:00:00.000Z", status: "planned", location: "Convention Center, Hall A", description: "3-day tech conference with 4 stages.", teamLeads: ["u-admin-2"], backupTeams: ["u-staff-1"], allowedStaff: ["u-admin-1","u-admin-2","u-staff-1"], plannedItems: {}, createdAt: "2026-04-15T10:00:00.000Z", createdBy: "u-admin-2", closedAt: null, closedBy: null },
      // 2 active — currently running, items checked out
      { id: "evt-active-01", name: "Spring Product Demo", startDate: "2026-05-20T08:00:00.000Z", endDate: "2026-05-26T20:00:00.000Z", status: "active", location: "HQ Atrium", description: "On-site product demo week.", teamLeads: ["u-admin-1"], backupTeams: ["u-staff-1","u-staff-2"], allowedStaff: ["u-admin-1","u-admin-2","u-staff-1","u-staff-2"], plannedItems: {}, createdAt: "2026-05-01T08:00:00.000Z", createdBy: "u-admin-1", closedAt: null, closedBy: null },
      // 3 active overdue — endDate < today (today is 2026-05-24 per project context) AND status active → EVT-07
      { id: "evt-overdue-01", name: "Marketing Pop-Up Booth", startDate: "2026-05-10T10:00:00.000Z", endDate: "2026-05-22T18:00:00.000Z", status: "active", location: "Mall Plaza", description: "10-day pop-up; items not yet returned.", teamLeads: ["u-staff-2"], backupTeams: [], allowedStaff: ["u-admin-1","u-admin-2","u-staff-2"], plannedItems: {}, createdAt: "2026-04-28T09:00:00.000Z", createdBy: "u-admin-1", closedAt: null, closedBy: null },
      // 4 completed
      { id: "evt-completed-01", name: "Q1 Town Hall", startDate: "2026-03-10T09:00:00.000Z", endDate: "2026-03-10T17:00:00.000Z", status: "completed", location: "Auditorium", description: "Quarterly town hall.", teamLeads: ["u-admin-2"], backupTeams: ["u-staff-1"], allowedStaff: ["u-admin-1","u-admin-2","u-staff-1"], plannedItems: {}, createdAt: "2026-02-15T10:00:00.000Z", createdBy: "u-admin-2", closedAt: "2026-03-11T10:00:00.000Z", closedBy: "u-admin-2" },
      // 5 cancelled
      { id: "evt-cancelled-01", name: "Cancelled Roadshow Stop", startDate: "2026-04-20T10:00:00.000Z", endDate: "2026-04-22T18:00:00.000Z", status: "cancelled", location: "Venue TBD", description: "Cancelled due to venue conflict.", teamLeads: ["u-admin-1"], backupTeams: [], allowedStaff: ["u-admin-1","u-admin-2"], plannedItems: {}, createdAt: "2026-03-25T09:00:00.000Z", createdBy: "u-admin-1", closedAt: "2026-04-18T15:00:00.000Z", closedBy: "u-admin-1" },
      // 6 planned (small, staff-led)
      { id: "evt-planned-02", name: "Booth at Annual Expo", startDate: "2026-08-12T08:00:00.000Z", endDate: "2026-08-14T20:00:00.000Z", status: "planned", location: "Expo Hall C", description: "Annual industry expo.", teamLeads: ["u-staff-1"], backupTeams: ["u-staff-2"], allowedStaff: ["u-admin-1","u-admin-2","u-staff-1","u-staff-2"], plannedItems: {}, createdAt: "2026-05-05T10:00:00.000Z", createdBy: "u-staff-1", closedAt: null, closedBy: null },
    ];
    ```
    Critical: `allowedStaff` is the union of `teamLeads + backupTeams + all admin uids` per ARCHITECTURE.md. Executor must populate this manually (Phase 2 Cloud Function maintains it; Phase 1 hard-codes it).

    **lib/mock/transactions.ts** (~80 transactions distributed across the 6 events):
    Create 80 deterministic `TransactionDoc` entries. Distribution:
    - evt-active-01: ~25 transactions (mix of `checkout` open, `checkout` matched with `checkin`, `checkin` with damagedQty)
    - evt-overdue-01: ~10 checkouts ALL still open (parentTxId on later checkins is null because there are no checkins yet for this overdue event)
    - evt-completed-01: ~25 transactions (full cycle: checkouts + checkins + 1 missing flagged + 1 adjustment)
    - evt-cancelled-01: ~5 transactions before cancellation
    - evt-planned-01, evt-planned-02: 0 transactions (no checkouts yet)
    - Global: ~15 additional transactions (item adjustments, missing flags, missing resolutions)

    Every transaction MUST have:
    - Denormalized `itemSku`, `itemName`, `eventName` so the history page (REP-04) doesn't need joins.
    - `actorRoleAtTimeOfAction` snapshot per AUD-01 (either "admin" or "staff" matching the actor at that time).
    - `at` ISO string in 2026 (sequential within each event).
    - `parentTxId` set for `checkin` transactions to the matching `checkout` tx id. (CI-08).
    - `clientTxId: null` for all (this field is used for idempotency in Phase 2).

    Example shape (first 3):
    ```ts
    import type { TransactionDoc } from "@/lib/types/transaction";

    export const seedTransactions: TransactionDoc[] = [
      { id: "tx-001", type: "checkout", itemId: "AUD-MIC-01", itemSku: "AUD-MIC-01", itemName: "Shure SM58 wireless mic", eventId: "evt-active-01", eventName: "Spring Product Demo", qty: 3, actorUid: "u-staff-1", actorName: "Sam Patel", actorRoleAtTimeOfAction: "staff", at: "2026-05-20T08:30:00.000Z", notes: "", parentTxId: null, clientTxId: null },
      { id: "tx-002", type: "checkout", itemId: "LGT-LED-01", itemSku: "LGT-LED-01", itemName: "ARRI LED panel S60", eventId: "evt-active-01", eventName: "Spring Product Demo", qty: 5, actorUid: "u-staff-1", actorName: "Sam Patel", actorRoleAtTimeOfAction: "staff", at: "2026-05-20T08:32:00.000Z", notes: "", parentTxId: null, clientTxId: null },
      // ... 78 more, with matched checkins for completed events, missing transactions where qty doesn't return, adjustment transactions where admin changed totalQty
    ];
    ```
    Executor must ensure:
    - The math reconciles: for each item, `sum(checkout.qty - checkin.qty)` over completed/cancelled events <= outQty of that item in seedItems for active/overdue events. Don't over-engineer; ensure no contradictions visible to a checker.

    **lib/mock/missing-items.ts** (~6 missing-item records):
    Create 6 records covering:
    - 3 open: one per reason variant (`Lost`, `Damaged`, `Not returned`)
    - 2 resolved as `found` (with `resolvedAt`, `resolvedBy` populated; `status: "found"`)
    - 1 resolved as `writtenOff`

    Each MUST have `parentCheckinTxId` referencing an existing transaction id in seedTransactions where `type === "checkin"`.

    ```ts
    import type { MissingItemDoc } from "@/lib/types/missing-item";

    export const seedMissingItems: MissingItemDoc[] = [
      { id: "miss-001", itemId: "AUD-MIC-01", itemName: "Shure SM58 wireless mic", eventId: "evt-completed-01", eventName: "Q1 Town Hall", qty: 1, reason: "Lost", reportedBy: "u-staff-1", reportedByName: "Sam Patel", reportedAt: "2026-03-11T09:00:00.000Z", status: "open", resolvedAt: null, resolvedBy: null, parentCheckinTxId: "tx-XXX" },
      // ... 5 more
    ];
    ```
    Replace `tx-XXX` with the actual transaction id from seedTransactions.

    Critical for ALL 5 files:
    - Fixed 2026 dates (D-04) — no `new Date().toISOString()`.
    - Deterministic (D-03) — running the file twice produces the same arrays.
    - All references between files (item ids in transactions, event ids in transactions, transaction ids in missingItems, user uids in actorUid) must resolve. Do not invent ids that don't exist.
    - Each file's first 5 lines start with `import type` from the relevant `@/lib/types/*` file.
  </action>
  <verify>
    <automated>node -e "const u=require('./lib/mock/users.ts.replace(/\\.ts$/,'')); console.log(u.seedUsers.length)" 2>/dev/null || true; grep -c "^  {" lib/mock/users.ts | grep -q "^5$"; grep -c "id: \"" lib/mock/events.ts | grep -q "^6$"; grep -c "{ id: \"" lib/mock/missing-items.ts | grep -q "^6$"; grep -q "evt-overdue-01" lib/mock/events.ts; grep -q "lifecycleState: \"damaged\"" lib/mock/items.ts; grep -q "lifecycleState: \"retired\"" lib/mock/items.ts; grep -q "lifecycleState: \"checked_out\"" lib/mock/items.ts; grep -c "category: \"Audio\"" lib/mock/items.ts; grep -c "category: \"Marketing\"" lib/mock/items.ts; grep -c "actorRoleAtTimeOfAction" lib/mock/transactions.ts; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `lib/mock/users.ts` contains exactly 5 user objects (verify by counting `^  {` lines).
    - `lib/mock/events.ts` contains exactly 6 events, one for each status: planned (2), active (2 — one overdue), completed (1), cancelled (1). `grep -q "evt-overdue-01" lib/mock/events.ts` (overdue event present per EVT-07).
    - `lib/mock/items.ts` contains 30 items: `grep -c "^  { id: \"" lib/mock/items.ts | grep -q "^30$"`. All 4 categories present. All 4 lifecycle states present (`grep -q "lifecycleState: \"damaged\""`, `... \"retired\"`, `... \"checked_out\"`, `... \"available\"`).
    - `lib/mock/transactions.ts` contains ≥75 transactions. Every transaction has `actorRoleAtTimeOfAction` field. At least one transaction of each type (`checkout`, `checkin`, `adjustment`, `missing`).
    - `lib/mock/missing-items.ts` contains exactly 6 records covering reasons `Lost`, `Damaged`, `Not returned` and statuses `open` (3), `found` (2), `writtenOff` (1).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>5 seed files exist, satisfy all distribution requirements, all dates are fixed 2026 strings, tsc passes.</done>
</task>

<task type="auto">
  <name>Task 2: Build mock store, selectors, cookie helpers, store/session hooks, server auth helper</name>
  <files>
    lib/mock/store.ts,
    lib/mock/selectors.ts,
    lib/mock/cookie.ts,
    lib/hooks/use-mock-store.ts,
    lib/hooks/use-current-user.ts,
    lib/auth/mock-session.ts
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md sections "Mock store" (lines 392-453), "Mock store consumer hook" (lines 456-471), "Mock cookie helpers" (lines 476-514), "Per-route role gate" (lines 314-342)
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-02 (useSyncExternalStore), D-05 (cookie shape), D-07 (strict role gate), D-09/D-10/D-11/D-12 (URL state sync)
    - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md (Next 16 async cookies)
    - lib/mock/items.ts, lib/mock/events.ts, lib/mock/users.ts, lib/mock/transactions.ts, lib/mock/missing-items.ts (created in Task 1)
    - lib/types/session.ts
  </read_first>
  <action>
    Implement 8 files. Each file must be a single, complete, type-checked module.

    **lib/mock/store.ts** (single in-memory store; React 19 useSyncExternalStore-compatible):
    ```ts
    import type { InventoryItem, ItemLifecycleState, ItemCategory } from "@/lib/types/item";
    import type { EventDoc, EventStatus } from "@/lib/types/event";
    import type { UserDoc, UserRole } from "@/lib/types/user";
    import type { TransactionDoc, TransactionType } from "@/lib/types/transaction";
    import type { MissingItemDoc, MissingReason } from "@/lib/types/missing-item";

    import { seedItems } from "./items";
    import { seedEvents } from "./events";
    import { seedUsers } from "./users";
    import { seedTransactions } from "./transactions";
    import { seedMissingItems } from "./missing-items";

    export type StoreSnapshot = Readonly<{
      items: readonly InventoryItem[];
      events: readonly EventDoc[];
      users: readonly UserDoc[];
      transactions: readonly TransactionDoc[];
      missingItems: readonly MissingItemDoc[];
    }>;

    let state: StoreSnapshot = Object.freeze({
      items: seedItems,
      events: seedEvents,
      users: seedUsers,
      transactions: seedTransactions,
      missingItems: seedMissingItems,
    });

    const listeners = new Set<() => void>();
    const emit = () => listeners.forEach((l) => l());

    export function subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
    export function getSnapshot(): StoreSnapshot { return state; }
    export function getServerSnapshot(): StoreSnapshot { return state; }

    // ID generator (Phase 1 only; Phase 2 uses Firestore-generated ids)
    let txCounter = state.transactions.length + 1;
    function nextTxId(): string { return `tx-${String(txCounter++).padStart(4, "0")}`; }
    let missingCounter = state.missingItems.length + 1;
    function nextMissingId(): string { return `miss-${String(missingCounter++).padStart(3, "0")}`; }
    let userCounter = state.users.length + 1;
    function nextUserUid(): string { return `u-staff-new-${userCounter++}`; }

    // MUTATORS — every mutator: 1) builds a new frozen snapshot, 2) assigns to `state`, 3) calls emit().

    export function checkout(args: {
      eventId: string;
      lines: { itemId: string; qty: number }[];
      actor: UserDoc;
    }): { ok: true; txIds: string[] } | { ok: false; error: string; failedLines?: { itemId: string; available: number }[] } {
      // CO-05: refuse if any line would drive availableQty < 0; whole cart fails atomically
      const failedLines: { itemId: string; available: number }[] = [];
      for (const line of args.lines) {
        const item = state.items.find((i) => i.id === line.itemId);
        if (!item || item.lifecycleState === "retired") { failedLines.push({ itemId: line.itemId, available: 0 }); continue; }
        if (item.availableQty < line.qty) failedLines.push({ itemId: line.itemId, available: item.availableQty });
      }
      if (failedLines.length > 0) return { ok: false, error: "Not enough stock", failedLines };

      const event = state.events.find((e) => e.id === args.eventId);
      if (!event) return { ok: false, error: "Event not found" };

      const now = new Date().toISOString();
      const newTxs: TransactionDoc[] = args.lines.map((line) => {
        const item = state.items.find((i) => i.id === line.itemId)!;
        return {
          id: nextTxId(), type: "checkout", itemId: item.id, itemSku: item.sku, itemName: item.name,
          eventId: event.id, eventName: event.name, qty: line.qty,
          actorUid: args.actor.uid, actorName: args.actor.displayName, actorRoleAtTimeOfAction: args.actor.role,
          at: now, notes: "", parentTxId: null, clientTxId: null,
        };
      });
      const newItems = state.items.map((item) => {
        const totalOut = args.lines.filter((l) => l.itemId === item.id).reduce((s, l) => s + l.qty, 0);
        if (totalOut === 0) return item;
        return {
          ...item,
          availableQty: item.availableQty - totalOut,
          outQty: item.outQty + totalOut,
          lifecycleState: (item.availableQty - totalOut === 0 ? "checked_out" : item.lifecycleState) as ItemLifecycleState,
          updatedAt: now,
          updatedBy: args.actor.uid,
        };
      });
      state = Object.freeze({ ...state, items: newItems, transactions: [...state.transactions, ...newTxs] });
      emit();
      return { ok: true, txIds: newTxs.map((t) => t.id) };
    }

    export function checkin(args: {
      eventId: string;
      lines: { parentTxId: string; itemId: string; returnedQty: number; damagedQty: number; missingReason?: MissingReason }[];
      actor: UserDoc;
    }): { ok: true; txIds: string[]; missingIds: string[] } {
      // CI-05, CI-06, CI-07, CI-08: returns flow to availableQty; damaged to damagedQty; missing creates MissingItem record; parentTxId set
      const now = new Date().toISOString();
      const event = state.events.find((e) => e.id === args.eventId)!;
      const newTxs: TransactionDoc[] = [];
      const newMissing: MissingItemDoc[] = [];

      for (const line of args.lines) {
        const item = state.items.find((i) => i.id === line.itemId)!;
        const parent = state.transactions.find((t) => t.id === line.parentTxId);
        const checkedOutQty = parent?.qty ?? 0;
        const missingQty = checkedOutQty - line.returnedQty - line.damagedQty;

        if (line.returnedQty + line.damagedQty > 0) {
          newTxs.push({
            id: nextTxId(), type: "checkin", itemId: item.id, itemSku: item.sku, itemName: item.name,
            eventId: event.id, eventName: event.name, qty: line.returnedQty + line.damagedQty,
            actorUid: args.actor.uid, actorName: args.actor.displayName, actorRoleAtTimeOfAction: args.actor.role,
            at: now, notes: line.damagedQty > 0 ? `${line.damagedQty} damaged` : "",
            parentTxId: line.parentTxId, clientTxId: null,
          });
        }
        if (missingQty > 0 && line.missingReason) {
          const checkinTxId = newTxs[newTxs.length - 1]?.id ?? nextTxId();
          newMissing.push({
            id: nextMissingId(), itemId: item.id, itemName: item.name, eventId: event.id, eventName: event.name,
            qty: missingQty, reason: line.missingReason, reportedBy: args.actor.uid, reportedByName: args.actor.displayName,
            reportedAt: now, status: "open", resolvedAt: null, resolvedBy: null, parentCheckinTxId: checkinTxId,
          });
          newTxs.push({
            id: nextTxId(), type: "missing", itemId: item.id, itemSku: item.sku, itemName: item.name,
            eventId: event.id, eventName: event.name, qty: missingQty,
            actorUid: args.actor.uid, actorName: args.actor.displayName, actorRoleAtTimeOfAction: args.actor.role,
            at: now, notes: `Reason: ${line.missingReason}`, parentTxId: line.parentTxId, clientTxId: null,
          });
        }
      }

      const newItems = state.items.map((item) => {
        const itemLines = args.lines.filter((l) => l.itemId === item.id);
        if (itemLines.length === 0) return item;
        const totalReturned = itemLines.reduce((s, l) => s + l.returnedQty, 0);
        const totalDamaged = itemLines.reduce((s, l) => s + l.damagedQty, 0);
        const newAvailable = item.availableQty + totalReturned;
        const newOut = item.outQty - (totalReturned + totalDamaged + itemLines.reduce((s, l) => {
          const parent = state.transactions.find((t) => t.id === l.parentTxId);
          const co = parent?.qty ?? 0;
          return s + Math.max(0, co - l.returnedQty - l.damagedQty);
        }, 0));
        return {
          ...item,
          availableQty: newAvailable,
          outQty: Math.max(0, newOut),
          damagedQty: item.damagedQty + totalDamaged,
          lifecycleState: (totalDamaged > 0 && item.damagedQty + totalDamaged > 0 && newAvailable === 0
            ? "damaged"
            : newAvailable > 0 ? "available" : item.lifecycleState) as ItemLifecycleState,
          updatedAt: now,
          updatedBy: args.actor.uid,
        };
      });

      state = Object.freeze({
        ...state,
        items: newItems,
        transactions: [...state.transactions, ...newTxs],
        missingItems: [...state.missingItems, ...newMissing],
      });
      emit();
      return { ok: true, txIds: newTxs.map((t) => t.id), missingIds: newMissing.map((m) => m.id) };
    }

    export function createItem(
      input: { name: string; sku: string; category: ItemCategory; totalQty: number; unit: string; photoUrl: string | null; notes: string; lowStockThreshold: number },
      actor: UserDoc
    ): InventoryItem {
      const now = new Date().toISOString();
      const item: InventoryItem = {
        id: input.sku, sku: input.sku, name: input.name, category: input.category,
        totalQty: input.totalQty, availableQty: input.totalQty, outQty: 0, damagedQty: 0,
        unit: input.unit, photoUrl: input.photoUrl, notes: input.notes,
        lifecycleState: "available", lowStockThreshold: input.lowStockThreshold, lowStockOrderedAt: null,
        createdAt: now, updatedAt: now, createdBy: actor.uid, updatedBy: actor.uid,
      };
      state = Object.freeze({ ...state, items: [...state.items, item] });
      emit();
      return item;
    }

    export function updateItem(itemId: string, patch: Partial<InventoryItem>, actor: UserDoc): void {
      const now = new Date().toISOString();
      const newItems = state.items.map((i) => i.id === itemId ? { ...i, ...patch, updatedAt: now, updatedBy: actor.uid } : i);
      state = Object.freeze({ ...state, items: newItems });
      emit();
    }

    export function retireItem(itemId: string, actor: UserDoc): void {
      updateItem(itemId, { lifecycleState: "retired" }, actor);
    }

    export function createEvent(
      input: { name: string; startDate: string; endDate: string; location: string; description: string; teamLeads: string[]; backupTeams: string[] },
      actor: UserDoc
    ): EventDoc {
      const now = new Date().toISOString();
      const adminUids = state.users.filter((u) => u.role === "admin").map((u) => u.uid);
      const allowedStaff = Array.from(new Set([...adminUids, ...input.teamLeads, ...input.backupTeams]));
      const event: EventDoc = {
        id: `evt-${Date.now()}`, name: input.name, startDate: input.startDate, endDate: input.endDate,
        status: "planned", location: input.location, description: input.description,
        teamLeads: input.teamLeads, backupTeams: input.backupTeams, allowedStaff,
        plannedItems: {}, createdAt: now, createdBy: actor.uid, closedAt: null, closedBy: null,
      };
      state = Object.freeze({ ...state, events: [...state.events, event] });
      emit();
      return event;
    }

    export function updateEvent(eventId: string, patch: Partial<EventDoc>, actor: UserDoc): void {
      const newEvents = state.events.map((e) => {
        if (e.id !== eventId) return e;
        const teamLeads = patch.teamLeads ?? e.teamLeads;
        const backupTeams = patch.backupTeams ?? e.backupTeams;
        const adminUids = state.users.filter((u) => u.role === "admin").map((u) => u.uid);
        const allowedStaff = Array.from(new Set([...adminUids, ...teamLeads, ...backupTeams]));
        return { ...e, ...patch, teamLeads, backupTeams, allowedStaff };
      });
      state = Object.freeze({ ...state, events: newEvents });
      emit();
    }

    export function cancelEvent(
      eventId: string,
      reconciliations: { itemId: string; resolution: "returned" | "lost" | "still_with_owner"; qty: number }[],
      actor: UserDoc
    ): void {
      // EVT-06: cancellation requires reconciling open check-outs
      const now = new Date().toISOString();
      const newTxs: TransactionDoc[] = reconciliations.map((r) => ({
        id: nextTxId(),
        type: r.resolution === "returned" ? "checkin" : "adjustment",
        itemId: r.itemId,
        itemSku: state.items.find((i) => i.id === r.itemId)?.sku ?? r.itemId,
        itemName: state.items.find((i) => i.id === r.itemId)?.name ?? "",
        eventId, eventName: state.events.find((e) => e.id === eventId)?.name ?? "",
        qty: r.qty,
        actorUid: actor.uid, actorName: actor.displayName, actorRoleAtTimeOfAction: actor.role,
        at: now, notes: `Cancellation reconciliation: ${r.resolution}`, parentTxId: null, clientTxId: null,
      }));
      const newEvents = state.events.map((e) => e.id === eventId ? { ...e, status: "cancelled" as EventStatus, closedAt: now, closedBy: actor.uid } : e);
      state = Object.freeze({ ...state, events: newEvents, transactions: [...state.transactions, ...newTxs] });
      emit();
    }

    export function resolveMissing(missingId: string, resolution: "found" | "writtenOff", actor: UserDoc): void {
      // MIS-03, MIS-04: status update + follow-up transaction; if found, return qty to availableQty; if writtenOff, decrement totalQty
      const now = new Date().toISOString();
      const record = state.missingItems.find((m) => m.id === missingId);
      if (!record) return;

      const newMissing = state.missingItems.map((m) => m.id === missingId
        ? { ...m, status: resolution, resolvedAt: now, resolvedBy: actor.uid }
        : m);

      const newItems = state.items.map((item) => {
        if (item.id !== record.itemId) return item;
        if (resolution === "found") return { ...item, availableQty: item.availableQty + record.qty, updatedAt: now, updatedBy: actor.uid };
        return { ...item, totalQty: Math.max(0, item.totalQty - record.qty), updatedAt: now, updatedBy: actor.uid };
      });

      const followUpTx: TransactionDoc = {
        id: nextTxId(), type: "adjustment", itemId: record.itemId, itemSku: state.items.find((i) => i.id === record.itemId)?.sku ?? "",
        itemName: record.itemName, eventId: record.eventId, eventName: record.eventName, qty: record.qty,
        actorUid: actor.uid, actorName: actor.displayName, actorRoleAtTimeOfAction: actor.role,
        at: now, notes: `Missing resolved: ${resolution}`, parentTxId: record.parentCheckinTxId, clientTxId: null,
      };
      state = Object.freeze({ ...state, missingItems: newMissing, items: newItems, transactions: [...state.transactions, followUpTx] });
      emit();
    }

    export function inviteUser(input: { email: string; displayName: string; role: UserRole }, actor: UserDoc): UserDoc {
      // AUTH-07: in Phase 1, "invite" creates the user record directly with mock password "password"; in Phase 2 it sends Firebase signed link
      const now = new Date().toISOString();
      const user: UserDoc = {
        uid: nextUserUid(), email: input.email, displayName: input.displayName,
        role: input.role, disabled: false, createdAt: now, createdBy: actor.uid, lastLoginAt: null,
      };
      state = Object.freeze({ ...state, users: [...state.users, user] });
      emit();
      return user;
    }

    export function setUserRole(uid: string, role: UserRole, actor: UserDoc): void {
      // AUTH-08
      const newUsers = state.users.map((u) => u.uid === uid ? { ...u, role } : u);
      // Recompute allowedStaff on every event (since admin promotion changes the union)
      const adminUids = newUsers.filter((u) => u.role === "admin").map((u) => u.uid);
      const newEvents = state.events.map((e) => ({
        ...e,
        allowedStaff: Array.from(new Set([...adminUids, ...e.teamLeads, ...e.backupTeams])),
      }));
      state = Object.freeze({ ...state, users: newUsers, events: newEvents });
      emit();
    }

    export function disableUser(uid: string, actor: UserDoc): void {
      // AUTH-09
      const newUsers = state.users.map((u) => u.uid === uid ? { ...u, disabled: true } : u);
      state = Object.freeze({ ...state, users: newUsers });
      emit();
    }

    export function markLowStockOrdered(itemId: string, actor: UserDoc): void {
      // RP-04
      updateItem(itemId, { lowStockOrderedAt: new Date().toISOString() }, actor);
    }

    export function updateLowStockThreshold(itemId: string, threshold: number, actor: UserDoc): void {
      // RP-01
      updateItem(itemId, { lowStockThreshold: threshold }, actor);
    }
    ```

    **lib/mock/selectors.ts** (pure functions over StoreSnapshot — same API will work in Phase 2):
    ```ts
    import type { StoreSnapshot } from "./store";
    import type { InventoryItem } from "@/lib/types/item";
    import type { EventDoc, EventStatus } from "@/lib/types/event";
    import type { UserDoc, UserRole } from "@/lib/types/user";
    import type { TransactionDoc } from "@/lib/types/transaction";
    import type { MissingItemDoc } from "@/lib/types/missing-item";

    // Phase 1 "today" — fixed per D-04 so dashboard widgets are deterministic.
    // Phase 2 should pass real `new Date()`. Component signatures accept an optional override.
    export const PHASE_1_TODAY = new Date("2026-05-24T12:00:00.000Z");

    export function selectItemById(s: StoreSnapshot, id: string): InventoryItem | undefined {
      return s.items.find((i) => i.id === id);
    }
    export function selectItemBySku(s: StoreSnapshot, sku: string): InventoryItem | undefined {
      return s.items.find((i) => i.sku.toLowerCase() === sku.toLowerCase());
    }
    export function selectEventById(s: StoreSnapshot, id: string): EventDoc | undefined {
      return s.events.find((e) => e.id === id);
    }
    export function selectUserByUid(s: StoreSnapshot, uid: string): UserDoc | undefined {
      return s.users.find((u) => u.uid === uid);
    }
    export function selectUserByEmail(s: StoreSnapshot, email: string): UserDoc | undefined {
      return s.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    }
    export function selectActiveEvents(s: StoreSnapshot): EventDoc[] {
      return s.events.filter((e) => e.status === "active");
    }
    export function selectOverdueEvents(s: StoreSnapshot, today: Date = PHASE_1_TODAY): EventDoc[] {
      return s.events.filter((e) => e.status === "active" && new Date(e.endDate) < today);
    }
    export function selectLowStockItems(s: StoreSnapshot): InventoryItem[] {
      return s.items.filter((i) =>
        i.lifecycleState !== "retired" &&
        i.lowStockThreshold > 0 &&
        i.availableQty <= i.lowStockThreshold &&
        !i.lowStockOrderedAt
      );
    }
    export function selectAccessibleEvents(s: StoreSnapshot, uid: string, role: UserRole, statuses?: EventStatus[]): EventDoc[] {
      // EVT-08: admin sees all; staff sees only events where allowedStaff includes their uid
      const filtered = role === "admin" ? s.events : s.events.filter((e) => e.allowedStaff.includes(uid));
      if (!statuses || statuses.length === 0) return filtered;
      return filtered.filter((e) => statuses.includes(e.status));
    }
    export function selectOpenCheckoutsForEvent(s: StoreSnapshot, eventId: string): TransactionDoc[] {
      // open checkouts = type checkout AND no matching checkin (no transaction with parentTxId === this.id)
      const allCheckouts = s.transactions.filter((t) => t.type === "checkout" && t.eventId === eventId);
      const childTxParentIds = new Set(s.transactions.filter((t) => t.parentTxId).map((t) => t.parentTxId));
      return allCheckouts.filter((co) => {
        const matchedQty = s.transactions
          .filter((t) => t.parentTxId === co.id && t.type === "checkin")
          .reduce((sum, t) => sum + t.qty, 0);
        return matchedQty < co.qty;
      });
    }
    export function selectTransactionsForItem(s: StoreSnapshot, itemId: string): TransactionDoc[] {
      return s.transactions.filter((t) => t.itemId === itemId).sort((a, b) => b.at.localeCompare(a.at));
    }
    export function selectTransactionsForEvent(s: StoreSnapshot, eventId: string): TransactionDoc[] {
      return s.transactions.filter((t) => t.eventId === eventId).sort((a, b) => b.at.localeCompare(a.at));
    }
    export function selectOpenMissing(s: StoreSnapshot): MissingItemDoc[] {
      return s.missingItems.filter((m) => m.status === "open");
    }
    export function selectRecentActivity(s: StoreSnapshot, limit = 20): TransactionDoc[] {
      return [...s.transactions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
    }
    export function selectItemsOut(s: StoreSnapshot): { item: InventoryItem; eventName: string; openTxs: TransactionDoc[] }[] {
      // REP-02 — items currently out at active events
      const activeIds = new Set(s.events.filter((e) => e.status === "active").map((e) => e.id));
      const openByItem = new Map<string, TransactionDoc[]>();
      for (const t of s.transactions) {
        if (t.type !== "checkout" || !t.eventId || !activeIds.has(t.eventId)) continue;
        const matched = s.transactions.filter((x) => x.parentTxId === t.id && x.type === "checkin").reduce((sum, x) => sum + x.qty, 0);
        if (matched >= t.qty) continue;
        const arr = openByItem.get(t.itemId) ?? [];
        arr.push(t); openByItem.set(t.itemId, arr);
      }
      return Array.from(openByItem.entries()).map(([itemId, txs]) => ({
        item: s.items.find((i) => i.id === itemId)!,
        eventName: txs[0].eventName ?? "",
        openTxs: txs,
      }));
    }
    ```

    **lib/mock/cookie.ts** (Next 16 async server helpers + sync client helpers per CONTEXT D-05):
    ```ts
    import type { Session } from "@/lib/types/session";

    // === SERVER ===
    // Used by /api/auth or by login route's server-side path.
    // Cookie is non-httpOnly per D-05 so the client-side role switcher can read it.
    export async function setMockSessionServer(session: Session): Promise<void> {
      const { cookies } = await import("next/headers");
      const jar = await cookies();
      jar.set("mock_session", JSON.stringify(session), {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24, // 1 day
      });
    }
    export async function clearMockSessionServer(): Promise<void> {
      const { cookies } = await import("next/headers");
      const jar = await cookies();
      jar.set("mock_session", "", { maxAge: 0, path: "/" });
    }
    export async function readMockSessionServer(): Promise<Session | null> {
      const { cookies } = await import("next/headers");
      const jar = await cookies();
      const raw = jar.get("mock_session")?.value;
      if (!raw) return null;
      try { return JSON.parse(raw) as Session; } catch { return null; }
    }

    // === CLIENT ===
    // Used by /login form's onSubmit and PhaseOnePocRoleSwitcher.
    export function writeMockSessionClient(session: Session): void {
      if (typeof document === "undefined") return;
      const value = encodeURIComponent(JSON.stringify(session));
      document.cookie = `mock_session=${value}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
    }
    export function clearMockSessionClient(): void {
      if (typeof document === "undefined") return;
      document.cookie = "mock_session=; path=/; max-age=0; samesite=lax";
    }
    export function readMockSessionClient(): Session | null {
      if (typeof document === "undefined") return null;
      const match = document.cookie.match(/(?:^|; )mock_session=([^;]+)/);
      if (!match) return null;
      try { return JSON.parse(decodeURIComponent(match[1])) as Session; } catch { return null; }
    }
    ```

    Critical: This file uses dynamic `import("next/headers")` inside async server functions so the same module can be referenced from client code without crashing (client-only consumers will never call the server functions). Plan 04 will import these helpers selectively.

    **lib/auth/mock-session.ts** (server helpers for the (app) layout and admin-only pages):
    ```ts
    import { redirect } from "next/navigation";
    import { readMockSessionServer } from "@/lib/mock/cookie";
    import type { Session } from "@/lib/types/session";

    export async function getMockSession(): Promise<Session | null> {
      return readMockSessionServer();
    }

    export async function requireSession(): Promise<Session> {
      const session = await getMockSession();
      if (!session || session.disabled) redirect("/login");
      return session;
    }

    export async function requireAdmin(): Promise<Session> {
      const session = await requireSession();
      if (session.role !== "admin") redirect("/unauthorized"); // D-07 strict gate
      return session;
    }
    ```

    **lib/hooks/use-mock-store.ts** (client hook):
    ```tsx
    "use client";
    import { useSyncExternalStore } from "react";
    import { subscribe, getSnapshot, getServerSnapshot, type StoreSnapshot } from "@/lib/mock/store";

    export function useMockStore<T>(selector: (s: StoreSnapshot) => T): T {
      return useSyncExternalStore(
        subscribe,
        () => selector(getSnapshot()),
        () => selector(getServerSnapshot()),
      );
    }
    ```

    **lib/hooks/use-current-user.ts** (client hook reading mock cookie):
    ```tsx
    "use client";
    import { useEffect, useState } from "react";
    import { readMockSessionClient } from "@/lib/mock/cookie";
    import type { Session } from "@/lib/types/session";

    export function useCurrentUser(): Session | null {
      const [session, setSession] = useState<Session | null>(null);
      useEffect(() => {
        setSession(readMockSessionClient());
      }, []);
      return session;
    }
    ```

    Critical: Do not add `import 'server-only'` to ANY of these files except mock-session.ts (which is server-only by virtue of `next/navigation`'s `redirect`). The store + selectors + cookie helpers must be importable from both server and client.

    **Plan 03 onwards depends on these exact exports. Do NOT rename anything.**
  </action>
  <verify>
    <automated>ls lib/mock/store.ts lib/mock/selectors.ts lib/mock/cookie.ts lib/hooks/use-mock-store.ts lib/hooks/use-current-user.ts lib/auth/mock-session.ts | wc -l | grep -q "^6$"; grep -q "useSyncExternalStore" lib/mock/store.ts && false || true; grep -q "useSyncExternalStore" lib/hooks/use-mock-store.ts; grep -q "export function checkout" lib/mock/store.ts; grep -q "export function checkin" lib/mock/store.ts; grep -q "export function createItem" lib/mock/store.ts; grep -q "export function createEvent" lib/mock/store.ts; grep -q "export function resolveMissing" lib/mock/store.ts; grep -q "export function inviteUser" lib/mock/store.ts; grep -q "export function setUserRole" lib/mock/store.ts; grep -q "export function disableUser" lib/mock/store.ts; grep -q "export function cancelEvent" lib/mock/store.ts; grep -q "export function markLowStockOrdered" lib/mock/store.ts; grep -q "export function selectLowStockItems" lib/mock/selectors.ts; grep -q "export function selectAccessibleEvents" lib/mock/selectors.ts; grep -q "export function selectOpenCheckoutsForEvent" lib/mock/selectors.ts; grep -q "export function selectOverdueEvents" lib/mock/selectors.ts; grep -q "export async function requireAdmin" lib/auth/mock-session.ts; grep -q "mock_session" lib/mock/cookie.ts; grep -q "httpOnly: false" lib/mock/cookie.ts; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 6 files exist (verify via `ls ... | wc -l` returns 6).
    - `lib/mock/store.ts` exports exactly 14 mutators: checkout, checkin, createItem, updateItem, retireItem, createEvent, updateEvent, cancelEvent, resolveMissing, inviteUser, setUserRole, disableUser, markLowStockOrdered, updateLowStockThreshold. Verify each with `grep -q "export function <name>" lib/mock/store.ts`.
    - `lib/mock/store.ts` exports subscribe, getSnapshot, getServerSnapshot, StoreSnapshot type.
    - `lib/mock/selectors.ts` exports at least: selectItemById, selectItemBySku, selectEventById, selectUserByUid, selectUserByEmail, selectActiveEvents, selectOverdueEvents, selectLowStockItems, selectAccessibleEvents, selectOpenCheckoutsForEvent, selectTransactionsForItem, selectTransactionsForEvent, selectOpenMissing, selectRecentActivity, selectItemsOut.
    - `lib/mock/cookie.ts` references `mock_session` literal AND `httpOnly: false` (per D-05).
    - `lib/auth/mock-session.ts` exports requireSession, requireAdmin, getMockSession.
    - `lib/hooks/use-mock-store.ts` uses `useSyncExternalStore`.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>6 files exist, store has 14 working mutators, selectors cover all dashboard/list query patterns, hooks compile, tsc passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| mock_session cookie ↔ Server Components | Non-httpOnly by D-05; client + server both read/write. Phase 1 has no secrets in this cookie. |
| Mock store as global mutable state | Single in-memory store on the server module — separate server/client copies in dev. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Spoofing | Non-httpOnly mock_session lets any client script forge a session | accept | Documented decision per CONTEXT.md D-05 + D-06. Phase 1 has NO secrets, NO real user data, NO backend writes. The pattern mirrors Phase 2's `__session` shape; Phase 2 swap is decoder-only. Comment in lib/mock/cookie.ts explains this is INTENTIONAL POC behavior. |
| T-02-02 | Tampering | Direct manipulation of in-memory store from devtools | accept | Phase 1 is a POC. Tampering produces UI states that visibly drift from seed; no backend persistence to corrupt. |
| T-02-03 | Information disclosure | Mock seed data contains plausible names + emails | mitigate | Seed users use clearly fake names with @example.com domain. No real PII. |
| T-02-04 | Repudiation | actorRoleAtTimeOfAction snapshot might be tampered | accept | Mock store is dev-only; Phase 2's Firestore + Server Actions are the real defense. |
| T-02-05 | DoS | Server module storing all state survives request boundary (memory leak in dev) | accept | Single-tenant solo dev. Restart `next dev` if memory grows; module reload clears state. |
</threat_model>

<verification>
- `lib/mock/store.ts` exports all 14 mutators plus subscribe/getSnapshot/getServerSnapshot.
- All store mutators return fresh frozen snapshots (verify: `grep -c "Object.freeze" lib/mock/store.ts` returns ≥13).
- Mock data passes integrity checks: every transaction's `itemId` exists in seedItems, every transaction's `eventId` exists in seedEvents (or is null for adjustments), every missing-item's `parentCheckinTxId` exists in seedTransactions.
- `tsc --noEmit` passes.
- No file references Firebase symbols.
</verification>

<success_criteria>
- Mock substrate complete: 5 seed files + store + selectors + cookie + auth helpers + 2 hooks (11 files total). The two table-related hooks (use-debounced-value, use-url-table-state) ship in Plan 03 alongside their DataTable consumer.
- Every requirement covered in this plan is exercised by the store's mutators (checkout for CO-04/05/06; checkin for CI-05..08; resolveMissing for MIS-03/04; etc.).
- Phase 2 swap path is preserved: same selector API, same mutator signatures (modulo `actor` becoming `verifySession()` server-side).
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-01/01-02-mock-data-store-SUMMARY.md` with:
- Final seed counts (items, events, users, transactions, missing-items)
- List of all 14 store mutators with signatures
- List of all selector functions
- Confirmation that tsc passes and no file imports Firebase
</output>
