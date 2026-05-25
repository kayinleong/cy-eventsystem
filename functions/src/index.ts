// functions/src/index.ts
// Re-exports all trigger registrations for the 2 logical Cloud Functions per refined D-02:
//  - Function 1: onUserWriteSetClaims (1 trigger)
//  - Function 2 (allowedStaff sync): onEventTeamChange + onUserRoleChange (2 triggers, shared logic)
//
// See CONTEXT.md "D-02 (refined during planning, 2026-05-25)" for rationale.

export { onUserWriteSetClaims } from "./setCustomUserClaims";
export { onEventTeamChange, onUserRoleChange } from "./syncAllowedStaff";
