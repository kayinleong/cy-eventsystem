# Claim: quick-kayinleong-017
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: done
- completed: 2026-06-09
- summary: On /inventory + item detail, hide the misleading Available/Checked-out lifecycle status (keep Damaged/Retired); also fix check-in so an item stays checked_out while units are still out.

## Problem
The lifecycle status badge shows Available / Checked out / Damaged / Retired. For
partial quantities it lies: check-in marks an item "available" as soon as any
qty is returned, even while `outQty > 0`. The Available/Out quantity columns are
the accurate truth. User wants the Available/Checked-out status removed from
display (keep Damaged/Retired), and the underlying check-in lifecycle logic
fixed.

## What will change (user-confirmed)
1. **Hide Available/Checked-out (keep Damaged/Retired):**
   - `components/feature/inventory/InventoryTable.tsx`: Status column renders a
     badge only for `damaged`/`retired` (muted "—" otherwise); the status filter
     `LIFECYCLES` list reduced to `["damaged","retired"]`.
   - `components/feature/inventory/ItemDetail.tsx`: the header `StatusBadge`
     renders only for `damaged`/`retired`.
2. **Fix check-in lifecycle logic:**
   - `app/(app)/events/[eventId]/checkin/actions.ts`: derive
     `newOut > 0 → "checked_out"`, else `newAvailable > 0 → "available"`, else
     `newDamaged > 0 → "damaged"` (else leave as-is). Previously set "available"
     whenever `newAvailable > 0`, ignoring still-out units. Checkout logic
     already marks `checked_out` when qty is out — unchanged.

Scope: only the two requested surfaces for display. Reports/stock + aggregations
read the now-more-accurate `lifecycleState`; checkout validation uses
`availableQty` (not lifecycle), so the flow is unaffected.

## What has changed

**Commit b9e1bb1** (fix, 3 files):
- `app/(app)/events/[eventId]/checkin/actions.ts`: lifecycle derivation now
  `newOut > 0 → "checked_out"`, else `newAvailable > 0 → "available"`, else
  `newDamaged > 0 → "damaged"` (else leave as-is). Previously flipped to
  "available" whenever `newAvailable > 0`, ignoring still-out units.
- `components/feature/inventory/InventoryTable.tsx`: `LIFECYCLES` filter list
  reduced to `["damaged","retired"]`; Status column cell renders a badge only
  for `damaged`/`retired`, muted "—" otherwise.
- `components/feature/inventory/ItemDetail.tsx`: header `StatusBadge` rendered
  only for `damaged`/`retired`.

## Verification

**Automated**
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors, 12 warnings (all pre-existing; none in touched files).
- `npm run build` → exit 0, all routes compiled.

**Regression surface audited**
- **Checkout flow unaffected:** checkout validates on `availableQty` (and the
  retired guard), not on the available/checked_out lifecycle value; its own
  lifecycle bump (available→checked_out when qty out) is unchanged.
- **Filter:** dropdown now offers All / Damaged / Retired. A stale URL
  `?lifecycleState=available|checked_out` still applies (client + server filter
  honor it) — just not selectable; acceptable.
- **No lifecycle-count consumers broke:** grep found no dashboard/aggregation
  code counting by `available`/`checked_out`; `aggregations.server.ts` counts
  `lifecycleState != retired` (unaffected); `reports/stock` excludes retired and
  otherwise lists all (now-more-accurate) items.
- **Display gating** only hides Available/Checked-out; Damaged/Retired badges
  still render (StatusBadge/statusToTone/statusToLabel imports still used — lint
  clean confirms no dead imports).
- **`isLowStock`, qty math, audit txs** untouched in check-in (only the
  `newLifecycle` branch changed).

**Manual UI confirmation (recommended, needs Firebase env):**
- Item with 10 total: check out 5, check in 2 → still 3 out → item shows no
  status badge on /inventory + detail (was wrongly "Available"); Available 7 /
  Out 3 columns are correct. Check in the last 3 → still no badge (available).
  Mark damaged/retired → badge shows. Status filter lists only Damaged/Retired.
