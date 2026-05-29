// Persistent left sidebar — role-aware nav rail visible at md+ breakpoints.
//
// UI-SPEC: "App shell" (lines 158-164) — sidebar items: Dashboard / Inventory /
// Scan / Events / Reports / Users (admin) / Settings, plus icon mapping.
// PATTERNS: "Active-nav sidebar" (lines 856-903) — usePathname pattern.
// AUTH-10: the Users nav item is admin-only (filter at item level).
//
// Active-link logic:
//   - `/` (Dashboard) matches ONLY on `pathname === "/"` (avoid false-positive
//     active state on every sub-route).
//   - All other items match on equality OR startsWith(`href/`) so
//     `/inventory/abc` activates the Inventory item.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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

import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/user";
import { LowStockBadge } from "@/components/layout/Nav";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: ReadonlyArray<UserRole>;
  // Optional broader prefix for active-state matching when the href points
  // at a sub-route. E.g. Reports' href is /reports/stock (the default tab)
  // but the item should highlight on any /reports/* page.
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

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar shrink-0">
      <div className="px-4 py-5 border-b">
        <Link href="/" className="text-base font-semibold">
          cy-eventsystem
        </Link>
      </div>
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
    </aside>
  );
}
