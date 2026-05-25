// scripts/repair-admin-claims.ts
//
// Diagnoses and repairs Firebase Auth custom claims for an admin user.
// Use when:
// - Firestore returns `permission-denied` on collection-list queries (users/inventory/etc)
//   even though the user signed in as admin
// - The seed-first-admin script ran but the user's claims may not have propagated
//
// Run:
//   npm run repair:admin-claims -- <email>
//
// What it does:
// 1. Looks up the user by email (no PII printed beyond email + redacted uid)
// 2. Inspects current customClaims
// 3. If `role !== 'admin'`, sets it
// 4. Cross-checks with the Firestore users/{uid} doc — they must agree
// 5. Reports whether the user needs to sign out + sign in to refresh their token

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run repair:admin-claims -- <email>");
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !rawPrivateKey) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in env");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
    }),
  });
}

async function main() {
  const auth = getAuth();
  const db = getFirestore();

  console.log(`\nDiagnosing claims for: ${email}`);
  console.log("─".repeat(60));

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (err) {
    console.error(`✗ User not found in Firebase Auth: ${email}`);
    console.error(`  (${(err as Error).message})`);
    process.exit(1);
  }

  const uidShort = `${user.uid.slice(0, 6)}...${user.uid.slice(-3)}`;
  console.log(`Found user (uid=${uidShort})`);
  console.log(`  disabled: ${user.disabled}`);
  console.log(`  emailVerified: ${user.emailVerified}`);
  console.log(`  customClaims (Auth): ${JSON.stringify(user.customClaims ?? null)}`);

  const docSnap = await db.collection("users").doc(user.uid).get();
  if (!docSnap.exists) {
    console.log(`  users/${uidShort} doc: MISSING in Firestore`);
  } else {
    const data = docSnap.data();
    console.log(`  users/${uidShort} doc: role=${data?.role}, disabled=${data?.disabled}`);
  }

  const authRole = (user.customClaims as { role?: string } | undefined)?.role;
  const docRole = docSnap.data()?.role;

  console.log("─".repeat(60));

  // Diagnose + repair
  if (authRole === "admin") {
    console.log("✓ Auth custom claim already has role=admin");
    if (docRole === "admin") {
      console.log("✓ Firestore users doc agrees (role=admin)");
      console.log("\nNo repair needed.");
      console.log("If you still see permission-denied errors:");
      console.log("  → Your browser's ID token may be stale (issued BEFORE the claim was set).");
      console.log("  → Sign out and sign back in to refresh the token.");
      console.log("  → OR in browser devtools: firebase.auth().currentUser.getIdToken(true)");
    } else {
      console.log(`⚠ Mismatch: Auth says role=admin, Firestore doc says role=${docRole ?? "(missing)"}`);
      console.log("  → Investigate Cloud Function 1 (onUserWriteSetClaims) — it should keep them in sync.");
    }
  } else {
    console.log(`⚠ Auth custom claim is missing or wrong: role=${authRole ?? "(unset)"}`);

    if (docRole === "admin") {
      console.log("  → Firestore users doc says role=admin. Setting custom claim to match...");
    } else {
      console.log(`  → Firestore users doc says role=${docRole ?? "(missing)"}.`);
      console.log("  → If this user should be admin, run seed-first-admin again, OR repair below.");
    }

    // Repair: set role=admin claim
    await auth.setCustomUserClaims(user.uid, { role: "admin" });

    // Ensure Firestore doc agrees
    if (!docSnap.exists || docRole !== "admin") {
      await db.collection("users").doc(user.uid).set(
        {
          uid: user.uid,
          email,
          displayName: user.displayName ?? "Admin",
          role: "admin",
          disabled: user.disabled,
        },
        { merge: true },
      );
      console.log("  → Wrote users doc with role=admin");
    }

    console.log("✓ Set Auth custom claim: { role: \"admin\" }");
    console.log("\nNEXT STEP — the user must refresh their ID token:");
    console.log("  → Sign out of the app, then sign back in.");
    console.log("  → New token will carry the role=admin claim.");
    console.log("  → Then retry the Firestore-backed page (e.g., /users).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
