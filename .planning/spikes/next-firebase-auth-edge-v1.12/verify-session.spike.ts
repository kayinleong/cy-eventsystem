// verify-session.spike.ts — DELETE after the spike completes (or keep as a
// debugging helper if FINDINGS.md says so; the npm script will remain pointed
// at this file).
//
// Usage (via npm script, recommended — auto-loads .env.local):
//   npm run spike:verify-session "<paste-cookie-value-here>"
//
// Direct invocation:
//   npx tsx --env-file=.env.local .planning/spikes/next-firebase-auth-edge-v1.12/verify-session.spike.ts "<cookie>"
//
// What this tests (Check 4 + Check 6 of the spike acceptance criteria):
//   - Admin SDK can be initialized from FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL
//     + FIREBASE_PRIVATE_KEY env vars.
//   - admin.auth().verifySessionCookie(cookie, true) decodes the session and
//     enforces revocation. The `true` second arg is the AUTH-09 revocation gate.
//   - Decoded claims contain {uid, email, auth_time, exp}. `role` may or may not
//     be present (Cloud Function in 02-04 sets it; manual test user has no role).
//
// Output is logged once. We do NOT log the cookie value back — only the decoded
// claims (CLAUDE.md secrets hygiene: never echo session cookies). We also do not
// log raw error messages from Firebase that may include token fragments; only
// the error code.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "ERROR: missing Firebase env vars.\n" +
        "  FIREBASE_PROJECT_ID: " + (projectId ? "set" : "MISSING") + "\n" +
        "  FIREBASE_CLIENT_EMAIL: " + (clientEmail ? "set" : "MISSING") + "\n" +
        "  FIREBASE_PRIVATE_KEY: " + (privateKey ? "set" : "MISSING") + "\n" +
        "Populate .env.local from .env.example and re-run via 'npm run spike:verify-session'."
    );
    process.exit(3);
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const cookie = process.argv[2];
if (!cookie) {
  console.error("Usage: npm run spike:verify-session \"<session-cookie-value>\"");
  console.error("Get the cookie from DevTools → Application → Cookies → __session.");
  process.exit(1);
}

getAuth()
  .verifySessionCookie(cookie, /* checkRevoked */ true)
  .then((decoded) => {
    // Print only the safe subset — never the raw decoded token (it includes the
    // full JWT structure).
    console.log(
      "DECODED: " +
        JSON.stringify(
          {
            uid: decoded.uid,
            email: decoded.email ?? "(no email claim)",
            role: (decoded.role as string | undefined) ?? "(no role claim)",
            auth_time: decoded.auth_time,
            exp: decoded.exp,
            iss: decoded.iss,
          },
          null,
          2,
        ),
    );
    process.exit(0);
  })
  .catch((err: { code?: string; message?: string }) => {
    // Print the error code only. AUTH-09 revocation surfaces as
    // "auth/user-disabled" or "auth/session-cookie-revoked" — both are PASS for
    // Check 6 of the spike.
    console.error("VERIFY FAILED: " + (err.code ?? err.message ?? "unknown"));
    process.exit(2);
  });
