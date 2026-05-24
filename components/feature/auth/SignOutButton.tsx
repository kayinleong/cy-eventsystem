// AUTH-05 — Sign out clears the mock_session cookie and redirects to /login.
//
// Designed to render inside the UserMenu's DropdownMenu — see UserMenu.tsx.
// Phase 2: swaps `clearMockSessionClient` for a POST to /api/auth/logout that
// revokes the Firebase session and clears the httpOnly __session cookie.

"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { clearMockSessionClient } from "@/lib/mock/cookie";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton() {
  const router = useRouter();

  function signOut() {
    clearMockSessionClient();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenuItem
      onClick={signOut}
      variant="destructive"
    >
      <LogOut className="mr-2 size-4" />
      Sign out
    </DropdownMenuItem>
  );
}
