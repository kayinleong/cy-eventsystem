// login-server-action.spike.ts — browser-console snippet for Check 1.
//
// Paste the function block below into DevTools at http://localhost:3000/login
// after wiring proxy.ts. Then call `spikeLogin('test@example.com', '<password>')`.
//
// What this tests (Check 1 of the spike acceptance criteria):
//   - Firebase Web SDK signs in via email+password (AUTH-01).
//   - user.getIdToken() returns a fresh ID token.
//   - POST /api/auth/session with Authorization: Bearer <idToken> reaches the
//     authMiddleware-intercepted endpoint at the proxy layer.
//   - Response carries Set-Cookie: __session=...; HttpOnly; Path=/; Max-Age=432000
//     (5 days per AUTH-02).
//
// The actual login form for production lives in
// app/(auth)/login/_components/login-form.tsx and ships in plan 02-03. This
// file exists only as the canonical Check-1 snippet for reproducibility.
//
// File body is commented out so the TypeScript compiler does not complain about
// `document.cookie` (no DOM types in this context) and so accidental imports
// from app code do not pull in browser globals.

/*

// ===== PASTE INTO DEVTOOLS CONSOLE BELOW =====
async function spikeLogin(email, password) {
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js');
  const { getAuth, signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js');

  // Substitute your real values from .env.local (NEXT_PUBLIC_FIREBASE_*).
  // DO NOT paste sensitive private values here — only the public client config.
  const firebaseConfig = {
    apiKey: '<NEXT_PUBLIC_FIREBASE_API_KEY>',
    authDomain: '<NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN>',
    projectId: '<NEXT_PUBLIC_FIREBASE_PROJECT_ID>',
    storageBucket: '<NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET>',
    appId: '<NEXT_PUBLIC_FIREBASE_APP_ID>',
  };

  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // AUTH-01: email + password sign-in
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await cred.user.getIdToken();

  // Hit the loginPath; authMiddleware intercepts at the proxy layer and writes
  // the __session cookie before the route handler runs.
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });

  // PASS criteria:
  //   - res.ok === true (200 or 201)
  //   - Network panel shows Set-Cookie: __session=...; HttpOnly; Path=/; Max-Age=432000
  //   - document.cookie does NOT contain __session (HttpOnly hides it from JS — correct)
  console.log('login response status:', res.status);
  console.log('login response ok:', res.ok);
  console.log('document.cookie (should NOT contain __session, HttpOnly):', document.cookie);
  console.log('uid:', cred.user.uid);
  return res.ok;
}

// Usage:
//   await spikeLogin('test@example.com', '<your-test-user-password>');
// ===== END PASTE =====

*/

export {};
