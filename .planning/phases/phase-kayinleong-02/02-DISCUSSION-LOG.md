# Phase 2: Functionality — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 02-functionality
**Areas discussed:** De-risk strategy, Email delivery scope, Photo / Storage scope, Scale + indexing

---

## Selection — which gray areas to discuss

| Option | Description | Selected |
|--------|-------------|----------|
| De-risk strategy | Spike-first vs commit-first for next-firebase-auth-edge v1.12 + Cloud Functions scope. Affects Block A ordering and first-wave plan structure. | ✓ |
| Email delivery scope | Firebase built-in vs SendGrid; what gets emailed? (STATE.md Q3) | ✓ |
| Photo / Storage scope | Item photos at create? Damage attachments on check-in? Storage rules + image processing? (STATE.md Q4) | ✓ |
| Scale + indexing | Operational scale assumption: small ops vs growth-ready. Drives composite indexes, listener pagination, cursor design. (STATE.md Q2) | ✓ |

**User's choice:** All four selected.

---

## De-risk strategy

### Q1: Spike on `next-firebase-auth-edge` v1.12 before Block A work commits?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — 1-day spike first | Build a throwaway proxy.ts + login Server Action + cookie round-trip against a scratch Firebase project. Validates v1.12 + Next 16 compatibility. STATE.md recommended. | ✓ |
| No — commit and iterate | Skip the spike, install v1.12, build Block A, back out if it fails. Faster on happy path but creates rework risk. | |
| Spike only if a smoke test fails | Build Block A's auth slice first; only triggers the spike if cookie round-trip breaks. | |

**User's choice:** Yes — 1-day spike first (Recommended).

### Q2: Cloud Functions scope for v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Required only | Two functions: onWrite(users) → setCustomUserClaims, onWrite(events/users) → maintain event.allowedStaff. Nothing else. | ✓ |
| Required + nightly stale-event scanner | Add scheduled function flagging 'status:active' events with endDate < today-N (PITFALLS C5 mitigation). | |
| Required + nightly + email triggers | Above + email function for low-stock/overdue alerts. Couples to email delivery + amends v2 deferral. | |
| Avoid Cloud Functions entirely | Inline claim sync in inviteUser action + recompute allowedStaff inline on writes. Loses async resilience. | |

**User's choice:** Required only (Recommended).

### Q3: Firebase project layout?

| Option | Description | Selected |
|--------|-------------|----------|
| One production project + Emulator Suite for dev | Single live Firebase project; Emulator for all local dev + rules-unit-tests + CI. | |
| Two projects: staging + prod | Separate staging + prod. Doubles env config; closer to prod parity. | |
| Three: dev + staging + prod | Personal dev per developer + shared staging + prod. Overkill for solo-owner. | |
| **Free-text response:** "use one firebase project, dont use emulator" | Single project; no emulator at all. | ✓ |

**User's choice:** Custom — one Firebase project, no emulator (single live project, all dev hits it).

### Q4: First admin user seed approach?

| Option | Description | Selected |
|--------|-------------|----------|
| One-time Admin SDK seed script | `scripts/seed-first-admin.ts` (gitignored or env-gated) uses Admin SDK to createUser → set claim → write Firestore doc. Run once manually. | ✓ |
| Console-created + manual Firestore doc | Create user in Firebase Console UI, then manually add users/{uid} doc. No script. | |
| Bootstrap mode in proxy.ts | If users collection empty, next sign-in promotes to admin automatically. Security-sensitive code path survives in prod. | |

**User's choice:** One-time Admin SDK seed script (Recommended).

### Follow-up Q5: Where do firestore.rules unit tests run if no emulator?

| Option | Description | Selected |
|--------|-------------|----------|
| Emulator for rules tests only | Allow @firebase/rules-unit-testing to spin up ephemeral emulator per test run. Doesn't conflict with "no emulator for dev". | |
| Rules tests against a 2nd prod-style project | Stand up `cy-eventsystem-rules-test` project. Real Firestore, no emulator. Adds a 2nd project. | |
| Skip rules unit tests in v1 | Accept success criterion #6 gap; manual rules audit + integration tests. Faster but breaks the locked acceptance gate. | ✓ |
| Manual rules-explorer-only verification | Use Firebase Console's Rules Playground for every rule; document scenarios. No automated CI test. | |

