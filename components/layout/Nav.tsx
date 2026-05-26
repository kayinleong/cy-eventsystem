// Phase 2 nav-rail low-stock badge — Block G (plan 02-10).
//
// REQUIREMENTS.md RP-03 — surface low-stock count next to the Reports nav
// item so the user notices items below threshold from any page.
//
// Implementation per RESEARCH §7.4 + plan 02-10 Task 4 Option A:
//   - useInventoryLive scoped to {isLowStock: true, limit: 50} (D-20
//     listener window). One subscription per LowStockBadge mount —
//     shared between AppSidebar and MobileNavSheet via this component.
//   - Badge renders only when count > 0. "50+" if the listener window
//     is saturated (rare in normal operation; matches D-20 cap).
//   - Why useInventoryLive over getCountFromServer: the AppSidebar is
//     already a Client Component (usePathname). Re-using the existing
//     live hook avoids a second Firestore round-trip per nav render
//     and gives the badge real-time updates without extra plumbing.

"use client";

import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
import { Badge } from "@/components/ui/badge";

/**
 * RP-03 — live low-stock count for the nav rail. Renders as a small
 * destructive badge; null when count is 0.
 */
export function LowStockBadge() {
  const items = useInventoryLive([], { isLowStock: true, limit: 50 });
  const count = items.length;
  if (count === 0) return null;
  return (
    <Badge variant="destructive" className="ml-auto">
      {count >= 50 ? "50+" : count}
    </Badge>
  );
}
