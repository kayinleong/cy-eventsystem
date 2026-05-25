---
phase: phase-kayinleong-02
plan: 14
type: execute
wave: 12
depends_on:
  - 02
  - 04
  - 05
  - 06
  - 07
  - 08
  - 09
  - 10
files_modified:
  - firestore.rules
  - firestore.indexes.json
  - storage.rules
  - .planning/phases/phase-kayinleong-02/rules-audit-final.md
autonomous: false
requirements:
  - INT-02
  - INT-03
  - INT-05
  - NFR-07
  - NFR-08

must_haves:
  truths:
    - "Final manual rules audit run through Firebase Console Rules Playground covers EVERY collection + EVERY operation per D-06 mitigation (b)+(c)."
    - "firestore.indexes.json contains every index that's been needed during 02-04..02-10 development; if FAILED_PRECONDITION fired during testing, that index was added."
    - "INT-05 ban on auto-create reaffirmed — no console-link clicks; all indexes flow via firebase deploy."
    - "Final audit report committed at .planning/phases/phase-kayinleong-02/rules-audit-final.md."
    - "firebase deploy --only firestore,storage executed cleanly."
  artifacts:
    - path: ".planning/phases/phase-kayinleong-02/rules-audit-final.md"
      provides: "Cross-collection final rules audit report"
      contains: "Cross-Collection Audit"
---

