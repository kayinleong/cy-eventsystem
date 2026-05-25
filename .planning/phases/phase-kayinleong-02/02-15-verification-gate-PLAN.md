---
phase: phase-kayinleong-02
plan: 15
type: execute
wave: 13
depends_on:
  - 11
  - 12
  - 13
  - 14
files_modified:
  - .planning/phases/phase-kayinleong-02/CLAIM.md
  - .planning/STATE.md
  - .planning/REQUIREMENTS.md
autonomous: false
requirements:
  - NFR-01
  - NFR-02
  - NFR-03
  - NFR-05
  - NFR-06
  - NFR-07
  - NFR-08
  - NFR-09

must_haves:
  truths:
    - "npm run build exits 0 with zero TypeScript errors."
    - "npx tsc --noEmit exits 0."
    - "npm run lint exits 0 (ESLint flat config; no next lint)."
    - "All 10 acceptance demo steps PASS (admin sign in → invite → set password → create item + event → assign team → staff checkout → checkin → missing resolved → reports → concurrent invariant)."
    - "Phase 1 UI surface visually unchanged except the 2 explicit amendments (D-15 photo field + D-17 cursor URLs)."
    - "All 88 phase REQ-IDs traced as implemented or explicitly documented exceptions."
    - "CLAIM.md status = done with full Regression Report per global CLAUDE.md docs gate."
    - "STATE.md updated to mark Phase 2 complete."
    - "REQUIREMENTS.md traceability checkboxes updated."
  artifacts:
    - path: ".planning/phases/phase-kayinleong-02/CLAIM.md"
      provides: "Closed phase claim with verification + regression report"
      contains: "status: done"
---

<objective>
**The verification gate.** Run the full ROADMAP Phase 2 acceptance criteria. If everything passes, mark CLAIM.md `status: done` per global CLAUDE.md rules and update STATE.md + REQUIREMENTS.md traceability.

