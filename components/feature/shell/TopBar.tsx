// App shell top bar — sticky header rendering breadcrumbs, mobile-nav trigger,
// and the user menu.
//
// UI-SPEC: "App shell" — top bar with breadcrumbs left, user menu right; mobile
// hamburger replaces the sidebar at <md. Backdrop-filter blur gives the
// scrolled-content feel without being noisy.
//
// This component itself is server-friendly (no `'use client'` directive),
// but its children (Breadcrumbs, MobileNavSheet, UserMenu) are Client
// Components. The boundary between them is fine — server parents can render
// client children.

import { Breadcrumbs } from "./Breadcrumbs";
import { MobileNavSheet } from "./MobileNavSheet";
import { UserMenu } from "./UserMenu";
import type { Session } from "@/lib/types/session";

export function TopBar({ session }: { session: Session }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-3 max-w-[1400px] mx-auto px-4 md:px-6">
        <MobileNavSheet role={session.role} />
        <div className="flex-1 min-w-0">
          <Breadcrumbs />
        </div>
        <UserMenu session={session} />
      </div>
    </header>
  );
}
