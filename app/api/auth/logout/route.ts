// app/api/auth/logout/route.ts
// POST → revoke refresh tokens (AUTH-09) + cookie cleared by proxy.
//
// next-firebase-auth-edge's authMiddleware (configured in /proxy.ts with
// logoutPath: "/api/auth/logout") clears the __session cookie. It does
// NOT revoke refresh tokens — that's our responsibility for AUTH-09.
//
// authMiddleware intercepts THIS path AFTER calling our handler? No — it
// intercepts BEFORE Next routes to this handler. So by the time this code
// runs, the proxy has already cleared the cookie on the response. We
// decode the auth-edge envelope from the ORIGINAL request cookies (which
// the proxy left intact on the request object) to learn the uid, then
// revoke. If decode fails, we still return 204 so the client sees a
// successful logout (cookie is already cleared by the proxy).

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

export async function POST(): Promise<Response> {
  const cookieStore = await cookies();

  try {
    const tokens = await getTokens(cookieStore, COOKIE_OPTS);
    if (tokens?.decodedToken?.uid) {
      // AUTH-09: invalidate all outstanding refresh tokens for this uid.
      // Effect: next time the auth-edge proxy tries to refresh this
      // session's ID token, it'll fail and the request will be redirected
      // to /login.
      await adminAuth.revokeRefreshTokens(tokens.decodedToken.uid);
    }
  } catch {
    // Decode failure or revoke RPC failure — the cookie is already cleared
    // by authMiddleware, so logout still appears successful from the
    // client's perspective. Stale refresh tokens (≤ 1h TTL) are the only
    // residual risk and they're handled by checkRevoked on the next request.
  }

  return new NextResponse(null, { status: 204 });
}

// GET /api/auth/logout — used by DAL.requireSession() to break the
// login↔dashboard loop when the server detects a revoked session.
//
// The auth-edge __session cookie's HMAC remains valid after revokeRefreshTokens
// (the proxy can't tell it apart from a fresh cookie without a Firebase
// round-trip). So if requireSession redirects to /login directly, the proxy
// sees the "valid" cookie and bounces the user back to / → infinite loop.
//
// This handler explicitly Set-Cookie's __session with Max-Age=0 BEFORE
// redirecting, so the next request carries no cookie and the proxy routes
// the user to /login cleanly.
export async function GET(request: NextRequest): Promise<Response> {
  const cookieStore = await cookies();

  try {
    const tokens = await getTokens(cookieStore, COOKIE_OPTS);
    if (tokens?.decodedToken?.uid) {
      await adminAuth.revokeRefreshTokens(tokens.decodedToken.uid);
    }
  } catch {
    // idempotent — proceed to clear cookie regardless
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
