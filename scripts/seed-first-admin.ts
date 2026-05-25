// scripts/seed-first-admin.ts
// One-time: creates the first admin user after Firebase project provision (D-05).
//
// Run:
//   npm run seed:first-admin -- <email> <displayName>
//
// Requires FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
// + NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in env. tsx is invoked with
// --env-file=.env.local in the npm script to load secrets.
//
// Safety rail (T-02-03-07 elevation-of-privilege mitigation):
//   - Refuses to run if the `users` collection is not empty.
//   - Use /users/invite (plan 02-09) to add additional admins after the
//     first one is seeded.
//
// The script does NOT set a password — it generates a Firebase password-reset
// link and prints it to stdout. Visit the link to set the first password
// (Firebase-hosted page, not /set-password). T-02-03-06 (don't log password).

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const email = process.argv[2];
const displayName = process.argv[3];

if (!email || !displayName) {
  console.error(
    "Usage: npm run seed:first-admin -- <email> <displayName>\n" +
      "Example: npm run seed:first-admin -- admin@example.com \"Admin Name\"",
  );
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!projectId || !clientEmail || !rawPrivateKey) {
  console.error(
    "Missing Admin SDK env vars. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, " +
      "and FIREBASE_PRIVATE_KEY in .env.local before running.",
  );
  process.exit(1);
}

const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
    storageBucket,
  });

const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  // Safety: refuse to run if any user already exists (prevents accidental
  // re-seed and self-elevation via re-creation with a known password).
  const existingUsersSnap = await db.collection("users").limit(1).get();
  if (!existingUsersSnap.empty) {
    console.error(
      "Refusing to seed: users collection is not empty.\n" +
        "Use /users/invite (plan 02-09 onward) to add additional users.\n" +
        "If you need to re-seed, manually delete the users collection in the Firebase Console first.",
    );
    process.exit(2);
  }

  // Idempotent against the Auth side: if a Firebase Auth user already
  // exists with this email but no Firestore doc, link them; otherwise
  // create a new Auth user.
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Found existing Auth user ${email} (uid: ${user.uid}); linking.`);
  } catch {
    user = await auth.createUser({
      email,
      displayName,
      emailVerified: true,
    });
    console.log(`Created Auth user ${email} (uid: ${user.uid}).`);
  }

  // Set role=admin custom claim. The Cloud Function (plan 02-04) will
  // overwrite this on the next users/{uid} write, but the doc-set below
  // writes role=admin so the function's mirror is a no-op.
  await auth.setCustomUserClaims(user.uid, { role: "admin" });

  // Write the users/{uid} document — the rules require this to exist for
  // any authenticated read (per the deny-by-default skeleton).
  await db.collection("users").doc(user.uid).set({
    uid: user.uid,
    email,
    displayName,
    role: "admin",
    disabled: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "seed-script",
    lastLoginAt: null,
  });

  // Generate a password-reset link so the admin can set their password.
  // Firebase also auto-sends a templated email when generatePasswordResetLink
  // is called from the Admin SDK; we print the link as a fallback for
  // localhost / no-email environments.
  const link = await auth.generatePasswordResetLink(email);

  console.log("\n=== FIRST ADMIN SEEDED ===");
  console.log("UID:        ", user.uid);
  console.log("Email:      ", email);
  console.log("DisplayName:", displayName);
  console.log("Role:        admin");
  console.log("\nNext step: visit the password-reset link below in a browser");
  console.log("to set your password, then sign in via /login.\n");
  console.log("Link:", link);
  console.log("\n(Firebase also sent a templated email; check your inbox.)");
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
