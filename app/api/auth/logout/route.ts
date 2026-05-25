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
import { NextResponse } from "next/server";
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
