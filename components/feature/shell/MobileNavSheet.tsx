// Mobile navigation drawer — shown via a hamburger trigger in the TopBar at
// breakpoints below md (the AppSidebar is hidden below md).
//
// UI-SPEC: "App shell" — bottom nav on <md (mobile). We use a Sheet for the
// mobile nav because it integrates cleanly with the top-bar pattern.
// AUTH-10: Users nav item is admin-only (same role gating as AppSidebar).

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  Package,
  Calendar,
  ScanLine,
  BarChart3,
  Truck,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/user";
import { LowStockBadge } from "@/components/layout/Nav";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: ReadonlyArray<UserRole>;
  // Optional broader prefix for active-state matching — see AppSidebar.tsx.
  matchPrefix?: string;
};

const items: ReadonlyArray<NavItem> = [
  { href: "/",              label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "staff"] },
  { href: "/inventory",     label: "Inventory", icon: Package,         roles: ["admin", "staff"] },
  { href: "/scan",          label: "Scan",      icon: ScanLine,        roles: ["admin", "staff"] },
  { href: "/events",        label: "Events",    icon: Calendar,        roles: ["admin", "staff"] },
  { href: "/reports/stock", label: "Reports",   icon: BarChart3,       roles: ["admin", "staff"], matchPrefix: "/reports" },
  { href: "/delivery-orders", label: "Delivery Orders", icon: Truck,   roles: ["admin"] }, // quick-kayinleong-001
  { href: "/users",         label: "Users",     icon: Users,           roles: ["admin"] }, // AUTH-10
  { href: "/settings",      label: "Settings",  icon: Settings,        roles: ["admin", "staff"] },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function MobileNavSheet({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <SheetHeader className="px-4 py-5 border-b">
          <SheetTitle>cy-eventsystem</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3">
          {items
            .filter((i) => i.roles.includes(role))
            .map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                  {/* RP-03 — surface low-stock badge next to Reports nav item. */}
                  {item.href === "/reports/stock" ? <LowStockBadge /> : null}
                </Link>
              );
            })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
