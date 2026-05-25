// app/api/auth/expire-session/route.ts
// GET endpoint used by DAL.requireSession() to break the login↔dashboard
// loop when the server detects a revoked or invalid session.
//
// Why this path (and not /api/auth/logout)?
//   next-firebase-auth-edge's authMiddleware (configured in proxy.ts with
//   logoutPath: "/api/auth/logout") intercepts that path and short-circuits
//   downstream route handlers. So a GET to /api/auth/logout never reaches
//   our handler — the library handles it and returns its own response,
//   leaving the user stuck on the URL.
//
//   /api/auth/expire-session is NOT loginPath or logoutPath, so authMiddleware
//   just runs handleValidToken/handleInvalidToken and falls through to this
//   route handler.
//
// The handler clears the __session cookie via Set-Cookie Max-Age=0 BEFORE
// the 303 redirect, so the browser follows the redirect with no cookie and
// the proxy routes cleanly to /login.

import "server-only";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getTokens } from "next-firebase-auth-edge";
import { adminAuth } from "@/lib/firebase/admin";

const COOKIE_OPTS = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: "__session",
  cookieSignatureKeys: [
    process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!,
    process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!,
  ],
  serviceAccount: {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  },
};

export async function GET(request: NextRequest): Promise<Response> {
  const cookieStore = await cookies();

  // Defensively revoke refresh tokens (idempotent if Cloud Function 1 already did).
  try {
    const tokens = await getTokens(cookieStore, COOKIE_OPTS);
    if (tokens?.decodedToken?.uid) {
      await adminAuth.revokeRefreshTokens(tokens.decodedToken.uid);
    }
  } catch {
    // idempotent — clear cookie regardless
  }

  const reason = request.nextUrl.searchParams.get("reason");
  const url = new URL("/login", request.url);
  if (reason) url.searchParams.set("reason", reason);

  const response = NextResponse.redirect(url, 303);
  response.cookies.set("__session", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.USE_SECURE_COOKIES === "true",
  });
  return response;
}
