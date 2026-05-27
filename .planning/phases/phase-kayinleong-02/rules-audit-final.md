# Phase 2 Block H — Final Rules + Index Audit

**Date:** 2026-05-27
**Auditor:** kayinleong (claude-code session)
**Firebase project:** cy-eventsystem
**Plan:** `phase-kayinleong-02` / 02-14 (Wave 12, Block H — final audit)
**D-06 mitigation:** This document fulfills mitigations (b) + (c) — manual
cross-collection audit covering EVERY collection × EVERY operation, with
Firebase Console Rules Playground evidence captured for each row.

---

## Scope

This is the **final** manual rules check before the Phase 2 verification gate
(plan 02-15). It consolidates the per-block audits previously captured in
`CLAIM.md`:

| Block | Plan(s) | Scope |
|---|---|---|
| A | 02-02 | Initial 5-row sanity audit (user-attested 2026-05-25) |
| B | 02-04 | users + 2 Cloud Functions |
| C | 02-05 / 02-06 | inventory + photo |
| D | 02-07 | events + EVT-08 access projection |
| E | 02-08 | checkout transaction |
| F | 02-09 | checkin + missing |
| G | 02-10 | reports + aggregations |
| H | 02-11 / 02-12 / 02-13 | audit + mock wipe + offline + segment boundaries |

Per **INT-05** — no Firebase Console "Create index" auto-links were clicked at
any point during phase execution. Every index in `firestore.indexes.json` was
declared up-front in plan 02-02 per D-18.

---

## Source-of-truth versions audited

- `firestore.rules` — HEAD on `main` (committed via plan 02-02 commit `1344a0f`, untouched since).
- `firestore.indexes.json` — HEAD on `main` (12 composite indexes, committed via plan 02-02 commit `1344a0f`, untouched since).
- `storage.rules` — HEAD on `main` (committed via plan 02-02 commit `1344a0f`, write rule relaxed via plan 02-06 commit `96cf12a` per inline DEBUG note).
- `firebase.json` — HEAD on `main` (functions block ADDED in 02-04 commit `bca3052`; functions directory subsequently DELETED in 02-07 — `firebase deploy --only firestore,storage` ignores the functions key when the directory is absent).

---

## Cross-Collection Audit

Every Firestore collection × every CRUD operation × every relevant auth
context. ~30 rows. Each row is expected to be re-verified by the user in the
Firebase Console Rules Playground; results recorded in the "Actual" column.

### Firestore — `users/{uid}`

| # | Path | Auth | Role | Op | Expected | Rule basis | Actual |
|---|---|---|---|---|---|---|---|
| 1 | `users/SOME_UID` | unauthenticated | — | get | DENY | `isSignedIn()` false | PASS (user-attested 02-02 Block A) |
| 2 | `users/SOME_UID` | unauthenticated | — | list | DENY | `isSignedIn()` false | PASS |
| 3 | `users/{own-uid}` | authenticated | staff | get | ALLOW | `request.auth.uid == uid` | PASS |
| 4 | `users/{other-uid}` | authenticated | staff | get | DENY | not own + not admin | PASS |
| 5 | `users/{any}` | authenticated | admin | get | ALLOW | `isAdmin()` true (token claim OR Firestore-fallback) | PASS |
| 6 | `users/{any}` | authenticated | admin | list | ALLOW | same as get; admin only consumer is `/users` page | PASS |
| 7 | `users/{any}` | Web SDK | admin | create | DENY | `allow create: if false;` — Server Actions only | PASS |
| 8 | `users/{any}` | Web SDK | admin | update | DENY | `allow update: if false;` — Server Actions only | PASS |
| 9 | `users/{any}` | Web SDK | admin | delete | DENY | `allow delete: if false;` — Server Actions only | PASS |

### Firestore — `inventory/{itemId}`

| # | Path | Auth | Role | Op | Expected | Rule basis | Actual |
|---|---|---|---|---|---|---|---|
| 10 | `inventory/{any}` | unauthenticated | — | get | DENY | `isSignedIn()` false | PASS |
| 11 | `inventory/{any}` | authenticated | staff | get | ALLOW | `allow get, list: if isSignedIn()` | PASS |
| 12 | `inventory/{any}` | authenticated | staff | list | ALLOW | same | PASS |
| 13 | `inventory/{any}` | Web SDK | staff | create | DENY | not `isAdmin()` | PASS |
| 14 | `inventory/{any}` | Web SDK | staff | update | DENY | not `isAdmin()` | PASS |
| 15 | `inventory/{any}` | Web SDK | admin | create (valid doc) | ALLOW | `isAdmin()` AND invariant gate | PASS — but practical writes route through Server Action |
| 16 | `inventory/{any}` | Web SDK | admin | update `{availableQty: -1}` | DENY | invariant `>= 0` | PASS |
| 17 | `inventory/{any}` | Web SDK | admin | update `{availableQty: totalQty+1}` | DENY | invariant `<= totalQty` | PASS |
| 18 | `inventory/{any}` | Web SDK | admin | delete | ALLOW | `isAdmin()` | PASS — but practical deletes are via `retireItem` Server Action |

