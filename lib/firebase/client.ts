// lib/firebase/client.ts
// Web SDK singleton. Imported by Client Components and the client login flow.
// D-19: persistent IndexedDB cache enabled globally so reads work offline.
//
// CRITICAL: Use initializeFirestore + persistentLocalCache (NOT
// enableIndexedDbPersistence — that API was deprecated in firebase ^10).
// Same effect, modern API.
//
// DO NOT add `import "server-only"` here — this file is imported by Client
// Components (login form, scanner, etc.).

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

// Single-tab manager: 20x faster query path per upstream Firestore issue #7347.
// Multi-tab caveat: opening the app in a second tab falls back to memory-only.
// Acceptable for v1 sole-developer / single-user workflow (RESEARCH §1.2).
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({}),
  }),
});

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
