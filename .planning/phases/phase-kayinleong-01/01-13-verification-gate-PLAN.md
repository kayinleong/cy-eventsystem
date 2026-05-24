---
phase: 01-ui-poc
plan: 13
type: execute
wave: 4
depends_on: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12]
files_modified:
  - .planning/phases/phase-kayinleong-01/CLAIM.md
  - .planning/STATE.md
autonomous: false
requirements:
  - NFR-02
  - NFR-03
  - NFR-05

must_haves:
  truths:
    - "tsc --noEmit passes (NFR-02)."
    - "npm run lint passes (NFR-03)."
    - "npm run build passes (NFR-02)."
    - "next dev runs without console errors on every route in the locked sitemap (NFR-05)."
    - "Manual click-through smoke test: admin sign-in → dashboard → create item → create event → switch to staff → scan into cart → confirm check-out → switch back to admin → resolve missing → see dashboard reflect changes — passes."
    - "Phase 1 acceptance demo flow per CONTEXT.md specifics completes end-to-end."
  artifacts:
    - path: ".planning/phases/phase-kayinleong-01/CLAIM.md"
      provides: "Updated to status=done with Verification section per CLAUDE.md global rules"
      contains: "Verification"
    - path: ".planning/STATE.md"
      provides: "Phase 1 marked complete"
      contains: "Completed"
  key_links:
    - from: "verification checkpoint"
      to: "human reviewer"
      via: "Stakeholders click through all routes and approve UI surface before Phase 2"
      pattern: "human-verify"
---

<objective>
Run the full Phase 1 verification gate: typecheck, lint, build, dev-server smoke test, and the acceptance demo flow. Update STATE.md and CLAIM.md per global CLAUDE.md rules.

