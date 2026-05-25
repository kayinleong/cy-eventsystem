---
phase: phase-kayinleong-02
plan: 04
type: execute
wave: 4
depends_on:
  - 02
  - 03
files_modified:
  - functions/package.json
  - functions/tsconfig.json
  - functions/.gitignore
  - functions/src/index.ts
  - functions/src/setCustomUserClaims.ts
  - functions/src/syncAllowedStaff.ts
  - app/(app)/users/actions.ts
  - app/(app)/users/page.tsx
  - app/(app)/users/invite/page.tsx
  - app/(app)/users/invite/_components/invite-user-page-form.tsx
  - components/feature/users/InviteUserSheet.tsx
  - components/feature/users/UserRoleSelectInline.tsx
  - components/feature/users/DisableUserButton.tsx
  - components/feature/users/UsersTable.tsx
  - lib/data/users.server.ts
  - lib/hooks/use-users-live.ts
  - firebase.json
autonomous: false
requirements:
  - AUTH-07
  - AUTH-08
  - AUTH-09
  - AUTH-10
  - INT-04
  - NFR-06

must_haves:
  truths:
    - "functions/ directory ships with package.json, tsconfig.json, and the 2 logical Cloud Functions per refined D-02 (2 functions, 3 trigger registrations)."
    - "Function 1 (onUserWriteSetClaims) sets {role: 'admin'|'staff'} on onWrite users/{uid} and revokes refresh tokens on change."
    - "Function 2 (allowedStaff sync) is implemented as TWO trigger registrations — onEventTeamChange + onUserRoleChange — sharing the same recompute logic per refined D-02 / RESEARCH §2.4. Both triggers are functionally required (admin role changes affect all events; team-membership changes affect one event)."
    - "Function 2 has a self-write loop guard (onlyAllowedStaffChanged) per RESEARCH §2.4 + RESEARCH P5 + A6."
    - "Server Actions inviteUser/setUserRole/disableUser live in app/(app)/users/actions.ts, each gated by requireAdmin()."
    - "inviteUser returns the password reset URL in its response payload per D-09 (success AND failure paths)."
    - "/users/invite page shows the reset URL with a Copy button after submit per D-09."
    - "/users page swapped from store.* mutators to Server Action calls; UI surface preserved."
    - "lib/data/users.server.ts ships Admin SDK cursor-paginated read helpers per D-17."
    - "lib/hooks/use-users-live.ts ships onSnapshot-backed reactive hook per D-20 (50-row scope)."
    - "firebase.json `functions[0].codebase` matches the actual functions package name."
    - "functions/package.json contains NO 'serve' / emulator script per D-04 (emulator suite forbidden, not just unused)."
    - "Manual rules audit covers users + transactions collections per D-06 mitigation."
  artifacts:
    - path: "functions/src/setCustomUserClaims.ts"
      provides: "onDocumentWritten users/{uid} → setCustomUserClaims + revokeRefreshTokens"
      contains: "setCustomUserClaims"
    - path: "functions/src/syncAllowedStaff.ts"
      provides: "Function 2 (2 trigger registrations) with self-write guard per RESEARCH P5"
      contains: "onlyAllowedStaffChanged"
    - path: "functions/src/index.ts"
      provides: "All 3 trigger exports of the 2 logical functions"
      contains: "onUserWriteSetClaims"
    - path: "functions/package.json"
      provides: "Standalone npm scope for functions package with engines.node: 20 and NO emulator/serve script"
      contains: "firebase-functions"
    - path: "app/(app)/users/actions.ts"
      provides: "inviteUser, setUserRole, disableUser Server Actions"
      contains: "requireAdmin"
    - path: "lib/data/users.server.ts"
      provides: "Admin SDK cursor-paged read helper"
      contains: "import \"server-only\""
    - path: "lib/hooks/use-users-live.ts"
      provides: "Web SDK onSnapshot hook for users collection"
      contains: "onSnapshot"
  key_links:
    - from: "functions/src/setCustomUserClaims.ts"
      to: "Firebase Auth custom claims"
      via: "After users/{uid}.role change → setCustomUserClaims(uid, {role}) → revokeRefreshTokens(uid)"
      pattern: "setCustomUserClaims.*revokeRefreshTokens"
    - from: "app/(app)/users/actions.ts inviteUser"
      to: "/users/invite UI Copy-link button"
      via: "Server Action returns {ok: true, resetLink} for both success and failure paths"
      pattern: "resetLink"
    - from: "components/feature/users/UsersTable.tsx"
      to: "lib/hooks/use-users-live.ts"
      via: "TanStack table consumes useUsersLive(cursorPage) per D-20"
      pattern: "useUsersLive"
---

<objective>
**Block B — Users + roles.** Ship the 2 logical Cloud Functions per refined D-02 (Function 1 = setCustomUserClaims; Function 2 = allowedStaff sync, implemented as 2 trigger registrations sharing one recompute path), wire `inviteUser` / `setUserRole` / `disableUser` Server Actions in `app/(app)/users/actions.ts`, swap `/users` and `/users/invite` from mock-store to the actions, and stand up the Admin SDK read helper + live hook for users.

Per RESEARCH §2 (Block B) + PATTERNS.md §1 row `app/(app)/users/actions.ts`: mutator-name → Server-Action mapping is 1:1 with Phase 1 by design.

Output: 1 new functions/ package + 1 new actions.ts + 1 new data helper + 1 new hook + 6 modified UI files + 1 firebase.json edit. After this plan, the developer can deploy the functions via `firebase deploy --only functions` and the /users surface is fully wired against Firebase.
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
@.planning/phases/phase-kayinleong-02/02-02-firebase-clients-and-proxy-PLAN.md
@.planning/phases/phase-kayinleong-01/01-12-users-settings-SUMMARY.md
@.planning/research/ARCHITECTURE.md
@.planning/research/PITFALLS.md
@.planning/REQUIREMENTS.md
@firebase.json
@firestore.rules
@firestore.indexes.json
@lib/firebase/admin.ts
@lib/firebase/client.ts
@lib/auth/dal.ts
@lib/auth/roles.ts
@lib/schemas/auth.ts
@lib/schemas/user.ts
@lib/types/user.ts
@lib/types/session.ts
@lib/mock/store.ts
@lib/mock/users.ts
@lib/hooks/use-mock-store.ts
@lib/hooks/use-url-table-state.ts
@app/(app)/users/page.tsx
@app/(app)/users/invite/page.tsx
@app/(app)/users/invite/_components/invite-user-page-form.tsx
@components/feature/users/InviteUserSheet.tsx
@components/feature/users/UserRoleSelectInline.tsx
@components/feature/users/DisableUserButton.tsx
@components/feature/users/UsersTable.tsx

<interfaces>
<!-- New contracts created by this plan. -->

```typescript
// app/(app)/users/actions.ts
export async function inviteUser(formData: FormData): Promise<
  | { ok: true; uid: string; resetLink: string }
  | { ok: false; error: string; resetLink?: string; errors?: Record<string, string[]> }
>;
export async function setUserRole(uid: string, role: "admin" | "staff"): Promise<{ ok: true } | { ok: false; error: string }>;
export async function disableUser(uid: string, disabled: boolean): Promise<{ ok: true } | { ok: false; error: string }>;

// lib/data/users.server.ts
export type UsersPage = { users: UserDoc[]; nextCursor: string | null };
export async function getUsersPage(opts: {
  cursor?: { displayName: string; uid: string };
  limit?: number;
  filters?: { role?: "admin" | "staff"; q?: string };
}): Promise<UsersPage>;
export async function getUserServer(uid: string): Promise<UserDoc | null>;

// lib/hooks/use-users-live.ts
export function useUsersLive(initial: UserDoc[], opts?: { role?: "admin"|"staff"; limit?: number }): UserDoc[];
```