**User's choice:** Skip rules unit tests in v1.

**Notes:** This amends ROADMAP success criterion #6 ("firestore.rules unit tests pass for every collection"). PITFALLS C3 (rules-misconfig data leak) is acknowledged unmitigated. CHANGELOG entry required per global CLAUDE.md docs gate. Mitigations: deny-by-default skeleton + manual rules audit checkpoint at end of each block + Firebase Console Rules Playground for non-trivial rules.

### Follow-up Q6: Where does local dev hit?

| Option | Description | Selected |
|--------|-------------|----------|
| Live Firebase project (single shared DB) | Every npm run dev write lands in live Firestore. Solo developer = zero contention. Data pollution managed manually. | ✓ |
| Live project with `dev-` doc prefix | All dev writes use dev-prefixed IDs and are filtered out of report queries. Sandboxed by convention. | |
| Reconsider — use emulator for dev after all | Reverses prior answer. Standard Firebase setup. | |

**User's choice:** Live Firebase project (single shared DB).

---

## Email delivery scope

### Q7: Email provider for invite + reset emails?

| Option | Description | Selected |
|--------|-------------|----------|
| Firebase built-in | admin.auth().generatePasswordResetLink + Firebase default email template. Free, zero infra. | ✓ |
| Firebase built-in + custom template via Console | Same SDK call, customize template in Firebase Console. Modest branding. | |
| Generate link, send via SendGrid | Mint URL via SDK, send via SendGrid. Full branding + tracking. Adds env var + costs. | |
| Generate link, send via Resend | Same as SendGrid but Resend (~3K free/mo). React Email templates. | |

**User's choice:** Firebase built-in (Recommended).

### Q8: After /set-password success, where does the user land?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-sign-in → dashboard | Immediately signInWithEmailAndPassword + redirect to /. Zero-friction; same UX for invite + forgot-pw. | ✓ |
| Toast + redirect to /login | Show "Password set", redirect to /login for manual sign-in. Cleaner mental model. | |
| Branch on flow type | Auto-sign-in after invite, redirect after forgot-pw. Two code paths; oobCodes not distinguishable. | |

**User's choice:** Auto-sign-in → dashboard (Recommended).

### Q9: Failed invite email delivery handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Surface to admin + offer manual link copy | Server Action returns the reset URL on success/failure; UI shows Copy link button. | ✓ |
| Trust Firebase, no fallback | Just call sendPasswordResetEmail; if it bounces, admin re-invites. Simplest. | |
| Log + retry queue | Cloud Function watches invitePending collection, retries on schedule. Adds a 3rd function. | |

**User's choice:** Surface to admin + offer manual link copy (Recommended).

### Q10: Low-stock + overdue-event email notifications in v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard-only, deferred to v2 | Stay aligned with REQUIREMENTS.md v2-deferral. Dashboard widget + nav badge only. | |
| Add basic low-stock email digest | Cloud Function daily at 09:00 emails admins low-stock + overdue list. Adds a function + email provider. | ✓ (initial choice) |

**User's choice:** Initially "Add basic low-stock email digest" — conflicts with prior answers surfaced and resolved below.

### Conflict-resolution Q11: How to resolve the digest decision?

| Option | Description | Selected |
|--------|-------------|----------|
| Roll digest back to v2 | Keep original v2 deferral. Dashboard + nav badge only. Preserves Required-only Functions + Firebase-built-in email + v2-deferred list. | ✓ |
| Keep digest — expand Functions to 3 + add Resend/SendGrid | Add scheduled function + Resend/SendGrid. Amends PROJECT.md v2 list. Adds ~2-3 plans. | |
| Keep digest — Vercel Cron + Resend | Skip Cloud Function; use Vercel Cron + Server Action + Resend. Amends v2 deferral. | |
| Keep digest — admin-triggered, no schedule | Add "Send digest now" button on dashboard. No scheduler, no Function. Adds Resend. | |

