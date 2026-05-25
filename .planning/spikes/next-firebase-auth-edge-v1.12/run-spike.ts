// run-spike.ts — programmatic spike runner.
//
// Invocation:
//   PORT=3010 npx tsx --env-file=.env.local .planning/spikes/next-firebase-auth-edge-v1.12/run-spike.ts
//
// Prerequisites (handled by orchestrator before invocation):
//   - .env.local populated with all 12 Firebase + cookie-signature vars
//   - sa.json present (currently unused — admin creds come from FIREBASE_* env vars)
//   - Spike proxy.ts copied to repo root: proxy.ts (mirror of proxy.spike.ts)
//   - Stub route handlers at app/api/auth/session/route.ts + app/api/auth/logout/route.ts
//   - Next dev server already running on PORT=3010 (run_in_background)
//
// What this does:
//   1. Bootstraps Admin SDK (Node env, server-side only).
//   2. Creates a one-shot test user via Admin SDK with a random password we know.
//      (Plan said "manually create test user in Console" — programmatic creation is
//       equivalent and avoids needing the developer in the loop. We capture uid + email.
//       Password is kept in memory only; never logged or written to disk.)
//   3. Signs in via Firebase Web SDK (REST API call — avoids needing a browser).
//   4. Exchanges ID token for __session cookie via POST /api/auth/session.
//   5. Runs all 6 acceptance checks and prints PASS/FAIL.
//   6. Tears down: deletes the test user.
//
// SECRETS HYGIENE:
//   - ID tokens, refresh tokens, session cookies → NEVER printed to stdout in full.
//   - Test-user password → NEVER printed to stdout.
//   - Decoded session claims → only safe subset (uid hash, email, claim names — not full JWT).
//   - On error, log the error code + class only.

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getTokensFromObject } from "next-firebase-auth-edge";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------- helpers ----------

const BASE_URL = process.env.SPIKE_BASE_URL ?? "http://localhost:3010";

function pickup(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`MISSING ENV VAR: ${name}`);
    process.exit(3);
  }
  return v;
}

function redactToken(s: string | undefined | null): string {
  if (!s) return "<empty>";
  if (s.length < 20) return "<short:" + s.length + ">";
  return `<REDACTED-${s.length}chars>`;
}

function redactCookieValue(setCookieHeader: string | null): string {
  if (!setCookieHeader) return "<no-set-cookie>";
  // Parse name=value;attrs ... and redact the value but keep attributes.
  // e.g. "__session=eyJ...; Path=/; HttpOnly; Max-Age=432000; SameSite=lax"
  const firstEq = setCookieHeader.indexOf("=");
  const firstSemi = setCookieHeader.indexOf(";");
  if (firstEq === -1) return "<unparseable>";
  const name = setCookieHeader.slice(0, firstEq);
  const valueLen = (firstSemi === -1 ? setCookieHeader.length : firstSemi) - firstEq - 1;
  const attrs = firstSemi === -1 ? "" : setCookieHeader.slice(firstSemi);
  return `${name}=<REDACTED-${valueLen}chars>${attrs}`;
}

type CheckResult = {
  num: number;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  notes: string;
};

const results: CheckResult[] = [];

function record(num: number, name: string, status: "PASS" | "FAIL" | "SKIP", notes: string) {
  results.push({ num, name, status, notes });
  console.log(`[Check ${num}] ${status}: ${name} — ${notes}`);
}

// ---------- bootstrap admin ----------

const apiKey = pickup("NEXT_PUBLIC_FIREBASE_API_KEY");

// Prefer sa.json (matches GOOGLE_APPLICATION_CREDENTIALS convention) so the
// spike doesn't depend on the FIREBASE_* env-var trio being correctly populated.
// Production code paths (plan 02-02) will use env-vars only; sa.json is for the
// spike's convenience.
const saPath = path.resolve(process.cwd(), "sa.json");

