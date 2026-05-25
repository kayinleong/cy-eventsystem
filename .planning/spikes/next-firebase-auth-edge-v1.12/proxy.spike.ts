// proxy.spike.ts — copy to repo-root /proxy.ts during the spike.
// NEVER imported by app code. DELETE after the spike completes.
//
// References:
// - 02-RESEARCH.md §1.4 (Block A Foundation — auth-edge setup, lines 218-285)
// - 02-PATTERNS.md §4 excerpt E (proxy.ts shape)
// - 02-CONTEXT.md decision D-01 (this spike gates Block A)
// - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//   * Function MUST be named `proxy` (or default export); no `runtime` config
//     allowed (Node-only in Next 16).
//
// What this verifies (per acceptance criteria in README.md):
//   - authMiddleware accepts our config object shape
//   - matcher excludes static + image-opt routes
//   - handleValidToken returns NextResponse.next() so requests pass through
//   - handleInvalidToken redirects anon users to /login
//   - cookieName: "__session" + httpOnly + sameSite: lax are honored
//
// This file does NOT itself test cookie creation — that happens via the POST to
// `loginPath` (`/api/auth/session`), which authMiddleware intercepts before any
// route handler runs.

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
      maxAge: 5 * 24 * 60 * 60, // AUTH-02: 5-day expiry per Phase 2 contract
    },
    serviceAccount: {
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      // Firebase Admin SDK quirk: literal "\n" sequences in env-var values
      // must be unescaped to real newlines before parsing the private key.
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    },
    handleValidToken: async (_data, headers) => {
      // Authenticated user landing on a public path → redirect to home.
      if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
        return redirectToHome(request);
      }
      // Otherwise let the request through with the augmented headers.
      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () => {
      // Anonymous or token-invalid → /login. Public paths are exempt.
      return redirectToLogin(request, {
        path: "/login",
        publicPaths: PUBLIC_PATHS,
      });
    },
    handleError: async (error) => {
      // Log the error object only, NOT the cookie value (T-02-01-04
      // information-disclosure mitigation).
      console.error("[spike proxy error]", error);
      return redirectToLogin(request, {
        path: "/login",
        publicPaths: PUBLIC_PATHS,
      });
    },
  });
}

export const config = {
  matcher: [
    // Auth endpoints must be in the matcher so authMiddleware can intercept the
    // POST to loginPath / logoutPath and set/clear the cookie before the route
    // handler runs.
    "/api/auth/:path*",
    // All app routes except static + image opt + favicon + PWA metadata files.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt).*)",
  ],
};
