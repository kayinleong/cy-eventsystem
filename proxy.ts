// proxy.ts — repo root. Next 16 renamed `middleware.ts` to `proxy.ts`.
// Node runtime by default; do NOT export `runtime` (Next 16 proxy is Node-only).
//
// Per spike FINDINGS.md PROCEED_AS_PLANNED verdict — direct port of
// proxy.spike.ts MINUS the sa.json/applicationDefault fallback used during
// the spike. Env-vars only. No `debug: true` (logs cookie payloads).
//
// authMiddleware intercepts POST /api/auth/session (loginPath) and
// POST /api/auth/logout (logoutPath) BEFORE Next routes the request, so
// the `app/api/auth/{session,logout}/route.ts` files are thin no-op
// stubs (see those files for explanation).

import { NextResponse, type NextRequest } from "next/server";
import {
  authMiddleware,
  redirectToHome,
  redirectToLogin,
} from "next-firebase-auth-edge";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/set-password"];

export async function proxy(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: "/api/auth/session",
    logoutPath: "/api/auth/logout",
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    cookieName: "__session",
    cookieSignatureKeys: [
      process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!,
      process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!,
    ],
    cookieSerializeOptions: {
      path: "/",
      httpOnly: true,
      secure: process.env.USE_SECURE_COOKIES === "true",
      sameSite: "lax" as const,
      maxAge: 5 * 24 * 60 * 60, // AUTH-02: 5-day expiry
    },
    serviceAccount: {
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      // Admin SDK quirk: env-var literal \n must be unescaped to real newlines.
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    },
    handleValidToken: async (_data, headers) => {
      // Authenticated user landing on a public path → redirect to home.
      if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
        return redirectToHome(request);
      }
      // Otherwise let the request through with the augmented headers
      // (next-firebase-auth-edge sets x-user-* headers internally).
      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () => {
      return redirectToLogin(request, {
        path: "/login",
        publicPaths: PUBLIC_PATHS,
      });
    },
    handleError: async (error) => {
      // Log the error object only, NOT the cookie value (T-02-01-04
      // information-disclosure mitigation).
      console.error("[auth proxy error]", error);
      return redirectToLogin(request, {
        path: "/login",
        publicPaths: PUBLIC_PATHS,
      });
    },
  });
}

export const config = {
  matcher: [
    // Auth endpoints in the matcher so authMiddleware can intercept the
    // POST to loginPath / logoutPath and set/clear the cookie before the
    // route handler runs.
    "/api/auth/:path*",
    // All app routes except static + image opt + favicon + PWA metadata.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt).*)",
  ],
};
