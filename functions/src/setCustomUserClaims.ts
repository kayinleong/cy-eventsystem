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
  },
);