ROADMAP Phase 2 success criteria (lines 163-172):
1. Admin signs in, invites staff via UI, staff receives email password reset link, sets password, signs in.
2. Admin creates item + event + assigns team membership; staff checks out + checks in for that event via QR scanner; stock numbers match at every step.
3. Concurrent check-outs by two browsers cannot drive availableQty negative — Firestore transactions reject the second; UI surfaces clear error.
4. Missing items flagged at check-in appear in /reports/missing; admin can resolve; resolution affects stock correctly.
5. Full UI from Phase 1 still renders correctly; UI surface has not regressed (except D-15 + D-17 amendments).
6. ~~firestore.rules unit tests pass for every collection~~ — AMENDED per D-06; replaced by manual rules audit chain.
7. firestore.indexes.json in repo + firebase deploy --only firestore succeeds without auto-create prompts.
8. npm run build + tsc --noEmit + ESLint pass.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/ROADMAP.md
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/phase-kayinleong-02/CLAIM.md
@.planning/phases/phase-kayinleong-02/audit-server-actions.md
@.planning/phases/phase-kayinleong-02/rules-audit-final.md
@CHANGELOG.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Run automated gates + 10-step acceptance demo</name>
  <what-built>
    All previous Phase 2 work. Final verification.
  </what-built>
  <how-to-verify>
    **Step A — Automated gates:**

    Run in order; ALL must exit 0:

    ```bash
    npm run build
    npx tsc --noEmit
    npm run lint
    ```

    If any fail, fix before continuing. Note the time and final exit codes in CLAIM.md.

    **Step B — 10-step acceptance demo** (per ROADMAP Phase 2 success criteria):

    Walk through this exact sequence end-to-end. Record any anomaly.

    1. **Admin sign-in.** Visit /login. Sign in with first-admin credentials. Land on /. KPI cards show real numbers.

    2. **Invite staff user.** /users → click "Invite user" → enter email + name + role=staff. Submit. **Expected:** "Invite created" panel with the Copy-link button visible (D-09).

    3. **Staff sets password.** Copy the link → open in private window → set password → automatic redirect to / signed in as the new staff user (D-08).

    4. **Admin creates item.** Sign back in as admin. /inventory/new → fill SKU="TEST-Phase2", name, totalQty=10, unit="ea", category, lowStockThreshold=2. Optionally upload a photo (D-15). Submit. **Expected:** redirect to /inventory/TEST-Phase2 with photo visible.

    5. **Admin creates event + assigns team.** /events/new → fill name, dates, location, teamLeads=[staff user uid], backupTeams=[]. Submit. **Expected:** redirect to /events/<id>. Within 5s, Cloud Function 2 fires → event.allowedStaff updated.

    6. **Staff checks out.** Sign in as staff. /events/<id>/checkout → scan/manual-enter SKU=TEST-Phase2, qty=3. Add to cart. Commit. **Expected:** redirect to /events/<id>; inventory shows availableQty 10→7, outQty 0→3.

    7. **Staff checks in (with partial missing).** /events/<id>/checkin → returnedQty=2 (partial), missingReason="Lost". Commit. **Expected:** inventory.availableQty 7→9, outQty 3→0. /reports/missing shows new missing record (qty=1).

    8. **Admin resolves missing.** Sign back in as admin. /reports/missing → click Resolve → "writtenOff". **Expected:** totalQty 10→9, missingItem.status=resolved. transactions log has follow-up "adjustment" row.

    9. **Reports show real data.** Visit each report:
       - /reports/stock — TEST-Phase2 shows availableQty=9, totalQty=9.
       - /reports/out — empty (nothing currently out).
       - /reports/history — checkout + checkin + missing + adjustment transactions all visible.
       - /reports/missing — empty (resolved items hidden by default filter).
       - /reports/repurchase — only items with isLowStock=true (TEST-Phase2 is at 9 > threshold 2 so NOT in list).

    10. **Concurrent checkout test (success criterion #3).**
        - Create a fresh item TEST-CONC with totalQty=2.
        - Open 2 browser windows. Both sign in as admin.
        - Both visit /events/<id>/checkout for the same event.
        - Both scan TEST-CONC with qty=2, add to cart. Both click Commit simultaneously.
        - **Expected:** ONE succeeds (toast "Checked out 1 line"), the OTHER fails (toast.error "Only 0 available, requested 2"). Inventory availableQty=0 (not negative). transactions has ONE checkout doc (not two).

    **Step C — UI surface regression check (success criterion #5):**

    Visit each route group; visually compare against Phase 1 UI-SPEC.md / approved acceptance demo:
    - /login (form unchanged, no SeedUsersDisclosure)
    - / (dashboard with 4 KPI cards + widgets — KPIs now real counts, layout identical)
    - /inventory (table layout identical; pagination chrome is now "Showing N — Prev/Next" per D-17 amendment; photo field on new/edit per D-15 amendment — these are EXPECTED diffs)
    - /events
    - /scan (camera widget identical)
    - /reports/* (all 5 unchanged except cursor pagination)
    - /users (admin only)
    - /settings

    Record any UNEXPECTED visual change in CLAIM.md.

    **Step D — Final stack verification:**

    ```bash
    grep -q '"next"' package.json && cat package.json | grep -E '"next"' | head -1
    # Expected: "^16.2.6" or similar 16.x
    grep -q '"firebase"' package.json
    grep -q '"firebase-admin"' package.json
    grep -q '"next-firebase-auth-edge"' package.json
    grep -q '"@yudiel/react-qr-scanner"' package.json
    grep -q '"bwip-js"' package.json
    grep -q '"browser-image-compression"' package.json
    ```
    All MUST exit 0.

    **Step E — Cache Components verification (NFR-09):**

    ```bash
    grep -q "cacheComponents" next.config.ts
    ```
    Should FAIL (no cacheComponents in v1 per KD #12).

    Report results: "All 10 steps PASS, build/lint/type green, UI surface unchanged except D-15+D-17 amendments" or describe each failure.
  </how-to-verify>
  <resume-signal>Type "all gates green, 10-step demo PASS" once everything completes successfully. If anything fails, describe specifically — I'll address before closing the phase.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Update CLAIM.md (Regression Report) + STATE.md + REQUIREMENTS.md traceability</name>
  <files>
    .planning/phases/phase-kayinleong-02/CLAIM.md,
    .planning/STATE.md,
    .planning/REQUIREMENTS.md
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/CLAIM.md (current — status: claimed)
    - .planning/STATE.md (current — phase tracker)
    - .planning/REQUIREMENTS.md (current — traceability section + each REQ-ID checkbox)
    - CLAUDE.md global "CLAIM.md Lifecycle" + "Commit & Push Gate" + "Regression Prevention"
    - .planning/phases/phase-kayinleong-02/audit-server-actions.md (audit artifact from 02-11)
    - .planning/phases/phase-kayinleong-02/rules-audit-final.md (rules audit from 02-14)
  </read_first>
  <action>
    **Step 2.1 — Update `.planning/phases/phase-kayinleong-02/CLAIM.md`:**

    Open the file. Change `status: claimed` → `status: done`. Fill out the three sections (What will change → kept; What has changed → fill from 15 plans; Verification → fill with regression report).

    Append the Regression Report (per global CLAUDE.md Regression Prevention rule):

    ```markdown
    ## What has changed (final)

    - Block A (02-01..02-03): Firebase project + clients + DAL + proxy.ts + auth pages live. Mock auth deleted.
    - Block B (02-04): users CRUD live; 2 Cloud Functions deployed; Copy-link invite UI live per D-09.
    - Block C (02-05..02-06): inventory CRUD + photo upload (D-15) + audit feed + cursor pagination (D-17).
    - Block D (02-07): events CRUD + EVT-08 access control at 3 layers + Cloud Function 2 maintains allowedStaff.
    - Block E (02-08): atomic checkout with CO-05 invariant + useOptimistic revert preserved.
    - Block F (02-09): atomic check-in with damaged routing + missing detection + admin resolution.
    - Block G (02-10): 5 reports + dashboard KPIs via count() + RP-03 badge live.
    - Block H (02-11..02-14): Server Action audit + segment boundaries + offline UX + PWA manifest + final cross-collection rules audit.

    Total files modified: ~80. Total files created: ~25. Total files deleted: ~10 (lib/mock wholesale + POC affordances).

    ## Verification

    ### Automated gates (run {date}):

    - `npm run build`: PASS (exit 0)
    - `npx tsc --noEmit`: PASS (exit 0)
    - `npm run lint`: PASS (exit 0)
    - `firebase deploy --only firestore:rules,firestore:indexes,storage`: PASS
    - `firebase deploy --only functions`: PASS (3 function exports deployed to asia-southeast1)

    ### Acceptance demo (10 steps run {date}):

    1. Admin sign-in: PASS
    2. Invite staff: PASS (resetLink returned per D-09; Firebase email also delivered)
    3. Staff sets password: PASS (auto-sign-in per D-08)
    4. Admin creates item: PASS (photo uploaded; Storage rule admin-write verified)
    5. Admin creates event + team: PASS (allowedStaff updated by Cloud Function 2 within 5s)
    6. Staff checkout: PASS (transactions written; outQty incremented atomically)
    7. Staff partial check-in (missing): PASS (missingItems doc + tx written atomically)
    8. Admin resolves missing: PASS (totalQty decremented; follow-up tx written)
    9. Reports show real data: PASS (all 5 reports + dashboard KPIs)
    10. Concurrent checkout invariant: PASS (one succeeds, one rejects with failedLines; availableQty never negative)

    ### Regression Report (per global CLAUDE.md)

    **What was tested:**
    - Phase 1 UI surface preserved across /login, /, /inventory, /events, /scan, /reports, /users, /settings.
    - D-15 photo field on /inventory/new + /inventory/[id]/edit (NEW per amendment).
    - D-17 cursor URL contract across /inventory, /events, /users, /reports/* (CHANGED per amendment; "Page N of M" replaced with Prev/Next).
    - All 15 Server Actions audited (see audit-server-actions.md): 8/8 checklist items PASS for every action.
    - 31+ Firestore + Storage rules cases passed manual Console Rules Playground audit (see rules-audit-final.md).

    **What passed:**
    - Concurrent checkout invariant under 2-browser race.
    - EVT-08 access control verified at server (DAL), client (array-contains query), and rule (isMember).
    - INT-01..05 all verified end-to-end.
    - AUD-01..04: every state-changing action writes a transactions doc with actor snapshot; transactions are immutable per rule + AUD-04.

    **What was ruled out:**
    - PITFALLS C3 (rules misconfig data leak): mitigated via D-06's per-block manual audits + final cross-collection audit; cumulative evidence reduces risk.
    - PITFALLS C1 (negative qty race): mitigated via runTransaction + invariant assert + rules-layer check.
    - PITFALLS C5 (stuck-out items): nightly scanner deferred to v2 per D-02; manual ops via /reports/out documented.
    - PITFALLS C6 (Admin SDK on client): mitigated via `import "server-only"` on every server-side module; build-time error if violated.

    **Outstanding caveats (v2 candidates) documented in respective SUMMARY files:**
    - Scan-cart persistence across reload (RES-03 partial — depends on Phase 1 implementation).
    - PWA icon files (manifest references them; developer may add for full Lighthouse pass).
    - CI-07 partial check-in granularity (single check-in closes parent line; multiple-against-same-parent requires multiple Server Action calls).

    **Sign-off:**
    Phase 2 — Functionality — COMPLETE on {YYYY-MM-DD}. All ROADMAP success criteria met (with criterion #6 amended per D-06).
    ```

    Update status frontmatter:
    ```
    - status: done
    ```

    **Step 2.2 — Update `.planning/STATE.md`:**

    Find the Phase 2 tracker block. Update:
    - Status → "complete"
    - Completion date → today
    - Add a summary line linking to CLAIM.md.

    **Step 2.3 — Update `.planning/REQUIREMENTS.md`:**

    Check the boxes for every REQ-ID this phase delivered. From the `requirements` field of plans 02-01 through 02-14, the union covers:

    AUTH-01..10, INV-01..10, EVT-01..08, CO-01..10, CI-01..08, MIS-01..04, REP-01..07, RP-01..04, SCN-01..06, AUD-01..04, INT-01..05, RES-01..04, NFR-01..03, NFR-05..09.

    Update each `- [ ]` to `- [x]` for the items above. Leave Phase 1-only items unchanged (NFR-04 etc.).

    Also: add a Phase 2 traceability section under `## Traceability` documenting D-06 (rules unit tests skipped) and D-15/D-17 (UI surface amendments).
  </action>
  <acceptance_criteria>
    - `grep -q "status: done" .planning/phases/phase-kayinleong-02/CLAIM.md` succeeds.
    - `grep -q "Regression Report" .planning/phases/phase-kayinleong-02/CLAIM.md` succeeds.
    - `grep -q "10 steps" .planning/phases/phase-kayinleong-02/CLAIM.md` OR `grep -q "Acceptance demo" .planning/phases/phase-kayinleong-02/CLAIM.md` succeeds.
    - Count of checked REQ-IDs in REQUIREMENTS.md ≥ 80: `[ "$(grep -c '^- \\[x\\]' .planning/REQUIREMENTS.md)" -ge "80" ]` (Phase 1 ones + Phase 2 ones).
    - `grep -q "Phase 2 — Functionality — COMPLETE" .planning/phases/phase-kayinleong-02/CLAIM.md` succeeds.
    - `grep -q "phase-kayinleong-02" .planning/STATE.md` succeeds and references "complete".
    - `npx tsc --noEmit` exits 0 (regression sanity check).
    - `npm run build` exits 0.
    - `npm run lint` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "status: done" .planning/phases/phase-kayinleong-02/CLAIM.md && grep -q "Regression Report" .planning/phases/phase-kayinleong-02/CLAIM.md && grep -q "Phase 2 — Functionality — COMPLETE" .planning/phases/phase-kayinleong-02/CLAIM.md && [ "$(grep -c '^- \[x\]' .planning/REQUIREMENTS.md)" -ge "80" ] && npx tsc --noEmit && npm run build && npm run lint</automated>
  </verify>
  <done>Phase 2 closed per global CLAUDE.md docs gate. CLAIM.md done; STATE.md updated; REQUIREMENTS.md traceability ticked.</done>
</task>

<task type="auto">
  <name>Task 3: Final commit + branch push</name>
  <files>
    .planning/phases/phase-kayinleong-02/CLAIM.md
  </files>
  <read_first>
    - CLAUDE.md global "Commit & Push Gate" section
    - .planning/phases/phase-kayinleong-02/CLAIM.md (verify done status)
  </read_first>
  <action>
    Per global CLAUDE.md "Commit & Push Gate":
    - [ ] Regression Report written in CLAIM.md — done in Task 2
    - [ ] No secrets introduced — re-scan diff
    - [ ] Docs updated if public surface changed — CHANGELOG.md from 02-02, plan SUMMARYs, audits
    - [ ] CLAIM.md status updated to done — done in Task 2

    Commit the final closing state. NO --no-verify; let hooks run.

    ```bash
    git status
    git diff --stat
    # Confirm no .env or service-account JSON in staged files
    git diff --staged | grep -E "(BEGIN PRIVATE KEY|FIREBASE_PRIVATE_KEY=)" && echo "ABORT — secrets detected" || echo "Clean"

    git add .planning/phases/phase-kayinleong-02/ .planning/STATE.md .planning/REQUIREMENTS.md
    git commit -m "$(cat <<'EOF'
    chore(phase-kayinleong-02): close phase — functionality complete

    All 8 ROADMAP success criteria met (criterion #6 amended per D-06).
    15 plans across 13 waves shipped. lib/mock wholesale removed.
    Regression report + final rules audit in CLAIM.md.

    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
    EOF
    )"
    ```

    DO NOT push automatically — let the developer review the commit and push manually per global CLAUDE.md "Review & Merge Etiquette" (Claude never merges its own PR).

    Print a final summary to stdout:

    ```
    ====================================================
    Phase 2 — Functionality (cy-eventsystem) COMPLETE
    ====================================================

    Files touched: ~120
    Plans executed: 15
    Cloud Functions: 3 exports (deployed)
    Server Actions: 15 (audited)
    Firestore indexes: 12 (deployed)
    Manual rules audits: 7 per-block + 1 final cross-collection
    Acceptance demo: 10/10 steps PASS

    Next steps:
    - Developer reviews this commit.
    - `git push` to remote when ready.
    - Open PR for human review per global CLAUDE.md "AI-authored code needs independent human review".
    - Tag v1.0.0 release when PR merges.
    ```
  </action>
  <acceptance_criteria>
    - `git log -1 --oneline | grep -q "phase-kayinleong-02"` succeeds.
    - `git status --short | wc -l` returns 0 (everything committed) OR the only uncommitted files are intentionally unstaged (gitignored).
    - No `.env.local` or service-account JSON in the commit: `git show HEAD --stat | grep -E "(\.env\.local|firebase-adminsdk-.*\.json|-service-account\.json)"` returns nothing.
  </acceptance_criteria>
  <verify>
    <automated>git log -1 --oneline | grep -q "phase-kayinleong-02" && ! (git show HEAD --stat 2>/dev/null | grep -qE "\.env\.local|firebase-adminsdk-.*\.json|-service-account\.json")</automated>
  </verify>
  <done>Phase 2 committed locally. Developer reviews + pushes manually.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation |
|---|---|---|---|---|
| T-02-15-01 | Info disclosure | Commit contains secrets | mitigate | Pre-commit grep for FIREBASE_PRIVATE_KEY; .gitignore covers .env.local; CLAUDE.md secrets hygiene |
| T-02-15-02 | Repudiation | No regression report | mitigate | CLAIM.md regression-report section is mandatory acceptance criterion |
</threat_model>

<verification>
- All ROADMAP Phase 2 success criteria met (with #6 amended).
- All automated gates green.
- 10-step acceptance demo PASS.
- CLAIM.md status: done with full regression report.
- STATE.md + REQUIREMENTS.md traceability updated.
- Commit landed locally; developer pushes manually.
</verification>

<success_criteria>
- Phase 2 complete. cy-eventsystem v1 shippable.
- All 88 phase REQ-IDs traced.
- D-06, D-15, D-17 amendments documented in CHANGELOG + traceability.
- Manual rules audit chain (7 per-block + 1 final) closes the D-06 partial-unmitigated risk.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-15-verification-gate-SUMMARY.md` summarizing the phase outcome + linking to CLAIM.md + audit artifacts. <= 80 lines.

After Task 3 commit lands, suggest to the developer: open a PR for human review. The PR description includes:
- claim ID: `phase-kayinleong-02`
- Regression Report excerpt
- Links to audit-server-actions.md + rules-audit-final.md
- List of UI surface amendments (D-15 photo, D-17 cursor URLs)
</output>