This is the final plan in Phase 1. It is NOT autonomous — it ends with a `checkpoint:human-verify` gate where stakeholders click through the app and approve before the phase is marked done.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/phase-kayinleong-01/CLAIM.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run all build + lint + typecheck gates and capture results</name>
  <files>
    .planning/phases/phase-kayinleong-01/01-13-verification-RESULTS.md
  </files>
  <read_first>
    - CLAUDE.md (Verification Expectations section)
    - .planning/REQUIREMENTS.md NFR-02, NFR-03, NFR-05
    - package.json (verify scripts: dev, build, start, lint)
  </read_first>
  <action>
    Run the following commands in sequence. For each, capture the exit code and the last 30 lines of output. Compile results into `.planning/phases/phase-kayinleong-01/01-13-verification-RESULTS.md`.

    Commands (in order):

    ```bash
    npx tsc --noEmit
    npm run lint
    npm run build
    ```

    For each command, record:
    - Command
    - Exit code (must be 0 to pass)
    - First/last lines of output if non-zero, or just "OK" if zero

    Then start the dev server in the background:

    ```bash
    npm run dev
    ```

    Wait for "Ready in Xms" output, then perform an automated smoke check using `curl` against every route in the locked sitemap to confirm a 200 response (or a documented 3xx redirect):

    ```bash
    # Authenticated user routes need a cookie. For the smoke check, prime a cookie via curl by
    # POSTing to the login form's underlying action. Since Phase 1 uses client-side cookie writes,
    # the smoke check should use a manual `cookie.txt` containing a forged mock_session JSON for
    # an admin seed user. Document this in the RESULTS file as a Phase 1 smoke-test workaround.

    # Compose the cookie value:
    COOKIE='mock_session=%7B%22uid%22%3A%22u-admin-1%22%2C%22displayName%22%3A%22Alex%20Chen%22%2C%22email%22%3A%22alex.chen%40example.com%22%2C%22role%22%3A%22admin%22%2C%22disabled%22%3Afalse%7D'

    for url in \
      "http://localhost:3000/login" \
      "http://localhost:3000/forgot-password" \
      "http://localhost:3000/set-password" \
      "http://localhost:3000/register" \
      "http://localhost:3000/" \
      "http://localhost:3000/inventory" \
      "http://localhost:3000/inventory/new" \
      "http://localhost:3000/inventory/AUD-MIC-01" \
      "http://localhost:3000/inventory/AUD-MIC-01/edit" \
      "http://localhost:3000/events" \
      "http://localhost:3000/events/new" \
      "http://localhost:3000/events/evt-active-01" \
      "http://localhost:3000/events/evt-active-01/edit" \
      "http://localhost:3000/events/evt-active-01/checkout" \
      "http://localhost:3000/events/evt-overdue-01/checkin" \
      "http://localhost:3000/scan" \
      "http://localhost:3000/scan?mode=checkin" \
      "http://localhost:3000/reports/stock" \
      "http://localhost:3000/reports/out" \
      "http://localhost:3000/reports/missing" \
      "http://localhost:3000/reports/history" \
      "http://localhost:3000/reports/repurchase" \
      "http://localhost:3000/users" \
      "http://localhost:3000/users/invite" \
      "http://localhost:3000/settings" \
      "http://localhost:3000/unauthorized"
    do
      status=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $COOKIE" "$url")
      echo "$status $url"
    done
    ```

    For each URL, record the HTTP status code. Acceptable:
    - 200 for all rendered routes
    - 404 for /register (AUTH-06 — `notFound()`)
    - 307 for / (redirects to dashboard but the cookie should route to dashboard at /(app)/page.tsx which IS at /, so should be 200 — verify)

    Stop the dev server after smoke check.

    Compile RESULTS.md with:

    ```markdown
    # Phase 1 Verification Results

    **Run:** YYYY-MM-DD HH:MM
    **Branch:** [current branch]
    **Commit:** [HEAD short SHA]

    ## Build gates

    | Gate | Exit | Notes |
    |------|------|-------|
    | npx tsc --noEmit | 0 | OK |
    | npm run lint | 0 | OK |
    | npm run build | 0 | OK |

    ## Route smoke check

    All 26 routes (authenticated as u-admin-1) return 200 except /register which returns 404 (AUTH-06 by design).

    | Route | HTTP | Notes |
    |-------|------|-------|
    | /login | 200 | |
    | /register | 404 | AUTH-06 |
    | ... | | |

    ## Console errors

    None observed during `next dev` route navigation (verified visually).
    ```

    If ANY gate fails (non-zero exit), document the failure and STOP — do not proceed to Task 2. The task is `done` only when all gates pass.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npm run build && test -f .planning/phases/phase-kayinleong-01/01-13-verification-RESULTS.md && grep -q "tsc --noEmit | 0" .planning/phases/phase-kayinleong-01/01-13-verification-RESULTS.md</automated>
  </verify>
  <acceptance_criteria>
    - All three commands exit 0.
    - Route smoke check completed.
    - RESULTS.md file exists with the documented format.
    - No build errors related to Next.js 16 async-API misuse, missing exports, or peer-dep conflicts.
  </acceptance_criteria>
  <done>Automated verification gates all pass; results documented.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Acceptance demo click-through</name>
  <what-built>
    Phase 1 UI POC: full UI shell across 28 routes, mock data only, navigable end-to-end with admin + staff roles, scanner functional, theme toggle working.
  </what-built>
  <how-to-verify>
    Run `npm run dev` and walk through the acceptance demo flow from CONTEXT.md `<specifics>`:

    1. Visit http://localhost:3000 — should redirect to /login.
    2. Sign in as `alex.chen@example.com` with password `password` (click POC seed users disclosure to one-click fill).
    3. Land on dashboard at /. Confirm:
       - KPI cards show non-zero values (active events, items out, low stock, open missing).
       - Active Events widget lists "Spring Product Demo" and "Marketing Pop-Up Booth".
       - Overdue Returns widget shows "Marketing Pop-Up Booth" (endDate 2026-05-22 < today 2026-05-24).
       - Low Stock widget lists ≥4 items.
       - Recent Activity feed shows ≥20 transactions newest-first.
    4. Navigate to /inventory. Confirm:
       - DataTable shows 30 items.
       - Filter by Audio category — URL gains ?category=Audio; rows reduce.
       - Search "mic" — URL gains ?q=mic; rows reduce.
       - Click an item to navigate to detail.
    5. On item detail:
       - Click "Print label" — QR code renders via bwip-js.
       - Click "Edit" → save changes → redirected back; "Item updated" toast appears.
       - Click "Retire" → AlertDialog with "Retire this item?" — confirm → toast → redirected to /inventory.
    6. Navigate to /inventory/new. Fill form → "Add item" → toast → redirected to detail page of new item.
    7. Navigate to /events. Confirm 6 events visible with status filter defaulted to active.
    8. Visit /events/evt-active-01. Click "Check in" → /events/evt-active-01/checkin opens with pre-populated lines.
    9. Decrement returnedQty on one line → "Pick a reason" error → select "Lost" → submit → toast → redirected to event detail.
    10. Visit /reports/missing → see the new missing record from step 9. As admin, click "Resolve" → choose "Found" → toast.
    11. Open user menu → "Switch role (POC only)" → click "Staff".
    12. Verify sidebar no longer shows Users; visiting /users redirects to /unauthorized.
    13. As staff, visit /scan. Pick an event from the picker dialog → manually enter a known SKU "AUD-MIC-01" → cart updates → click "Check out N items" → redirected to event detail.
    14. Open user menu → switch back to Admin.
    15. Open user menu → switch theme to Dark → entire UI updates → switch to Light → updates again.
    16. Visit /users → invite a new user via Sheet → toast → row appears.
    17. Inline change a user's role → toast.
    18. Sign out from user menu → redirected to /login.

    Validate AFTER walkthrough:
    - No console errors at any step (Chrome devtools console).
    - Every page renders within ~500ms.
    - Dark mode looks correct on every visited route.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues observed (route, step #, what went wrong).</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Update CLAIM.md + STATE.md to mark Phase 1 done</name>
  <files>
    .planning/phases/phase-kayinleong-01/CLAIM.md,
    .planning/STATE.md
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/CLAIM.md (current shape)
    - .planning/STATE.md (current shape)
    - CLAUDE.md "CLAIM.md Lifecycle" section
  </read_first>
  <action>
    Update CLAIM.md per global CLAUDE.md rules:

    ```markdown
    # Claim: phase-kayinleong-01
    - owner: kayinleong
    - session: claude-code
    - branch: <current-branch>
    - started: 2026-05-24
    - completed: <today>
    - status: done
    - summary: UI POC — full UI shell for every route in the locked sitemap, navigable end-to-end with mock data.

    ## What changed
    - Created 110+ files across app/(auth), app/(app), components/ui, components/feature, lib/{mock,types,schemas,auth,hooks}
    - Installed 9 new runtime deps (next-themes, sonner, react-hook-form, @hookform/resolvers, zod, @tanstack/react-table, date-fns, @yudiel/react-qr-scanner, bwip-js) and 27 shadcn UI components via CLI
    - All Phase 1 REQ-IDs satisfied at UI/mock level (see ROADMAP coverage table)

    ## Verification
    - npx tsc --noEmit exits 0
    - npm run lint exits 0
    - npm run build exits 0
    - Manual route smoke-check: all 26 routes return 200/3xx/404 as documented in 01-13-verification-RESULTS.md
    - Acceptance demo click-through approved by stakeholder (see human-verify checkpoint)
    - No console errors observed during navigation

    ## Regression scope (per global CLAUDE.md)
    - Only new files added; existing files modified: app/layout.tsx (added ThemeProvider + Toaster), app/page.tsx (deleted in favor of (app)/page.tsx)
    - No Firebase calls introduced (NFR-04 confirmed)
    - No env.local dependencies (NFR-04 confirmed)
    - Mock store mutators preserve immutability invariants verified by manual checkout/checkin walkthrough
    ```

    Update STATE.md phase tracker:

    ```markdown
    | Phase | ID | Status | Started | Completed |
    |-------|----|----|---------|-----------|
    | 1 | `phase-kayinleong-01` (UI POC) | done | 2026-05-24 | <today> |
    | 2 | `phase-kayinleong-02` (Functionality) | Not started | — | — |
    ```

    And update the "Current focus" section:

    ```markdown
    ## Current focus

    **Next step:** `/gsd-discuss-phase 2` — gather context for Phase 2 (Firebase wiring). UI surface frozen from Phase 1; Phase 2 replaces lib/mock/* wholesale without changing components.
    ```

    Commit per global CLAUDE.md rules:
    ```bash
    git add .planning/phases/phase-kayinleong-01/CLAIM.md .planning/STATE.md
    git commit -m "chore(phase-kayinleong-01): mark Phase 1 done"
    ```
  </action>
  <verify>
    <automated>grep -q "status: done" .planning/phases/phase-kayinleong-01/CLAIM.md; grep -q "## Verification" .planning/phases/phase-kayinleong-01/CLAIM.md; grep -q "done" .planning/STATE.md; git log -1 --pretty=%s | grep -q "phase-kayinleong-01"</automated>
  </verify>
  <acceptance_criteria>
    - CLAIM.md status updated to `done` with Verification section per CLAUDE.md.
    - STATE.md phase tracker shows Phase 1 = done.
    - Single commit captures both updates.
  </acceptance_criteria>
  <done>Claim closed, state updated, Phase 1 officially complete.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Demo cookie used in smoke test | Forged mock_session in curl headers — Phase 1 only; documents the deliberate non-httpOnly trade-off. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-01 | Tampering | The smoke-check cookie technique is documented and Phase-1 specific; do not carry into Phase 2 | mitigate | Comment in RESULTS.md explicitly notes "Phase 1 smoke-test workaround; Phase 2 must use real Firebase session cookie via the login flow." |
</threat_model>

<verification>
- All automated gates pass (tsc, lint, build).
- Route smoke check passes for all 26 routes.
- Human verifier approves end-to-end demo walkthrough.
- CLAIM.md + STATE.md committed.
</verification>

<success_criteria>
Phase 1 done. UI surface approved. Ready to begin Phase 2 (`/gsd-discuss-phase 2`).
</success_criteria>

<output>
After Task 3, no SUMMARY.md needed — `01-13-verification-RESULTS.md` IS the summary. The phase's STATE.md update is the final artifact.
</output>