**User's choice:** Roll digest back to v2 (Recommended).

**Notes:** Initial answer to Q10 contradicted prior decisions (Required-only Functions in Q2, Firebase-built-in email in Q7) plus PROJECT.md v2-deferred list. User chose to roll back rather than amend three decisions; final state: low-stock + overdue email = v2-deferred.

---

## Photo / Storage scope

### Q12: Photo source on item create/edit?

| Option | Description | Selected |
|--------|-------------|----------|
| File upload only | Standard input type=file. Mobile auto-offers camera roll or capture. Simplest. | |
| File upload + dedicated 'Take photo' button | Add explicit Take photo button alongside file picker. Better mobile UX. Reuses scanner's camera-permission pattern. | ✓ |
| Skip photo upload entirely in v1 | Defer to v2. Amends INV-01 'optional photo' clause. | |

**User's choice:** File upload + dedicated 'Take photo' button.

### Q13: Image processing before upload?

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side resize + compress | browser-image-compression, max 1600px, JPEG q0.85. Caps Storage cost ~150-300KB. | ✓ |
| Upload original, resize on read via Storage extension | Firebase Storage image-resize extension. Heavier infra. | |
| Upload original, no processing | Upload as-is. Cheapest to implement, most expensive at scale. | |

**User's choice:** Client-side resize + compress (Recommended).

### Q14: Storage rules — who can read/write item photos?

| Option | Description | Selected |
|--------|-------------|----------|
| Read: any signed-in; Write: admin only | Mirrors INV-03 (admin-only edit). Symmetric with Firestore inventory rules. | ✓ |
| Read: any signed-in; Write: admin OR team-lead | Team leads can attach photos during event prep. Wider write surface. | |
| Public read; admin write | Photos accessible by URL without auth. Loses revocability. | |

**User's choice:** Read: any signed-in user; Write: admin only (Recommended).

### Q15: Photo deletion + lifecycle?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace-only | Edit replaces existing photo at same path. No delete affordance. No orphan cleanup. | ✓ |
| Replace + explicit 'Remove photo' button | Allow nulling photo back to no-image. Adds delete() call. | |
| Versioned (keep last N) | Storage path versioned by timestamp. Photo history visible on item detail. Overkill for v1. | |

**User's choice:** Replace-only (Recommended).

---

## Scale + indexing

### Q16: Operational scale assumption for v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Small ops: ~100 items, ~10 active events | ~50-200 items, ~5-15 events. Full-collection fetch viable. Phase 1 seed (30 items) baseline. | |
| Mid: ~1000 items, ~50 events | ~500-2000 items, ~30-80 events. Need pagination via cursors. Composite indexes. | |
| Growth-ready: 5000+ items, 100+ events | 5000-20000 items, 100+ events. Full denormalization. count() aggregations. Sharded counters. | ✓ |

**User's choice:** Growth-ready: 5000+ items, 100+ events.

### Q17: Pagination strategy on list pages?

| Option | Description | Selected |
|--------|-------------|----------|
| Full fetch + client TanStack pagination | Server Component reads full collection, TanStack paginates in-browser. Cheap for ~100; dies at 1000+. | ✓ (initial) |
| Firestore cursor + Server pagination | Server Component reads page-N via startAfter cursor; URL ?cursor=xxx. Scales to any size. | |
| Hybrid: full fetch for small collections + cursor for history | Small collections full-fetch; history uses cursors. | |

**User's choice:** Initially "Full fetch + client pagination" — conflict with Q16 surfaced and resolved below.

### Conflict-resolution Q18: Resolve scale-vs-pagination contradiction?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid pagination | Bounded collections (inventory, events, users, missing) full-fetch; transactions log uses cursors. Adds 1 abstraction. | |
| Full Firestore cursor pagination everywhere | All list pages → startAfter cursors. URL ?page=N → ?cursor=xxx. Loses "go to page N" UX. | ✓ |
| Reconsider scale assumption | If realistic Year 1 plateau is 200-500 items, small-ops + full-fetch is fine. | |
| Stay growth-ready + lazy aggregations | Keep 5000+ assumption; use count() for KPIs; filter-and-search inventory UI instead of pagination. | |

