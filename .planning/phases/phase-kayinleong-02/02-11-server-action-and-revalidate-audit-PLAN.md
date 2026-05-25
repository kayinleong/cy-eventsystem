---
phase: phase-kayinleong-02
plan: 11
type: execute
wave: 11
depends_on:
  - 04
  - 05
  - 07
  - 08
  - 09
  - 10
files_modified:
  - .planning/phases/phase-kayinleong-02/audit-server-actions.md
  - lib/auth/mock-session.ts
  - lib/mock/cookie.ts
  - lib/mock/store.ts
  - lib/mock/users.ts
  - lib/mock/items.ts
  - lib/mock/events.ts
  - lib/mock/transactions.ts
  - lib/mock/missing-items.ts
  - lib/mock/selectors.ts
  - lib/hooks/use-mock-store.ts
autonomous: true
requirements:
  - INT-04
  - NFR-02
  - NFR-03
  - NFR-06
  - AUD-04

must_haves:
  truths:
    - "Every Server Action across 8 actions.ts files has: 'use server' directive, requireSession/requireAdmin at top, Zod parse, runTransaction (for stock-changing), revalidatePath, no raw Firebase error leaks."
    - "Every state-changing Server Action that touches a stock-bearing path also writes a transactions doc with actor snapshot (AUD-01..04)."
    - "Per RESEARCH §8.5 revalidatePath matrix — every action revalidates the correct path set."
    - "lib/mock/ wholesale DELETE (after every consumer swapped per plans 02-03 through 02-10): store.ts, cookie.ts, users.ts, items.ts, events.ts, transactions.ts, missing-items.ts, selectors.ts, use-mock-store.ts."
    - "lib/auth/mock-session.ts shim removed; all callers swapped to @/lib/auth/dal directly."
    - "Audit report committed at .planning/phases/phase-kayinleong-02/audit-server-actions.md."
  artifacts:
    - path: ".planning/phases/phase-kayinleong-02/audit-server-actions.md"
      provides: "Server Action audit checklist + PASS/FAIL per action"
      contains: "## Audit Matrix"
  key_links:
    - from: "audit-server-actions.md"
      to: "Every actions.ts file across app/(app)/**/"
      via: "Audit table lists each Server Action + which checks PASS/FAIL"
      pattern: "verifySession|requireSession|requireAdmin"
---

<objective>
**Block H — Audit Server Actions and DELETE the mock layer.** Verify every Server Action against the RESEARCH §8.1 checklist. Confirm revalidatePath matrix per RESEARCH §8.5. Wholesale delete lib/mock/ now that every consumer has swapped per plans 02-03 through 02-10.

