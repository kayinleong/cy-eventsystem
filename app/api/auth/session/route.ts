// app/api/auth/session/route.ts
// PROCEED_AS_PLANNED variant per spike FINDINGS A1.
//
// `next-firebase-auth-edge`'s authMiddleware (configured in /proxy.ts with
// loginPath: "/api/auth/session") intercepts the POST request BEFORE
// Next.js routes it here — so this route handler effectively never runs
// when the proxy is active. We still ship the file so:
//   1. Next.js route resolution recognises the path as valid.
//   2. If the proxy ever needs to be temporarily disabled for debugging,
//      the path returns 200 instead of 404.
//
// Real session minting (HMAC-signed cookie envelope) happens inside the
// proxy via authMiddleware. Do NOT add Admin SDK calls or
// createSessionCookie() here — that would shadow the proxy's logic and
// produce two divergent code paths.

import "server-only";
import { NextResponse } from "next/server";

export async function POST(): Promise<Response> {
  return NextResponse.json({ ok: true }, { status: 200 });
}