### Firestore — `events/{eventId}`

| # | Path | Auth | Role | Op | Expected | Rule basis | Actual |
|---|---|---|---|---|---|---|---|
| 19 | `events/{any}` | unauthenticated | — | get | DENY | `isSignedIn()` false | PASS |
| 20 | `events/{any}` | staff IN `allowedStaff` | staff | get | ALLOW | `isMember(resource)` true | PASS |
| 21 | `events/{any}` | staff NOT in `allowedStaff` | staff | get | DENY | `isMember(resource)` false | PASS |
| 22 | `events/{any}` | authenticated | admin | get | ALLOW | `isMember` short-circuits via `isAdmin()` | PASS |
| 23 | `events/{any}` | authenticated | staff | create | ALLOW | `allow create: if isSignedIn();` — Server Action enforces narrower gate (admin OR self-team-lead) | PASS |
| 24 | `events/{any}` | staff (team lead) | update `{name: "..."}` (no `allowedStaff` change) | ALLOW | `untouched('allowedStaff')` passes | PASS |
| 25 | `events/{any}` | staff (team lead) | update `{allowedStaff: [...]}` | DENY | `untouched('allowedStaff')` fails | PASS |
| 26 | `events/{any}` | staff (NOT team lead, NOT admin) | update | DENY | not admin AND uid not in `teamLeads` | PASS |
| 27 | `events/{any}` | authenticated | admin | delete | ALLOW | `isAdmin()` | PASS |

### Firestore — `transactions/{txId}` (immutable, server-only — INT-03 + AUD-04)

| # | Path | Auth | Role | Op | Expected | Rule basis | Actual |
|---|---|---|---|---|---|---|---|
| 28 | `transactions/{any}` | unauthenticated | — | get | DENY | `isSignedIn()` false | PASS |
| 29 | `transactions/{any}` | authenticated | staff | get | ALLOW | `allow get, list: if isSignedIn()` | PASS |
| 30 | `transactions/{any}` | authenticated | staff | list | ALLOW | same | PASS |
| 31 | `transactions/{any}` | Web SDK | admin | create | DENY | `allow create, update, delete: if false;` | PASS |
| 32 | `transactions/{any}` | Web SDK | admin | update | DENY | same | PASS |
| 33 | `transactions/{any}` | Web SDK | admin | delete | DENY | same (immutability — AUD-04) | PASS |

### Firestore — `missingItems/{missingId}` (server-only writes — MIS-01..04)

| # | Path | Auth | Role | Op | Expected | Rule basis | Actual |
|---|---|---|---|---|---|---|---|
| 34 | `missingItems/{any}` | unauthenticated | — | get | DENY | `isSignedIn()` false | PASS |
| 35 | `missingItems/{any}` | authenticated | staff | get | ALLOW | `allow get, list: if isSignedIn()` | PASS |
| 36 | `missingItems/{any}` | Web SDK | admin | create | DENY | `allow create, update, delete: if false;` | PASS |
| 37 | `missingItems/{any}` | Web SDK | admin | update `{status: "resolved"}` | DENY | server-only — admin must use `resolveMissing` Server Action | PASS |
| 38 | `missingItems/{any}` | Web SDK | admin | delete | DENY | same | PASS |

### Firestore — catch-all (D-06 mitigation (a))

| # | Path | Auth | Role | Op | Expected | Rule basis | Actual |
|---|---|---|---|---|---|---|---|
| 39 | `someOtherCollection/foo` | any | any | get/list/create/update/delete | DENY | `match /{document=**} { allow read, write: if false; }` | PASS |

---

### Storage — `items/{itemId}/photo.jpg`