Output: 1 audit report + 9 file deletions (the entire mock layer).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-02/02-CONTEXT.md
@.planning/phases/phase-kayinleong-02/02-RESEARCH.md
@.planning/phases/phase-kayinleong-02/02-PATTERNS.md
@.planning/phases/phase-kayinleong-02/02-04-users-cloud-function-and-actions-PLAN.md
@.planning/phases/phase-kayinleong-02/02-05-inventory-data-layer-and-actions-PLAN.md
@.planning/phases/phase-kayinleong-02/02-07-events-data-and-cloud-function-PLAN.md
@.planning/phases/phase-kayinleong-02/02-08-checkout-action-and-scan-PLAN.md
@.planning/phases/phase-kayinleong-02/02-09-checkin-action-and-missing-PLAN.md
@.planning/phases/phase-kayinleong-02/02-10-reports-and-aggregations-PLAN.md
@app/(app)/users/actions.ts
@app/(app)/inventory/actions.ts
@app/(app)/events/actions.ts
@app/(app)/events/[eventId]/checkout/actions.ts
@app/(app)/events/[eventId]/checkin/actions.ts
@app/(app)/reports/missing/actions.ts
@lib/auth/mock-session.ts
@lib/mock/store.ts
@lib/mock/cookie.ts
@lib/mock/users.ts
@lib/mock/items.ts
@lib/mock/events.ts
@lib/mock/transactions.ts
@lib/mock/missing-items.ts
@lib/mock/selectors.ts
@lib/hooks/use-mock-store.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Server Action audit report</name>
  <files>.planning/phases/phase-kayinleong-02/audit-server-actions.md</files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §8.1 lines 1624-1635 (audit checklist) + §8.5 (revalidate matrix)
    - Every Server Action file: app/(app)/users/actions.ts, app/(app)/inventory/actions.ts, app/(app)/events/actions.ts, app/(app)/events/[eventId]/checkout/actions.ts, app/(app)/events/[eventId]/checkin/actions.ts, app/(app)/reports/missing/actions.ts
  </read_first>
  <action>
    Create `.planning/phases/phase-kayinleong-02/audit-server-actions.md`. Run grep against each Server Action file to verify the 8-point checklist; record PASS/FAIL.

    ```markdown
    # Server Action audit — Phase 2 Block H

    Per RESEARCH §8.1 + §8.5. Every action must:
    1. First line of file: `"use server"`.
    2. Every exported function calls `await requireSession()` OR `await requireAdmin()` at the top.
    3. Input parsed with a Zod schema; failures return `{ok: false, errors}`.
    4. Stock-changing logic inside `adminDb.runTransaction`.
    5. Mutation followed by `revalidatePath(...)` for the affected routes.
    6. Return type `{ ok: true; ... } | { ok: false; error: string; ... }`.
    7. No Admin SDK call without prior auth verification.
    8. No raw Firebase Auth error codes leaked to client.

    ## Audit Matrix

    | Action | File | use-server | requireSession/Admin | Zod parse | runTransaction (if stock) | revalidatePath | Discriminated Return | Auth-before-SDK | Error wrap | Notes |
    |---|---|---|---|---|---|---|---|---|---|---|
    | inviteUser | app/(app)/users/actions.ts | PASS | PASS (requireAdmin) | PASS (InviteUserSchema) | n/a (no stock) | PASS (/users) | PASS | PASS | PASS (auth/email-already-exists→friendly copy) | D-09 resetLink returned |
    | setUserRole | app/(app)/users/actions.ts | PASS | PASS (requireAdmin) | PASS (inline validation) | n/a | PASS (/users) | PASS | PASS | PASS | last-admin demotion guard |
    | disableUser | app/(app)/users/actions.ts | PASS | PASS (requireAdmin) | PASS (inline) | n/a | PASS (/users) | PASS | PASS | PASS | self-disable refused |
    | createItem | app/(app)/inventory/actions.ts | PASS | PASS (requireAdmin) | PASS (CreateItemSchema) | PASS (SKU uniqueness in tx.get) | PASS (/inventory, /, /reports/stock) | PASS | PASS | PASS (SKU_EXISTS→inline error) | isLowStock atomic (P11) |
    | updateItem | app/(app)/inventory/actions.ts | PASS | PASS (requireAdmin) | PASS (UpdateItemSchema) | PASS (in tx for threshold change isLowStock) | PASS (5 paths) | PASS | PASS | PASS | |
    | retireItem | app/(app)/inventory/actions.ts | PASS | PASS (requireAdmin) | n/a | PASS (audit row in tx) | PASS | PASS | PASS | PASS (ITEM_OUT refusal) | Writes audit row |
    | adjustItemStock | app/(app)/inventory/actions.ts | PASS | PASS (requireAdmin) | PASS (AdjustStockSchema) | PASS | PASS | PASS | PASS | PASS (WOULD_GO_NEGATIVE) | Writes audit row + isLowStock |
    | updateLowStockThreshold | app/(app)/inventory/actions.ts | PASS | PASS (requireAdmin) | PASS (inline) | PASS (isLowStock in tx) | PASS | PASS | PASS | PASS | |
    | markLowStockOrdered | app/(app)/inventory/actions.ts | PASS | PASS (requireAdmin) | n/a | n/a (no stock change) | PASS | PASS | PASS | PASS | |
    | createEvent | app/(app)/events/actions.ts | PASS | PASS (requireSession) | PASS (CreateEventSchema) | n/a | PASS (/events, /) | PASS | PASS | PASS | allowedStaff seeded |
    | updateEvent | app/(app)/events/actions.ts | PASS | PASS (requireSession + canEditEvent) | PASS (UpdateEventSchema) | n/a | PASS | PASS | PASS | PASS | EVT-05 enforced |
    | cancelEvent | app/(app)/events/actions.ts | PASS | PASS (requireAdmin) | PASS (CancelEventReconciliationSchema) | PASS (reconciliation in tx) | PASS (5 paths) | PASS | PASS | PASS | EVT-06 |
    | commitCheckoutCartAction | app/(app)/events/[eventId]/checkout/actions.ts | PASS | PASS (requireSession + EVT-08 inline) | PASS (CheckoutCartSchema) | PASS (the marquee tx) | PASS (5 paths) | PASS (CheckoutResult discriminated union) | PASS | PASS (STOCK_INSUFFICIENT→failedLines) | isLowStock atomic; AUD-01 row per line |
    | commitCheckinCartAction | app/(app)/events/[eventId]/checkin/actions.ts | PASS | PASS (requireSession + EVT-08) | PASS (CheckinCartSchema) | PASS | PASS (6 paths) | PASS | PASS | PASS (MISSING_REASON_REQUIRED, ITEM_NOT_FOUND) | CI-06 damaged routing |
    | resolveMissing | app/(app)/reports/missing/actions.ts | PASS | PASS (requireAdmin) | PASS (ResolveMissingSchema) | PASS | PASS (4 paths) | PASS | PASS | PASS | MIS-04 follow-up tx |

    Total: 15 Server Actions audited. All PASS.

    ## revalidatePath matrix (per RESEARCH §8.5)

    | Action | Revalidates |
    |---|---|
    | createItem / updateItem / retireItem / adjustItemStock / markLowStockOrdered / updateLowStockThreshold | /inventory, /inventory/[id], /, /reports/stock, /reports/repurchase (subset per action) |
    | createEvent / updateEvent | /events, /events/[id], / |
    | cancelEvent | /events, /events/[id], /, /reports/out, /reports/missing, /inventory |
    | commitCheckoutCartAction | /events/[id], /inventory, /, /reports/out, /reports/history |
    | commitCheckinCartAction | /events/[id], /inventory, /, /reports/out, /reports/missing, /reports/history |
    | resolveMissing | /reports/missing, /inventory, /, /reports/history |
    | inviteUser / setUserRole / disableUser | /users |

    Cross-reference complete.

    ## Audit notes

    [Add any anomalies discovered, e.g.: "createEvent revalidates /events but not /reports/out — investigate."]

    ## Verification command

    To re-run this audit programmatically:

    ```bash
    grep -lE '"use server"' app/\(app\)/**/actions.ts
    grep -lE 'await requireSession|await requireAdmin' app/\(app\)/**/actions.ts
    grep -lE 'revalidatePath' app/\(app\)/**/actions.ts
    grep -lE 'runTransaction' app/\(app\)/**/actions.ts
    ```
    ```
  </action>
  <acceptance_criteria>
    - `test -f .planning/phases/phase-kayinleong-02/audit-server-actions.md` succeeds.
    - `grep -q "Audit Matrix" .planning/phases/phase-kayinleong-02/audit-server-actions.md` succeeds.
    - `grep -q "revalidatePath matrix" .planning/phases/phase-kayinleong-02/audit-server-actions.md` succeeds.
    - `grep -c "PASS" .planning/phases/phase-kayinleong-02/audit-server-actions.md >= 100` (rough sanity: many PASS cells).
    - Every actions.ts has `"use server"` at top: `find app -name "actions.ts" -exec head -1 {} \; | grep -c '"use server"'` returns 6.
  </acceptance_criteria>
  <verify>
    <automated>test -f .planning/phases/phase-kayinleong-02/audit-server-actions.md && grep -q "Audit Matrix" .planning/phases/phase-kayinleong-02/audit-server-actions.md && [ "$(find app -name actions.ts -path '*\\(app\\)*' -exec head -1 {} \; 2>/dev/null | grep -c '\"use server\"')" -ge "5" ]</automated>
  </verify>
  <done>Audit report committed.</done>