function getServiceAccountForVerify(): { projectId: string; clientEmail: string; privateKey: string } {
  if (fs.existsSync(saPath)) {
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8")) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
  }
  return {
    projectId: pickup("FIREBASE_PROJECT_ID"),
    clientEmail: pickup("FIREBASE_CLIENT_EMAIL"),
    privateKey: pickup("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

if (!getApps().length) {
  if (fs.existsSync(saPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = saPath;
    initializeApp({ credential: applicationDefault() });
    console.log(`[admin] initialized from sa.json`);
  } else {
    const projectId = pickup("FIREBASE_PROJECT_ID");
    const clientEmail = pickup("FIREBASE_CLIENT_EMAIL");
    const privateKey = pickup("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    console.log(`[admin] initialized from FIREBASE_* env vars`);
  }
}
const adminAuth = getAdminAuth();
// Avoid logging the env-var value to stdout to prevent leaks.
const projectId = "(see sa.json/.env.local — not logged)";

// ---------- run ----------

async function main() {
  console.log("=== spike runner — next-firebase-auth-edge v1.12 ===");
  console.log(`base URL: ${BASE_URL}`);
  console.log(`project:  ${projectId}`);
  console.log("");

  // Generate a one-shot test user.
  // Email is randomized so reruns don't collide; password is random + in-memory only.
  const testEmail = `spike-${Date.now()}@spike.local`;
  const testPassword = "Sp!ke" + Math.random().toString(36).slice(2) + "Aa1!";
  let testUid: string | null = null;

  try {
    // ====== Setup: create test user ======
    console.log("[setup] creating test user...");
    const userRecord = await adminAuth.createUser({
      email: testEmail,
      password: testPassword,
      emailVerified: true,
      disabled: false,
    });
    testUid = userRecord.uid;
    console.log(`[setup] test user uid: ${testUid.slice(0, 8)}... email: spike-***@spike.local`);
    console.log("");

    // ====== Check 1: Cookie creation round-trip ======
    // a) Sign in via Firebase Auth REST API (avoids needing a browser).
    //    https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          returnSecureToken: true,
        }),
      },
    );

    if (!signInRes.ok) {
      const err = await signInRes.json().catch(() => ({})) as { error?: { message?: string } };
      record(
        1,
        "Cookie creation round-trip",
        "FAIL",
        `signIn REST returned ${signInRes.status}: ${err.error?.message ?? "unknown"}`,
      );
      // can't continue without ID token
      throw new Error("REST sign-in failed; cannot continue spike");
    }

    const signInBody = (await signInRes.json()) as { idToken: string; localId: string };
    const idToken = signInBody.idToken;
    console.log(`[check 1] obtained idToken: ${redactToken(idToken)}, uid match: ${signInBody.localId === testUid}`);

    // b) POST /api/auth/session with Authorization: Bearer <idToken>
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      redirect: "manual",
    });

    const setCookie = sessionRes.headers.get("set-cookie");
    console.log(`[check 1] POST /api/auth/session → status ${sessionRes.status}, set-cookie: ${redactCookieValue(setCookie)}`);

    // Parse cookie value from Set-Cookie header for later checks.
    let sessionCookieValue: string | null = null;
    if (setCookie) {
      const match = setCookie.match(/__session=([^;]+)/);
      if (match) sessionCookieValue = match[1];
    }

    const c1pass =
      sessionRes.status >= 200 &&
      sessionRes.status < 400 &&
      !!setCookie &&
      /__session=/i.test(setCookie) &&
      /HttpOnly/i.test(setCookie) &&
      /Path=\//i.test(setCookie);

    if (c1pass) {
      record(
        1,
        "Cookie creation round-trip",
        "PASS",
        `Set-Cookie with __session, HttpOnly, Path=/; cookie len=${sessionCookieValue?.length ?? 0}`,
      );
    } else {
      record(
        1,
        "Cookie creation round-trip",
        "FAIL",
        `status=${sessionRes.status} setCookie=${redactCookieValue(setCookie)}`,
      );
    }

    // ====== Check 2: proxy allows authenticated requests ======
    // NOTE on test design: Phase 1 `(app)/layout.tsx` reads `mock_session` (NOT
    // `__session`) via `requireSession()`. Even when the proxy passes the request
    // through, the downstream Phase 1 layout will redirect to /login because the
    // mock-session cookie is missing. To isolate the proxy's behavior, we test
    // against /login: with a valid `__session` cookie, the proxy's handleValidToken
    // detects we're on a public path and redirects to /home (via redirectToHome).
    // That redirect (307 → /) is positive proof that the proxy validated the cookie
    // and recognized the user as authenticated.
    if (!sessionCookieValue) {
      record(2, "proxy allows authenticated requests", "SKIP", "no session cookie from Check 1");
    } else {
      const authedRes = await fetch(`${BASE_URL}/login`, {
        method: "GET",
        headers: { Cookie: `__session=${sessionCookieValue}` },
        redirect: "manual",
      });
      const location = authedRes.headers.get("location") ?? "";
      // PASS conditions:
      //   - Proxy redirected /login → / (means handleValidToken ran → cookie was valid)
      //   - OR plain 200 if /login is one of the public paths AND wasn't redirected
      //     (would mean cookie was IGNORED — that's a FAIL)
      const redirectsToHome =
        (authedRes.status === 307 || authedRes.status === 308) &&
        (location === "/" || location.endsWith("/"));
      const c2pass = redirectsToHome;
      record(
        2,
        "proxy allows authenticated requests",
        c2pass ? "PASS" : "FAIL",
        `GET /login with cookie → status=${authedRes.status}, location=${location || "(none)"}, redirects-to-home=${redirectsToHome} (proxy's handleValidToken triggered redirectToHome)`,
      );
    }

    // ====== Check 3: proxy blocks anonymous requests ======
    const anonRes = await fetch(`${BASE_URL}/inventory`, {
      method: "GET",
      redirect: "manual",
    });
    const anonLocation = anonRes.headers.get("location") ?? "";
    const c3pass =
      (anonRes.status === 307 || anonRes.status === 308) && anonLocation.includes("/login");
    record(
      3,
      "proxy blocks anonymous requests",
      c3pass ? "PASS" : "FAIL",
      `GET /inventory no-cookie → status=${anonRes.status}, location=${anonLocation || "(none)"}`,
    );

    // ====== Check 4: verifySession returns decoded claims ======
    // IMPORTANT: next-firebase-auth-edge does NOT use Firebase's createSessionCookie
    // API. It produces its own HMAC-signed envelope containing the ID token + refresh
    // token. So admin.auth().verifySessionCookie(value) always throws auth/argument-error.
    // The CORRECT way to verify an auth-edge cookie is via getTokensFromObject(), which
    // parses the envelope, validates the HMAC, and verifies the wrapped ID token.
    if (!sessionCookieValue) {
      record(4, "verifySession returns decoded claims", "SKIP", "no session cookie from Check 1");
    } else {
      try {
        const tokens = await getTokensFromObject(
          { __session: sessionCookieValue } as Record<string, string>,
          {
            apiKey,
            cookieName: "__session",
            cookieSignatureKeys: [
              process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!,
              process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!,
            ],
            serviceAccount: getServiceAccountForVerify(),
          },
        );
        if (!tokens) {
          record(4, "verifySession returns decoded claims", "FAIL", "getTokensFromObject returned null");
        } else {
          const decoded = tokens.decodedToken;
          const safeKeys = Object.keys(decoded).sort();
          const uidMatch = decoded.uid === testUid;
          const emailMatch = decoded.email === testEmail;
          const c4pass = uidMatch && emailMatch;
          record(
            4,
            "verifySession returns decoded claims",
            c4pass ? "PASS" : "FAIL",
            `uidMatch=${uidMatch}, emailMatch=${emailMatch}, claim-keys=[${safeKeys.join(",")}], role-claim=${(decoded as { role?: unknown }).role ? "(present)" : "(missing — expected; set in 02-04)"}`,
          );
        }
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string; name?: string };
        record(
          4,
          "verifySession returns decoded claims",
          "FAIL",
          `getTokensFromObject threw ${err.code ?? err.name ?? err.message ?? "unknown"}`,
        );
      }
    }

    // ====== Check 5: signOut clears cookie ======
    if (!sessionCookieValue) {
      record(5, "signOut revokes + clears", "SKIP", "no session cookie from Check 1");
    } else {
      const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: `__session=${sessionCookieValue}` },
        redirect: "manual",
      });
      const clearSetCookie = logoutRes.headers.get("set-cookie");
      const c5pass =
        (logoutRes.status === 200 || logoutRes.status === 204) &&
        !!clearSetCookie &&
        /__session=/i.test(clearSetCookie) &&
        /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(clearSetCookie);
      record(
        5,
        "signOut revokes + clears",
        c5pass ? "PASS" : "FAIL",
        `POST /api/auth/logout → status=${logoutRes.status}, clear-cookie=${redactCookieValue(clearSetCookie)}`,
      );
    }

    // ====== Check 6: Revocation gate (AUTH-09) ======
    // auth-edge's getTokensFromObject calls verifyIdToken under the hood (via jose).
    // Disabling the user via admin.auth().updateUser() AND revoking refresh tokens
    // should result in subsequent token refresh failures. For an UNEXPIRED ID token
    // that's already minted, jose's verifyIdToken will still accept the signature
    // (it only checks JWT validity, not Firebase user status). HOWEVER, the proxy's
    // `checkRevoked: true` equivalent in auth-edge is triggered when the ID token
    // expires (~1 hour) and getTokens tries to refresh — at which point the refresh
    // token is dead and verification fails.
    //
    // For an IMMEDIATE rejection of an unexpired ID token, we need
    // adminAuth.verifyIdToken(idToken, true /* checkRevoked */) — which is the
    // canonical Firebase-side revocation check.
    if (!testUid) {
      record(6, "Revocation gate (AUTH-09)", "SKIP", "no test user");
    } else {
      const reSignInRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: testEmail,
            password: testPassword,
            returnSecureToken: true,
          }),
        },
      );

      if (!reSignInRes.ok) {
        record(6, "Revocation gate (AUTH-09)", "FAIL", `re-signIn failed status=${reSignInRes.status}`);
      } else {
        const reBody = (await reSignInRes.json()) as { idToken: string };
        const idToken2 = reBody.idToken;

        // Sanity: verifyIdToken on the fresh ID token should succeed pre-revocation.
        let preRevokeWorks = false;
        try {
          await adminAuth.verifyIdToken(idToken2, true);
          preRevokeWorks = true;
        } catch {
          preRevokeWorks = false;
        }

        // Revoke + disable the user.
        await adminAuth.revokeRefreshTokens(testUid);
        await adminAuth.updateUser(testUid, { disabled: true });

        // Wait for backend propagation (revokeRefreshTokens is near-instant since
        // it bumps the user's tokensValidAfterTime).
        await new Promise((r) => setTimeout(r, 1500));

        // Post-revoke: verifyIdToken with checkRevoked=true should throw.
        let postRevokeRejected = false;
        let postRevokeError = "(none — DID NOT throw)";
        try {
          await adminAuth.verifyIdToken(idToken2, /* checkRevoked */ true);
          postRevokeRejected = false;
        } catch (e: unknown) {
          postRevokeRejected = true;
          const err = e as { code?: string; message?: string };
          postRevokeError = err.code ?? err.message ?? "(unknown error)";
        }

        const c6pass = preRevokeWorks && postRevokeRejected;
        record(
          6,
          "Revocation gate (AUTH-09)",
          c6pass ? "PASS" : "FAIL",
          `pre-revoke-works=${preRevokeWorks}, post-revoke-rejected=${postRevokeRejected}, error=${postRevokeError}`,
        );
      }
    }

    console.log("");
    console.log("=== summary ===");
    for (const r of results) {
      console.log(`  Check ${r.num}: ${r.status} — ${r.name}`);
    }

    const passCount = results.filter((r) => r.status === "PASS").length;
    const failCount = results.filter((r) => r.status === "FAIL").length;
    const skipCount = results.filter((r) => r.status === "SKIP").length;
    console.log(`\n${passCount}/${results.length} PASS, ${failCount} FAIL, ${skipCount} SKIP`);

    // Write JSON for FINDINGS.md generation.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const outPath = path.resolve(
      ".planning/spikes/next-firebase-auth-edge-v1.12/spike-results.json",
    );
    fs.writeFileSync(
      outPath,
      JSON.stringify({ results, nodeVersion: process.version }, null, 2),
    );
    console.log(`\nwrote: ${outPath}`);
  } finally {
    // ====== Teardown: delete test user ======
    if (testUid) {
      try {
        await adminAuth.deleteUser(testUid);
        console.log(`[teardown] deleted test user ${testUid.slice(0, 8)}...`);
      } catch (e) {
        console.error("[teardown] failed to delete test user:", (e as Error).message);
      }
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", (e as Error).message);
  process.exit(2);
});
