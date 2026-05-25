// AUTH-05 — Sign out clears the __session cookie + revokes refresh tokens
// (server-side) and redirects to /login.
//
// Flow:
//   1. POST /api/auth/logout — proxy.ts authMiddleware (logoutPath) clears
//      the __session cookie; our handler revokes refresh tokens for AUTH-09.
//   2. signOut(auth) — clears the Web SDK's in-memory user (onAuthStateChanged
//      subscribers receive null immediately, so useCurrentUser updates).
//   3. Hard nav to /login so proxy.ts re-evaluates with the cleared cookie
//      before any prefetch fires.
//
// Designed to render inside the UserMenu's DropdownMenu — see UserMenu.tsx.

"use client";

import { useTransition } from "react";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      // 1. Revoke server-side + clear cookie via proxy interception.
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Best-effort: even if the fetch fails the proxy clears the cookie
        // on a successful response; on outright network failure we still
        // proceed with the client-side signOut + redirect below so the user
        // isn't trapped in a half-authenticated state.
      }
      // 2. Sign out the Web SDK client (clears in-memory user so
      //    onAuthStateChanged emits null and useCurrentUser updates).
      try {
        await signOut(auth);
      } catch {
        // Best-effort; client-side signOut shouldn't fail unless auth
        // module is broken, in which case the hard nav still gets us out.
      }
      // 3. Hard nav so proxy.ts re-evaluates with the cleared cookie.
      window.location.assign("/login");
    });
  }

  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        handleSignOut();
      }}
      variant="destructive"
      disabled={pending}
    >
      <LogOut className="mr-2 size-4" />
      Sign out
    </DropdownMenuItem>
  );
}