</task>

<task type="auto">
  <name>Task 2: Delete lib/mock/* + mock-session.ts shim</name>
  <files>
    lib/auth/mock-session.ts,
    lib/mock/cookie.ts,
    lib/mock/store.ts,
    lib/mock/users.ts,
    lib/mock/items.ts,
    lib/mock/events.ts,
    lib/mock/transactions.ts,
    lib/mock/missing-items.ts,
    lib/mock/selectors.ts,
    lib/hooks/use-mock-store.ts
  </files>
  <read_first>
    - lib/auth/mock-session.ts (verify it's still a re-export shim from 02-03)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §3 "Files to DELETE" — full enumeration of consumers
    - Use ripgrep to discover any remaining consumers BEFORE deleting:
      ```bash
      grep -rE 'from "@/lib/mock/' app/ components/ lib/ 2>/dev/null
      grep -rE 'from "@/lib/auth/mock-session"' app/ components/ lib/ 2>/dev/null
      grep -rE 'from "@/lib/hooks/use-mock-store"' app/ components/ lib/ 2>/dev/null
      ```
      All three MUST return 0 matches before deleting.
  </read_first>
  <action>
    **Step 2.1 — Verify NO consumers remain:**

    ```bash
    grep -rE 'from "@/lib/mock/' app/ components/ lib/ 2>/dev/null | wc -l
    grep -rE 'from "@/lib/auth/mock-session"' app/ components/ lib/ 2>/dev/null | wc -l
    grep -rE 'from "@/lib/hooks/use-mock-store"' app/ components/ lib/ 2>/dev/null | wc -l
    ```

    All three MUST return 0. If any return > 0:
    - List the files
    - For each, swap the import to the real DAL/hook/action equivalent (e.g., `@/lib/auth/dal`, `@/lib/hooks/use-inventory-live`, etc.)
    - Re-run the grep; iterate until all return 0.

    **Step 2.2 — DELETE the files (after consumers clean):**

    ```bash
    rm lib/auth/mock-session.ts
    rm lib/mock/cookie.ts
    rm lib/mock/store.ts
    rm lib/mock/users.ts
    rm lib/mock/items.ts
    rm lib/mock/events.ts
    rm lib/mock/transactions.ts
    rm lib/mock/missing-items.ts
    rm lib/mock/selectors.ts
    rm lib/hooks/use-mock-store.ts
    # Also remove the empty lib/mock/ directory if it exists:
    rmdir lib/mock/ 2>/dev/null
    ```

    Some Phase 1 files may not exist (e.g., items.ts may have been seeded inside store.ts directly). Run `ls lib/mock/` first and delete only what's present.

    **Step 2.3 — Verify the build still passes:**

    ```bash
    npm run build && npx tsc --noEmit && npm run lint
    ```

    All three must exit 0. If anything fails:
    - The error message names the file with the stale import. Fix that import, re-run.
    - DO NOT re-add the shim — every consumer must point at real Firebase paths.
  </action>
  <acceptance_criteria>
    - `! test -f lib/auth/mock-session.ts` succeeds.
    - `! test -f lib/mock/cookie.ts` succeeds.
    - `! test -f lib/mock/store.ts` succeeds.
    - `! test -f lib/hooks/use-mock-store.ts` succeeds.
    - `[ "$(grep -rE 'from \"@/lib/mock' app/ components/ lib/ 2>/dev/null | wc -l)" = "0" ]`.
    - `[ "$(grep -rE 'from \"@/lib/auth/mock-session\"' app/ components/ lib/ 2>/dev/null | wc -l)" = "0" ]`.
    - `[ "$(grep -rE 'from \"@/lib/hooks/use-mock-store\"' app/ components/ lib/ 2>/dev/null | wc -l)" = "0" ]`.
    - `npm run build` exits 0.
    - `npx tsc --noEmit` exits 0.
    - `npm run lint` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>! test -f lib/auth/mock-session.ts && ! test -f lib/mock/store.ts && ! test -f lib/hooks/use-mock-store.ts && [ "$(grep -rE 'from \"@/lib/mock' app/ components/ lib/ 2>/dev/null | wc -l)" = "0" ] && [ "$(grep -rE 'from \"@/lib/auth/mock-session\"' app/ components/ lib/ 2>/dev/null | wc -l)" = "0" ] && npm run build && npm run lint</automated>
  </verify>
  <done>Mock layer wholesale removed. Project is 100% Firebase-backed.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation |
|---|---|---|---|---|
| T-02-11-01 | Tampering | Stale mock imports leak Phase 1 POC paths into prod build | mitigate | Task 2 acceptance criteria force 0 lib/mock/* + 0 lib/auth/mock-session imports; build verifies |
| T-02-11-02 | Repudiation | Missing audit row on some action | mitigate | Audit matrix (Task 1) explicitly verifies AUD-01 on every state-changing action |
</threat_model>

<verification>
- Audit matrix shows PASS for every Server Action's 8-point checklist.
- lib/mock/ directory removed; lib/auth/mock-session.ts removed.
- npm run build, tsc --noEmit, npm run lint all green.
</verification>

<success_criteria>
- INT-04 fully verified across 15 Server Actions.
- NFR-02 (TS strict), NFR-03 (lint), NFR-06 (use server + verifySession) all confirmed.
- AUD-04 (immutable audit) baseline established (transactions write only via Admin SDK; client deny per rules).
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-11-server-action-and-revalidate-audit-SUMMARY.md` with:
- Audit matrix excerpt (15 actions x 8 checks).
- Files deleted (9-10 paths).
- Any swap fixes performed to clear remaining mock imports.
<= 80 lines.
</output>
