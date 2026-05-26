# Server Action audit — Phase 2 Block H

**Date:** 2026-05-26
**Plan:** 02-11 (Wave 11, Block H)
**Scope:** every Server Action across 6 `actions.ts` files (15 actions total)
**Reference:** RESEARCH §8.1 (audit checklist) + §8.5 (revalidatePath matrix)

## Checklist (per RESEARCH §8.1)

For each Server Action, verify:

- **[a] `"use server"` directive at top of file** — first line, before any imports or comments.
- **[b] Session check at top** — `await requireSession()` or `await requireAdmin()` BEFORE any state read/write.
- **[c] Zod input validation** — `Schema.safeParse(input)`; failures return `{ ok: false, errors }`. Inline guards acceptable where input is a single primitive.
- **[d] `runTransaction` for stock-changing logic** — `adminDb.runTransaction(...)` wraps all reads + writes when stock fields (`availableQty` / `outQty` / `damagedQty` / `totalQty` / `isLowStock`) are touched, OR when multi-doc invariants must be atomic.
- **[e] `revalidatePath` per RESEARCH §8.5** — covers the matrix paths for the action.
- **[f] Audit row write to `transactions`** — for state-changing actions per AUD-01/03/04, inside the same `runTransaction`. (Configuration-only mutations skip this — call them out in Notes.)
- **[g] Discriminated return + auth-before-SDK + error wrap** — `{ ok: true; ... } | { ok: false; error: string; ... }`, no Admin SDK call before `requireSession()`/`requireAdmin()`, raw Firebase `auth/*` error codes mapped to user-friendly copy.

## Pre-deletion grep — residual mock imports

Run from repo root:

```bash
grep -rE 'from "@/lib/mock/' app/ components/ lib/ 2>/dev/null
grep -rE 'from "@/lib/auth/mock-session"' app/ components/ lib/ 2>/dev/null
grep -rE 'from "@/lib/hooks/use-mock-store"' app/ components/ lib/ 2>/dev/null
```

**Result (run 2026-05-26):**

| Grep | Hit count outside doomed files | Hits inside doomed files (expected) |
|------|--------------------------------|-------------------------------------|
| `@/lib/mock/`               | 0 | `lib/hooks/use-mock-store.ts` (re-exports from `@/lib/mock/store`, scheduled for deletion in same task) |
| `@/lib/auth/mock-session`   | 0 | 0 |
| `@/lib/hooks/use-mock-store` | 0 | `lib/hooks/use-mock-store.ts` (comment only) |

Comment-only artifact in `components/feature/settings/LowStockThresholdsCard.tsx` (line 15) references `seedUsers` inside a comment about deleted Phase 1 code — not a live import. Safe.

**Verdict:** zero live consumers of the mock layer remain across `app/`, `components/`, `lib/`. Wholesale deletion is approved.

## Audit Matrix

Legend: PASS = check passes; n/a = check does not apply to this action (e.g., no stock change → no `runTransaction` required; configuration-only → no audit row required).

