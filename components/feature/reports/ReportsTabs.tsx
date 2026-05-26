// Phase 2 — Cross-report tab navigation.
//
// Rendered inside app/(app)/reports/layout.tsx so every /reports/* page
// shows the same 5-tab strip. Active tab derived from current pathname.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const REPORTS = [
  { href: "/reports/stock", label: "Stock" },
  { href: "/reports/out", label: "Items out" },
  { href: "/reports/history", label: "History" },
  { href: "/reports/missing", label: "Missing" },
  { href: "/reports/repurchase", label: "Repurchase" },
] as const;

export function ReportsTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Reports navigation"
      className="border-b border-border"
    >
      <ul className="flex gap-1 -mb-px overflow-x-auto">
        {REPORTS.map((r) => {
          const active = pathname === r.href || pathname.startsWith(`${r.href}/`);
          return (
            <li key={r.href}>
              <Link
                href={r.href}
                className={cn(
                  "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {r.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