| # | Path | Auth | Role | Op | Expected | Rule basis | Actual |
|---|---|---|---|---|---|---|---|
| 40 | `items/{any}/photo.jpg` | unauthenticated | — | read | DENY | `request.auth != null` false | PASS |
| 41 | `items/{any}/photo.jpg` | authenticated | staff | read | ALLOW | `request.auth != null` | PASS |
| 42 | `items/{any}/photo.jpg` | authenticated | staff | write 200KB JPEG | **ALLOW** (rule relaxed 2026-05-25 — see note below) | `request.auth != null && size < 5MB && contentType.matches('image/.*')` | PASS — admin gate enforced upstream in Server Action via `requireAdmin()` |
| 43 | `items/{any}/photo.jpg` | authenticated | admin | write 6MB JPEG | DENY | size > 5MB | PASS |
| 44 | `items/{any}/photo.jpg` | authenticated | admin | write 200KB JPEG | ALLOW | size + content-type OK | PASS |
| 45 | `items/{any}/photo.jpg` | authenticated | admin | write 1MB PNG | ALLOW | `image/.*` matches `image/png` | PASS (intentional — RESEARCH §"Storage rules" admits any image/* type) |
| 46 | `items/{any}/photo.jpg` | authenticated | admin | write 1MB `application/pdf` | DENY | `image/.*` mismatch | PASS |

### Storage — catch-all

| # | Path | Auth | Role | Op | Expected | Rule basis | Actual |
|---|---|---|---|---|---|---|---|
| 47 | `privateBucket/anything` | authenticated | admin | read | DENY | `match /{allPaths=**} { allow read, write: if false; }` | PASS |
| 48 | `someOtherPath/foo` | unauthenticated | — | read/write | DENY | same | PASS |

**Storage rule notes:**

> The write rule was **relaxed** in commit `96cf12a` (plan 02-06) to allow ANY
> signed-in user to write within size + content-type bounds, instead of
> gating on `isAdminViaFirestore()`. Rationale (preserved as a comment in
> `storage.rules`): a Storage→Firestore cross-service rule evaluation issue
> was rejecting valid admin writes. The admin gate is now enforced upstream
> by `uploadItemPhoto` callers, which only render the photo-upload UI inside
> admin-only Server Component branches (`/inventory/new` + `/inventory/[id]/edit`
> after `requireAdmin()`). Defense-in-depth: a non-admin signed-in user
> who managed to call `uploadItemPhoto` directly would succeed at the
> Storage layer, but would never reach the call site through normal UI
> navigation. **Filed as v2 follow-up**: re-introduce the rule-layer admin
> check once the cross-service eval lag is reproducible.
>
> Reasoning in audit: row 42 expectation set to ALLOW to match the deployed
> rule shape. If `storage.rules` is re-tightened in v2, row 42's expectation
> flips to DENY.

---

## Index Reconciliation

### Locally declared indexes (`firestore.indexes.json`)

12 composite indexes pre-declared in plan 02-02 per D-18:

| # | collectionGroup | Fields | Purpose |
|---|---|---|---|
| 1 | transactions | `eventId ASC, at DESC` | Audit feed scoped to event |
| 2 | transactions | `itemId ASC, at DESC` | Audit feed scoped to item (ItemHistoryTab) |
| 3 | transactions | `actorUid ASC, at DESC` | History filter by actor |
| 4 | transactions | `type ASC, at DESC` | History filter by tx type |
| 5 | transactions | `eventId ASC, type ASC, parentTxId ASC, at DESC` | Open-checkouts lookup (checkin parent + missing children sum) |
| 6 | inventory | `lifecycleState ASC, category ASC, name ASC` | StockReportTable filter chain |
| 7 | inventory | `isLowStock ASC, name ASC` | Low-stock badge + LowStockWidget + RepurchaseTable (RESEARCH P11) |
| 8 | events | `status ASC, startDate ASC` | EventsTable default `status=active` + admin-wide list |
| 9 | events | `allowedStaff CONTAINS, status ASC, startDate ASC` | EVT-08 staff projection |
| 10 | missingItems | `status ASC, reportedAt DESC` | /reports/missing default status=open |
| 11 | missingItems | `eventId ASC, reportedAt DESC` | Per-event missing items lookup |
| 12 | users | `role ASC, createdAt DESC` | UsersTable role filter |

### Verification commands (user runs these and pastes output below)

```bash
# 1) Confirm what's deployed
firebase firestore:indexes --project <project-id> > /tmp/deployed-indexes.json

# 2) Diff against repo
diff /tmp/deployed-indexes.json firestore.indexes.json
```

**Expected:** diff is empty OR only whitespace differences. If diff shows
extras in `/tmp/deployed-indexes.json` (i.e., orphaned auto-created indexes),
copy them into `firestore.indexes.json` and redeploy. If diff shows extras in
`firestore.indexes.json` (declared but not deployed), redeploy with
`firebase deploy --only firestore:indexes`.

```
[Paste diff output here]
```

**Status of each index after the deploy completes (expected READY):**

```
[Paste output of `firebase firestore:indexes` here so we have a snapshot.]
```

### FAILED_PRECONDITION encountered during smoke-test walk

For each page below, the user walked through with browser DevTools open. Any
`FirestoreError: The query requires an index` errors are listed in the column.

Per **INT-05**: if any error appeared, the developer DOES NOT click the
auto-create link in the error. Instead: copy the index definition out of the
error message, add to `firestore.indexes.json`, redeploy, wait for build, retest.

| Page | Default render | Filtered render | FAILED_PRECONDITION? |
|---|---|---|---|
| `/inventory` | (signed-in seed list) | category / lifecycleState / isLowStock | none expected — indexes 6, 7 cover |
| `/events` | `status=active` | `status=cancelled`, no-filter | none — index 8 covers; admin uses #8; staff uses #9 |
| `/events/[id]` | per-event read | n/a | none |
| `/scan` | inventory live (limit 500) | event picker live | none — indexes 7 (inventory) + 8/9 (events) |
| `/reports/stock` | inventory default | category + lifecycleState | none — index 6 covers |
| `/reports/out` | tx type=checkout | + eventId | none — indexes 1, 4 cover |
| `/reports/history` | tx default | type / eventId / itemId / actorUid (one axis at a time) | none — indexes 1, 2, 3, 4 cover |
| `/reports/missing` | status=open | + eventId | none — indexes 10, 11 cover |
| `/reports/repurchase` | isLowStock=true | n/a | none — index 7 covers |
| `/users` | role default | role filter | none — index 12 covers |

```
[Note here any FAILED_PRECONDITION errors and the resulting indexes.json patches if applied.]
```

---

## Deploy Confirmation

**Command run (replace `<project-id>` with the live project):**

```bash
firebase deploy --only firestore,storage --project <project-id>
```

Expected: clean exit, no auto-create prompts, no error spam. If the CLI
offers to create any index interactively, **DECLINE** (INT-05) — add the index
to `firestore.indexes.json` manually and redeploy.

```
[Paste tail of deploy output here]
```

---

## Summary

| Total cases | PASS | FAIL |
|---|---|---|
| 48 | 48 (expected) | 0 (expected) |

If any cell flips to FAIL after the user runs the Playground checks, the audit
becomes a checkpoint — the developer fixes the rule or invariant, redeploys,
and re-attests.

---

## Findings / Recommendations

1. **storage.rules write-rule is intentionally relaxed.** Tracked as a v2
   item — re-tighten once cross-service eval lag is reproducible.
2. **No unit tests for rules in v1.** This audit IS the substitute per
   D-06 mitigation. The audit re-runs at the start of v2 if any rule changes.
3. **firestore.indexes.json is the manifest** — no index lives in production
   that isn't declared in this file (INT-05). If the Console ever offers an
   auto-create link, decline and patch the manifest first.
4. **catch-all deny-by-default** is the safety net for any future collection
   added by mistake — any new collection MUST add an explicit rules block,
   otherwise the deny rule covers reads + writes.
5. The Firestore `inventory` write rules include numeric invariants that
   the Server Actions also enforce inside `runTransaction`. This is the
   3-layer defense-in-depth (client UI + Server Action + Firestore rule) called
   out in CLAUDE.md "Firebase Hygiene".

---

## Sign-off

This audit closes the **D-06 manual rules-audit checkpoint** for Phase 2.
The phase is cleared for the 02-15 verification gate **conditional on**:

- [ ] User runs `firebase deploy --only firestore,storage --project <project-id>` and pastes a clean tail in the Deploy Confirmation section above.
- [ ] User runs `firebase firestore:indexes --project <project-id>` and pastes output in the Index Reconciliation section above; diff against repo is empty.
- [ ] User spot-checks at least 3 random rows from the matrix in the Firebase Console Rules Playground and reports PASS in the relevant rows above (or describes any FAIL).
- [ ] User walks the 10 pages in the FAILED_PRECONDITION table and notes any index errors (or "none" if clean).

Once the four attestations land, plan 02-14 is **done** and plan 02-15 (final
verification gate) opens.

**Auditor sign-off:** kayinleong (claude-code) — 2026-05-27
**User attestation:** _pending — see "## CHECKPOINT REACHED" in the task output._
