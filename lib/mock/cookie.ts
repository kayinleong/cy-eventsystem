// Phase 1 mock-session cookie helpers (CONTEXT.md D-05).
//
// SECURITY POSTURE (T-02-01, INTENTIONAL):
// The Phase 1 `mock_session` cookie is **non-httpOnly** so the client-side
// role switcher (PhaseOnePocRoleSwitcher.tsx) can read it via document.cookie.
// This is acceptable in Phase 1 because:
//   - There is NO backend persistence.
//   - There are NO real secrets or user PII in the cookie payload.
//   - Tampering only produces UI states that visibly drift from the seed.
//   - The cookie shape deliberately mirrors Phase 2's `__session` so the
//     role-gate decoder is the only thing that swaps in Phase 2.
//
// Phase 2 replaces this file wholesale with a Firebase session cookie
// (httpOnly, signed, server-revocable).
//
// USAGE
// - Server contexts (Server Components, Server Actions, Route Handlers):
//     await readMockSessionServer() / await setMockSessionServer(s) / await clearMockSessionServer()
// - Client contexts (event handlers, "use client" components):
//     readMockSessionClient() / writeMockSessionClient(s) / clearMockSessionClient()
//
// The dynamic `import("next/headers")` keeps this module importable from
// client bundles (the server function is never invoked client-side). Same
// module → same import in both contexts.

import type { Session } from "@/lib/types/session";

// ============================================================
// SERVER helpers (Server Components / Server Actions / Route Handlers).
// `cookies()` is the Next 16 async API.
// ============================================================

export async function setMockSessionServer(session: Session): Promise<void> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set("mock_session", JSON.stringify(session), {
    httpOnly: false, // CONTEXT.md D-05 — intentional; see header comment.
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day
  });
}

export async function clearMockSessionServer(): Promise<void> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set("mock_session", "", { maxAge: 0, path: "/" });
}

export async function readMockSessionServer(): Promise<Session | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const raw = jar.get("mock_session")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

// ============================================================
// CLIENT helpers (use in "use client" components — event handlers, the
// PhaseOnePocRoleSwitcher, login form submit handler).
// ============================================================

export function writeMockSessionClient(session: Session): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(session));
  document.cookie = `mock_session=${value}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
}

export function clearMockSessionClient(): void {
  if (typeof document === "undefined") return;
  document.cookie = "mock_session=; path=/; max-age=0; samesite=lax";
}

export function readMockSessionClient(): Session | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )mock_session=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as Session;
  } catch {
    return null;
  }
}