<objective>
**Block H — Final rules + index audit.** Per D-06 mitigation (b)+(c). This is the LAST manual rules check before phase verification. All per-block rules audits (02-02, 02-04, 02-05, 02-07, 02-08, 02-09, 02-10) consolidated into one cross-collection report. Verify all indexes deployed; no FAILED_PRECONDITION remaining.
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
@firestore.rules
@firestore.indexes.json
@storage.rules
@firebase.json
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Run final Rules Playground audit + reconcile any FAILED_PRECONDITION indexes</name>
  <what-built>
    Phase 2 is feature-complete. Time for the final security audit.
  </what-built>
  <how-to-verify>
    **Step A — Re-deploy rules + indexes to ensure latest is live:**
    ```bash
    firebase deploy --only firestore:rules,firestore:indexes,storage --project <your-project-id>
    ```

    **Step B — Open Firebase Console → Firestore → Rules Playground.** Run a comprehensive cross-collection matrix.

    Test cases (record in `.planning/phases/phase-kayinleong-02/rules-audit-final.md`):

    | # | Path | Auth? | Role | Op | Expected | Actual |
    |---|------|-------|------|-----|----------|--------|
    | 1 | /users/{any} | No | — | read | DENY | |
    | 2 | /users/{any} | No | — | write | DENY | |
    | 3 | /users/{uid} | Yes | staff (same uid) | read | ALLOW | |
    | 4 | /users/{uid} | Yes | staff (other uid) | read | DENY | |
    | 5 | /users/{any} | Yes | admin | read | ALLOW | |
    | 6 | /users/{any} | Yes | admin | write | DENY (Admin SDK only) | |
    | 7 | /inventory/{any} | No | — | read | DENY | |
    | 8 | /inventory/{any} | Yes | staff | read | ALLOW | |
    | 9 | /inventory/{any} | Yes | staff | write | DENY | |
    | 10 | /inventory/{any} | Yes | admin | create (valid) | ALLOW | |
    | 11 | /inventory/{any} | Yes | admin | update avail=-1 | DENY (invariant) | |
    | 12 | /inventory/{any} | Yes | admin | update avail > total | DENY (invariant) | |
    | 13 | /events/{any} | Yes | staff (in allowedStaff) | read | ALLOW | |
    | 14 | /events/{any} | Yes | staff (NOT in allowedStaff) | read | DENY | |
    | 15 | /events/{any} | Yes | admin | read | ALLOW | |
    | 16 | /events/{any} | Yes | staff (team lead) | update no allowedStaff change | ALLOW | |
    | 17 | /events/{any} | Yes | staff | update allowedStaff (untouched guard) | DENY | |
    | 18 | /events/{any} | Yes | staff (NOT team lead) | update | DENY | |
    | 19 | /events/{any} | Yes | admin | delete | ALLOW | |
    | 20 | /transactions/{any} | Yes | anyone | read | ALLOW | |
    | 21 | /transactions/{any} | Yes | admin Web SDK | create/update/delete | DENY (INT-03 + AUD-04) | |
    | 22 | /missingItems/{any} | Yes | staff | read | ALLOW | |
    | 23 | /missingItems/{any} | Yes | admin Web SDK | update | DENY (server-only) | |
    | 24 | /someOtherCollection | Yes | admin | any | DENY (catch-all) | |

    **Step C — Storage Rules Playground:**

    | # | Path | Auth? | Role | Op | Expected | Actual |
    |---|------|-------|------|-----|----------|--------|
    | 25 | items/{any}/photo.jpg | No | — | read | DENY | |
    | 26 | items/{any}/photo.jpg | Yes | staff | read | ALLOW | |
    | 27 | items/{any}/photo.jpg | Yes | staff | write | DENY | |
    | 28 | items/{any}/photo.jpg | Yes | admin | write 6MB JPEG | DENY (5MB limit) | |
    | 29 | items/{any}/photo.jpg | Yes | admin | write 1MB PNG | DENY (image/jpeg or content type mismatch) — wait, rule is `image/.*`, so PNG would ALLOW | |
    | 30 | items/{any}/photo.jpg | Yes | admin | write 200KB JPEG | ALLOW | |
    | 31 | /privateBucket/anything | Yes | admin | read | DENY (deny-by-default) | |

    **Step D — Index audit:**

    ```bash
    firebase firestore:indexes --project <your-project-id>
    ```

    Compare output against `firestore.indexes.json` line-by-line. If any deployed index is missing from the file (because someone clicked the auto-create link by accident), capture it now:

    ```bash
    firebase firestore:indexes --project <your-project-id> > /tmp/deployed-indexes.json
    diff /tmp/deployed-indexes.json firestore.indexes.json
    ```

    If diff shows extras in deployed (i.e., extras not in repo file): ADD them to `firestore.indexes.json` and commit.
    If diff shows extras in repo file (i.e., declared but not deployed): re-run `firebase deploy --only firestore:indexes`.

    **Step E — Smoke-test queries:**

    Visit these pages, observe browser DevTools console for ANY `FirestoreError: The query requires an index` errors. If any appear, DO NOT click the console link (INT-05 ban). Instead:
    1. Copy the index def from the error message.
    2. Add to `firestore.indexes.json`.
    3. `firebase deploy --only firestore:indexes`.
    4. Wait for index to build (5-15 min).
    5. Re-test.

    Pages to walk:
    - /inventory (default + filtered by category/lifecycleState/isLowStock)
    - /events (default status=active + filtered)
    - /events/[id] (with various staff/admin roles)
    - /scan (mode toggle, event picker)
    - /reports/stock, /reports/out, /reports/history (with each filter combination)
    - /reports/missing (status filter)
    - /reports/repurchase

    **Step F — Reconcile audit:**

    Write `.planning/phases/phase-kayinleong-02/rules-audit-final.md` with the full table (Steps B+C) + outcomes + any deltas applied.

    Report: "Final rules audit PASS — all 31+ cases match expected; no FAILED_PRECONDITION encountered; indexes reconciled" or describe failures.
  </how-to-verify>
  <resume-signal>Type "final rules + index audit PASS" once the audit report is committed and indexes deployed cleanly. Describe any anomaly otherwise.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Commit final audit report</name>
  <files>.planning/phases/phase-kayinleong-02/rules-audit-final.md</files>
  <read_first>
    - Notes from Task 1
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-06
  </read_first>
  <action>
    Write the report capturing Task 1 outcomes. Use this template:

    ```markdown
    # Phase 2 Block H — Final Rules + Index Audit

    **Date:** {YYYY-MM-DD}
    **Auditor:** {developer-name}
    **Firebase project:** cy-eventsystem
    **D-06 mitigation:** This document fulfills mitigation (b)+(c) — manual cross-collection audit + Console Rules Playground evidence.

    ## Cross-Collection Audit

    ### Firestore

    [Paste the 24-row table from Task 1 Step B with actuals]

    ### Storage

    [Paste the 7-row table from Task 1 Step C with actuals]

    ## Index Reconciliation

    `firebase firestore:indexes` vs `firestore.indexes.json`:
    - Deployed but missing from repo file: [list or "none"]
    - Declared but not deployed: [list or "none"]
    - Action taken: [if any]

    ## FAILED_PRECONDITION encountered during smoke-test walk:
    - [list or "none"]

    ## Summary

    Total cases: 31
    PASS: {N}
    FAIL: {N}

    {If any FAIL, describe the fix applied or open follow-up.}

    ## Sign-off

    This audit closes the D-06 manual rules-audit checkpoint. The phase is cleared for 02-15 verification gate.

    {signature/uid}
    ```

    Commit the file.
  </action>
  <acceptance_criteria>
    - `test -f .planning/phases/phase-kayinleong-02/rules-audit-final.md` succeeds.
    - `grep -q "Cross-Collection Audit" .planning/phases/phase-kayinleong-02/rules-audit-final.md` succeeds.
    - `grep -q "Sign-off" .planning/phases/phase-kayinleong-02/rules-audit-final.md` succeeds.
    - `grep -qE "PASS|FAIL" .planning/phases/phase-kayinleong-02/rules-audit-final.md` succeeds.
  </acceptance_criteria>
  <verify>
    <automated>test -f .planning/phases/phase-kayinleong-02/rules-audit-final.md && grep -q "Cross-Collection Audit" .planning/phases/phase-kayinleong-02/rules-audit-final.md && grep -q "Sign-off" .planning/phases/phase-kayinleong-02/rules-audit-final.md</automated>
  </verify>
  <done>Final D-06 audit checkpoint cleared.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation |
|---|---|---|---|---|
| T-02-14-01 | Information disclosure | Manual rules audit missed a case | mitigate | The audit matrix lists 31+ cases across every collection + every op; any FAIL is documented and a fix landed before phase close. PITFALLS C3 reduction is incremental: per-block audits in Blocks A,B,C,D,E,F,G + this final cross-collection sweep |
</threat_model>

<verification>
- 31+ rules cases tested via Console Rules Playground; report committed.
- firestore.indexes.json reconciled vs deployed; no orphan indexes.
- No FAILED_PRECONDITION errors during smoke-test walk.
- firebase deploy --only firestore,storage succeeded.
</verification>

<success_criteria>
- INT-02, INT-03, INT-05 fully verified at rules layer.
- D-06 manual audit complete — partial-unmitigated risk of PITFALLS C3 is now reduced via comprehensive playground evidence.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-14-rules-and-index-audit-SUMMARY.md` referencing the rules-audit-final.md and listing any deltas applied. <= 50 lines.
</output>
