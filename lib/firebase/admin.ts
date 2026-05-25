// lib/firebase/admin.ts
// Server-only Admin SDK singleton. PITFALLS C6 — must be server-only.
// Plan 02-02 Correction 4 (FINDINGS A2): startup project-ID assertion catches
// credential mismatch immediately, before any server action runs.

import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

// Read each Admin-SDK env var via process.env and fail fast if any is missing.
// (requireEnv is a thin wrapper around process.env so the boot error names the
// missing var rather than a downstream "credential undefined" stack trace.)
const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
};

const projectId = process.env.FIREBASE_PROJECT_ID ?? requireEnv("FIREBASE_PROJECT_ID");
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? requireEnv("FIREBASE_CLIENT_EMAIL");
// FIREBASE_PRIVATE_KEY is stored double-quoted with literal \n escapes
// in .env.local; unescape to real newlines at runtime.
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY ?? requireEnv("FIREBASE_PRIVATE_KEY");
const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
  requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");

const app: App =
  getApps()[0] ??
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId, // surface on app.options for diagnostics + downstream consistency
    storageBucket,
  });

// FINDINGS A2 told us to catch credential mismatch early. The original
// `app.options.projectId !== projectId` check is unsafe: Firebase Admin SDK
// does NOT auto-populate options.projectId from the cert credential
// (verified empirically — it stays `undefined`). We now pass `projectId`
// explicitly to initializeApp above, so `app.options.projectId` is a
// reliable echo. The FINDINGS A2 root cause (mismatched private key vs
// clientEmail in .env.local producing `invalid_grant: account not found`)
// surfaces on the first authenticated RPC, not at boot — there is no
// cheap synchronous boot check that catches it.
if (app.options.projectId && app.options.projectId !== projectId) {
  throw new Error(
    `Firebase project ID mismatch: app initialized with ${app.options.projectId}, env says ${projectId}`,
  );
}

const adminAuth: Auth = getAuth(app);
const adminDb: Firestore = getFirestore(app);
const adminStorage: Storage = getStorage(app);

export { app as adminApp, adminAuth, adminDb, adminStorage };