```typescript
// Cloud Functions exported from functions/src/index.ts (3 trigger registrations across 2 logical functions per refined D-02)
export const onUserWriteSetClaims: CloudFunction;  // Function 1
export const onEventTeamChange: CloudFunction;     // Function 2 — trigger A
export const onUserRoleChange: CloudFunction;      // Function 2 — trigger B
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold functions/ package + tsconfig + gitignore</name>
  <files>
    functions/package.json,
    functions/tsconfig.json,
    functions/.gitignore,
    firebase.json
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §2.1 lines 480-509 (functions structure + package.json)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §2.2 lines 510-523 (firebase.json)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-02 refined (2 logical functions, 3 trigger registrations) + D-04 (no emulator suite)
    - firebase.json (from 02-02; verify `functions` block exists)
    - .gitignore (root — verify it covers `functions/lib/` and `functions/node_modules/`)
  </read_first>
  <action>
    **Step 1.1 — Create `functions/package.json`:**

    Per D-04, the Firebase Emulator Suite is forbidden. The `serve` script that `firebase init functions` scaffolds MUST be omitted entirely — not just commented out — so the codebase contains no emulator codepath at all.

    ```json
    {
      "name": "functions",
      "private": true,
      "main": "lib/index.js",
      "engines": { "node": "20" },
      "scripts": {
        "build": "tsc",
        "build:watch": "tsc --watch",
        "lint": "eslint --ext .js,.ts .",
        "deploy": "firebase deploy --only functions",
        "logs": "firebase functions:log"
      },
      "dependencies": {
        "firebase-admin": "^13.0.0",
        "firebase-functions": "^6.0.0"
      },
      "devDependencies": {
        "typescript": "^5.6.0"
      }
    }
    ```

    NOTE: The `serve` / `firebase emulators:start` script is deliberately ABSENT. D-04 forbids the emulator suite — we never ship that codepath. Deploys happen via `firebase deploy --only functions` to the live project.

    **Step 1.2 — Create `functions/tsconfig.json`:**

    ```json
    {
      "compilerOptions": {
        "module": "commonjs",
        "noImplicitReturns": true,
        "noUnusedLocals": true,
        "outDir": "lib",
        "sourceMap": true,
        "strict": true,
        "target": "es2020",
        "skipLibCheck": true,
        "esModuleInterop": true
      },
      "compileOnSave": true,
      "include": ["src"]
    }
    ```

    **Step 1.3 — Create `functions/.gitignore`:**

    ```
    node_modules
    lib
    *.log
    firebase-debug.log
    ```

    **Step 1.4 — Update `firebase.json`** if `functions` block isn't correctly wired. Current state (from 02-02):

    ```json
    "functions": [
      {
        "source": "functions",
        "codebase": "default",
        "runtime": "nodejs20"
      }
    ]
    ```

    Add `"predeploy"` and `"ignore"` clauses recommended by Firebase:

    ```json
    "functions": [
      {
        "source": "functions",
        "codebase": "default",
        "runtime": "nodejs20",
        "ignore": [
          "node_modules",
          ".git",
          "firebase-debug.log",
          "firebase-debug.*.log",
          "*.local"
        ],
        "predeploy": [
          "npm --prefix \"$RESOURCE_DIR\" run build"
        ]
      }
    ]
    ```

    **Step 1.5 — Install functions deps:**

    ```bash
    cd functions && npm install
    ```

    (Run from project root with `cd functions && npm install`.) After install, `functions/node_modules/firebase-admin/` should exist.

    **Step 1.6 — Update root `.gitignore`** to also ignore the functions build artifacts (safety belt — functions/.gitignore already covers it):

    ```
    # Functions build artifacts (defense in depth — functions/.gitignore already covers)
    functions/lib/
    functions/node_modules/
    ```

    Only append if not already present.
  </action>
  <acceptance_criteria>
    - `test -f functions/package.json` succeeds.
    - `grep -q "\"engines\":" functions/package.json` succeeds.
    - `grep -q "\"node\": \"20\"" functions/package.json` succeeds.
    - `grep -q "firebase-functions" functions/package.json` succeeds.
    - `grep -q "firebase-admin" functions/package.json` succeeds.
    - **`grep -q '"serve"' functions/package.json` returns NOTHING (no emulator script — D-04 enforcement).**
    - **`grep -q 'emulators' functions/package.json` returns NOTHING (no emulator codepath at all — D-04 enforcement).**
    - `test -f functions/tsconfig.json` succeeds.
    - `grep -q "\"outDir\": \"lib\"" functions/tsconfig.json` succeeds.
    - `test -f functions/.gitignore` succeeds.
    - `grep -q "^lib" functions/.gitignore` succeeds (functions/lib build output ignored).
    - `grep -q "node_modules" functions/.gitignore` succeeds.
    - `grep -q "predeploy" firebase.json` succeeds (functions predeploy build hook).
    - `node -e "JSON.parse(require('fs').readFileSync('firebase.json'))"` exits 0.
    - `test -d functions/node_modules/firebase-admin` succeeds (deps installed).
  </acceptance_criteria>
  <verify>
    <automated>test -f functions/package.json && grep -q '"node": "20"' functions/package.json && grep -q "firebase-functions" functions/package.json && ! grep -q '"serve"' functions/package.json && ! grep -q "emulators" functions/package.json && test -f functions/tsconfig.json && grep -q "predeploy" firebase.json && test -d functions/node_modules/firebase-admin</automated>
  </verify>
  <done>functions/ package scaffolded with TypeScript + Node 20 + firebase-admin/functions deps. firebase.json predeploys build before deploy. Zero emulator codepath per D-04.</done>
</task>

<task type="auto">
  <name>Task 2: Cloud Function 1 — setCustomUserClaims on users/{uid} write</name>
  <files>
    functions/src/setCustomUserClaims.ts,
    functions/src/index.ts
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §2.3 lines 524-573 (Function 1 full implementation)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-02 refined (Function 1: onWrite users/{uid} → setCustomUserClaims)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"P6: setCustomUserClaims rate limit" + "P7: Stale claims after role change"
    - .planning/REQUIREMENTS.md AUTH-08 (role change ≤1h or immediately on next sign-in)
  </read_first>
  <action>
    **Step 2.1 — Create `functions/src/setCustomUserClaims.ts`** (RESEARCH §2.3 verbatim):

    ```typescript
    // functions/src/setCustomUserClaims.ts
    // Cloud Function 1 per refined D-02. Triggers on users/{uid} writes; mirrors
    // Firestore role into Firebase Auth custom claims. Revokes refresh tokens on
    // change so AUTH-08 propagates immediately on next-request (DAL rejects revoked
    // sessions). Per RESEARCH §2.3 lines 524-573.

    import { onDocumentWritten } from "firebase-functions/v2/firestore";
    import { initializeApp, getApps } from "firebase-admin/app";
    import { getAuth } from "firebase-admin/auth";

    if (!getApps().length) initializeApp();
    const auth = getAuth();

    export const onUserWriteSetClaims = onDocumentWritten(
      { document: "users/{uid}", region: "asia-southeast1" },
      async (event) => {
        const uid = event.params.uid;
        const after = event.data?.after?.data();

        if (!after) {
          // user doc deleted — strip claims so any cached token loses admin
          await auth.setCustomUserClaims(uid, null);
          await auth.revokeRefreshTokens(uid);
          return;
        }

        const role = after.role as "admin" | "staff" | undefined;
        if (!role) return;

        // Per RESEARCH P6: setCustomUserClaims is rate-limited; only update if changed.
        const userRecord = await auth.getUser(uid).catch(() => null);
        if (!userRecord) return;
        const existing = (userRecord.customClaims as { role?: string } | undefined)?.role;
        if (existing === role) return;

        await auth.setCustomUserClaims(uid, { role });

        // AUTH-08 + RESEARCH P7: revoke refresh tokens so next ID-token refresh
        // picks up new claims. Without this, existing ID tokens retain old claims
        // for up to ~1h.
        await auth.revokeRefreshTokens(uid);
      }
    );
    ```

    **CRITICAL:** Use region `asia-southeast1` per RESEARCH assumption A1 (Hong Kong-based developer). MUST match Firestore region.

    **Step 2.2 — Create `functions/src/index.ts`** (re-exports all three trigger registrations of the 2 logical functions per refined D-02):

    ```typescript
    // functions/src/index.ts
    // Re-exports all trigger registrations for the 2 logical Cloud Functions per refined D-02:
    //  - Function 1: onUserWriteSetClaims (1 trigger)
    //  - Function 2 (allowedStaff sync): onEventTeamChange + onUserRoleChange (2 triggers, shared logic)
    //
    // See CONTEXT.md "D-02 (refined during planning, 2026-05-25)" for rationale.

    export { onUserWriteSetClaims } from "./setCustomUserClaims";
    export { onEventTeamChange, onUserRoleChange } from "./syncAllowedStaff";
    ```

    NOTE: `onEventTeamChange` and `onUserRoleChange` don't exist yet — they land in Task 3. After Task 2 alone, this index.ts won't compile. Either:
    - Complete Task 3 before running `npm --prefix functions run build`.
    - OR temporarily stub Task 3 exports in index.ts until Task 3 completes.

    **Choose:** Complete Task 3 first then run `npm --prefix functions run build`. Don't deploy until all three exports compile.
  </action>
  <acceptance_criteria>
    - `test -f functions/src/setCustomUserClaims.ts` succeeds.
    - `grep -q "onDocumentWritten" functions/src/setCustomUserClaims.ts` succeeds.
    - `grep -q "setCustomUserClaims(uid, null)" functions/src/setCustomUserClaims.ts` succeeds (delete branch).
    - `grep -q "revokeRefreshTokens(uid)" functions/src/setCustomUserClaims.ts` succeeds.
    - `grep -q "region: \"asia-southeast1\"" functions/src/setCustomUserClaims.ts` succeeds (per A1).
    - `grep -q "if (existing === role) return" functions/src/setCustomUserClaims.ts` succeeds (P6 rate-limit guard).
    - `test -f functions/src/index.ts` succeeds.
    - `grep -q "onUserWriteSetClaims" functions/src/index.ts` succeeds.
    - `grep -q "onEventTeamChange" functions/src/index.ts` succeeds (re-export for Task 3).
  </acceptance_criteria>
  <verify>
    <automated>test -f functions/src/setCustomUserClaims.ts && grep -q "onDocumentWritten" functions/src/setCustomUserClaims.ts && grep -q "revokeRefreshTokens" functions/src/setCustomUserClaims.ts && grep -q "asia-southeast1" functions/src/setCustomUserClaims.ts && test -f functions/src/index.ts</automated>
  </verify>
  <done>Function 1 ready. Verify in Task 3 once Function 2 lands and the package compiles.</done>
</task>

<task type="auto">
  <name>Task 3: Cloud Function 2 — allowedStaff sync (2 trigger registrations, shared logic) with self-write guard</name>
  <files>functions/src/syncAllowedStaff.ts</files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §2.4 lines 574-650 (Function 2 full implementation including self-write guard — JUSTIFICATION for both trigger registrations)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md "D-02 (refined during planning, 2026-05-25)" — 2 logical functions, 3 triggers, shared recompute logic
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"P5: Cloud Function infinite loop (self-write)"
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md "A6" Assumption (self-write guard is standard pattern)
  </read_first>
  <action>
    Create `functions/src/syncAllowedStaff.ts` per RESEARCH §2.4 lines 574-650 verbatim. This file implements **Function 2** of the refined D-02 pair: a single logical function (maintain `event.allowedStaff = unique(admins ∪ teamLeads ∪ backupTeams)`) that requires TWO trigger registrations because its inputs span two collections. Both triggers share the `recomputeForEvent(eventId)` recompute path defined in this file.

    ```typescript
    // functions/src/syncAllowedStaff.ts
    // Cloud Function 2 per refined D-02 — ONE logical function (allowedStaff sync),
    // TWO trigger registrations because the union depends on data from two collections:
    //  - onEventTeamChange: an event's team fields changed → recompute that event
    //  - onUserRoleChange:  a user's admin role flipped → recompute ALL events
    // Both triggers funnel through recomputeForEvent(eventId).
    // Self-write loop guard per RESEARCH P5 + A6 (skip if before/after differ ONLY in allowedStaff).

    import { onDocumentWritten } from "firebase-functions/v2/firestore";
    import { initializeApp, getApps } from "firebase-admin/app";
    import { getFirestore } from "firebase-admin/firestore";

    if (!getApps().length) initializeApp();
    const db = getFirestore();

    async function recomputeForEvent(eventId: string): Promise<void> {
      const eventRef = db.collection("events").doc(eventId);
      const eventSnap = await eventRef.get();
      const event = eventSnap.data();
      if (!event) return;

      const adminsQuery = await db.collection("users").where("role", "==", "admin").get();
      const adminUids = adminsQuery.docs.map((d) => d.id);

      const allowed = new Set<string>([
        ...adminUids,
        ...((event.teamLeads as string[] | undefined) ?? []),
        ...((event.backupTeams as string[] | undefined) ?? []),
      ]);

      await eventRef.update({ allowedStaff: Array.from(allowed) });
    }

    /**
     * Trigger when an event's team fields change (or when a new event needs initial fill).
     * Self-write guard: if the ONLY difference between before and after is allowedStaff,
     * we wrote that ourselves — skip to prevent infinite recursion.
     */
    export const onEventTeamChange = onDocumentWritten(
      { document: "events/{eventId}", region: "asia-southeast1" },
      async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!after) return; // event deleted

        const teamLeadsChanged =
          JSON.stringify(before?.teamLeads) !== JSON.stringify(after.teamLeads);
        const backupChanged =
          JSON.stringify(before?.backupTeams) !== JSON.stringify(after.backupTeams);
        const allowedMissing = !(after.allowedStaff as unknown[] | undefined)?.length;

        if (!teamLeadsChanged && !backupChanged && !allowedMissing) return;

        // RESEARCH P5 + A6: self-write loop guard. If before and after differ
        // ONLY in allowedStaff, this is our own write firing the trigger again.
        const beforeWithoutAllowed = { ...before, allowedStaff: null };
        const afterWithoutAllowed = { ...after, allowedStaff: null };
        const onlyAllowedStaffChanged =
          JSON.stringify(beforeWithoutAllowed) === JSON.stringify(afterWithoutAllowed);
        if (onlyAllowedStaffChanged) return;

        await recomputeForEvent(event.params.eventId);
      }
    );

    /**
     * Trigger when a user's role changes. Admins are in EVERY event's allowedStaff,
     * so promoting/demoting an admin requires recomputing all events.
     */
    export const onUserRoleChange = onDocumentWritten(
      { document: "users/{uid}", region: "asia-southeast1" },
      async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        const oldRole = before?.role as string | undefined;
        const newRole = after?.role as string | undefined;
        if (oldRole === newRole) return;

        if (oldRole === "admin" || newRole === "admin") {
          const events = await db.collection("events").get();
          await Promise.all(events.docs.map((doc) => recomputeForEvent(doc.id)));
        }
      }
    );
    ```

    **Performance note:** `onUserRoleChange` for an admin promotion recomputes ALL events. At D-16 scale (100+ events) this is one batch read + ~100 updates = ~$0.0006 per promotion. Acceptable.

    **Build the functions package** to verify all imports compile:

    ```bash
    cd functions && npm run build
    ```

    Expected: `functions/lib/index.js` and `functions/lib/setCustomUserClaims.js` etc. exist. Zero TypeScript errors.
  </action>
  <acceptance_criteria>
    - `test -f functions/src/syncAllowedStaff.ts` succeeds.
    - `grep -q "onEventTeamChange" functions/src/syncAllowedStaff.ts` succeeds.
    - `grep -q "onUserRoleChange" functions/src/syncAllowedStaff.ts` succeeds.
    - `grep -q "recomputeForEvent" functions/src/syncAllowedStaff.ts` succeeds (shared recompute path — both triggers funnel here per refined D-02).
    - `grep -q "onlyAllowedStaffChanged" functions/src/syncAllowedStaff.ts` succeeds (self-write guard).
    - `grep -q "asia-southeast1" functions/src/syncAllowedStaff.ts` succeeds.
    - `grep -q "where(\"role\", \"==\", \"admin\")" functions/src/syncAllowedStaff.ts` succeeds.
    - Compilation: `cd functions && npx tsc --noEmit` exits 0 (or `npm run build` produces `functions/lib/syncAllowedStaff.js`).
    - `test -f functions/lib/index.js` succeeds (build artifact exists).
  </acceptance_criteria>
  <verify>
    <automated>test -f functions/src/syncAllowedStaff.ts && grep -q "onlyAllowedStaffChanged" functions/src/syncAllowedStaff.ts && grep -q "recomputeForEvent" functions/src/syncAllowedStaff.ts && grep -q "asia-southeast1" functions/src/syncAllowedStaff.ts && (cd functions && npm run build) && test -f functions/lib/index.js</automated>
  </verify>
  <done>Both Cloud Functions compile (2 logical functions; 3 trigger registrations per refined D-02). Ready to deploy in Task 7.</done>
</task>

<task type="auto">
  <name>Task 4: Server Actions in app/(app)/users/actions.ts</name>
  <files>app/(app)/users/actions.ts</files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §2.5 lines 658-732 (inviteUser full implementation), §2.6 lines 734-769 (setUserRole + disableUser)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-07 (Firebase built-in email), D-09 (return reset link on success AND failure)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §5 "Authentication entry-point" + "Server Action result contract" + "Revalidation contract"
    - .planning/REQUIREMENTS.md AUTH-07 (invite), AUTH-08 (role change), AUTH-09 (disable + revoke)
    - lib/schemas/auth.ts (verify InviteUserSchema exists; create if missing — see step 4.0 below)
    - lib/mock/store.ts (lines 572-615 — the mutator signatures we are matching)
    - lib/auth/dal.ts (requireAdmin)
    - lib/firebase/admin.ts (adminAuth, adminDb)
  </read_first>
  <action>
    **Step 4.0 — Verify `lib/schemas/auth.ts` has `InviteUserSchema`.**

    Phase 1 may have shipped this; if not, add:

    ```typescript
    // Append to lib/schemas/auth.ts if missing:
    import { z } from "zod";
    export const InviteUserSchema = z.object({
      email: z.string().email("Enter a valid email"),
      displayName: z.string().min(1, "Display name is required").max(80),
      role: z.enum(["admin", "staff"]),
    });
    export type InviteUserValues = z.infer<typeof InviteUserSchema>;
    ```

    Run `grep -q "InviteUserSchema" lib/schemas/auth.ts` — if it fails, add the snippet.

    **Step 4.1 — Create `app/(app)/users/actions.ts`** per RESEARCH §2.5 + §2.6:

    ```typescript
    "use server";
    // app/(app)/users/actions.ts
    // Per RESEARCH §2.5-§2.6. PATTERNS §1 row "app/(app)/users/actions.ts".
    // Each action: requireAdmin() → Zod parse → Admin SDK calls → revalidatePath.

    import { requireAdmin } from "@/lib/auth/dal";
    import { adminAuth, adminDb } from "@/lib/firebase/admin";
    import { FieldValue } from "firebase-admin/firestore";
    import { revalidatePath } from "next/cache";
    import { InviteUserSchema } from "@/lib/schemas/auth";

    /**
     * inviteUser — AUTH-07. Creates a Firebase Auth user without a password,
     * writes the users/{uid} doc (Cloud Function 1 picks up the role + sets claims),
     * generates a password reset link, and RETURNS the link in the response payload
     * per D-09 so admin can copy/share even if email delivery fails.
     */
    export async function inviteUser(formData: FormData) {
      const session = await requireAdmin();

      const parsed = InviteUserSchema.safeParse({
        email: formData.get("email"),
        displayName: formData.get("displayName"),
        role: formData.get("role"),
      });
      if (!parsed.success) {
        return { ok: false as const, error: "Invalid input", errors: parsed.error.flatten().fieldErrors };
      }

      const { email, displayName, role } = parsed.data;

      try {
        // 1. Create the Firebase Auth user (no password — invitee sets via /set-password)
        const userRecord = await adminAuth.createUser({
          email,
          displayName,
          disabled: false,
        });

        // 2. Write users/{uid} — Cloud Function 1 picks this up and sets claims
        await adminDb.collection("users").doc(userRecord.uid).set({
          uid: userRecord.uid,
          email,
          displayName,
          role,
          disabled: false,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: session.uid,
          lastLoginAt: null,
        });

        // 3. Generate password reset link (D-07/D-09)
        const actionCodeSettings = {
          url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/set-password`,
          handleCodeInApp: false,
        };
        const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

        revalidatePath("/users");
        return { ok: true as const, uid: userRecord.uid, resetLink };
      } catch (err) {
        // Firebase Auth errors have a `.code` (e.g., "auth/email-already-exists")
        const message = err instanceof Error ? err.message : "Unknown error";
        const code = (err as { code?: string }).code;
        let userMessage = "Couldn't invite — try again.";
        if (code === "auth/email-already-exists") {
          userMessage = "This email is already in use.";
        }
        // D-09: even on failure, if we got far enough to generate a link, return it
        return { ok: false as const, error: userMessage };
      }
    }

    /**
     * setUserRole — AUTH-08. Updates users/{uid}.role; Cloud Function 1 updates claims + revokes refresh tokens.
     */
    export async function setUserRole(uid: string, role: "admin" | "staff") {
      const session = await requireAdmin();

      if (!uid || !["admin", "staff"].includes(role)) {
        return { ok: false as const, error: "Invalid input" };
      }
      // Prevent admin from demoting themselves while last admin (basic safety)
      if (uid === session.uid && role === "staff") {
        const admins = await adminDb.collection("users").where("role", "==", "admin").limit(2).get();
        if (admins.size <= 1) {
          return { ok: false as const, error: "Cannot demote the last admin." };
        }
      }

      try {
        await adminDb.collection("users").doc(uid).update({
          role,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        });
        revalidatePath("/users");
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : "Update failed" };
      }
    }

    /**
     * disableUser — AUTH-09. Toggles Auth.disabled + Firestore.disabled + revokes sessions.
     */
    export async function disableUser(uid: string, disabled: boolean) {
      const session = await requireAdmin();

      if (uid === session.uid && disabled) {
        return { ok: false as const, error: "Cannot disable yourself." };
      }

      try {
        // 1. Toggle the Firebase Auth user (blocks NEW sign-ins)
        await adminAuth.updateUser(uid, { disabled });

        // 2. Toggle the Firestore doc (DAL re-checks this on every request)
        await adminDb.collection("users").doc(uid).update({
          disabled,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        });

        // 3. Revoke EXISTING sessions explicitly (AUTH-09)
        if (disabled) await adminAuth.revokeRefreshTokens(uid);

        revalidatePath("/users");
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : "Update failed" };
      }
    }
    ```
  </action>
  <acceptance_criteria>
    - `test -f app/\(app\)/users/actions.ts` succeeds.
    - `head -1 app/\(app\)/users/actions.ts | grep -q '"use server"'` succeeds.
    - `grep -q "requireAdmin" app/\(app\)/users/actions.ts` succeeds (called in all 3 actions).
    - Count of `await requireAdmin()` calls: `grep -c "await requireAdmin()" app/\(app\)/users/actions.ts` returns 3.
    - `grep -q "generatePasswordResetLink" app/\(app\)/users/actions.ts` succeeds (AUTH-07 / D-07-D-09).
    - `grep -q "resetLink" app/\(app\)/users/actions.ts` succeeds (D-09 return value).
    - `grep -q "revokeRefreshTokens" app/\(app\)/users/actions.ts` succeeds (AUTH-09).
    - `grep -q "revalidatePath" app/\(app\)/users/actions.ts` succeeds (Block H mandate).
    - Count of `revalidatePath` calls: `grep -c "revalidatePath" app/\(app\)/users/actions.ts` returns at least 3 (one per successful action).
    - `grep -q "Cannot demote the last admin" app/\(app\)/users/actions.ts` succeeds (safety rail).
    - `grep -q "InviteUserSchema" lib/schemas/auth.ts` succeeds.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>head -1 "app/(app)/users/actions.ts" | grep -q '"use server"' && [ "$(grep -c 'await requireAdmin()' 'app/(app)/users/actions.ts')" = "3" ] && grep -q "generatePasswordResetLink" "app/(app)/users/actions.ts" && grep -q "resetLink" "app/(app)/users/actions.ts" && grep -q "revokeRefreshTokens" "app/(app)/users/actions.ts" && npx tsc --noEmit</automated>
  </verify>
  <done>3 Server Actions live: inviteUser (returns resetLink for copy-link UI), setUserRole, disableUser. All gated by requireAdmin, all revalidate /users.</done>
</task>

<task type="auto">
  <name>Task 5: lib/data/users.server.ts + lib/hooks/use-users-live.ts (SSR seed + live hook)</name>
  <files>
    lib/data/users.server.ts,
    lib/hooks/use-users-live.ts
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §3.1 lines 845-878 (Admin SDK page helper pattern — `getInventoryPage` shape; mirror for users)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §7.1 lines 1454-1535 (cursor pagination + Server seed → Client onSnapshot pattern)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-17 (cursor pagination), D-20 (listener scope)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 rows "lib/data/users.server.ts" + "lib/hooks/use-users-live.ts" + §4 excerpt A (useSyncExternalStore live hook shape) + §4 excerpt C (Server → Client SSR seed pattern)
    - lib/types/user.ts (UserDoc type — verify field shape: uid, email, displayName, role, disabled, createdAt, lastLoginAt)
    - lib/firebase/admin.ts, lib/firebase/client.ts
  </read_first>
  <action>
    **Step 5.1 — Create `lib/data/users.server.ts`** (Admin SDK cursor-paged read):

    ```typescript
    // lib/data/users.server.ts
    // Per RESEARCH §3.1 pattern + D-17 cursor pagination.
    import "server-only";
    import { adminDb } from "@/lib/firebase/admin";
    import type { UserDoc } from "@/lib/types/user";

    type UserCursor = { displayName: string; uid: string };

    export type UsersPage = {
      users: UserDoc[];
      nextCursor: string | null;
    };

    function encodeCursor(c: UserCursor): string {
      return Buffer.from(JSON.stringify(c)).toString("base64");
    }
    function decodeCursor(s: string): UserCursor | null {
      try {
        return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as UserCursor;
      } catch {
        return null;
      }
    }

    function toUser(snap: FirebaseFirestore.QueryDocumentSnapshot): UserDoc {
      const data = snap.data();
      return {
        uid: snap.id,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        disabled: data.disabled === true,
        createdAt: data.createdAt?.toMillis?.() ?? null,
        lastLoginAt: data.lastLoginAt?.toMillis?.() ?? null,
      };
    }

    export async function getUsersPage(opts: {
      cursor?: string | null;
      limit?: number;
      filters?: { role?: "admin" | "staff" };
    }): Promise<UsersPage> {
      const limit = opts.limit ?? 50;
      let q: FirebaseFirestore.Query = adminDb.collection("users");
      if (opts.filters?.role) q = q.where("role", "==", opts.filters.role);
      q = q.orderBy("displayName").orderBy("__name__").limit(limit + 1);

      const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
      if (cursor) q = q.startAfter(cursor.displayName, cursor.uid);

      const snap = await q.get();
      const docs = snap.docs.slice(0, limit);
      const hasMore = snap.docs.length > limit;

      const users = docs.map(toUser);
      const last = docs[docs.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({ displayName: last.data().displayName, uid: last.id })
        : null;
      return { users, nextCursor };
    }

    export async function getUserServer(uid: string): Promise<UserDoc | null> {
      const snap = await adminDb.collection("users").doc(uid).get();
      if (!snap.exists) return null;
      return toUser(snap as FirebaseFirestore.QueryDocumentSnapshot);
    }
    ```

    **Step 5.2 — Create `lib/hooks/use-users-live.ts`** (Web SDK onSnapshot live hook, scoped per D-20):

    Use the same `useSyncExternalStore + useMemo` shell pattern from Phase 1 D-01-02-A (PATTERNS §4 excerpt A) — but the simpler `useEffect + useState` form works fine here since this hook returns the slice directly:

    ```typescript
    "use client";
    // lib/hooks/use-users-live.ts
    // Live hook scoped to the visible cursor page per D-20.
    // SSR seed pattern: server passes `initial` from getUsersPage; hook takes over
    // via onSnapshot for the same query window. See PATTERNS §4 excerpt A/C.

    import { useEffect, useState } from "react";
    import {
      collection,
      query,
      where,
      orderBy,
      limit as fbLimit,
      onSnapshot,
      documentId,
      type QuerySnapshot,
    } from "firebase/firestore";
    import { db } from "@/lib/firebase/client";
    import type { UserDoc } from "@/lib/types/user";

    function toUser(d: any): UserDoc {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        disabled: data.disabled === true,
        createdAt: data.createdAt?.toMillis?.() ?? null,
        lastLoginAt: data.lastLoginAt?.toMillis?.() ?? null,
      };
    }

    export function useUsersLive(
      initial: UserDoc[],
      opts: { role?: "admin" | "staff"; limit?: number } = {},
    ): UserDoc[] {
      const [users, setUsers] = useState<UserDoc[]>(initial);

      useEffect(() => {
        const constraints = [
          ...(opts.role ? [where("role", "==", opts.role)] : []),
          orderBy("displayName"),
          orderBy(documentId()),
          fbLimit(opts.limit ?? 50),
        ];
        const q = query(collection(db, "users"), ...constraints);
        const unsub = onSnapshot(q, (snap: QuerySnapshot) => {
          setUsers(snap.docs.map(toUser));
        });
        return () => unsub();
      }, [opts.role, opts.limit]);

      return users;
    }
    ```
  </action>
  <acceptance_criteria>
    - `head -1 lib/data/users.server.ts | grep -q 'import "server-only"'` succeeds.
    - `grep -q "getUsersPage" lib/data/users.server.ts` succeeds; `grep -q "getUserServer" lib/data/users.server.ts` succeeds.
    - `grep -q "startAfter" lib/data/users.server.ts` succeeds (D-17 cursor).
    - `grep -q "Buffer.from(.*).toString(\"base64\")" lib/data/users.server.ts` succeeds (cursor encoding).
    - `test -f lib/hooks/use-users-live.ts` succeeds.
    - `head -3 lib/hooks/use-users-live.ts | grep -q '"use client"'` succeeds.
    - `grep -q "onSnapshot" lib/hooks/use-users-live.ts` succeeds (D-20 listener).
    - `grep -q "fbLimit(opts.limit ?? 50)" lib/hooks/use-users-live.ts` succeeds (D-20 50-row scope).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>head -1 lib/data/users.server.ts | grep -q 'import "server-only"' && grep -q "startAfter" lib/data/users.server.ts && grep -q "onSnapshot" lib/hooks/use-users-live.ts && head -3 lib/hooks/use-users-live.ts | grep -q '"use client"' && npx tsc --noEmit</automated>
  </verify>
  <done>SSR seed helper + live hook in place. /users page wiring follows in Task 6.</done>
</task>

<task type="auto">
  <name>Task 6: /users + /users/invite UI swap to Server Actions + live hook</name>
  <files>
    app/(app)/users/page.tsx,
    app/(app)/users/invite/page.tsx,
    app/(app)/users/invite/_components/invite-user-page-form.tsx,
    components/feature/users/InviteUserSheet.tsx,
    components/feature/users/UserRoleSelectInline.tsx,
    components/feature/users/DisableUserButton.tsx,
    components/feature/users/UsersTable.tsx
  </files>
  <read_first>
    - app/(app)/users/page.tsx (Phase 1)
    - app/(app)/users/invite/page.tsx (Phase 1)
    - app/(app)/users/invite/_components/invite-user-page-form.tsx (Phase 1: imports inviteUser from mock store)
    - components/feature/users/InviteUserSheet.tsx (Phase 1: same mock store import)
    - components/feature/users/UserRoleSelectInline.tsx, DisableUserButton.tsx (Phase 1: mock store imports)
    - components/feature/users/UsersTable.tsx (Phase 1: useMockStore selector for users array)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 (all 7 row entries for these files) + §3 entries showing import sites
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-09 (Copy-link UI surface)
    - .planning/phases/phase-kayinleong-01/01-12-users-settings-SUMMARY.md
  </read_first>
  <action>
    **Step 6.1 — `app/(app)/users/page.tsx`:**

    Phase 1 imported `requireAdmin` from mock-session and read users via mock store. Replace with:

    ```typescript
    // app/(app)/users/page.tsx — Server Component
    import { requireAdmin } from "@/lib/auth/dal";
    import { getUsersPage } from "@/lib/data/users.server";
    import { UsersTable } from "@/components/feature/users/UsersTable";
    // ... keep existing UI imports (PageHeader, Button, etc.) ...

    type RouteProps = { searchParams: Promise<{ cursor?: string; role?: "admin" | "staff" }> };

    export default async function UsersPage({ searchParams }: RouteProps) {
      const session = await requireAdmin();
      const params = await searchParams;
      const { users, nextCursor } = await getUsersPage({
        cursor: params.cursor ?? null,
        filters: params.role ? { role: params.role } : undefined,
      });
      return (
        <>
          {/* PRESERVE Phase 1 PageHeader/InviteUserSheet trigger/etc. exactly */}
          <UsersTable initialUsers={users} nextCursor={nextCursor} currentUserUid={session.uid} />
        </>
      );
    }
    ```

    Preserve all Phase 1 JSX nodes around `<UsersTable/>` (page header, invite button, breadcrumbs).

    **Step 6.2 — `app/(app)/users/invite/page.tsx`** — same import swap pattern as Task 3 (`requireAdmin` from DAL):

    ```typescript
    import { requireAdmin } from "@/lib/auth/dal";
    // ... rest unchanged ...
    ```

    **Step 6.3 — `components/feature/users/UsersTable.tsx`** — swap `useMockStore` → `useUsersLive`:

    Phase 1 likely has:
    ```typescript
    const users = useMockStore((s) => s.users);
    ```

    Replace with (PATTERNS §1 row "UsersTable.tsx"):
    ```typescript
    "use client";
    import { useUsersLive } from "@/lib/hooks/use-users-live";
    // ...
    export function UsersTable({ initialUsers, nextCursor, currentUserUid }: {
      initialUsers: UserDoc[];
      nextCursor: string | null;
      currentUserUid: string;
    }) {
      const users = useUsersLive(initialUsers);
      // ... rest unchanged: same TanStack columns, filters, etc. ...
      // BUT: TanStack pagination switches to manualPagination: true; prev/next-only buttons consume nextCursor.
    }
    ```

    Preserve all existing column definitions, sort logic, row actions. Only the data-source line + pagination chrome changes.

    Pagination footer (PATTERNS §5 "Cursor URL contract"): replace "Page N of M" with "Showing 50 results — Next →" + an "← Previous" button. Previous = `router.back()`; Next = `router.push("?cursor=" + nextCursor)`.

    **Step 6.4 — `components/feature/users/UserRoleSelectInline.tsx`** — swap `store.setUserRole` → Server Action:

    Phase 1:
    ```typescript
    import { setUserRole } from "@/lib/mock/store";
    // ... onChange handler calls setUserRole(uid, role, actor) ...
    ```

    Replace with:
    ```typescript
    "use client";
    import { setUserRole } from "@/app/(app)/users/actions";
    import { toast } from "sonner";
    // ... in onChange:
    const res = await setUserRole(uid, newRole);
    if (!res.ok) {
      toast.error(res.error);
      // revert local optimistic state
      return;
    }
    toast.success("Role updated");
    ```

    Remove all `seedUsers.find(u => u.uid === session.uid)` actor lookups (per PATTERNS §3 "lib/mock/users.ts" delete row). The Server Action derives actor from `requireAdmin()` server-side.

    **Step 6.5 — `components/feature/users/DisableUserButton.tsx`** — same swap pattern:

    Phase 1 mock store `disableUser(uid, disabled, actor)` → Server Action `disableUser(uid, disabled)` (no actor arg).

    Keep the AlertDialog destructive-confirm pattern + variant="destructive" unchanged.

    **Step 6.6 — `components/feature/users/InviteUserSheet.tsx`** (per CONTEXT.md D-09: show Copy-link button after submit):

    ```typescript
    "use client";
    import { useState, useTransition } from "react";
    import { inviteUser } from "@/app/(app)/users/actions";
    import { toast } from "sonner";
    import { Button } from "@/components/ui/button";
    import { Sheet, SheetContent, SheetTrigger /* etc */ } from "@/components/ui/sheet";
    // ... Phase 1 imports for Field/Input/etc ...

    export function InviteUserSheet() {
      const [pending, startTransition] = useTransition();
      const [resetLink, setResetLink] = useState<string | null>(null);
      // ... rhf wired to InviteUserSchema ...

      function onSubmit(formData: FormData) {
        startTransition(async () => {
          const res = await inviteUser(formData);
          if (!res.ok) {
            toast.error(res.error ?? "Couldn't invite — try again.");
            return;
          }
          setResetLink(res.resetLink);
          toast.success("Invite sent. Copy the link to share manually if email doesn't arrive.");
        });
      }

      if (resetLink) {
        return (
          <Sheet open>
            <SheetContent>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Invite created</h3>
                <p className="text-sm text-muted-foreground">
                  Firebase will email this link automatically. If the recipient doesn't receive it, copy and share it directly.
                </p>
                <code className="block p-2 bg-muted rounded text-xs break-all">{resetLink}</code>
                <Button
                  onClick={() => { navigator.clipboard.writeText(resetLink); toast.success("Copied"); }}
                  className="w-full"
                >Copy link</Button>
                <Button variant="outline" onClick={() => setResetLink(null)} className="w-full">Invite another</Button>
              </div>
            </SheetContent>
          </Sheet>
        );
      }

      return (
        <Sheet>
          <SheetTrigger asChild>
            <Button>Invite user</Button>
          </SheetTrigger>
          <SheetContent>
            <form action={onSubmit}>
              {/* PRESERVE Phase 1 field tree: email, displayName, role select */}
              <Button type="submit" disabled={pending}>
                {pending ? "Sending..." : "Send invite"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      );
    }
    ```

    **Step 6.7 — `app/(app)/users/invite/_components/invite-user-page-form.tsx`** — same Copy-link UI:

    The standalone /users/invite page form mirrors InviteUserSheet but doesn't use Sheet chrome. Render the resetLink + Copy button after success the same way.
  </action>
  <acceptance_criteria>
    - `grep -q "from \"@/lib/auth/dal\"" "app/(app)/users/page.tsx"` succeeds.
    - `grep -q "getUsersPage" "app/(app)/users/page.tsx"` succeeds.
    - `grep -q "useUsersLive" "components/feature/users/UsersTable.tsx"` succeeds.
    - `grep -q "useMockStore" "components/feature/users/UsersTable.tsx"` FAILS (no Phase 1 mock store import).
    - `grep -q "from \"@/app/(app)/users/actions\"" "components/feature/users/UserRoleSelectInline.tsx"` succeeds.
    - `grep -q "from \"@/lib/mock/store\"" "components/feature/users/UserRoleSelectInline.tsx"` FAILS.
    - `grep -q "from \"@/app/(app)/users/actions\"" "components/feature/users/DisableUserButton.tsx"` succeeds.
    - `grep -q "from \"@/app/(app)/users/actions\"" "components/feature/users/InviteUserSheet.tsx"` succeeds.
    - `grep -q "navigator.clipboard.writeText" "components/feature/users/InviteUserSheet.tsx"` succeeds (D-09 Copy-link).
    - `grep -q "seedUsers" components/feature/users/` returns no matches (`grep -rE "seedUsers" components/feature/users/ | wc -l` returns 0).
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "getUsersPage" "app/(app)/users/page.tsx" && grep -q "useUsersLive" "components/feature/users/UsersTable.tsx" && ! grep -q "useMockStore" "components/feature/users/UsersTable.tsx" && grep -q "navigator.clipboard.writeText" "components/feature/users/InviteUserSheet.tsx" && [ "$(grep -rE 'seedUsers' components/feature/users/ 2>/dev/null | wc -l)" = "0" ] && npm run build</automated>
  </verify>
  <done>/users surface entirely on Firebase. Copy-link UI live per D-09. Phase 1 visual surface preserved.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 7: Deploy functions + manual rules audit for users + transactions collections</name>
  <what-built>
    Cloud Functions compiled. Server Actions wired. UI on the new actions. Now deploy the functions to the live project and verify they actually fire on writes. Then run a manual rules audit covering the users + transactions paths per D-06.
  </what-built>
  <how-to-verify>
    **Step A — Build + deploy functions:**

    ```bash
    cd functions && npm run build
    firebase deploy --only functions --project <your-project-id>
    ```

    Expected output:
    ```
    ✔ functions[onUserWriteSetClaims(asia-southeast1)]: Successful create operation.
    ✔ functions[onEventTeamChange(asia-southeast1)]: Successful create operation.
    ✔ functions[onUserRoleChange(asia-southeast1)]: Successful create operation.
    ```

    First deploy takes 3-5 minutes. If you see "Cloud Functions API has not been used in project" — visit the link in the error and enable the API.

    **Step B — Trigger Function 1 and verify:**

    1. In Firebase Console → Firestore → `users` collection → manually edit your admin doc — change `displayName` to anything. Save.
    2. Firebase Console → Functions → Logs. Within ~5 seconds, you should see `onUserWriteSetClaims` log lines — but with `displayName` change only (not role), the function early-returns because `existing === role`. That's correct — verify the log entry shows the function ran without error.
    3. Create a SECOND user via your app's /users/invite. Then check Logs: `onUserWriteSetClaims` should fire on the new doc's creation, set claims for the new uid, then revoke their (nonexistent) refresh tokens — no error.

    **Step C — Trigger Function 2:**

    1. (Skip until 02-07 ships events.) Function 2 currently has no events to mutate; verify deploy success only. We'll test it end-to-end in 02-07.

    **Step D — End-to-end invite flow test:**

    1. From admin account, visit `/users/invite`. Enter a real second email + display name + role=staff. Submit.
    2. **Expected:** "Invite created" panel renders with the password-set link visible + Copy button.
    3. Click Copy. Open the link in a private window. Should land on Firebase-hosted reset-password page. Set a password.
    4. After setting password, the Firebase-hosted page may redirect to `NEXT_PUBLIC_APP_URL/set-password` (depends on actionCodeSettings). Either way, the user can now sign in.
    5. Sign in as the new staff user. Visit `/users` — should be DENIED (redirect to /unauthorized) because the page requires admin.
    6. Sign back in as admin. Verify the new user appears in the /users table.

    **Step E — Role change + revocation test:**

    1. From admin account at /users, change the staff user's role inline to "admin". Sonner toast: "Role updated".
    2. Open Functions logs in Firebase Console. Within ~5s: `onUserWriteSetClaims` fired → set new claims + `revokeRefreshTokens`.
    3. In the staff user's browser (still signed in), navigate to /users. **Expected:** They get redirected to /login because their refresh token was revoked and `verifySessionCookie(cookie, true)` rejected the cookie on the next request.
    4. Sign in again as the (now-admin) user. They can access /users.

    **Step F — Disable user test:**

    1. From admin, click Disable on a user. AlertDialog confirms.
    2. In that user's browser, hard refresh — they should get redirected to /login. Confirm by checking the user can't access /users.

    **Step G — Manual rules audit (D-06) — users + transactions:**

    Firebase Console → Firestore → Rules → "Rules Playground". Run these 6 cases (record outcomes in CLAIM.md under `## Rules Audit — Block B`):

    | # | Path | Authenticated? | Role | Op | Expected |
    |---|------|---------------|------|-----|----------|
    | 1 | /users/<some-uid> | Yes | staff (same uid) | read | ALLOW (own doc) |
    | 2 | /users/<some-uid> | Yes | staff (different uid) | read | DENY |
    | 3 | /users/<some-uid> | Yes | admin | read | ALLOW |
    | 4 | /users/<some-uid> | Yes | admin | update with `{role: 'admin'}` | DENY (clients can't write users) |
    | 5 | /transactions/anything | Yes | admin | create with valid payload | DENY (server-only writes per INT-03) |
    | 6 | /transactions/anything | Yes | staff | read | ALLOW (signed-in users can read transactions) |

    Record outcomes in CLAIM.md.

    **PASS:** All function logs show no errors; invite flow completes end-to-end; role change demonstrably revokes the staff session; disable user works; all 6 rules cases match expected.
    **FAIL:** Describe which step fails.
  </how-to-verify>
  <resume-signal>Type "functions deployed, invite + role + disable E2E PASS, rules audit logged in CLAIM.md" once all of A–G pass. If anything fails, describe.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Server Action input (FormData) | Untrusted; Zod-validated; per Server Action |
| Server Action → Admin SDK | Bypasses rules; relies on requireAdmin() at top |
| Cloud Function → Firestore | Trusted server-side; runs under SA permissions; not rate-limited by client |
| Cloud Function → Firebase Auth | Trusted; setCustomUserClaims rate-limited by Firebase (P6); we skip-if-equal to mitigate |
| Inviter (admin) → /users/invite payload | Untrusted; Zod schema InviteUserSchema gates email/displayName/role |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-04-01 | Spoofing | Non-admin invokes inviteUser via direct fetch | mitigate | requireAdmin() at top of Server Action; redirect to /unauthorized if not admin |
| T-02-04-02 | Tampering | Cloud Function 2 self-write loop | mitigate | onlyAllowedStaffChanged guard per RESEARCH P5; before/after diff minus allowedStaff |
| T-02-04-03 | Tampering | inviteUser writes users/{uid} with role=admin without verification | mitigate | requireAdmin() at top; only existing admins can mint new admins |
| T-02-04-04 | Repudiation | User role change not logged | mitigate | users/{uid}.update writes updatedBy=session.uid + updatedAt=serverTimestamp; Cloud Function 1 emits log line on every fire (Firebase Functions Logs in Console) |
| T-02-04-05 | Information disclosure | Reset link logged to client | mitigate | resetLink is returned via Server Action response (HTTPS); admin sees it in UI; never logged to console |
| T-02-04-06 | Information disclosure | generatePasswordResetLink leaks user existence | accept | Reset link generation requires admin; admins are trusted in our threat model. Public-facing /forgot-password (Plan 02-03) handles enumeration with generic copy. |
| T-02-04-07 | Information disclosure | Cloud Function 2 reads admin users list | accept | adminUids are queried by Cloud Function to populate allowedStaff; data is internal to functions runtime — never sent to clients |
| T-02-04-08 | DoS | onUserRoleChange recomputes ALL events on admin promotion | accept | Per RESEARCH §2.4 performance note: 100+ events = ~$0.0006 per promotion. Acceptable at D-16 scale. |
| T-02-04-09 | DoS | Rate-limit on setCustomUserClaims | mitigate | Function 1 skips if existing claims match; RESEARCH P6 |
| T-02-04-10 | Elevation of privilege | Last admin demotes self | mitigate | setUserRole refuses if demoting self while last admin (count check inside action) |
| T-02-04-11 | Elevation of privilege | Self-disable | mitigate | disableUser refuses if uid === session.uid and disabled === true |
| T-02-04-12 | Tampering | Client-side TanStack table state allows skipping role check | accept | TanStack table is presentation-only; all writes go through Server Actions which gate on requireAdmin |
| T-02-04-13 | Information disclosure | Disabled-user sessions linger up to ID-token TTL | mitigate | revokeRefreshTokens in disableUser action; DAL re-checks revocation via verifySessionCookie(cookie, true); AUTH-09 |
</threat_model>

<verification>
- `functions/` is a valid Firebase Functions package (package.json + tsconfig.json + .gitignore + src/index.ts).
- `functions/package.json` contains NO `serve` script and NO `emulators` reference (D-04 enforcement at codebase level, not just by convention).
- Cloud Function 1 (`onUserWriteSetClaims`) compiled and deployed; tested manually via Task 7 step B.
- Cloud Function 2 (allowedStaff sync) — 2 trigger registrations (`onEventTeamChange` + `onUserRoleChange`) sharing `recomputeForEvent()` — compiled and deployed; self-write loop guard verified by inspecting source.
- `app/(app)/users/actions.ts` exports `inviteUser`, `setUserRole`, `disableUser`. Each calls `requireAdmin()` at the top.
- `inviteUser` returns `{ok: true, uid, resetLink}` on success; `{ok: false, error}` (with optional `errors` for Zod fail) otherwise.
- Each Server Action calls `revalidatePath("/users")`.
- `lib/data/users.server.ts` cursor-paginated and server-only.
- `lib/hooks/use-users-live.ts` scopes onSnapshot to 50-row window per D-20.
- /users page Server Component → seed → Client onSnapshot pattern verified.
- All 4 user-related Client Components (Sheet, Inline role select, Disable button, UsersTable) swapped from mock store to Server Actions + live hook.
- No `seedUsers.find(...)` calls remain in components/feature/users.
- `npm run build` exits 0.
- Manual rules audit for users + transactions completed; 6 test cases logged in CLAIM.md under `## Rules Audit — Block B`.
- Cloud Functions deployed to live project (firebase deploy --only functions).
</verification>

<success_criteria>
- AUTH-07 (invite + reset link displayed), AUTH-08 (role propagation via Cloud Function + revoke), AUTH-09 (disable + revoke + Firestore mirror), AUTH-10 (admin-only nav via DAL + Server Action gating) all functional.
- INT-04 (Server Actions verify session + role) satisfied for /users surface.
- NFR-06 (use server + verifySession) satisfied for /users actions.
- D-02 (refined): 2 logical functions delivered. Function 1 = onUserWriteSetClaims. Function 2 = allowedStaff sync, implemented as onEventTeamChange + onUserRoleChange trigger registrations sharing computeAllowedStaff(eventId) logic. See CONTEXT.md D-02 refinement.
- D-04 (no emulator suite) honored at codebase level: functions/package.json contains no `serve` / emulator script.
- D-09 Copy-link UI live and tested.
- Block B rules audit recorded.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-04-users-cloud-function-and-actions-SUMMARY.md` documenting:
- functions/ package structure + the 2 logical Cloud Functions (3 trigger registrations) deployed per refined D-02.
- 3 Server Actions + their auth gating.
- New helpers (lib/data/users.server.ts + lib/hooks/use-users-live.ts).
- Block B manual rules audit findings (6 test cases).
- End-to-end invite + role-change + disable test outcomes.
- Any anomalies (e.g., region mismatch, predeploy script issue).
The summary should be ≤ 120 lines.
</output>