**User's choice:** Full Firestore cursor pagination everywhere.

**Notes:** Significant Phase 2 change from Phase 1's URL contract. All list pages migrate from ?page=N to ?cursor=xxx. TanStack tables set manualPagination: true. "Go to specific page" UX lost; replaced with prev/next only.

### Q19: Composite index strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-declare from research + grow reactively | Block A ships obvious indexes; new queries hitting FAILED_PRECONDITION get added. Never use console auto-create. | ✓ |
| Pre-declare exhaustively up front | Audit every query, pre-declare every index. Slower start. | |
| Reactive only — add when queries fail | Empty indexes.json at start. Risk: indexes auto-created via console (breaks INT-05). | |

**User's choice:** Pre-declare from research + grow reactively (Recommended).

### Q20: Firestore offline persistence?

| Option | Description | Selected |
|--------|-------------|----------|
| Enable globally + RES-02 banner + scanner disable | enableIndexedDbPersistence in lib/firebase/client.ts. RES-01/02/03 fulfilled. | ✓ |
| Enable selectively (reads only, writes blocked offline) | Persistence on; every Server Action checks navigator.onLine. | |
| Skip offline persistence in v1 | Defer RES-01..04 to v2. App requires connectivity end-to-end. | |

**User's choice:** Enable globally + RES-02 banner + scanner disable (Recommended).

### Q21: Real-time listener strategy at scale?

| Option | Description | Selected |
|--------|-------------|----------|
| Listeners scoped to current page only | onSnapshot on the 50-row visible window. Navigating spins up new listener. Cost bounded. | ✓ |
| Polling on a timer | Every 30s refetch via Server Action. Predictable cost; loses real-time. | |
| Hot pages live + cold pages server-fetch | Active check-out screens + dashboard live; inventory list + history server-fetch. | |
| Live listeners everywhere | Subscribe to full filtered queries on every list page. Best UX, highest cost. | |

**User's choice:** Listeners scoped to current cursor page only (Recommended).

### Q22: Dashboard KPI strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Firestore count() aggregation per KPI | 4 cheap count() reads per dashboard load. Not real-time. | ✓ |
| Live aggregate doc maintained by Cloud Function | stats/{kpis} doc maintained by Function. Truly live. Adds a 3rd Function. | |
| Sharded counters | Distributed counter pattern. Overkill for v1. | |

**User's choice:** Firestore count() aggregation per KPI (Recommended).

---

## Claude's Discretion

Areas explicitly left for the planner to decide (captured in CONTEXT.md `### Claude's Discretion`):

- Server Action file structure (co-located per route)
- DAL implementation details (`React.cache()` wrapping, etc.)
- Cursor encoding format (base64 of JSON likely)
- Error UX copy specifics
- `revalidatePath` granularity
- App Check enrollment decision
- `experimental_taintObjectReference` adoption
- Plan/wave structure for the 8 ROADMAP blocks

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Highlights:

- **Rolled back during discussion:** Low-stock email digest (Q11 resolution).
- **v2 candidates surfaced incidentally:** Damage photos on missing form, rules-unit-tests against ephemeral emulator, App Check enrollment, nightly stale-event scanner, sharded counters, multi-region Firestore, CI/CD for Firebase deployments.

---

## ROADMAP / REQUIREMENTS amendments locked here

These amendments need explicit reflection in upstream docs:

1. **Success criterion #6** ("firestore.rules unit tests pass for every collection") — SKIPPED in v1 per D-06. PITFALLS C3 acknowledged unmitigated; manual audit + Rules Playground checkpoint applied instead. CHANGELOG entry required.
2. **"UI surface frozen"** clause — AMENDED by D-15 (add photo field to inventory forms) and D-17 (cursor URLs replace ?page=N on all list pages). Both are documented here for traceability.
3. **PROJECT.md "Out of Scope"** entry for "Email / Slack notifications" — CONFIRMED, stays v2-deferred (initial digest decision in Q10 was rolled back in Q11).

---

*Audit log generated 2026-05-25 during /gsd-discuss-phase 2.*
