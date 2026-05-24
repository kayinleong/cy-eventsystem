// Top-bar breadcrumb trail — derived from usePathname segments.
//
// UI-SPEC: "App shell" — breadcrumbs (left), search (center), user menu (right).
// PATTERNS: lines 907-912 — usePathname → segments → shadcn breadcrumb block.
//
// Rendering rules:
//   - The first crumb is always "Dashboard" linking to "/".
//   - The last crumb is the current page (BreadcrumbPage — no link).
//   - Bracketed segments like `[itemId]` are unwrapped via humanize().
//   - On `/` itself we return null so the breadcrumb bar collapses cleanly.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function humanize(seg: string): string {
  return seg
    .replace(/^\[(.+)\]$/, "$1")
    .replace(/-/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((seg, idx) => {
          const href = "/" + segments.slice(0, idx + 1).join("/");
          const isLast = idx === segments.length - 1;
          return (
            <span key={href} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{humanize(seg)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{humanize(seg)}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