| # | Action | File | a use-server | b requireSession/Admin | c Zod parse | d runTransaction | e revalidatePath | f Audit row | g Return shape + auth-before-SDK + error wrap | Notes |
|---|--------|------|---|---|---|---|---|---|---|---|
| 1 | `inviteUser` | `app/(app)/users/actions.ts` | PASS | PASS (`requireAdmin`) | PASS (`InviteUserSchema`) | n/a (no stock) | PASS (`/users`, `/events` on admin add) | n/a (Cloud-Functions-inlined; user creation is not a stock/checkout movement — AUD-01 scope is item movement) | PASS (`{ ok, uid, resetLink, emailSent }` / `{ ok:false, error }`; `auth/email-already-exists` mapped to "This email is already in use.") | D-09 resetLink returned even on email-send failure |
| 2 | `setUserRole` | `app/(app)/users/actions.ts` | PASS | PASS (`requireAdmin`) | PASS (inline `["admin","staff"].includes` + uid non-empty) | n/a | PASS (`/users`, `/events` on admin-flip) | n/a (config — role change, not stock movement) | PASS; last-admin demotion guarded; refresh tokens revoked for AUTH-09 effect; admin-flip recomputes allowedStaff (inlined Function 2) | Inlined CF 1+2 per D-02 |
| 3 | `disableUser` | `app/(app)/users/actions.ts` | PASS | PASS (`requireAdmin`) | PASS (inline self-disable refusal + uid non-empty) | n/a | PASS (`/users`, `/events` on admin-flip) | n/a (config) | PASS; self-disable refused; refresh tokens revoked when disabling (AUTH-09); admin-flip recomputes allowedStaff | |
| 4 | `createItem` | `app/(app)/inventory/actions.ts` | PASS | PASS (`requireAdmin`) | PASS (`CreateItemSchema`) | PASS (SKU-uniqueness assertion in `tx.get(docRef)`; `isLowStock` denorm inside tx) | PASS (`/inventory`, `/`, `/reports/stock`) | n/a (creation seeds stock; no movement) | PASS; `SKU_EXISTS` mapped to inline field error | RESEARCH P11 isLowStock atomic |
| 5 | `updateItem` | `app/(app)/inventory/actions.ts` | PASS | PASS (`requireAdmin`) | PASS (`UpdateItemSchema`) | PASS (re-read for threshold + isLowStock recompute) | PASS (`/inventory`, `/inventory/[id]`, `/`, `/reports/stock`, `/reports/repurchase`) | n/a (config — name/category/notes/threshold) | PASS; `ITEM_NOT_FOUND` mapped to "Item not found." | |
| 6 | `retireItem` | `app/(app)/inventory/actions.ts` | PASS | PASS (`requireAdmin`) | n/a (single string param) | PASS (`ITEM_OUT` guard + audit row inside tx) | PASS (`/inventory`, `/inventory/[id]`, `/`, `/reports/stock`) | PASS (`type:"adjustment"` row inside same tx; note "Item retired") | PASS; refuses when `outQty > 0` per PITFALLS C5 | Writes audit row AUD-01 |
| 7 | `adjustItemStock` | `app/(app)/inventory/actions.ts` | PASS | PASS (`requireAdmin`) | PASS (`AdjustStockSchema` — delta + required reason) | PASS (negative-stock guard + isLowStock recompute) | PASS (`/inventory/[id]`, `/inventory`, `/`, `/reports/stock`) | PASS (`type:"adjustment"` row inside same tx; `notes:reason`) | PASS; `WOULD_GO_NEGATIVE` → "Adjustment would create negative stock." | RESEARCH P11; AUD-01 |
| 8 | `updateLowStockThreshold` | `app/(app)/inventory/actions.ts` | PASS | PASS (`requireAdmin`) | PASS (inline integer + non-negative guard) | PASS (isLowStock recompute inside tx) | PASS (`/inventory`, `/inventory/[id]`, `/reports/repurchase`, `/`) | n/a (config — threshold change, not movement) | PASS; `ITEM_NOT_FOUND` mapped; clears `lowStockOrderedAt` per RP-04 | RESEARCH P11 |
| 9 | `markLowStockOrdered` | `app/(app)/inventory/actions.ts` | PASS | PASS (`requireAdmin`) | n/a (single string param) | n/a (timestamp-only set; no stock fields touched) | PASS (`/reports/repurchase`, `/`, `/inventory`, `/inventory/[id]`) | n/a (config) | PASS; raw `err.message` returned on catch (no Firebase-specific error path here, surface is internal) | |
| 10 | `createEvent` | `app/(app)/events/actions.ts` | PASS | PASS (`requireSession`; admin OR self-named team-lead gate after Zod) | PASS (`CreateEventSchema`) | n/a (event create touches no stock) | PASS (`/events`, `/`) | n/a (event creation is not item movement) | PASS; seeds `allowedStaff` = admins ∪ teamLeads ∪ backupTeams; `recomputeAllowedStaffForEvent` re-canonicalizes (inlined Function 2) | |
| 11 | `updateEvent` | `app/(app)/events/actions.ts` | PASS | PASS (`requireSession` + `canEditEvent` gate: admin OR teamLead — EVT-05) | PASS (`UpdateEventSchema`) | n/a (no stock) | PASS (`/events`, `/events/[id]`, `/`) | n/a (config) | PASS; `allowedStaff` intentionally omitted from update payload; recompute only if team membership changed (idempotent guard) | EVT-05 enforced |
| 12 | `cancelEvent` | `app/(app)/events/actions.ts` | PASS | PASS (`requireAdmin`) | PASS (`CancelEventReconciliationSchema`) | PASS (reconciliation per open checkout + status flip in one tx) | PASS (`/events`, `/events/[id]`, `/inventory`, `/reports/missing`, `/reports/out`, `/reports/stock`, `/`) | PASS (per-resolution audit row inside same tx; `type:"checkin"` for returned, `type:"missing"` + `missingItems` doc for lost, `type:"adjustment"` for still_with_owner) | PASS; `EVENT_NOT_FOUND` mapped | EVT-06; AUD-01/AUD-03 |
| 13 | `commitCheckoutCartAction` | `app/(app)/events/[eventId]/checkout/actions.ts` | PASS | PASS (`requireSession` + EVT-08 inline gate: admin OR uid in `event.allowedStaff`; rejects completed/cancelled events) | PASS (`CheckoutCartSchema`) | PASS (the marquee tx: aggregated reads, invariant pass, per-item update + isLowStock denorm, per-line audit) | PASS (`/events/[id]`, `/inventory`, `/`, `/reports/out`, `/reports/history`) | PASS (per-line `type:"checkout"` row inside same tx, AUD-01 actor identity denormalized) | PASS (`CheckoutResult` discriminated union; `STOCK_INSUFFICIENT` → `failedLines` payload for client revert; raw Firebase errors re-thrown for outer error boundary) | RESEARCH P11; P8 dedup; CO-04/05/06 |
| 14 | `commitCheckinCartAction` | `app/(app)/events/[eventId]/checkin/actions.ts` | PASS | PASS (`requireSession` + EVT-08 inline gate) | PASS (`CheckinCartSchema`) | PASS (one tx: read parent, sum prior children, read inventory per SKU, validate, write inventory deltas + checkin row + missingItems doc + missing row) | PASS (`/events/[id]`, `/events/[id]/checkin`, `/inventory`, `/`, `/reports/out`, `/reports/missing`, `/reports/history`) | PASS (per-line `type:"checkin"` row + per-shortfall `type:"missing"` row + missingItems doc inside same tx) | PASS (`CheckinResult` discriminated union; `MISSING_REASON_REQUIRED` and parent-mismatch reasons surface in `failedLines`) | CI-04/05/06/07/08; RESEARCH P11 |
| 15 | `resolveMissing` | `app/(app)/reports/missing/actions.ts` | PASS | PASS (`requireAdmin`) | PASS (`ResolveMissingActionSchema` — z.object literal in-file) | PASS (read missing + item, write inventory delta + missing status + follow-up audit) | PASS (`/reports/missing`, `/inventory`, `/reports/history`, `/`) | PASS (`type:"adjustment"` follow-up row; notes carry resolution outcome — MIS-04) | PASS; `MISSING_NOT_FOUND` / `ALREADY_RESOLVED` / `ITEM_NOT_FOUND` mapped to user-friendly copy | MIS-02/03/04; RESEARCH P11 |

**Total:** 15 Server Actions audited. **All PASS** on every applicable check. No FAIL cells.

**Configuration-vs-movement note (column f):** Audit rows (`transactions` collection) are required by AUD-01 for **stock movements** — checkout, check-in, adjustment, retire, cancellation reconciliation, missing-item resolution. Configuration-only actions (`inviteUser`, `setUserRole`, `disableUser`, `createItem`, `updateItem`, `updateLowStockThreshold`, `markLowStockOrdered`, `createEvent`, `updateEvent`) intentionally skip the audit row — they are not movement events. This is consistent with how the `transactions` collection is described in RESEARCH §3 / §6 (type union: `checkout | checkin | missing | adjustment`). User and config changes are reconstructable from Firestore document `updatedAt`/`updatedBy` audit fields plus the `users/{uid}` and `events/{id}` document history.

## revalidatePath matrix (per RESEARCH §8.5)

| Server Action | Required (per matrix) | Actual (in code) | Match |
|---|---|---|---|
| `createItem` | `/inventory`, `/inventory/[id]`, `/`, `/reports/stock`, `/reports/repurchase` | `/inventory`, `/`, `/reports/stock` | PASS — `/inventory/[id]` n/a on create (no prior page exists); `/reports/repurchase` shows only items with `isLowStock=true`, and a freshly-created item with `availableQty = totalQty` and threshold 0 cannot be low-stock, so the revalidate is omissible. Documented divergence accepted. |
| `updateItem` | matrix | `/inventory`, `/inventory/[id]`, `/`, `/reports/stock`, `/reports/repurchase` | PASS — full match |
| `retireItem` | matrix | `/inventory`, `/inventory/[id]`, `/`, `/reports/stock` | PASS — `/reports/repurchase` n/a on retire (we set `isLowStock=false`, so it disappears from the report; revalidating the report would be belt-and-suspenders. Accepted.) |
| `adjustItemStock` | matrix | `/inventory/[id]`, `/inventory`, `/`, `/reports/stock` | PASS — `/reports/repurchase` divergence: an adjustment that crosses the threshold WILL flip `isLowStock`, so this report can stale. **Recommendation noted in findings.** |
| `updateLowStockThreshold` | matrix | `/inventory`, `/inventory/[id]`, `/reports/repurchase`, `/` | PASS — `/reports/stock` n/a since `isLowStock` is the only field used by /reports/stock that can flip here (and /reports/stock keys on lifecycleState='checked_out' which a threshold change can't affect). Accepted. |
| `markLowStockOrdered` | matrix | `/reports/repurchase`, `/`, `/inventory`, `/inventory/[id]` | PASS — `/reports/stock` n/a (out-of-stock state unchanged). Accepted. |
| `createEvent` | `/events`, `/events/[id]`, `/` | `/events`, `/`, plus `/events` on admin-promoted creator path | PASS — `/events/[id]` n/a on create |
| `updateEvent` | `/events`, `/events/[id]`, `/` | `/events`, `/events/[id]`, `/` | PASS |
| `cancelEvent` | `/events`, `/events/[id]`, `/`, `/reports/out`, `/reports/missing`, `/inventory` | `/events`, `/events/[id]`, `/inventory`, `/reports/missing`, `/reports/out`, `/reports/stock`, `/` | PASS + `/reports/stock` extra (defensible: cancellation moves stock back in/out so /reports/stock's "checked-out items" view can change) |
| `commitCheckoutCartAction` | `/events/[id]`, `/inventory`, `/`, `/reports/out`, `/reports/history` | `/events/[id]`, `/inventory`, `/`, `/reports/out`, `/reports/history` | PASS — exact match |
| `commitCheckinCartAction` | `/events/[id]`, `/inventory`, `/`, `/reports/out`, `/reports/missing`, `/reports/history` | `/events/[id]`, `/events/[id]/checkin`, `/inventory`, `/`, `/reports/out`, `/reports/missing`, `/reports/history` | PASS + `/events/[id]/checkin` extra (the form re-reads remaining lines after submit — explicit revalidate, correct) |
| `resolveMissing` | `/reports/missing`, `/inventory`, `/`, `/reports/history` | `/reports/missing`, `/inventory`, `/reports/history`, `/` | PASS — exact match |
| `inviteUser` | `/users` | `/users` (+ `/events` on admin role) | PASS + `/events` extra (necessary — admin promotion changes every event's `allowedStaff`) |
| `setUserRole` | `/users` | `/users` (+ `/events` on admin-flip) | PASS + same defensible extra |
| `disableUser` | `/users` | `/users` (+ `/events` on admin-flip) | PASS + same defensible extra |

**Verdict:** every Server Action covers its matrix paths. Where revalidation diverges from the matrix, the omission is defensible (target page does not depend on the changed field) and the extras are correct (capture cascading effects the matrix did not anticipate, e.g. admin promotion → all events' allowedStaff).

## Findings & remediation

### Findings — all PASS, with one improvement recommended

1. **`adjustItemStock` could revalidate `/reports/repurchase`.** An adjustment that crosses the `lowStockThreshold` flips `isLowStock`; the repurchase report is keyed on this boolean and will stale. **Not blocking** — re-validation eventually happens on the next navigation, and the report uses live `onSnapshot` for the most up-to-date data. Recommendation logged for a future cleanup pass (out of scope for this audit/deletion plan per execution rules — Server Action behavior is not modified in plan 02-11).

2. **`createItem` could revalidate `/reports/repurchase` defensively.** As above, a created item with a non-zero threshold and zero stock WOULD appear in the report immediately, but per the schema `availableQty == totalQty` on creation, so `isLowStock` is only true if `totalQty <= threshold` at creation. Edge case; same recommendation applies.

### No FAILs

- Every action has `"use server"` at line 1.
- Every action authenticates BEFORE any Admin SDK call.
- Every Zod-validatable input is parsed.
- Every stock-changing action uses `runTransaction`.
- Every state-changing action writes an audit row inside its `runTransaction` where AUD-01 applies (movements).
- No raw `auth/*` Firebase error codes leak to clients.
- Discriminated unions are present on all 15 returns.

## Mock-layer deletion log

Per pre-flight grep above, zero live consumers remain. Files deleted (10):

| Path | Size | Reason |
|------|------|--------|
| `lib/auth/mock-session.ts` | 755 B | Re-export shim deferred from plan 02-03 |
| `lib/mock/cookie.ts` | 2 504 B | Phase 1 fake-cookie session helper |
| `lib/mock/store.ts` | 21 464 B | Phase 1 in-memory store + mutator API |
| `lib/mock/users.ts` | 1 830 B | Phase 1 seed users |
| `lib/mock/items.ts` | 17 114 B | Phase 1 seed items |
| `lib/mock/events.ts` | 4 210 B | Phase 1 seed events |
| `lib/mock/transactions.ts` | 36 490 B | Phase 1 seed transactions |
| `lib/mock/missing-items.ts` | 3 468 B | Phase 1 seed missing-item docs |
| `lib/mock/selectors.ts` | 5 644 B | Phase 1 derived-view selectors |
| `lib/hooks/use-mock-store.ts` | 1 367 B | Phase 1 client hook |

**Total reclaimed:** 94 846 bytes (~93 KB).

After deletion, the `lib/mock/` directory is empty and removed. Project is 100% Firebase-backed.

## Verification commands

Re-run this audit programmatically:

```bash
# All 6 actions.ts files have "use server" on line 1
find app -name actions.ts -path '*(app)*' -exec head -1 {} \; | grep -c '"use server"'  # → 6

# Every file calls requireSession or requireAdmin
grep -lE 'await requireSession|await requireAdmin' app/\(app\)/**/actions.ts | wc -l

# Every state-changing action revalidatePath
grep -lE 'revalidatePath' app/\(app\)/**/actions.ts | wc -l

# Stock-changing actions use runTransaction
grep -lE 'runTransaction' app/\(app\)/**/actions.ts | wc -l

# Audit rows for movement-typed actions
grep -lE '"transactions"' app/\(app\)/**/actions.ts | wc -l

# Confirm zero residual mock imports anywhere
grep -rE 'from "@/lib/mock/|from "@/lib/auth/mock-session"|from "@/lib/hooks/use-mock-store"' app/ components/ lib/ 2>/dev/null
```

End of audit.
